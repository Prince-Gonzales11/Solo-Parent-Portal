<?php

namespace App\Console\Commands;

use App\Models\ApplicantProfile;
use App\Models\Document;
use App\Services\SupabaseStorageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class MigrateDocumentPaths extends Command
{
    protected $signature = 'documents:migrate-paths {--dry-run : Show what would be moved without actually moving}';
    protected $description = 'Migrate existing document storage paths to the new Applicants/{Name}/Old Documents/ folder structure';

    public function handle()
    {
        $isDryRun = $this->option('dry-run');

        if ($isDryRun) {
            $this->info('🔍 DRY RUN MODE — No files will be moved or database records updated.');
        }

        $this->info('Fetching all documents that need migration...');

        // Get all documents that are NOT already in the new folder structure
        $documents = Document::whereNotNull('storage_path')
            ->where('storage_path', 'NOT LIKE', 'Applicants/%')
            ->get();

        if ($documents->isEmpty()) {
            $this->info('✅ No documents need migration. All paths are already in the new format.');
            return 0;
        }

        $this->info("Found {$documents->count()} document(s) to migrate.");

        $storage = new SupabaseStorageService();
        $success = 0;
        $failed = 0;
        $skipped = 0;

        // Cache profiles to avoid repeated queries
        $profileCache = [];

        foreach ($documents as $doc) {
            $userId = $doc->user_id;

            // Build the applicant folder name
            if (!isset($profileCache[$userId])) {
                $profile = ApplicantProfile::where('user_id', $userId)->first();
                if ($profile && $profile->last_name && $profile->first_name) {
                    $lastName  = trim($profile->last_name);
                    $firstName = trim($profile->first_name);
                    $middlePart = '';
                    if ($profile->middle_name) {
                        $middleInitial = strtoupper(mb_substr(trim($profile->middle_name), 0, 1));
                        $middlePart = ", {$middleInitial}";
                    }
                    $folderName = "{$lastName}., {$firstName}{$middlePart}";
                    $folderName = preg_replace('/[\\\\\\/:*?"<>|]/', '', $folderName);
                    $profileCache[$userId] = $folderName;
                } else {
                    $profileCache[$userId] = $userId; // Fallback
                }
            }

            $applicantFolder = $profileCache[$userId];
            $oldPath = $doc->storage_path;

            // Extract just the filename from the old path
            $filename = basename($oldPath);

            // Build new path
            $newPath = "Applicants/{$applicantFolder}/Old Documents/{$filename}";

            if ($oldPath === $newPath) {
                $skipped++;
                continue;
            }

            $this->line("  Moving: {$oldPath}");
            $this->line("      → {$newPath}");

            if ($isDryRun) {
                $success++;
                continue;
            }

            try {
                $storage->move($oldPath, $newPath);

                // Update the database record
                $doc->storage_path = $newPath;
                $doc->save();

                $success++;
                $this->info("    ✅ Moved successfully");
            } catch (\Exception $e) {
                $failed++;
                $this->error("    ❌ Failed: {$e->getMessage()}");
                Log::error('Document path migration failed', [
                    'document_id' => $doc->id,
                    'old_path'    => $oldPath,
                    'new_path'    => $newPath,
                    'error'       => $e->getMessage(),
                ]);
            }
        }

        $this->newLine();
        $this->info('═══════════════════════════════════════');
        $this->info("  Migration Summary" . ($isDryRun ? ' (DRY RUN)' : ''));
        $this->info('═══════════════════════════════════════');
        $this->info("  ✅ Successful: {$success}");
        $this->info("  ❌ Failed:     {$failed}");
        $this->info("  ⏭  Skipped:    {$skipped}");
        $this->info('═══════════════════════════════════════');

        if ($failed > 0) {
            $this->warn('Some documents failed to migrate. Check the logs for details.');
            return 1;
        }

        return 0;
    }
}
