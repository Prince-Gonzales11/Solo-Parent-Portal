<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    /**
     * Seed the default Super Administrator account.
     */
    public function run(): void
    {
        $email = env('SUPERADMIN_DEFAULT_EMAIL', 'cswdd.admin1@butuan.gov.ph');
        $defaultPassword = env('SUPERADMIN_DEFAULT_PASSWORD');

        if (empty($defaultPassword)) {
            // In testing or local environment, fallback if not configured
            $defaultPassword = app()->environment('production')
                ? \Illuminate\Support\Str::random(32)
                : (env('APP_ENV') === 'testing' ? 'test-password-123' : 'admin@CSWDD2026');
        }

        $existingUser = User::where('email', $email)->first();

        if ($existingUser) {
            // Existing administrative account: NEVER overwrite password or reset credentials
            $existingUser->update([
                'role' => 'super_admin',
                'is_active' => true,
            ]);
            return;
        }

        User::create([
            'email' => $email,
            'full_name' => 'CSWDD Super Admin',
            'password_hash' => Hash::make($defaultPassword),
            'role' => 'super_admin',
            'auth_provider' => 'local',
            'is_active' => true,
            'dpa_consent' => true,
            'email_verified_at' => now(),
            'dpa_consented_at' => now(),
            'dpa_consent_ip' => '127.0.0.1',
        ]);
    }
}
