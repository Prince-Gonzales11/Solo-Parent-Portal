<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Http;

$baseUrl = rtrim(config('services.supabase.url'), '/');
$serviceKey = config('services.supabase.service_key');
$buckets = [
    config('services.supabase.bucket', 'solo-parent-portal-documents'),
    config('services.supabase.temp_bucket', 'solo-parent-temp'),
];

function listSupabaseFiles($baseUrl, $serviceKey, $bucket, $prefix = '') {
    $encodedBucket = rawurlencode($bucket);
    $url = "{$baseUrl}/storage/v1/object/list/{$encodedBucket}";
    $res = Http::withOptions(['verify' => false])
        ->withHeaders([
            'Authorization' => "Bearer {$serviceKey}",
            'Content-Type' => 'application/json',
        ])
        ->post($url, [
            'prefix' => $prefix,
            'limit' => 1000,
            'offset' => 0,
            'sortBy' => ['column' => 'name', 'order' => 'asc']
        ]);
    
    if (!$res->successful()) {
        return ["ERROR: " . $res->status() . " " . $res->body()];
    }
    
    $items = $res->json();
    $results = [];
    foreach ($items as $item) {
        $name = $item['name'] ?? '';
        if ($name === '' || $name === '.emptyFolderPlaceholder') continue;
        
        $fullPath = $prefix ? rtrim($prefix, '/') . '/' . $name : $name;
        
        // If it's a folder (id is null or has metadata with is_dir or similar), list recursively
        if (empty($item['id'])) {
            $subResults = listSupabaseFiles($baseUrl, $serviceKey, $bucket, $fullPath);
            $results = array_merge($results, $subResults);
        } else {
            $results[] = [
                'bucket' => $bucket,
                'path' => $fullPath,
                'id' => $item['id'],
                'metadata' => $item['metadata'] ?? []
            ];
        }
    }
    return $results;
}

foreach ($buckets as $b) {
    echo "========================================\n";
    echo "Scanning Supabase bucket: {$b}\n";
    $files = listSupabaseFiles($baseUrl, $serviceKey, $b);
    echo "Found " . count($files) . " files:\n";
    foreach ($files as $f) {
        if (is_array($f)) {
            echo " - {$f['path']} ({$f['bucket']})\n";
        } else {
            echo " - {$f}\n";
        }
    }
}
