<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;

class CleanTempStorage extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'storage:clean-temp';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Deletes files older than 30 days from the Supabase temporary storage bucket.';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $baseUrl = rtrim(config('services.supabase.url'), '/');
        $serviceKey = config('services.supabase.service_key');
        $bucket = config('services.supabase.temp_bucket', 'solo-parent-temp');
        $cutoffDate = Carbon::now()->subDays(30);
        
        $this->info("Scanning {$bucket} for files older than {$cutoffDate->toIso8601String()}...");
        
        $encodedBucket = rawurlencode($bucket);
        
        $this->deleteOldFiles($baseUrl, $encodedBucket, $serviceKey, '', $cutoffDate);
        
        $this->info("Cleanup completed.");
        return 0;
    }

    private function deleteOldFiles($baseUrl, $encodedBucket, $serviceKey, $prefix, $cutoffDate)
    {
        $listUrl = "{$baseUrl}/storage/v1/object/list/{$encodedBucket}";
        $response = Http::withOptions(['verify' => false])
            ->withHeaders([
                'Authorization' => "Bearer {$serviceKey}",
                'Content-Type'  => 'application/json',
            ])
            ->post($listUrl, [
                'prefix' => $prefix,
                'limit' => 10000,
                'offset' => 0,
                'sortBy' => [
                    'column' => 'created_at',
                    'order' => 'asc'
                ]
            ]);

        if (!$response->successful()) {
            $this->error("Failed to list prefix '{$prefix}': " . $response->body());
            return;
        }

        $files = $response->json();
        $pathsToDelete = [];

        $protectedDocs = \App\Models\Document::whereIn('review_status', ['approved', 'verified'])
            ->where(function ($q) {
                $q->where('storage_status', '!=', 'promoted')
                  ->orWhereNull('storage_status');
            })
            ->get(['temporary_storage_path', 'storage_path']);

        $protectedPaths = [];
        foreach ($protectedDocs as $d) {
            if ($d->temporary_storage_path) {
                $p = $d->temporary_storage_path;
                $protectedPaths[$p] = true;
                $protectedPaths[ltrim($p, '/')] = true;
            }
            if ($d->storage_path) {
                $p = $d->storage_path;
                $protectedPaths[$p] = true;
                $protectedPaths[ltrim($p, '/')] = true;
            }
        }

        foreach ($files as $file) {
            if ($file['name'] === '.emptyFolderPlaceholder' || $file['name'] === '') continue;

            $fullPath = $prefix ? $prefix . '/' . $file['name'] : $file['name'];
            $cleanFullPath = ltrim($fullPath, '/');

            if (isset($file['id']) && $file['id'] !== null) {
                // It's a file. Check its created_at date.
                if (isset($file['created_at'])) {
                    $fileDate = Carbon::parse($file['created_at']);
                    if ($fileDate->lessThan($cutoffDate)) {
                        // Safety check: Never delete a file that belongs to an approved document that has not yet been promoted!
                        if (isset($protectedPaths[$fullPath]) || isset($protectedPaths[$cleanFullPath])) {
                            $this->warn("Skipping deletion of unpromoted approved document: {$fullPath}");
                            continue;
                        }
                        $pathsToDelete[] = $fullPath;
                    }
                }
            } else {
                // It's a folder, recursively scan it
                $this->deleteOldFiles($baseUrl, $encodedBucket, $serviceKey, $fullPath, $cutoffDate);
            }
        }

        if (count($pathsToDelete) > 0) {
            $this->info("Deleting " . count($pathsToDelete) . " old files in '{$prefix}'...");
            $deleteUrl = "{$baseUrl}/storage/v1/object/{$encodedBucket}";
            $delResponse = Http::withOptions(['verify' => false])
                ->withHeaders([
                    'Authorization' => "Bearer {$serviceKey}",
                    'Content-Type'  => 'application/json',
                ])
                ->delete($deleteUrl, ['prefixes' => $pathsToDelete]);

            if (!$delResponse->successful()) {
                $this->error("Failed to delete paths in '{$prefix}': " . $delResponse->body());
            }
        }
    }
}
