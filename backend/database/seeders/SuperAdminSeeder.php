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
        User::updateOrCreate(
            ['email' => 'cswdd.admin1@butuan.gov.ph'],
            [
                'full_name' => 'CSWDD Super Admin',
                'password_hash' => Hash::make('admin@CSWDD2026'),
                'role' => 'super_admin',
                'auth_provider' => 'local',
                'is_active' => true,
                'dpa_consent' => true,
                'email_verified_at' => now(),
                'dpa_consented_at' => now(),
                'dpa_consent_ip' => '127.0.0.1',
            ]
        );
    }
}
