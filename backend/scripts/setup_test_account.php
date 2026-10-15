<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\ApplicantProfile;
use App\Models\Barangay;
use Illuminate\Support\Facades\Hash;

echo "--- Setting up admin account ---\n";

// 1. Ensure Super Admin exists
$admin = User::updateOrCreate(
    ['email' => 'cswdd.admin1@butuan.gov.ph'],
    [
        'full_name' => 'Super Admin',
        'password_hash' => Hash::make('admin@CSWDD2026'),
        'role' => 'super_admin',
        'is_active' => true,
        'email_verified_at' => now(),
        'dpa_consented_at' => now(),
        'auth_provider' => 'local',
    ]
);
echo "Admin ready: " . $admin->email . " (Password: admin@CSWDD2026)\n";
echo "Setup complete!\n";
