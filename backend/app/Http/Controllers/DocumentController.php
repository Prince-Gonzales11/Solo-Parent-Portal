<?php

namespace App\Http\Controllers;

use App\Models\ApplicantProfile;
use App\Models\Application;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Document;
use App\Models\DocumentaryRequirement;
use App\Models\Notification;
use App\Services\SupabaseStorageService;
use App\Services\StoragePathBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class DocumentController extends Controller
{
    // ── Constants ──────────────────────────────────────────────────────────
    const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/octet-stream',
        'application/zip',
    ];

    const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'doc'];

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    // Magic bytes for file signature validation
    const MAGIC_BYTES = [
        'pdf'  => '%PDF',
        'jpg'  => ["\xFF\xD8\xFF"],
        'jpeg' => ["\xFF\xD8\xFF"],
        'png'  => ["\x89PNG"],
        'docx' => ["PK\x03\x04"],
        'doc'  => ["\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"],
    ];

    // ═════════════════════════════════════════════════════════════════════
    //  USER ENDPOINTS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Return requirements for a category in canonical order (not random UUID order).
     */
    private function getCategoryRequirementsOrdered($category)
    {
        $catCode = strtoupper($category->code ?? '');
        $reqs = $category->requirements;

        if ($catCode === 'RENEWAL') {
            $order = [
                'affidavit of solo parent',
                'affidavit of barangay official',
                'income tax return',
                'original of solo parent id',
                '1x1 picture',
            ];
            return $reqs->sort(function ($a, $b) use ($order) {
                $posA = array_search(strtolower(trim($a->name)), $order);
                $posB = array_search(strtolower(trim($b->name)), $order);
                $posA = ($posA === false) ? 999 : $posA;
                $posB = ($posB === false) ? 999 : $posB;
                return $posA <=> $posB;
            })->values();
        }

        if ($catCode === 'LOSS_SPIC') {
            $order = [
                'affidavit of loss',
                '1x1 picture',
                'sworn affidavit',
                'affidavit of a barangay official',
            ];
            return $reqs->sort(function ($a, $b) use ($order) {
                $posA = array_search(strtolower(trim($a->name)), $order);
                $posB = array_search(strtolower(trim($b->name)), $order);
                $posA = ($posA === false) ? 999 : $posA;
                $posB = ($posB === false) ? 999 : $posB;
                return $posA <=> $posB;
            })->values();
        }

        return $reqs->sortBy([
            ['created_at', 'asc'],
            ['name', 'asc']
        ])->values();
    }

    /**
     * GET /documents/my
     * List all documents for the authenticated user.
     */
    public function myDocuments(Request $request)
    {
        $query = Document::where('user_id', $request->user()->id);
        if ($request->filled('application_id')) {
            $query->where('application_id', $request->application_id);
        }

        $docs = $query
            ->with(['requirement.category.requirements'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($doc) {
                // Bridge to the legacy format `doc_type` for the frontend
                $docArray = $doc->toArray();
                if ($doc->requirement && $doc->requirement->category) {
                    $category = $doc->requirement->category;
                    $catCode = $category->code;
                    $reqs = $this->getCategoryRequirementsOrdered($category);
                    $index = $reqs->search(fn($r) => $r->id === $doc->requirement_id);
                    if ($index !== false) {
                        $docArray['doc_type'] = "req_{$catCode}_{$index}";
                        $docArray['requirement_name'] = $doc->requirement->name;
                        $docArray['requirement_index'] = $index;
                    }
                }
                // Map review_status to verification_status for frontend compatibility
                $docArray['verification_status'] = $doc->review_status;
                $docArray['verification_remark'] = $doc->review_note;
                
                return $docArray;
            });

        return response()->json($docs);
    }

    /**
     * POST /documents/upload
     * Upload one or multiple documents for a specific requirement.
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file'              => 'nullable|file|max:20480', // 20MB
            'files'             => 'nullable|array',
            'files.*'           => 'file|max:20480',
            'doc_type'          => 'required|string|max:120',
            'requirement_id'    => 'nullable|string',
            'requirement_name'  => 'nullable|string|max:320',
            'requirement_index' => 'nullable|integer|min:0',
            'application_id'    => 'nullable|string',
            'label'             => 'nullable|string|max:320',
        ]);

        $user = $request->user();

        // ── Resolve uploaded files list ───────────────────────────────
        $uploadedFiles = [];
        if ($request->hasFile('files')) {
            $rawFiles = $request->file('files');
            $uploadedFiles = is_array($rawFiles) ? $rawFiles : [$rawFiles];
        } elseif ($request->hasFile('file')) {
            $uploadedFiles = [$request->file('file')];
        }

        if (empty($uploadedFiles)) {
            return response()->json(['detail' => 'Please select at least one file to upload.'], 422);
        }

        // ── Pre-validate all files upfront ────────────────────────────
        foreach ($uploadedFiles as $idx => $f) {
            $validationError = $this->validateFile($f);
            if ($validationError) {
                $filename = $f->getClientOriginalName() ?: ('File #' . ($idx + 1));
                return response()->json([
                    'detail' => "Validation failed for '{$filename}': {$validationError}"
                ], 422);
            }
        }

        // ── Resolve application ───────────────────────────────────────
        $applicationId = $request->application_id;
        if (!$applicationId) {
            // Try to find user's current editable application
            $app = Application::where('user_id', $user->id)
                ->whereIn('status', ['draft', 'requirements_submitted', 'qualified', 'for_document_correction'])
                ->orderBy('created_at', 'desc')
                ->first();
            $applicationId = $app?->id;
        } else {
            // Verify ownership
            $app = Application::where('id', $applicationId)
                ->where('user_id', $user->id)
                ->first();
            if (!$app) {
                return response()->json(['detail' => 'Application not found or not yours.'], 403);
            }
        }

        if (!$applicationId || !$app) {
            return response()->json(['detail' => 'You must start an application before uploading documents.'], 400);
        }

        // QA-P1-07: Enforce application lifecycle state - reject uploads on finalized/approved records
        $immutableStatuses = ['approved', 'ready_for_pickup', 'claimed', 'released', 'completed'];
        if (in_array($app->status, $immutableStatuses)) {
            return response()->json([
                'detail' => "This application is currently in '{$app->status}' status and cannot accept new document uploads.",
            ], 422);
        }

        // ── Resolve requirement id ───────────────────────────────────────────
        $requirementId = $request->requirement_id;
        $docType = $request->doc_type; // e.g. "req_A1_0"
        $catCode = null;
        $category = null;
        $index = null;

        if (preg_match('/^req_(.+)_(\d+)$/', $docType, $matches)) {
            $catCode = $matches[1];
            $index = (int) $matches[2];
            $category = Category::whereRaw('LOWER(code) = ?', [strtolower($catCode)])->first();
        }

        if (!$requirementId && $category) {
            // Match by requirement_name FIRST to avoid index or sort misalignment
            if ($request->requirement_name) {
                $reqByName = $category->requirements()
                    ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($request->requirement_name))])
                    ->first();
                $requirementId = $reqByName?->id;
            }
            if (!$requirementId) {
                $orderedReqs = $this->getCategoryRequirementsOrdered($category);
                if (isset($orderedReqs[$index])) {
                    $requirementId = $orderedReqs[$index]->id;
                }
            }
        }

        if (!$requirementId && $request->requirement_name && $app->category_id) {
            $appCat = Category::find($app->category_id);
            if ($appCat) {
                $reqByName = $appCat->requirements()
                    ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($request->requirement_name))])
                    ->first();
                $requirementId = $reqByName?->id;
            }
        }

        if (!$requirementId) {
            return response()->json(['detail' => 'Invalid document type or requirement not found.'], 400);
        }

        // QA-P2-05: Verify that the resolved requirement belongs to this application's category or is general
        if ($app->category_id) {
            $isValidReq = DocumentaryRequirement::where('id', $requirementId)
                ->where(function ($query) use ($app) {
                    $query->where('category_id', $app->category_id)
                          ->orWhereNull('category_id');
                })
                ->exists();

            if (!$isValidReq) {
                return response()->json([
                    'detail' => 'The specified documentary requirement does not belong to this application category.',
                ], 422);
            }
        }

        // ── Duplicate file prevention (exact same filename + size under same requirement) ───
        foreach ($uploadedFiles as $f) {
            $duplicate = Document::where('application_id', $applicationId)
                ->where('requirement_id', $requirementId)
                ->where('original_filename', $f->getClientOriginalName())
                ->where('file_size', $f->getSize())
                ->whereNotIn('review_status', ['replaced', 'rejected'])
                ->first();

            if ($duplicate) {
                return response()->json([
                    'detail' => "The file '{$f->getClientOriginalName()}' has already been uploaded for this requirement. Please choose a different file or rename it.",
                ], 409);
            }
        }

        // ── Process uploads to Supabase Storage & Database ───────────
        $appType = $app->application_type ?? 'new_id';
        $refNo = $app->reference_no ?? 'UNKNOWN';
        $requirementName = $request->requirement_name ?? 'Document';
        if ($requirementId) {
            $req = \App\Models\DocumentaryRequirement::find($requirementId);
            if ($req) $requirementName = $req->name;
        }

        $storage = app(SupabaseStorageService::class);
        $savedDocs = [];
        $uploadedPaths = [];

        try {
            foreach ($uploadedFiles as $file) {
                $ext = strtolower($file->getClientOriginalExtension());
                $docId = (string) Str::uuid();
                $sanitizedName = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
                $storedName = "{$docId}-{$sanitizedName}.{$ext}";

                $storagePath = StoragePathBuilder::buildTempPath($user->id, $appType, $refNo, $requirementName, $storedName);

                $storage->uploadTemporary(
                    $storagePath,
                    file_get_contents($file->getRealPath()),
                    $this->detectMimeType($file)
                );
                $uploadedPaths[] = $storagePath;

                $doc = new Document();
                $doc->id = $docId;
                $doc->user_id = $user->id;
                $doc->application_id = $applicationId;
                $doc->requirement_id = $requirementId;
                $doc->original_filename = $file->getClientOriginalName();
                $doc->storage_path = $storagePath;
                $doc->temporary_storage_path = $storagePath;
                $doc->storage_status = 'temporary';
                $doc->mime_type = $this->detectMimeType($file);
                $doc->file_size = $file->getSize();
                $doc->review_status = 'pending';
                $doc->save();

                AuditLog::record($request, 'document.uploaded', 'Document', $doc->id, [
                    'filename'         => $doc->original_filename,
                    'requirement_id'   => $doc->requirement_id,
                    'file_size'        => $doc->file_size,
                ]);

                $savedDocs[] = $doc;
            }
        } catch (\Exception $e) {
            // Clean up any successfully uploaded storage files and DB records on failure
            foreach ($uploadedPaths as $p) {
                try {
                    $storage->deleteTemporary($p);
                } catch (\Exception $cleanupEx) {
                    Log::warning('Failed to cleanup temp storage file', ['path' => $p, 'error' => $cleanupEx->getMessage()]);
                }
            }
            foreach ($savedDocs as $d) {
                try {
                    $d->delete();
                } catch (\Exception $dbEx) {}
            }
            Log::error('Document upload batch failed', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
            return response()->json([
                'detail' => 'We could not complete uploading the document attachment(s). Please try again.',
            ], 500);
        }

        // ── Format response for both single and multiple file consumers ────
        $mappedSavedDocs = collect($savedDocs)->map(function ($doc) use ($request, $requirementName) {
            $doc->load(['requirement.category']);
            $arr = $doc->toArray();
            $arr['doc_type'] = $request->doc_type;
            $arr['requirement_name'] = $doc->requirement?->name ?? $requirementName;
            $arr['verification_status'] = $doc->review_status;
            return $arr;
        })->values();

        $responsePayload = $mappedSavedDocs->first();
        $responsePayload['documents'] = $mappedSavedDocs->toArray();
        $responsePayload['uploaded_documents'] = $mappedSavedDocs->toArray();
        $responsePayload['count'] = count($mappedSavedDocs);

        return response()->json($responsePayload, 201);
    }

    /**
     * POST /documents/{id}/replace
     * Replace a rejected document with a new upload.
     */
    public function replace($id, Request $request)
    {
        $request->validate([
            'file' => 'required|file|max:20480',
        ]);

        $user = $request->user();
        $oldDoc = Document::find($id);
        if (!$oldDoc) {
            return response()->json(['detail' => 'Document not found.'], 404);
        }
        if ($oldDoc->user_id !== $user->id) {
            return response()->json(['detail' => 'Unauthorized action.'], 403);
        }

        // QA-P1-07: Reject replacement if application has reached finalized status
        $app = $oldDoc->application;
        if ($app && in_array($app->status, ['approved', 'ready_for_pickup', 'claimed', 'released', 'completed'])) {
            return response()->json([
                'detail' => "Cannot replace documents for an application in '{$app->status}' status.",
            ], 422);
        }

        // Prevent replacement only if document has already been verified/approved or is currently under official review
        if (in_array($oldDoc->review_status, ['approved', 'verified', 'under_review'])) {
            return response()->json([
                'detail' => 'This document has already been verified or is currently under official review and cannot be replaced.',
            ], 422);
        }

        $file = $request->file('file');
        $validationError = $this->validateFile($file);
        if ($validationError) {
            return response()->json(['detail' => $validationError], 422);
        }

        // Upload the new file
        $ext = strtolower($file->getClientOriginalExtension());
        $newDocId = (string) Str::uuid();
        $sanitizedName = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        $storedName = "{$newDocId}-{$sanitizedName}.{$ext}";

        $oldDoc->load('application', 'requirement');
        $appType = $oldDoc->application->application_type ?? 'new_id';
        $refNo = $oldDoc->application->reference_no ?? 'UNKNOWN';
        $requirementName = $oldDoc->requirement->name ?? 'Document';

        $storagePath = StoragePathBuilder::buildTempPath($user->id, $appType, $refNo, $requirementName, $storedName);

        try {
            $storage = app(SupabaseStorageService::class);
            $result = $storage->uploadTemporary(
                $storagePath,
                file_get_contents($file->getRealPath()),
                $this->detectMimeType($file)
            );
        } catch (\Exception $e) {
            return response()->json(['detail' => 'Upload failed. Please try again.'], 500);
        }

        // Clean up previous temporary file if it was still in temporary storage
        if ($oldDoc->storage_status === 'temporary' && $oldDoc->active_storage_path) {
            try {
                $storage->deleteTemporary($oldDoc->active_storage_path);
            } catch (\Exception $cleanupEx) {
                // Ignore failure to clean up replaced temp file
            }
        }

        // Mark old document as replaced
        $oldDoc->update(['review_status' => 'replaced']);

        $newDoc = new Document();
        $newDoc->id = $newDocId;
        $newDoc->user_id = $user->id;
        $newDoc->application_id = $oldDoc->application_id;
        $newDoc->requirement_id = $oldDoc->requirement_id;
        $newDoc->original_filename = $file->getClientOriginalName();
        $newDoc->storage_path = $storagePath;
        $newDoc->temporary_storage_path = $storagePath;
        $newDoc->storage_status = 'temporary';
        $newDoc->mime_type = $this->detectMimeType($file);
        $newDoc->file_size = $file->getSize();
        $newDoc->review_status = 'pending';
        $newDoc->save();

        AuditLog::record($request, 'document.replaced', 'Document', $newDoc->id, [
            'filename'        => $newDoc->original_filename,
            'replaces'        => $oldDoc->id,
            'previous_status' => $oldDoc->review_status,
        ]);

        // Transition application status if it was in for_document_correction
        if ($oldDoc->application_id) {
            $application = Application::find($oldDoc->application_id);
            if ($application && $application->status === 'for_document_correction') {
                $hasRemaining = Document::where('application_id', $application->id)
                    ->where('id', '!=', $oldDoc->id)
                    ->whereIn('review_status', ['rejected', 'needs_replacement', 'replacement_required'])
                    ->exists();
                if (!$hasRemaining) {
                    $application->update(['status' => 'documents_under_review']);
                    $application->statusHistory()->create([
                        'from_status' => 'for_document_correction',
                        'to_status'   => 'documents_under_review',
                        'note'        => 'Applicant replaced rejected document(s). Ready for CSWDD review.',
                        'changed_by'  => $user->id,
                    ]);
                }
            }
        }

        // Notify admins about replacement
        $reqName = $newDoc->requirement?->name ?? $newDoc->original_filename;
        $userName = $user->full_name ?? ($user->first_name . ' ' . $user->last_name);
        Notification::create([
            'user_id' => $user->id,
            'type'    => 'document_replaced',
            'title'   => 'Document Replaced',
            'message' => "{$userName} has replaced a rejected document: {$reqName}",
            'link'    => $newDoc->application_id ? "/admin/applications/{$newDoc->application_id}" : null,
            'created_at' => now(),
        ]);

        $newDoc->load(['requirement.category']);
        $docArray = $newDoc->toArray();
        if ($newDoc->requirement && $newDoc->requirement->category) {
            $catCode = $newDoc->requirement->category->code;
            $reqs = $newDoc->requirement->category->requirements()->orderBy('id')->get();
            $index = $reqs->search(fn($r) => $r->id === $newDoc->requirement_id);
            $docArray['doc_type'] = "req_{$catCode}_{$index}";
            $docArray['requirement_name'] = $newDoc->requirement->name;
            $docArray['requirement_index'] = $index;
        }
        $docArray['verification_status'] = $newDoc->review_status;

        return response()->json($docArray, 201);
    }

    /**
     * GET /documents/{id}/view
     * Generate a temporary signed URL and metadata for viewing a document.
     */
    public function view($id, Request $request)
    {
        $doc = Document::find($id);
        if (!$doc) {
            return response()->json(['detail' => 'Document not found.'], 404);
        }
        if ($doc->user_id !== $request->user()->id) {
            return response()->json(['detail' => 'Unauthorized access.'], 403);
        }

        try {
            $storage = app(SupabaseStorageService::class);
            // Self-healing: if document is approved but promotion failed or is still temporary, attempt promotion
            if (in_array($doc->review_status, ['approved', 'verified']) && $doc->storage_status !== 'promoted') {
                $storage->promoteDocumentRecord($doc);
                $doc->refresh();
            }

            $path = $doc->active_storage_path;
            
            if ($storage->isLocalDriver()) {
                $url = url("/api/documents/{$id}/preview");
            } elseif ($doc->storage_status === 'promoted') {
                $url = $storage->getSignedUrl($path, 900);
            } else {
                $url = $storage->getTemporarySignedUrl($path, 900);
            }
            return response()->json([
                'url'               => $url,
                'preview_url'       => url("/api/documents/{$id}/preview"),
                'id'                => $doc->id,
                'original_filename' => $doc->original_filename,
                'mime_type'         => $doc->mime_type,
                'file_size'         => $doc->file_size,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to generate signed URL', ['doc_id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['detail' => 'Could not generate document preview. Please try again.'], 500);
        }
    }

    /**
     * GET /documents/{id}/preview
     * Stream document directly through backend proxy with proper content-type headers.
     */
    public function streamFile($id, Request $request)
    {
        $doc = Document::find($id);
        if (!$doc) {
            return response()->json(['detail' => 'Document not found.'], 404);
        }
        if ($doc->user_id !== $request->user()->id) {
            return response()->json(['detail' => 'Unauthorized access.'], 403);
        }

        try {
            $storage = app(SupabaseStorageService::class);
            // Self-healing: if document is approved but promotion failed or is still temporary, attempt promotion
            if (in_array($doc->review_status, ['approved', 'verified']) && $doc->storage_status !== 'promoted') {
                $storage->promoteDocumentRecord($doc);
                $doc->refresh();
            }

            $path = $doc->active_storage_path;
            
            if ($doc->storage_status === 'promoted') {
                $content = $storage->download($path);
            } else {
                $content = $storage->downloadTemporary($path);
            }
            $mime = $doc->mime_type ?: 'application/octet-stream';

            return response($content, 200, [
                'Content-Type'        => $mime,
                'Content-Disposition' => 'inline; filename="' . addslashes($doc->original_filename) . '"',
                'Cache-Control'       => 'private, max-age=3600',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to stream document', ['doc_id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['detail' => 'Could not preview document file.'], 500);
        }
    }

    /**
     * DELETE /documents/{id}
     * Delete an unreviewed document.
     */
    public function delete($id, Request $request)
    {
        $doc = Document::find($id);
        if (!$doc) {
            return response()->json(['detail' => 'Document not found.'], 404);
        }
        if ($doc->user_id !== $request->user()->id) {
            return response()->json(['detail' => 'Unauthorized action.'], 403);
        }

        // QA-P1-07: Reject deletion if application is finalized
        $app = $doc->application;
        if ($app && in_array($app->status, ['approved', 'ready_for_pickup', 'claimed', 'released', 'completed'])) {
            return response()->json([
                'detail' => "Cannot delete documents from an application that is in '{$app->status}' status.",
            ], 422);
        }

        // Only allow deletion of submitted/pending documents (not approved/under_review)
        if (in_array($doc->review_status, ['approved', 'verified', 'under_review'])) {
            return response()->json([
                'detail' => 'Approved or in-review documents cannot be deleted.',
            ], 422);
        }

        // Remove from storage
        try {
            $storage = app(SupabaseStorageService::class);
            $path = $doc->active_storage_path;
            
            if ($doc->storage_status === 'promoted') {
                $storage->delete($path);
            } else {
                $storage->deleteTemporary($path);
            }
        } catch (\Exception $e) {
            Log::warning('Failed to delete storage file', ['path' => $doc->active_storage_path]);
        }

        $doc->delete();

        AuditLog::record($request, 'document.deleted', 'Document', $id, [
            'filename' => $doc->original_filename,
        ]);

        return response()->json(['message' => 'Document deleted']);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  ADMIN ENDPOINTS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * GET /admin/applications/{appId}/documents
     * List all documents for an application, mapped against requirements.
     */
    public function adminApplicationDocuments($appId, Request $request)
    {
        $app = Application::findOrFail($appId);

        $documents = Document::where('application_id', $appId)
            ->orderBy('created_at', 'asc')
            ->get();

        // Load the category's requirements
        $category = null;
        $requirements = [];
        $catCode = null;
        
        if ($app->category_id) {
            $category = Category::find($app->category_id);
        } else {
            // Fallback for old applications that might not have category_id
            $profile = $app->user?->profile ?? \App\Models\ApplicantProfile::where('user_id', $app->user_id)->first();
            if ($profile?->solo_parent_category) {
                $category = Category::where('code', $profile->solo_parent_category)->first();
            }
        }

        if ($category) {
            $catCode = $category->code;
            $requirements = $category->requirements ?? [];
        }

        // Build requirement-document mapping
        $mapped = [];
        $reqIndex = 0;
        foreach ($requirements as $req) {
            $docKey = "req_{$catCode}_{$reqIndex}";
            $reqDocs = $documents->filter(fn($d) => $d->requirement_id === $req->id)->values();
            // All active (non-replaced) documents belonging to this requirement
            $activeDocs = $reqDocs->filter(fn($d) => !in_array($d->review_status, ['replaced']))->values();
            $current = $activeDocs->first();

            $mapped[] = [
                'id'              => $req->id,
                'index'           => $reqIndex,
                'doc_type'        => $docKey,
                'name'            => $req->name,
                'description'     => $req->description,
                'is_required'     => $req->is_required,
                'current_document'=> $current,
                'documents'       => $activeDocs,
                'attachments_count'=> $activeDocs->count(),
                'all_revisions'   => $reqDocs,
            ];
            $reqIndex++;
        }

        // Summary counts
        $total_required = collect($mapped)->filter(fn($m) => $m['is_required'])->count();
        $submitted = collect($mapped)->filter(fn($m) => $m['attachments_count'] > 0)->count();
        $approved = collect($mapped)->filter(fn($m) => $m['attachments_count'] > 0 && collect($m['documents'])->every(fn($d) => in_array($d->review_status, ['approved', 'verified'])))->count();
        $rejected = collect($mapped)->filter(fn($m) => collect($m['documents'])->contains(fn($d) => in_array($d->review_status, ['rejected', 'needs_replacement', 'replacement_required'])))->count();

        return response()->json([
            'requirements' => $mapped,
            'summary'      => [
                'total_required' => $total_required,
                'submitted'      => $submitted,
                'approved'       => $approved,
                'rejected'       => $rejected,
                'missing'        => max(0, $total_required - $submitted),
            ],
            'category'     => $catCode,
        ]);
    }

    /**
     * GET /admin/documents/{id}/view
     * Generate a signed URL and metadata for admin preview.
     */
    public function adminView($id, Request $request)
    {
        $doc = Document::findOrFail($id);

        try {
            $storage = app(SupabaseStorageService::class);
            // Self-healing: if document is approved but promotion failed or is still temporary, attempt promotion
            if (in_array($doc->review_status, ['approved', 'verified']) && $doc->storage_status !== 'promoted') {
                $storage->promoteDocumentRecord($doc);
                $doc->refresh();
            }

            $path = $doc->active_storage_path;
            
            if ($storage->isLocalDriver()) {
                $url = url("/api/admin/documents/{$id}/preview");
            } elseif ($doc->storage_status === 'promoted') {
                $url = $storage->getSignedUrl($path, 900);
            } else {
                $url = $storage->getTemporarySignedUrl($path, 900);
            }
            return response()->json([
                'url'               => $url,
                'preview_url'       => url("/api/admin/documents/{$id}/preview"),
                'id'                => $doc->id,
                'original_filename' => $doc->original_filename,
                'mime_type'         => $doc->mime_type,
                'file_size'         => $doc->file_size,
            ]);
        } catch (\Exception $e) {
            Log::error('Admin signed URL failed', ['doc_id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['detail' => 'Could not generate document preview.'], 500);
        }
    }

    /**
     * GET /admin/documents/{id}/preview
     * Stream document directly for admin preview.
     */
    public function adminStreamFile($id, Request $request)
    {
        $doc = Document::findOrFail($id);

        try {
            $storage = app(SupabaseStorageService::class);
            // Self-healing: if document is approved but promotion failed or is still temporary, attempt promotion
            if (in_array($doc->review_status, ['approved', 'verified']) && $doc->storage_status !== 'promoted') {
                $storage->promoteDocumentRecord($doc);
                $doc->refresh();
            }

            $path = $doc->active_storage_path;
            
            if ($doc->storage_status === 'promoted') {
                $content = $storage->download($path);
            } else {
                $content = $storage->downloadTemporary($path);
            }
            $mime = $doc->mime_type ?: 'application/octet-stream';

            return response($content, 200, [
                'Content-Type'        => $mime,
                'Content-Disposition' => 'inline; filename="' . addslashes($doc->original_filename) . '"',
                'Cache-Control'       => 'private, max-age=3600',
            ]);
        } catch (\Exception $e) {
            Log::error('Admin stream preview failed', ['doc_id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['detail' => 'Could not preview document file.'], 500);
        }
    }

    /**
     * POST /admin/documents/{id}/review
     * Approve, reject, or request replacement for a document.
     */
    public function adminReview($id, Request $request)
    {
        $request->validate([
            'status'  => 'required|in:approved,verified,rejected,needs_replacement,replacement_required,under_review,pending',
            'remarks' => 'nullable|string|max:2000',
        ]);

        $status = $request->status;
        $remarks = $request->remarks;

        // Require remarks for rejection
        if (in_array($status, ['rejected', 'needs_replacement', 'replacement_required']) && !$remarks) {
            return response()->json([
                'detail' => 'Please provide a reason when rejecting a document.',
            ], 422);
        }

        $doc = Document::findOrFail($id);
        $oldStatus = $doc->review_status;

        $doc->update([
            'review_status' => $status,
            'review_note'   => $remarks,
            'reviewed_by'   => $request->user()->id,
            'reviewed_at'   => now(),
        ]);

        // If approved or verified, promote document from temporary to permanent storage with error tracking
        if (in_array($status, ['approved', 'verified'])) {
            $storage = app(SupabaseStorageService::class);
            $storage->promoteDocumentRecord($doc);
            $doc->refresh();
        }

        // Audit
        AuditLog::record($request, 'document.reviewed', 'Document', $doc->id, [
            'filename'    => $doc->original_filename,
            'from_status' => $oldStatus,
            'to_status'   => $status,
            'remarks'     => $remarks,
        ]);

        // If rejected, transition application to 'for_document_correction'
        if (in_array($status, ['rejected', 'needs_replacement', 'replacement_required']) && $doc->application_id) {
            $application = Application::find($doc->application_id);
            if ($application && !in_array($application->status, ['rejected', 'cancelled', 'completed', 'released'])) {
                $oldAppStatus = $application->status;
                $docTitle = $doc->requirement?->name ?: $doc->original_filename;
                $application->update([
                    'status'        => 'for_document_correction',
                    'status_reason' => "Document \"{$docTitle}\" rejected: {$remarks}",
                ]);

                $application->statusHistory()->create([
                    'from_status' => $oldAppStatus,
                    'to_status'   => 'for_document_correction',
                    'note'        => "Status updated to For Document Correction due to rejected document: {$docTitle}. Reason: {$remarks}",
                    'changed_by'  => $request->user()->id,
                ]);
            }
        }

        // Notify the applicant
        $statusLabels = [
            'approved' => 'approved', 'verified' => 'approved',
            'rejected' => 'rejected', 'needs_replacement' => 'requires replacement',
            'replacement_required' => 'requires replacement',
            'under_review' => 'is now under review',
        ];
        $label = $statusLabels[$status] ?? $status;

        $doc->load('requirement');
        $reqName = $doc->requirement?->name ?? $doc->original_filename;

        Notification::create([
            'user_id' => $doc->user_id,
            'type'    => 'document_review',
            'title'   => 'Document Review Update',
            'message' => "Your document \"{$reqName}\" has been {$label}."
                . ($remarks ? " Remarks: {$remarks}" : ''),
            'link'    => '/portal/my-application?step=documents',
            'created_at' => now(),
        ]);

        // Also record notification for current admin user
        Notification::create([
            'user_id' => $request->user()->id,
            'type'    => 'document_review',
            'title'   => 'Document ' . ($status === 'approved' ? 'Approved' : ucfirst($status)),
            'message' => "Document \"{$reqName}\" has been marked as " . ($status === 'approved' ? 'Approved' : $status) . ".",
            'link'    => "/admin/applications/{$doc->application_id}",
            'created_at' => now(),
        ]);

        $arr = $doc->fresh(['requirement'])->toArray();
        $arr['verification_status'] = $doc->review_status;
        $arr['status'] = $doc->review_status;
        $arr['review_status'] = $doc->review_status;
        $arr['requirement_name'] = $reqName;
        $arr['label'] = $reqName;
        $arr['verification_remark'] = $doc->review_note;
        return response()->json($arr);
    }

    /**
     * POST /admin/applications/{appId}/documents/approve-all
     * Bulk approve all active submitted documents for an application.
     */
    public function adminApproveAllDocuments($appId, Request $request)
    {
        $app = Application::with('user')->findOrFail($appId);

        // Fetch documents belonging strictly to this specific application
        $documents = Document::where('application_id', $appId)
            ->whereNotIn('review_status', ['replaced', 'rejected'])
            ->get();

        // Guarded fallback for unlinked/legacy documents: ONLY allowed for user's initial 'new' application
        // NEVER allow legacy documents from previous applications to be pulled into a Renewal or Loss review!
        if ($documents->isEmpty() && ($app->application_type === 'new' || !$app->application_type)) {
            $earliestApp = Application::where('user_id', $app->user_id)->orderBy('created_at', 'asc')->first();
            if ($earliestApp && $earliestApp->id === $app->id) {
                $documents = Document::where('user_id', $app->user_id)
                    ->whereNull('application_id')
                    ->whereNotIn('review_status', ['replaced', 'rejected'])
                    ->get();
                // Normalize legacy documents to belong to this application
                foreach ($documents as $legacyDoc) {
                    $legacyDoc->update(['application_id' => $app->id]);
                }
            }
        }

        $remarks = $request->remarks ?? 'Approved by CSWDD Administrator.';
        $adminId = $request->user()->id;
        $adminName = $request->user()->full_name ?? $request->user()->name ?? 'Administrator';

        // 1. Atomically update all document statuses & application state in database
        DB::transaction(function () use ($documents, $app, $remarks, $adminId, $adminName) {
            foreach ($documents as $doc) {
                $doc->update([
                    'review_status' => 'approved',
                    'review_note'   => $remarks,
                    'reviewed_by'   => $adminId,
                    'reviewed_at'   => now(),
                ]);
            }

            // Update application state to reflect approved requirements
            $appUpdates = ['are_documents_complete' => true];
            if (in_array($app->status, ['submitted', 'draft', 'document_verification', 'for_document_correction', 'documents_under_review'])) {
                $appUpdates['status'] = 'under_initial_review';
            }
            $oldAppStatus = $app->status;
            $app->update($appUpdates);

            $app->statusHistory()->create([
                'from_status'     => $oldAppStatus,
                'to_status'       => $appUpdates['status'] ?? $oldAppStatus,
                'note'            => 'Documentary requirements approved by CSWDD Administrator. Applicant is qualified to proceed to Application Form.',
                'changed_by'      => $adminId,
                'changed_by_name' => $adminName,
            ]);
        });

        $updatedCount = $documents->count();

        // 2. Storage promotion: promote approved temporary documents to permanent storage with error tracking & reconciliation
        @set_time_limit(120);
        $storage = app(SupabaseStorageService::class);
        foreach ($documents as $doc) {
            $storage->promoteDocumentRecord($doc);
        }

        AuditLog::record($request, 'documents.approved_all', 'Application', $app->id, [
            'count' => $updatedCount,
        ]);

        Notification::create([
            'user_id' => $app->user_id,
            'type'    => 'document_review',
            'title'   => 'Documentary Requirements Approved',
            'message' => 'All your documentary requirements have been reviewed and approved. You are qualified to proceed to fill out your Solo Parent Application Form.',
            'link'    => '/portal/my-application?step=form',
            'created_at' => now(),
        ]);

        // Notification for admin user
        Notification::create([
            'user_id' => $request->user()->id,
            'type'    => 'document_review',
            'title'   => 'Requirements Approved',
            'message' => "All {$updatedCount} documentary requirements approved for {$app->user?->name}. Applicant qualified to proceed to Application Form.",
            'link'    => "/admin/applications/{$app->id}",
            'created_at' => now(),
        ]);

        return response()->json([
            'message'       => "Successfully approved {$updatedCount} documents. Applicant qualified for application form.",
            'updated_count' => $updatedCount,
            'application'   => $app->fresh(['category', 'statusHistory']),
        ]);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Detect MIME type from magic bytes — no fileinfo extension required.
     * Falls back to client-provided MIME type.
     */
    private function detectMimeType($file): string
    {
        $path = $file->getRealPath();
        $handle = fopen($path, 'rb');
        if ($handle) {
            $header = fread($handle, 8);
            fclose($handle);

            if (str_starts_with($header, '%PDF'))                          return 'application/pdf';
            if (str_starts_with($header, "\xFF\xD8\xFF"))                  return 'image/jpeg';
            if (str_starts_with($header, "\x89PNG"))                       return 'image/png';
            if (str_starts_with($header, "PK\x03\x04"))                    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            if (str_starts_with($header, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1")) return 'application/msword';
        }

        // Fallback: use the client-provided MIME type (does NOT need fileinfo)
        return $file->getClientMimeType() ?: 'application/octet-stream';
    }

    /**
     * Validate file: extension, MIME type (via magic bytes), size.
     *
     * @return string|null  Error message, or null if valid.
     */
    private function validateFile($file): ?string
    {
        if (!$file || !$file->isValid()) {
            return 'Please select a valid file.';
        }

        // Size check
        if ($file->getSize() > self::MAX_FILE_SIZE) {
            return 'The selected file exceeds the maximum allowed size of 20MB.';
        }

        // Extension check
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, self::ALLOWED_EXTENSIONS)) {
            return "This file type (.{$ext}) is not supported. Accepted formats: PDF, JPG, JPEG, PNG, DOCX.";
        }

        // Magic bytes validation (also serves as MIME check — no fileinfo needed)
        $handle = fopen($file->getRealPath(), 'rb');
        if ($handle) {
            $header = fread($handle, 8);
            fclose($handle);

            $valid = false;
            if ($ext === 'pdf') {
                $valid = str_starts_with($header, '%PDF');
            } elseif (in_array($ext, ['jpg', 'jpeg'])) {
                $valid = str_starts_with($header, "\xFF\xD8\xFF");
            } elseif ($ext === 'png') {
                $valid = str_starts_with($header, "\x89PNG");
            } elseif ($ext === 'docx') {
                $valid = str_starts_with($header, "PK\x03\x04");
            } elseif ($ext === 'doc') {
                $valid = str_starts_with($header, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1");
            }

            if (!$valid) {
                return 'The file content does not match its extension. Please upload a genuine PDF, JPG, PNG, or DOCX file.';
            }
        }

        return null;
    }

    /**
     * Build the applicant folder name from their profile: "Last name., First Name, MI"
     * Falls back to user ID if profile is incomplete.
     */
    private function buildApplicantFolderName(string $userId): string
    {
        $profile = ApplicantProfile::where('user_id', $userId)->first();

        if (!$profile || !$profile->last_name || !$profile->first_name) {
            return $userId; // Fallback to user ID
        }

        $lastName  = trim($profile->last_name);
        $firstName = trim($profile->first_name);

        // Build middle initial
        $middlePart = '';
        if ($profile->middle_name) {
            $middleInitial = strtoupper(mb_substr(trim($profile->middle_name), 0, 1));
            $middlePart = " {$middleInitial}";
        }

        // Format: "Lastname Firstname MI"
        $folderName = "{$lastName} {$firstName}{$middlePart}";

        // Sanitize for filesystem and URL safety (remove characters invalid in paths)
        $folderName = preg_replace('#[,.\\\\/:*?"<>|]#', '', $folderName);
        $folderName = preg_replace('/\s+/', ' ', trim($folderName));

        return $folderName ?: $userId;
    }
}
