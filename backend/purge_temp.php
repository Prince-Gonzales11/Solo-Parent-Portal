<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
use Illuminate\Support\Facades\DB;
$nonAdmins = App\Models\User::where('role', '!=', 'super_admin')->get();
foreach ($nonAdmins as $u) {
    $u->tokens()->delete();
    try { DB::table('document_audit_logs')->where('actor_id', $u->id)->delete(); } catch (\Throwable $e) {}
    foreach (App\Models\Application::where('user_id', $u->id)->get() as $a) {
        try { DB::table('application_timelines')->where('application_id', $a->id)->delete(); } catch (\Throwable $e) {}
        try { DB::table('document_audit_logs')->where('application_id', $a->id)->delete(); } catch (\Throwable $e) {}
        try { DB::table('documents')->where('application_id', $a->id)->delete(); } catch (\Throwable $e) {}
        try { DB::table('application_forms')->where('application_id', $a->id)->delete(); } catch (\Throwable $e) {}
        $a->delete();
    }
    App\Models\ApplicantProfile::where('user_id', $u->id)->delete();
    App\Models\Notification::where('user_id', $u->id)->delete();
    $u->delete();
}
echo 'Purge complete. Remaining users: ' . App\Models\User::count() . PHP_EOL;
