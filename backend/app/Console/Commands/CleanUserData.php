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
        // 1. Production and staging environment prohibition
        if (app()->environment('production', 'staging')) {
            $this->error("Safety violation: Destructive test cleanup command 'portal:clean-user-data' is strictly prohibited in " . strtoupper(app()->environment()) . " environment.");
            return 1;
        }

        // 2. Database connection and host verification
        $defaultConn = config('database.default');
        $connConfig = config("database.connections.{$defaultConn}", []);
        $host = (string) ($connConfig['host'] ?? '');
        $database = (string) ($connConfig['database'] ?? '');

        $allowedLocalHosts = ['127.0.0.1', 'localhost', '::1', 'sqlite', ''];
        if (!in_array(strtolower($host), $allowedLocalHosts, true)) {
            $this->error("Safety violation: Destructive cleanup is strictly prohibited against non-local database host '{$host}'.");
            return 1;
        }

        $prohibitedPatterns = ['supabase', 'amazonaws', 'rds', 'cloud', 'prod', 'production', 'pooler', 'stage', 'staging'];
        foreach ($prohibitedPatterns as $pattern) {
            if (str_contains(strtolower($host), $pattern) || str_contains(strtolower($database), $pattern)) {
                $this->error("Safety violation: Database configuration matches prohibited remote/cloud pattern '{$pattern}'. Aborting.");
                return 1;
            }
        }

        // 3. Storage driver verification: must strictly be local or mock
        $storage = app(\App\Services\SupabaseStorageService::class);
        if (!$storage->isLocalDriver()) {
            $this->error("Safety violation: Destructive test-data cleanup is strictly prohibited against remote storage driver '{$storage->getDriver()}'. Storage must be set to 'local' or 'mock'.");
            return 1;
        }

        // 4. Interactive confirmation (cannot bypass environment safeguards)
        if (!$this->option('force')) {
            if (!$this->confirm("WARNING: This will wipe applicant accounts, applications, and documents from LOCAL test database '{$database}'. Categories, barangays, and admin accounts will be PRESERVED. Proceed?")) {
                $this->info('Cleanup cancelled.');
                return 0;
            }
        }

        $this->info("Starting safe cleanup of user test data in local database '{$database}'...");

        DB::beginTransaction();

        try {
            // 1. Delete transactional records
            $docsCount = Document::count();
            Document::query()->delete();
            $this->line("  - Deleted {$docsCount} document records.");

            // 2. Purge local mock storage only (zero cloud interaction)
            $mockDir = $storage->getLocalStoragePath();
            $deletedFilesCount = 0;
            if (is_dir($mockDir)) {
                $iterator = new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator($mockDir, \FilesystemIterator::SKIP_DOTS),
                    \RecursiveIteratorIterator::CHILD_FIRST
                );
                foreach ($iterator as $item) {
                    if ($item->isFile()) {
                        @unlink($item->getPathname());
                        $deletedFilesCount++;
                    } elseif ($item->isDir()) {
                        @rmdir($item->getPathname());
                    }
                }
            }
            $this->line("  - Cleared local mock storage ({$deletedFilesCount} file(s) removed).");

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

            // 3. Delete non-admin user accounts, strictly preserving ALL admin and super_admin accounts
            $nonAdminQuery = User::whereNotIn('role', ['admin', 'super_admin'])
                ->where(function ($q) {
                    $q->where('email', '!=', 'cswdd.admin1@butuan.gov.ph')
                      ->orWhereNull('email');
                });
            
            $nonAdminCount = $nonAdminQuery->count();
            $nonAdminQuery->delete();
            $this->line("  - Deleted {$nonAdminCount} non-admin user account(s).");

            // 4. Ensure Super Admin account exists WITHOUT overwriting any existing password
            $superAdmin = User::where('role', 'super_admin')->first();
            if (!$superAdmin) {
                $seedPassword = env('SEED_ADMIN_PASSWORD');
                if ($seedPassword) {
                    User::create([
                        'email' => 'cswdd.admin1@butuan.gov.ph',
                        'full_name' => 'Super Admin',
                        'password_hash' => Hash::make($seedPassword),
                        'role' => 'super_admin',
                        'is_active' => true,
                        'email_verified_at' => now(),
                        'dpa_consented_at' => now(),
                        'auth_provider' => 'local',
                    ]);
                    $this->line("  - Seeded initial Super Admin account.");
                } else {
                    $this->warn("  ! No Super Admin found; create via 'php artisan db:seed' or configure SEED_ADMIN_PASSWORD.");
                }
            } else {
                $this->line("  - Preserved existing Super Admin account ({$superAdmin->email}) without modifying credentials.");
            }

            DB::commit();

            // 5. Ensure reference data is preserved and intact
            $categoryCount = Category::count();
            if ($categoryCount === 0) {
                $this->warn('  ! Categories were empty, re-seeding now...');
                (new CategorySeeder())->run();
                $categoryCount = Category::count();
            }

            $reqsCount = DB::table('documentary_requirements')->count();

            // 6. Clear application caches
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
