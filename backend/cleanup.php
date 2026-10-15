<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

$users = User::where('role', '!=', 'super_admin')->get();
foreach ($users as $u) {
    $u->delete();
}
echo "Deleted " . $users->count() . " users.\n";
