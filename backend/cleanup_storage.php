<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$baseUrl = rtrim(config('services.supabase.url', env('SUPABASE_URL')), '/');
$serviceKey = config('services.supabase.service_key', env('SUPABASE_SERVICE_KEY'));
$buckets = [
    config('services.supabase.bucket', env('AWS_BUCKET', 'solo-parent-documents')),
    config('services.supabase.temp_bucket', env('SUPABASE_TEMP_BUCKET', 'solo-parent-temp'))
];

function deleteFolderRecursively($baseUrl, $encodedBucket, $serviceKey, $prefix) {
    echo "Scanning prefix: '$prefix'\n";
    $listUrl = "{$baseUrl}/storage/v1/object/list/{$encodedBucket}";
    $response = Http::withOptions(['verify' => false])
        ->withHeaders([
            'Authorization' => "Bearer {$serviceKey}",
            'Content-Type'  => 'application/json',
        ])
        ->post($listUrl, [
            'prefix' => $prefix,
            'limit' => 10000,
            'offset' => 0
        ]);

    if (!$response->successful()) {
        echo "Failed to list prefix '$prefix': " . $response->body() . "\n";
        return;
    }

    $files = $response->json();
    $pathsToDelete = [];
    foreach ($files as $file) {
        if ($file['name'] === '.emptyFolderPlaceholder' || $file['name'] === '') continue;
        
        $fullPath = $prefix ? $prefix . '/' . $file['name'] : $file['name'];
        
        if (isset($file['id']) && $file['id'] !== null) {
            // It's a file
            $pathsToDelete[] = $fullPath;
        } else {
            // It's a folder (id is null usually for folders in supabase list response, or there is no id)
            deleteFolderRecursively($baseUrl, $encodedBucket, $serviceKey, $fullPath);
            // We should also delete the folder itself (or empty folder placeholder)
            $pathsToDelete[] = $fullPath;
        }
    }

    if (count($pathsToDelete) > 0) {
        echo "Deleting " . count($pathsToDelete) . " files/folders in '$prefix'...\n";
        $deleteUrl = "{$baseUrl}/storage/v1/object/{$encodedBucket}";
        $delResponse = Http::withOptions(['verify' => false])
            ->withHeaders([
                'Authorization' => "Bearer {$serviceKey}",
                'Content-Type'  => 'application/json',
            ])
            ->delete($deleteUrl, ['prefixes' => $pathsToDelete]);

        if (!$delResponse->successful()) {
            echo "Failed to delete paths in '$prefix': " . $delResponse->body() . "\n";
        }
    }
}

foreach ($buckets as $bucket) {
    echo "\nProcessing bucket: $bucket\n";
    $encodedBucket = rawurlencode($bucket);
    deleteFolderRecursively($baseUrl, $encodedBucket, $serviceKey, '');
}
echo "Done.\n";
