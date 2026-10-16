<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\Services\SupabaseStorageService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CleanTempStorage extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'storage:clean-temp {--dry-run : Report candidate deletions without removing objects} {--force : Bypass confirmation in interactive mode}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Safely deletes orphaned temporary files older than 30 days from temporary storage.';

    /** @var bool|string */
    protected $verifySsl;

    /** @var SupabaseStorageService */
    protected SupabaseStorageService $storage;

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->storage = app(SupabaseStorageService::class);
        $isDryRun = (bool) $this->option('dry-run');
        $cutoffDate = Carbon::now()->subDays(30);

        if ($isDryRun) {
            $this->warn("Executing in DRY-RUN mode. No files will be deleted.");
        }

        // 1. If effective driver is local or mock, strictly clean local mock storage without network calls
        if ($this->storage->isLocalDriver()) {
            return $this->cleanLocalMockStorage($cutoffDate, $isDryRun);
        }

        // 2. Cloud Driver Safety & Environment Validation
        $baseUrl = rtrim($this->storage->getBaseUrl(), '/');
        $serviceKey = $this->storage->getServiceKey();
        $bucket = $this->storage->getTempBucket();
        $permanentBucket = $this->storage->getDefaultBucket();

        if (empty($baseUrl) || empty($serviceKey)) {
            $this->error("Supabase cloud storage is unconfigured: missing baseUrl or serviceKey.");
            return 1;
        }

        if (!filter_var($baseUrl, FILTER_VALIDATE_URL)) {
            $this->error("Invalid Supabase URL: " . SupabaseStorageService::sanitizeResponseBody($baseUrl));
            return 1;
        }

        if (parse_url($baseUrl, PHP_URL_USER) || parse_url($baseUrl, PHP_URL_PASS)) {
            $this->error("Supabase URL must not contain embedded user credentials.");
            return 1;
        }

        if (app()->environment('production', 'staging') && !str_starts_with(strtolower($baseUrl), 'https://')) {
            $this->error("Supabase cloud URL must use HTTPS in production and staging.");
            return 1;
        }

        // Prevent accidental cloud destruction during tests if pointing to real production Supabase
        if (app()->environment('testing')) {
            $knownProductionHost = 'nntovqphomdbsomshbsp.supabase.co';
            if (str_contains(strtolower($baseUrl), $knownProductionHost)) {
                $this->error("Refusing to run destructive cloud cleanup against production Supabase endpoint during automated tests.");
                return 1;
            }
        }

        // Target bucket safety check: never run cleanup against the permanent bucket
        if ($bucket === $permanentBucket) {
            $this->error("Safety violation: Temporary storage bucket is identical to permanent bucket '{$bucket}'. Aborting cleanup to protect permanent documents.");
            return 1;
        }

        // Target environment confirmation in interactive production runs
        if (app()->environment('production') && $this->input->isInteractive() && !$this->option('force') && !$isDryRun) {
            if (!$this->confirm("WARNING: You are about to clean temporary storage in PRODUCTION ({$bucket}). Continue?")) {
                $this->info("Cleanup cancelled.");
                return 0;
            }
        }

        $this->verifySsl = $this->storage->getVerifySsl();

        $this->info("Scanning cloud bucket {$bucket} for orphaned files older than {$cutoffDate->toIso8601String()}...");

        $protectedPaths = $this->buildProtectedPaths();
        $encodedBucket = rawurlencode($bucket);

        $totalDeleted = $this->deleteOldCloudFiles($baseUrl, $encodedBucket, $serviceKey, '', $cutoffDate, $protectedPaths, $isDryRun);

        $actionWord = $isDryRun ? "identified for deletion" : "deleted";
        $this->info("Cloud cleanup completed: {$totalDeleted} file(s) {$actionWord}.");
        return 0;
    }

    /**
     * Clean local mock temporary storage directory.
     */
    protected function cleanLocalMockStorage(Carbon $cutoffDate, bool $isDryRun): int
    {
        $bucket = $this->storage->getTempBucket();
        $tempDir = $this->storage->getLocalStoragePath() . DIRECTORY_SEPARATOR . $bucket;

        $this->info("Local/mock storage driver active. Scanning directory: {$tempDir}");

        if (!is_dir($tempDir)) {
            $this->info("Temporary directory does not exist. Nothing to clean.");
            return 0;
        }

        $protectedPaths = $this->buildProtectedPaths();
        $deletedCount = 0;

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($tempDir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        $canonicalBase = realpath($tempDir);

        foreach ($iterator as $item) {
            if ($item->isFile()) {
                $realItemPath = realpath($item->getPathname());
                // Traversal safety guard
                if ($realItemPath === false || !str_starts_with($realItemPath, $canonicalBase . DIRECTORY_SEPARATOR)) {
                    continue;
                }

                $relPath = str_replace('\\', '/', substr($realItemPath, strlen($canonicalBase) + 1));
                $cleanRelPath = ltrim($relPath, '/');

                if (isset($protectedPaths[$cleanRelPath])) {
                    $this->line("  [PROTECTED] Skipping referenced document: " . SupabaseStorageService::sanitizeLogPath($cleanRelPath));
                    continue;
                }

                $fileMtime = Carbon::createFromTimestamp($item->getMTime());
                if ($fileMtime->lessThan($cutoffDate)) {
                    if ($isDryRun) {
                        $this->line("  [DRY RUN] Would delete orphaned local file: " . SupabaseStorageService::sanitizeLogPath($cleanRelPath));
                    } else {
                        @unlink($item->getPathname());
                        $this->line("  [DELETED] Orphaned local file: " . SupabaseStorageService::sanitizeLogPath($cleanRelPath));
                    }
                    $deletedCount++;
                }
            } elseif ($item->isDir() && !$isDryRun) {
                // Remove empty directory if not the root
                $files = @scandir($item->getPathname());
                if ($files !== false && count($files) <= 2) {
                    @rmdir($item->getPathname());
                }
            }
        }

        $actionWord = $isDryRun ? "identified for deletion" : "deleted";
        $this->info("Local cleanup completed: {$deletedCount} file(s) {$actionWord}.");
        return 0;
    }

    /**
     * Build map of protected document paths from the database.
     * Protects every document that has not been successfully promoted to permanent storage,
     * ensuring active, pending, draft, and in-review documents are NEVER deleted.
     */
    protected function buildProtectedPaths(): array
    {
        $protectedPaths = [];

        $unpromotedDocs = Document::where(function ($q) {
                $q->where('storage_status', '!=', 'promoted')
                  ->orWhereNull('storage_status')
                  ->orWhereNull('permanent_storage_path');
            })
            ->get(['temporary_storage_path', 'storage_path']);

        foreach ($unpromotedDocs as $d) {
            foreach ([$d->temporary_storage_path, $d->storage_path] as $p) {
                if ($p) {
                    $normalized = trim(str_replace('\\', '/', $p), '/');
                    $protectedPaths[$normalized] = true;
                }
            }
        }

        return $protectedPaths;
    }

    /**
     * Recursively list and delete orphaned cloud objects.
     */
    protected function deleteOldCloudFiles(
        string $baseUrl,
        string $encodedBucket,
        string $serviceKey,
        string $prefix,
        Carbon $cutoffDate,
        array $protectedPaths,
        bool $isDryRun,
        int $depth = 0
    ): int {
        if ($depth > 10) {
            $this->warn("Maximum folder recursion depth reached at prefix '{$prefix}'.");
            return 0;
        }

        $listUrl = "{$baseUrl}/storage/v1/object/list/{$encodedBucket}";
        $offset = 0;
        $limit = 100;
        $totalDeleted = 0;

        do {
            $response = Http::withOptions(['verify' => $this->verifySsl])
                ->withHeaders([
                    'Authorization' => "Bearer {$serviceKey}",
                    'Content-Type'  => 'application/json',
                ])
                ->post($listUrl, [
                    'prefix' => $prefix,
                    'limit'  => $limit,
                    'offset' => $offset,
                    'sortBy' => [
                        'column' => 'created_at',
                        'order'  => 'asc',
                    ],
                ]);

            if (!$response->successful()) {
                $sanitizedError = SupabaseStorageService::sanitizeResponseBody($response->body());
                $this->error("Failed to list prefix '{$prefix}': {$sanitizedError}");
                // Fail closed: abort deletion for this prefix to avoid deleting without accurate listing
                return $totalDeleted;
            }

            $files = $response->json();
            if (!is_array($files)) {
                $this->error("Unexpected non-array listing response for prefix '{$prefix}'. Aborting.");
                return $totalDeleted;
            }

            $pathsToDelete = [];

            foreach ($files as $file) {
                $name = $file['name'] ?? '';
                if ($name === '.emptyFolderPlaceholder' || $name === '') {
                    continue;
                }

                $fullPath = $prefix ? $prefix . '/' . $name : $name;
                $cleanFullPath = ltrim(str_replace('\\', '/', $fullPath), '/');

                if (isset($file['id']) && $file['id'] !== null) {
                    // It's a file
                    if (isset($file['created_at'])) {
                        $fileDate = Carbon::parse($file['created_at']);
                        if ($fileDate->lessThan($cutoffDate)) {
                            // Safety check: protect any document referenced in the database that is not promoted
                            if (isset($protectedPaths[$cleanFullPath]) || isset($protectedPaths[$fullPath])) {
                                $this->warn("Skipping deletion of referenced document: " . SupabaseStorageService::sanitizeLogPath($cleanFullPath));
                                continue;
                            }
                            $pathsToDelete[] = $cleanFullPath;
                        }
                    }
                } else {
                    // It's a sub-prefix (folder), recursively scan it
                    $totalDeleted += $this->deleteOldCloudFiles(
                        $baseUrl,
                        $encodedBucket,
                        $serviceKey,
                        $cleanFullPath,
                        $cutoffDate,
                        $protectedPaths,
                        $isDryRun,
                        $depth + 1
                    );
                }
            }

            if (count($pathsToDelete) > 0) {
                if ($isDryRun) {
                    $this->info("[DRY RUN] Would delete " . count($pathsToDelete) . " orphaned files in '{$prefix}'");
                    foreach ($pathsToDelete as $p) {
                        $this->line("  - [DRY RUN] " . SupabaseStorageService::sanitizeLogPath($p));
                    }
                    $totalDeleted += count($pathsToDelete);
                } else {
                    $this->info("Deleting " . count($pathsToDelete) . " orphaned files in '{$prefix}'...");
                    $deleteUrl = "{$baseUrl}/storage/v1/object/{$encodedBucket}";

                    foreach (array_chunk($pathsToDelete, 100) as $chunk) {
                        $delResponse = Http::withOptions(['verify' => $this->verifySsl])
                            ->withHeaders([
                                'Authorization' => "Bearer {$serviceKey}",
                                'Content-Type'  => 'application/json',
                            ])
                            ->delete($deleteUrl, ['prefixes' => $chunk]);

                        if (!$delResponse->successful()) {
                            $sanitizedError = SupabaseStorageService::sanitizeResponseBody($delResponse->body());
                            $this->error("Failed to delete chunk in '{$prefix}': {$sanitizedError}");
                        } else {
                            $totalDeleted += count($chunk);
                        }
                    }
                }
            }

            $offset += count($files);
        } while (count($files) === $limit);

        return $totalDeleted;
    }
}
