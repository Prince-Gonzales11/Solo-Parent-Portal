<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

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
        $category = Category::findOrFail($id);
        return response()->json($category);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:10|unique:categories,code',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'requirements' => 'required|array',
            'display_order' => 'required|integer',
            'is_active' => 'required|boolean',
        ]);

        $category = Category::create($validated);
        Cache::forget('public_categories_list');
        Cache::forget('public_landing_full_data');

        return response()->json($category, 201);
    }

    public function update(Request $request, $id)
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'code' => 'required|string|max:10|unique:categories,code,' . $category->id,
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'requirements' => 'required|array',
            'display_order' => 'required|integer',
            'is_active' => 'required|boolean',
        ]);

        $category->update($validated);
        Cache::forget('public_categories_list');
        Cache::forget('public_landing_full_data');

        return response()->json($category);
    }

    public function destroy($id)
    {
        $category = Category::findOrFail($id);
        $category->delete();
        Cache::forget('public_categories_list');
        Cache::forget('public_landing_full_data');

        return response()->json(['message' => 'Category deleted']);
    }
}
