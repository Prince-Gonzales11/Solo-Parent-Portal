<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$users = App\Models\User::all();
foreach ($users as $u) {
    echo "----------------------------------------\n";
    echo "User: {$u->id} | {$u->email} | {$u->role} | {$u->full_name}\n";
    $p = App\Models\ApplicantProfile::where('user_id', $u->id)->first();
    echo "Profile: " . ($p ? "Yes (ID: {$p->id})" : "No") . "\n";
    $apps = App\Models\Application::where('user_id', $u->id)->get();
    echo "Applications: " . $apps->count() . "\n";
    $docs = App\Models\Document::where('user_id', $u->id)->get();
    echo "Documents: " . $docs->count() . "\n";
    $msgs = App\Models\Message::where('sender_id', $u->id)->orWhere('recipient_id', $u->id)->get();
    echo "Messages: " . $msgs->count() . "\n";
    $notifs = App\Models\Notification::where('user_id', $u->id)->get();
    echo "Notifications: " . $notifs->count() . "\n";
    $tokens = Laravel\Sanctum\PersonalAccessToken::where('tokenable_id', $u->id)->get();
    echo "Tokens: " . $tokens->count() . "\n";
}
