<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Document;
use App\Models\DocumentaryRequirement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AdminCategoryController extends Controller
{
    public function index()
    {
        $categories = Category::with('requirements')
            ->withCount('applications')
            ->orderBy('display_order')
            ->orderBy('code')
            ->get();
        return response()->json($categories);
    }

    public function show($id)
    {
        $category = Category::with('requirements')->findOrFail($id);
        return response()->json($category);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:20|unique:solo_parent_categories,code',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'requirements' => 'nullable|array',
            'requirements.*.name' => 'required_with:requirements|string|max:255',
            'requirements.*.description' => 'nullable|string',
            'requirements.*.is_required' => 'nullable|boolean',
            'display_order' => 'required|integer',
            'is_active' => 'required|boolean',
        ]);

        $category = DB::transaction(function () use ($validated) {
            $categoryData = collect($validated)->except('requirements')->toArray();
            $category = Category::create($categoryData);

            if (!empty($validated['requirements'])) {
                foreach ($validated['requirements'] as $req) {
                    if (is_array($req) && !empty($req['name'])) {
                        DocumentaryRequirement::create([
                            'category_id' => $category->id,
                            'name' => trim($req['name']),
                            'description' => $req['description'] ?? null,
                            'is_required' => $req['is_required'] ?? true,
                        ]);
                    } elseif (is_string($req) && trim($req) !== '') {
                        DocumentaryRequirement::create([
                            'category_id' => $category->id,
                            'name' => trim($req),
                            'description' => null,
                            'is_required' => true,
                        ]);
                    }
                }
            }

            return $category->load('requirements');
        });

        Cache::forget('public_categories_list');
        Cache::forget('public_landing_full_data');

        return response()->json($category, 201);
    }

    public function update(Request $request, $id)
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'code' => 'required|string|max:20|unique:solo_parent_categories,code,' . $category->id,
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'requirements' => 'nullable|array',
            'requirements.*.name' => 'required_with:requirements|string|max:255',
            'requirements.*.description' => 'nullable|string',
            'requirements.*.is_required' => 'nullable|boolean',
            'display_order' => 'required|integer',
            'is_active' => 'required|boolean',
        ]);

        DB::transaction(function () use ($category, $validated) {
            $categoryData = collect($validated)->except('requirements')->toArray();
            $category->update($categoryData);

            if (isset($validated['requirements'])) {
                // Safeguard: Protect requirements that already have associated uploaded documents
                $existingReqIds = $category->requirements()->pluck('id');
                $reqIdsWithDocs = Document::whereIn('requirement_id', $existingReqIds)->pluck('requirement_id')->unique();

                // Delete only requirements that have no linked documents
                $category->requirements()->whereNotIn('id', $reqIdsWithDocs)->delete();

                foreach ($validated['requirements'] as $req) {
                    $reqName = is_array($req) ? ($req['name'] ?? '') : (is_string($req) ? $req : '');
                    if (trim($reqName) === '') {
                        continue;
                    }

                    $reqDesc = is_array($req) ? ($req['description'] ?? null) : null;
                    $isRequired = is_array($req) ? ($req['is_required'] ?? true) : true;
                    $reqId = is_array($req) ? ($req['id'] ?? null) : null;

                    if ($reqId && $reqIdsWithDocs->contains($reqId)) {
                        DocumentaryRequirement::where('id', $reqId)->update([
                            'name' => trim($reqName),
                            'description' => $reqDesc,
                            'is_required' => $isRequired,
                        ]);
                    } else {
                        DocumentaryRequirement::create([
                            'category_id' => $category->id,
                            'name' => trim($reqName),
                            'description' => $reqDesc,
                            'is_required' => $isRequired,
                        ]);
                    }
                }
            }
        });

        Cache::forget('public_categories_list');
        Cache::forget('public_landing_full_data');

        return response()->json($category->fresh('requirements'));
    }

    public function destroy($id)
    {
        $category = Category::findOrFail($id);

        // QA-P0-02 Safety Guard: Check if category is linked to existing applications
        if ($category->applications()->exists()) {
            return response()->json([
                'detail' => 'Cannot delete category because it is linked to existing applicant applications. You may deactivate it instead.',
            ], 422);
        }

        // Check if any requirements of this category have uploaded documents
        $hasDocuments = Document::whereIn('requirement_id', $category->requirements()->pluck('id'))->exists();
        if ($hasDocuments) {
            return response()->json([
                'detail' => 'Cannot delete category because its requirements have associated uploaded documentary records. You may deactivate it instead.',
            ], 422);
        }

        DB::transaction(function () use ($category) {
            $category->requirements()->delete();
            $category->delete();
        });

        Cache::forget('public_categories_list');
        Cache::forget('public_landing_full_data');

        return response()->json(['message' => 'Category deleted successfully']);
    }
}
