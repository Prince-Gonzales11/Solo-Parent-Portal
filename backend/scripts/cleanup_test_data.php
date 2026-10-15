<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use App\Models\User;
use App\Models\ApplicantProfile;
use App\Models\Application;
use App\Models\ApplicationForm;
use App\Models\ApplicationFamilyMember;
use App\Models\ApplicationStatusHistory;
use App\Models\Document;
use App\Models\Message;
use App\Models\Notification;
use App\Models\AuditLog;
use Laravel\Sanctum\PersonalAccessToken;

echo "========================================================\n";
echo "CLEANUP PROCESS: REMOVING ALL TEST/DUMMY ACCOUNTS & FILES\n";
echo "========================================================\n\n";

$superAdminEmail = 'cswdd.admin1@butuan.gov.ph';
$superAdmin = User::where('email', $superAdminEmail)->where('role', 'super_admin')->first();

if (!$superAdmin) {
    echo "ERROR: Super admin {$superAdminEmail} not found! Aborting to prevent lockout.\n";
    exit(1);
}
echo "Confirmed Super Admin preserved: {$superAdmin->email} (ID: {$superAdmin->id})\n\n";

// ── STEP 1: SUPABASE STORAGE CLEANUP ───────────────────────────────────────────
echo "--- STEP 1: Cleaning Supabase Storage ---\n";
$baseUrl = rtrim(config('services.supabase.url'), '/');
$serviceKey = config('services.supabase.service_key');
$buckets = [
    config('services.supabase.bucket', 'solo-parent-portal-documents'),
    config('services.supabase.temp_bucket', 'solo-parent-temp'),
];

function getAllSupabaseFiles($baseUrl, $serviceKey, $bucket, $prefix = '') {
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
        return [];
    }
    
    $items = $res->json();
    $paths = [];
    foreach ($items as $item) {
        $name = $item['name'] ?? '';
        if ($name === '' || $name === '.emptyFolderPlaceholder') continue;
        
        $fullPath = $prefix ? rtrim($prefix, '/') . '/' . $name : $name;
        
        if (empty($item['id'])) {
            // Directory
            $subPaths = getAllSupabaseFiles($baseUrl, $serviceKey, $bucket, $fullPath);
            $paths = array_merge($paths, $subPaths);
        } else {
            $paths[] = $fullPath;
        }
    }
    return $paths;
}

foreach ($buckets as $bucket) {
    $files = getAllSupabaseFiles($baseUrl, $serviceKey, $bucket);
    echo "Found " . count($files) . " file(s) in bucket [{$bucket}]\n";
    
    if (count($files) > 0) {
        $encodedBucket = rawurlencode($bucket);
        $deleteUrl = "{$baseUrl}/storage/v1/object/{$encodedBucket}";
        
        // Delete in chunks of 50
        $chunks = array_chunk($files, 50);
        foreach ($chunks as $chunk) {
            $delRes = Http::withOptions(['verify' => false])
                ->withHeaders([
                    'Authorization' => "Bearer {$serviceKey}",
                    'Content-Type' => 'application/json',
                ])
                ->delete($deleteUrl, ['prefixes' => $chunk]);
            
            if ($delRes->successful()) {
                echo "Successfully deleted " . count($chunk) . " file(s) from [{$bucket}].\n";
                foreach ($chunk as $p) {
                    echo "  Deleted: {$p}\n";
                }
            } else {
                echo "FAILED to delete chunk from [{$bucket}]: " . $delRes->body() . "\n";
            }
        }
    }
}

// ── STEP 2: DATABASE CLEANUP ──────────────────────────────────────────────────
echo "\n--- STEP 2: Cleaning Database Records ---\n";

$dummyUsers = User::where('id', '!=', $superAdmin->id)->get();
echo "Found " . $dummyUsers->count() . " dummy/test user(s) to remove.\n";

$dummyUserIds = $dummyUsers->pluck('id')->toArray();
$dummyEmails = $dummyUsers->pluck('email')->toArray();

if (!empty($dummyUserIds)) {
    DB::transaction(function () use ($dummyUsers, $dummyUserIds, $dummyEmails, $superAdmin) {
        $appIds = Application::whereIn('user_id', $dummyUserIds)->pluck('id')->toArray();
        echo "Found " . count($appIds) . " application(s) linked to dummy users.\n";
        
        // 1. Delete documents
        $delDocs = Document::whereIn('application_id', $appIds)->orWhereIn('user_id', $dummyUserIds)->delete();
        echo "Deleted {$delDocs} document records.\n";
        
        // 2. Delete application status history
        $delHist = ApplicationStatusHistory::whereIn('application_id', $appIds)->delete();
        echo "Deleted {$delHist} application status history records.\n";
        
        // 3. Delete family members
        $delFm = ApplicationFamilyMember::whereIn('application_id', $appIds)->delete();
        echo "Deleted {$delFm} family member records.\n";
        
        // 4. Delete application forms
        $delForms = ApplicationForm::whereIn('application_id', $appIds)->delete();
        echo "Deleted {$delForms} application form records.\n";
        
        // 5. Delete applications
        $delApps = Application::whereIn('id', $appIds)->delete();
        echo "Deleted {$delApps} application records.\n";
        
        // 6. Delete profiles
        $delProf = ApplicantProfile::whereIn('user_id', $dummyUserIds)->delete();
        echo "Deleted {$delProf} applicant profile records.\n";
        
        // 7. Delete messages
        $delMsgs = Message::whereIn('sender_id', $dummyUserIds)->orWhereIn('recipient_id', $dummyUserIds)->delete();
        echo "Deleted {$delMsgs} message records.\n";
        
        // 8. Delete notifications
        $delNotifs = Notification::whereIn('user_id', $dummyUserIds)->delete();
        echo "Deleted {$delNotifs} notification records for dummy users.\n";
        
        // Clean orphan/test notifications on super admin
        $delAdminNotifs = Notification::where('user_id', $superAdmin->id)
            ->where(function ($q) use ($appIds, $dummyUsers) {
                foreach ($appIds as $aid) {
                    $q->orWhere('link', 'like', "%{$aid}%");
                }
                foreach ($dummyUsers as $du) {
                    if ($du->full_name) {
                        $q->orWhere('message', 'like', "%{$du->full_name}%")
                          ->orWhere('title', 'like', "%{$du->full_name}%");
                    }
                    if ($du->email) {
                        $q->orWhere('message', 'like', "%{$du->email}%");
                    }
                }
            })
            ->delete();
        echo "Cleaned {$delAdminNotifs} test-related notification(s) on super admin.\n";
        
        // 9. Delete audit logs linked to dummy users or applications
        $delLogs = AuditLog::whereIn('admin_id', $dummyUserIds)
            ->orWhere(function ($q) use ($dummyUserIds, $appIds) {
                $q->whereIn('entity_id', $dummyUserIds)
                  ->orWhereIn('entity_id', $appIds);
            })
            ->delete();
        echo "Deleted {$delLogs} audit log record(s).\n";

        // 10. Reassign any announcements to super admin
        $updatedAnnouncements = DB::table('announcements')->whereIn('created_by', $dummyUserIds)->update(['created_by' => $superAdmin->id]);
        echo "Reassigned {$updatedAnnouncements} announcement(s) to Super Admin.\n";

        // 11. Delete personal access tokens
        $delTokens = PersonalAccessToken::whereIn('tokenable_id', $dummyUserIds)->delete();
        echo "Deleted {$delTokens} personal access tokens.\n";
        
        // 12. Delete email verifications
        $filteredEmails = array_filter($dummyEmails, fn($e) => !empty($e));
        if (!empty($filteredEmails)) {
            $delVerif = DB::table('email_verifications')->whereIn('email', $filteredEmails)->delete();
            echo "Deleted {$delVerif} email verification records.\n";
        }
        
        // 13. Delete dummy users
        $delUsers = User::whereIn('id', $dummyUserIds)->delete();
        echo "Deleted {$delUsers} dummy user account(s).\n";
    });
}

// ── STEP 3: LOCAL STORAGE CLEANUP ─────────────────────────────────────────────
echo "\n--- STEP 3: Cleaning Local Temp/Document Folders ---\n";
$localDirs = [
    storage_path('app/public/users'),
    storage_path('app/public/applications'),
    storage_path('app/documents'),
];
foreach ($localDirs as $ldir) {
    if (\Illuminate\Support\Facades\File::exists($ldir)) {
        \Illuminate\Support\Facades\File::deleteDirectory($ldir);
        echo "Deleted local directory: {$ldir}\n";
    }
}

// ── STEP 4: FINAL AUDIT & VERIFICATION ─────────────────────────────────────────
echo "\n--- STEP 4: Verification & Remaining Audit ---\n";

$remainingUsers = User::all();
echo "Remaining Users in DB: " . $remainingUsers->count() . "\n";
foreach ($remainingUsers as $u) {
    echo " -> [{$u->role}] {$u->email} ({$u->full_name})\n";
}

$remainingApps = Application::count();
$remainingDocs = Document::count();
$remainingMsgs = Message::count();
echo "Remaining Applications: {$remainingApps}\n";
echo "Remaining Documents: {$remainingDocs}\n";
echo "Remaining Messages: {$remainingMsgs}\n";

foreach ($buckets as $b) {
    $remainingStorageFiles = getAllSupabaseFiles($baseUrl, $serviceKey, $b);
    echo "Remaining Supabase Storage Files in [{$b}]: " . count($remainingStorageFiles) . "\n";
    foreach ($remainingStorageFiles as $f) {
        echo " -> {$f}\n";
    }
}

echo "\nCleanup completed successfully! Only Super Admin remains.\n";
