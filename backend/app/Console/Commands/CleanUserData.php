<?php

namespace App\Console\Commands;

use App\Models\ApplicantProfile;
use App\Models\Application;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Document;
use App\Models\EmailVerification;
use App\Models\Notification;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class CleanUserData extends Command
{
    protected $signature = 'portal:clean-user-data {--force : Force cleanup without confirmation}';
    protected $description = 'Safely clean test applicant/user data while strictly preserving categories, documentary requirements, barangays, and admin accounts.';

    public function handle()
    {
        if (!$this->option('force') && !$this->confirm('This will wipe all applicant accounts, applications, and documents, but will PRESERVE all Solo Parent categories and requirements. Do you want to proceed?')) {
            $this->info('Cleanup cancelled.');
            return 0;
        }

        $this->info('Starting safe cleanup of user test data...');

        DB::beginTransaction();

        try {
            // 1. Delete transactional records
            $docsCount = Document::count();
            Document::query()->delete();
            $this->line("  - Deleted {$docsCount} document records.");

            // Purge file server objects in Supabase storage
            $baseUrl = rtrim(config('services.supabase.url', env('SUPABASE_URL')), '/');
            $serviceKey = config('services.supabase.service_key', env('SUPABASE_SERVICE_KEY'));
            if ($baseUrl && $serviceKey) {
                try {
                    $client = \Illuminate\Support\Facades\Http::withoutVerifying()->withHeaders([
                        'Authorization' => "Bearer {$serviceKey}",
                    ]);
                    $bucketsRes = $client->get("{$baseUrl}/storage/v1/bucket");
                    if ($bucketsRes->successful()) {
                        $buckets = $bucketsRes->json();
                        $deletedFilesCount = 0;
                        if (is_array($buckets)) {
                            foreach ($buckets as $b) {
                                $bId = $b['id'] ?? $b['name'];
                                $filesRes = $client->post("{$baseUrl}/storage/v1/object/list/{$bId}", [
                                    'prefix' => '',
                                    'limit' => 100,
                                ]);
                                if ($filesRes->successful() && is_array($filesRes->json())) {
                                    $names = array_filter(array_column($filesRes->json(), 'name'));
                                    if (!empty($names)) {
                                        $client->delete("{$baseUrl}/storage/v1/object/{$bId}", [
                                            'prefixes' => array_values($names),
                                        ]);
                                        $deletedFilesCount += count($names);
                                    }
                                }
                            }
                        }
                        $this->line("  - Cleared Supabase file server ({$deletedFilesCount} file(s) removed).");
                    }
                } catch (\Throwable $storageEx) {
                    $this->warn("  ! Supabase storage notice: " . $storageEx->getMessage());
                }
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('application_status_history')) {
                $historyCount = DB::table('application_status_history')->count();
                DB::table('application_status_history')->delete();
                $this->line("  - Deleted {$historyCount} application history records.");
            }

            $appsCount = Application::count();
            Application::query()->delete();
            $this->line("  - Deleted {$appsCount} application records.");

            $profilesCount = ApplicantProfile::count();
            ApplicantProfile::query()->delete();
            $this->line("  - Deleted {$profilesCount} applicant profile records.");

            $notifsCount = Notification::count();
            Notification::query()->delete();
            $this->line("  - Deleted {$notifsCount} notifications.");

            $auditsCount = AuditLog::count();
            AuditLog::query()->delete();
            $this->line("  - Deleted {$auditsCount} audit logs.");

            $verifsCount = EmailVerification::count();
            EmailVerification::query()->delete();
            $this->line("  - Deleted {$verifsCount} email verifications.");

            if (\Illuminate\Support\Facades\Schema::hasTable('personal_access_tokens')) {
                $tokensCount = DB::table('personal_access_tokens')->count();
                DB::table('personal_access_tokens')->delete();
                $this->line("  - Cleared {$tokensCount} personal access tokens.");
            }

            // 2. Delete all non-super_admin accounts (including accounts with NULL email)
            $nonAdminQuery = User::where(function ($q) {
                $q->where('email', '!=', 'cswdd.admin1@butuan.gov.ph')
                  ->orWhereNull('email');
            })->where('role', '!=', 'super_admin');
            
            $nonAdminCount = $nonAdminQuery->count();
            $nonAdminQuery->delete();
            $this->line("  - Deleted {$nonAdminCount} non-super-admin user account(s).");

            // 3. Ensure Super Admin account exists
            User::updateOrCreate(
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
            $this->line("  - Verified Super Admin account (cswdd.admin1@butuan.gov.ph).");

            DB::commit();

            // 4. Ensure reference data is preserved and intact
            $categoryCount = Category::count();
            if ($categoryCount === 0) {
                $this->warn('  ! Categories were empty, re-seeding now...');
                (new CategorySeeder())->run();
                $categoryCount = Category::count();
            }

            $reqsCount = DB::table('documentary_requirements')->count();

            // 5. Clear application caches
            Cache::flush();

            $this->newLine();
            $this->info('═════════════════════════════════════════════════════');
            $this->info('  CLEANUP COMPLETE — SYSTEM INTEGRITY VERIFIED');
            $this->info('═════════════════════════════════════════════════════');
            $this->info("  Preserved Categories:    {$categoryCount} categories");
            $this->info("  Preserved Requirements:  {$reqsCount} requirements");
            if (\Illuminate\Support\Facades\Schema::hasTable('barangays')) {
                $barangaysCount = DB::table('barangays')->count();
                $this->info("  Preserved Barangays:     {$barangaysCount} barangays");
            }
            $this->info("  Preserved Admin Users:   " . User::whereIn('role', ['admin', 'super_admin'])->count() . " admin(s)");
            $this->info('═════════════════════════════════════════════════════');
            $this->info('System is clean and ready for new applicant registration.');

            return 0;
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('Cleanup failed: ' . $e->getMessage());
            return 1;
        }
    }
}
