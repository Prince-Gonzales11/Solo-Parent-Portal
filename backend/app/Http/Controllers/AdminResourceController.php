<?php

namespace App\Http\Controllers;

use App\Models\ResourceItem;
use Illuminate\Http\Request;

class AdminResourceController extends Controller
{
    /**
     * List all resources.
     */
    public function index()
    {
        $items = ResourceItem::orderBy('display_order')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($items);
    }

    /**
     * Create a new resource.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'description'   => ['nullable', 'string', 'max:1000'],
            'file_type'     => ['required', 'string', 'max:50'],
            'url'           => ['required', 'string', 'url', 'max:2048'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'is_active'     => ['nullable', 'boolean'],
        ]);

        $item = ResourceItem::create([
            'name'          => $validated['name'],
            'description'   => $validated['description'] ?? null,
            'file_type'     => $validated['file_type'],
            'url'           => $validated['url'],
            'display_order' => $validated['display_order'] ?? 0,
            'is_active'     => $validated['is_active'] ?? true,
        ]);

        return response()->json($item, 201);
    }

    /**
     * Update an existing resource.
     */
    public function update(Request $request, string $id)
    {
        $item = ResourceItem::findOrFail($id);

        $validated = $request->validate([
            'name'          => ['sometimes', 'required', 'string', 'max:255'],
            'description'   => ['nullable', 'string', 'max:1000'],
            'file_type'     => ['sometimes', 'required', 'string', 'max:50'],
            'url'           => ['sometimes', 'required', 'string', 'url', 'max:2048'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'is_active'     => ['nullable', 'boolean'],
        ]);

        $item->update($validated);

        return response()->json($item);
    }

    /**
     * Delete a resource.
     */
    public function destroy(string $id)
    {
        $item = ResourceItem::findOrFail($id);
        $item->delete();

        return response()->json(['message' => 'Resource deleted.']);
    }
}
