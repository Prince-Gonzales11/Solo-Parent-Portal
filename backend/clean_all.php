<?php

use App\Models\User;
use App\Services\SupabaseStorageService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\File;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "Starting cleanup...\n";

// 1. Clean Local File System
$directories = [
    storage_path('app/public/users'),
    storage_path('app/public/applications'),
    storage_path('app/documents'),
];

foreach ($directories as $dir) {
    if (File::exists($dir)) {
        File::deleteDirectory($dir);
        echo "Deleted local directory: $dir\n";
    }
}

// 2. Clean Supabase Storage Bucket
try {
    echo "Cleaning Supabase Storage Bucket...\n";
    $bucketName = env('AWS_BUCKET', 'solo-parent-documents');
    
    // Get all files in the bucket by querying storage.objects
    $objects = DB::table('storage.objects')
        ->where('bucket_id', $bucketName)
        ->select('name')
        ->get();
        
    if ($objects->count() > 0) {
        $storage = new SupabaseStorageService();
        $count = 0;
        foreach ($objects as $obj) {
            // SupabaseStorageService delete expects an array of prefixes in the payload, wait
            // the delete method signature: public function delete(string $path, ?string $bucket = null): bool
            $storage->delete($obj->name, $bucketName);
            $count++;
        }
        echo "Deleted $count objects from Supabase storage.\n";
    } else {
        echo "Supabase bucket is already empty.\n";
    }
} catch (\Exception $e) {
    echo "Error cleaning Supabase storage: " . $e->getMessage() . "\n";
}

// 3. Clean Database (Fresh Migration & Seed)
echo "Wiping database and re-seeding...\n";
Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
echo Artisan::output();

echo "Cleanup complete! Only the admin account remains.\n";
