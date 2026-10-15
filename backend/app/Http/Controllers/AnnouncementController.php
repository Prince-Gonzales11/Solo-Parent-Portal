<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AnnouncementController extends Controller
{
    /**
     * List all announcements (including unpublished) for admin management.
     */
    public function index()
    {
        return response()->json(
            Announcement::orderBy('created_at', 'desc')->get()
        );
    }

    /**
     * Create a new announcement.
     */
    public function store(Request $request)
    {
        $request->validate([
            'title'        => 'required|string|max:240',
            'body'         => 'required|string',
            'category'     => 'nullable|string|max:60',
            'is_published' => 'required|boolean',
        ]);

        $announcement = Announcement::create([
            'title'        => $request->title,
            'body'         => $request->body,
            'category'     => $request->category ?? 'general',
            'is_published' => $request->is_published,
            'published_at' => $request->is_published ? now() : null,
            'created_by'   => $request->user()->id,
        ]);

        Cache::forget('public_announcements_list');
        Cache::forget('public_landing_full_data');

        AuditLog::record($request, 'announcement.created', 'Announcement', $announcement->id, [
            'title' => $announcement->title,
        ]);

        return response()->json($announcement, 201);
    }

    /**
     * Update an existing announcement.
     */
    public function update($id, Request $request)
    {
        $announcement = Announcement::findOrFail($id);

        $request->validate([
            'title'        => 'required|string|max:240',
            'body'         => 'required|string',
            'category'     => 'nullable|string|max:60',
            'is_published' => 'required|boolean',
        ]);

        $old = $announcement->only(['title', 'is_published']);

        $announcement->update([
            'title'        => $request->title,
            'body'         => $request->body,
            'category'     => $request->category ?? $announcement->category,
            'is_published' => $request->is_published,
            'published_at' => $request->is_published && !$announcement->published_at
                ? now()
                : $announcement->published_at,
        ]);

        Cache::forget('public_announcements_list');
        Cache::forget('public_landing_full_data');

        AuditLog::record($request, 'announcement.updated', 'Announcement', $announcement->id, [
            'before' => $old,
            'after'  => $announcement->fresh()->only(['title', 'is_published']),
        ]);

        return response()->json($announcement->fresh());
    }

    /**
     * Delete an announcement.
     */
    public function destroy($id, Request $request)
    {
        $announcement = Announcement::findOrFail($id);

        AuditLog::record($request, 'announcement.deleted', 'Announcement', $announcement->id, [
            'title' => $announcement->title,
        ]);

        $announcement->delete();

        Cache::forget('public_announcements_list');
        Cache::forget('public_landing_full_data');

        return response()->json(['message' => 'Announcement deleted.']);
    }
}
