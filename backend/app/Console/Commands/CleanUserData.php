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
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class CleanUserData extends Command
{
    protected $signature = 'portal:clean-user-data
                            {--connection= : Target database connection override (strictly prohibited to prevent cross-database modifications)}
                            {--force : Force cleanup without confirmation}
                            {--disposable-marker= : Explicit disposable environment identity marker}';

    protected $description = 'Safely clean test applicant/user data in verified disposable test databases only, while strictly preserving categories, documentary requirements, barangays, and admin accounts.';

    public const REQUIRED_DISPOSABLE_MARKER = 'solo_parent_disposable_verified_e2e';
    public const ALLOWED_PGSQL_DATABASE = 'solo_parent_disposable_e2e';
    public const ALLOWED_SQLITE_FILE = 'disposable_e2e.sqlite';
    public const ALLOWED_DISPOSABLE_STORAGE_DIR = 'disposable_e2e_storage';

    public function handle(): int
    {
        // 1. Connection Override Prohibition Guard:
        // Destructive operations execute against Laravel's default database connection.
        // Allowing a --connection override risks validating one connection and deleting from another.
        if ($this->hasOption('connection') && $this->option('connection')) {
            $override = (string) $this->option('connection');
            $defaultConn = (string) config('database.default', 'sqlite');
            if ($override !== $defaultConn) {
                $this->error("Safety violation: Connection mismatch detected. Connection override '{$override}' does not match active default connection '{$defaultConn}'. Destructive cleanup strictly refuses execution to prevent cross-database modifications.");
                return 1;
            }
            $this->error("Safety violation: Connection override '--connection' is disabled. The active default database connection must directly be the verified disposable database.");
            return 1;
        }

        $defaultConn = (string) config('database.default', 'sqlite');

        // 2. Environment Guard: Prohibit production and staging environments
        $env = strtolower((string) app()->environment());
        if (in_array($env, ['production', 'staging'], true)) {
            $this->error("Safety violation: Destructive cleanup command 'portal:clean-user-data' is strictly prohibited in " . strtoupper($env) . " environment.");
            return 1;
        }

        // 3. Storage Driver Guard: Must be strictly local or mock
        $storage = app(\App\Services\SupabaseStorageService::class);
        if (!$storage->isLocalDriver()) {
            $this->error("Safety violation: Destructive cleanup is strictly prohibited against non-local storage driver '{$storage->getDriver()}'. Storage driver must be 'local' or 'mock'.");
            return 1;
        }

        // 4. Shared Cache Backend Guard: Prohibit shared cache stores to prevent cross-app cache corruption
        $cacheStore = strtolower((string) config('cache.default', 'file'));
        $prohibitedCacheStores = ['redis', 'memcached', 'dynamodb'];
        if (in_array($cacheStore, $prohibitedCacheStores, true)) {
            $this->error("Safety violation: Destructive cleanup cannot run with shared cache store '{$cacheStore}'. Refusing execution to prevent global cache invalidation.");
            return 1;
        }

        // 5. Inspect effective Laravel default database configuration (connection, overrides, DB_URL)
        $connConfig = config("database.connections.{$defaultConn}", []);
        $rawDriver = strtolower((string) ($connConfig['driver'] ?? $defaultConn));

        $url = $connConfig['url'] ?? env('DB_URL') ?? env('DATABASE_URL');
        $parsedUrl = is_string($url) && !empty($url) ? parse_url($url) : [];

        $host = (string) ($parsedUrl['host'] ?? $connConfig['host'] ?? '');
        $database = (string) (
            isset($parsedUrl['path']) && $parsedUrl['path'] !== ''
                ? ltrim($parsedUrl['path'], '/')
                : ($connConfig['database'] ?? '')
        );
        $username = (string) ($parsedUrl['user'] ?? $connConfig['username'] ?? '');
        $port = (int) ($parsedUrl['port'] ?? $connConfig['port'] ?? 0);
        $sslMode = strtolower((string) ($connConfig['sslmode'] ?? ''));

        // 6. Host and Cloud/Remote Pattern Guard
        $allowedLocalHosts = ['127.0.0.1', 'localhost', '::1', 'sqlite', ''];
        if (!in_array(strtolower($host), $allowedLocalHosts, true)) {
            $this->error("Safety violation: Destructive cleanup is strictly prohibited against non-local database host '{$host}'.");
            return 1;
        }

        $prohibitedPatterns = ['supabase', 'amazonaws', 'rds', 'cloud', 'pooler', 'neon', 'prod', 'production', 'staging', 'stage'];
        foreach ($prohibitedPatterns as $pattern) {
            if (
                str_contains(strtolower($host), $pattern) ||
                str_contains(strtolower($database), $pattern) ||
                str_contains(strtolower($username), $pattern) ||
                (is_string($url) && str_contains(strtolower($url), $pattern))
            ) {
                $this->error("Safety violation: Database configuration matches prohibited remote/cloud pattern '{$pattern}'. Aborting.");
                return 1;
            }
        }

        // 7. Forwarded Remote Connection and Port/Tunnel Guard
        $isForwarded = !empty($connConfig['is_forwarded']) || !empty(env('DB_FORWARDED'));
        if ($port === 6543 || $isForwarded || in_array($sslMode, ['verify-full', 'verify-ca'], true)) {
            $this->error("Safety violation: Detected potentially forwarded or tunneled remote database configuration (port {$port}, sslmode '{$sslMode}'). Cannot reliably verify local isolation. Aborting.");
            return 1;
        }

        // 8. Strict Database Driver and Name Allowlist
        if ($rawDriver === 'pgsql' || $rawDriver === 'postgres') {
            // Explicitly reject primary local test database
            if ($database === 'solo_parent_local_test') {
                $this->error("Safety violation: Destructive cleanup is strictly prohibited against primary test database 'solo_parent_local_test'. Only exact allowlisted database '" . self::ALLOWED_PGSQL_DATABASE . "' is permitted.");
                return 1;
            }

            // Prohibit any database other than exact allowlisted disposable database
            if ($database !== self::ALLOWED_PGSQL_DATABASE) {
                $this->error("Safety violation: Destructive cleanup is strictly prohibited against database '{$database}'. Only exact allowlisted database '" . self::ALLOWED_PGSQL_DATABASE . "' is permitted.");
                return 1;
            }

            // Database User Privileges Check:
            // Prohibit superusers / administrative accounts that could modify unrelated databases
            $prohibitedUsers = ['postgres', 'root', 'admin', 'administrator', 'supabase_admin'];
            if (in_array(strtolower($username), $prohibitedUsers, true)) {
                $this->error("Safety violation: Database user '{$username}' has excessive administrative privileges and can modify unrelated databases. Destructive cleanup requires a narrowly restricted disposable runner account.");
                return 1;
            }

            $authorizedUsers = ['solo_parent_disposable_user', 'solo_parent_tester', 'disposable_e2e_user', 'disposable_runner'];
            $configuredAllowedUser = config('database.disposable_authorized_user');
            if ($configuredAllowedUser) {
                $authorizedUsers[] = strtolower((string) $configuredAllowedUser);
            }
            if (!empty($username) && !in_array(strtolower($username), $authorizedUsers, true)) {
                $this->error("Safety violation: Database user '{$username}' is not authorized for destructive disposable cleanup. Account must have narrowly restricted privileges.");
                return 1;
            }
        } elseif ($rawDriver === 'sqlite') {
            $isMemory = ($database === ':memory:');

            if (!$isMemory) {
                // Reject empty database or lookalike filenames
                if (empty($database) || basename($database) !== self::ALLOWED_SQLITE_FILE) {
                    $this->error("Safety violation: SQLite database '{$database}' is not an approved disposable target. Only ':memory:' or exact canonical 'database/" . self::ALLOWED_SQLITE_FILE . "' is permitted.");
                    return 1;
                }

                $approvedPath = database_path(self::ALLOWED_SQLITE_FILE);

                // Reject symlinks
                if (is_link($database) || (file_exists($approvedPath) && is_link($approvedPath))) {
                    $this->error("Safety violation: Symlinks are strictly prohibited for disposable SQLite database target.");
                    return 1;
                }

                // Canonical path resolution
                $canonicalApprovedDir = realpath(database_path());
                $canonicalDbDir = realpath(dirname($database));
                $canonicalDb = realpath($database);
                $canonicalApproved = realpath($approvedPath);

                if ($canonicalApprovedDir === false || $canonicalDbDir === false || $canonicalDbDir !== $canonicalApprovedDir) {
                    $this->error("Safety violation: SQLite database path '{$database}' does not resolve to the canonical approved path '{$approvedPath}'. Execution aborted.");
                    return 1;
                }

                if ($canonicalApproved !== false && ($canonicalDb === false || $canonicalDb !== $canonicalApproved)) {
                    $this->error("Safety violation: SQLite database path '{$database}' does not resolve to the canonical approved path '{$approvedPath}'. Execution aborted.");
                    return 1;
                }
            }
        } else {
            // Reject any other database drivers (mysql, mariadb, sqlsrv, etc.)
            $this->error("Safety violation: Database driver '{$rawDriver}' is not authorized for disposable cleanup. Only verified pgsql or approved disposable sqlite targets are permitted.");
            return 1;
        }

        // 9. Disposable Environment Identity Marker Verification
        $marker = (string) (
            $this->option('disposable-marker') ?:
            config('database.disposable_instance_marker') ?:
            config('database.disposable_marker') ?:
            env('DISPOSABLE_INSTANCE_MARKER') ?:
            env('DISPOSABLE_MARKER') ?:
            ''
        );

        if (empty($marker)) {
            $this->error("Safety violation: Missing required disposable environment identity marker. Execution aborted.");
            return 1;
        }

        if ($marker !== self::REQUIRED_DISPOSABLE_MARKER) {
            $this->error("Safety violation: Invalid disposable environment identity marker '{$marker}'. Expected '" . self::REQUIRED_DISPOSABLE_MARKER . "'. Execution aborted.");
            return 1;
        }

        // 10. Independently Verify the Actual Live Connected Database Identity Before Deletion
        try {
            $pdo = DB::connection($defaultConn)->getPdo();
        } catch (\Throwable $e) {
            $this->error("Safety violation: Unable to establish database connection for identity verification: " . $e->getMessage());
            return 1;
        }

        try {
            $connectedIdentity = $this->getConnectedDatabaseIdentity($defaultConn, $rawDriver, $pdo);
        } catch (\Throwable $e) {
            $this->error("Safety violation: Failed to verify live connected database identity: " . $e->getMessage());
            return 1;
        }

        if ($rawDriver === 'pgsql' || $rawDriver === 'postgres') {
            if ($connectedIdentity['database'] !== self::ALLOWED_PGSQL_DATABASE) {
                $this->error("Safety violation: Actual connected database '{$connectedIdentity['database']}' does not match allowed disposable database '" . self::ALLOWED_PGSQL_DATABASE . "'. Aborting.");
                return 1;
            }
        } elseif ($rawDriver === 'sqlite') {
            $isMemory = ($database === ':memory:');
            if ($isMemory) {
                if ($connectedIdentity['file'] !== '') {
                    $this->error("Safety violation: Connected SQLite database is not an in-memory instance. Aborting.");
                    return 1;
                }
            } else {
                $approvedPath = database_path(self::ALLOWED_SQLITE_FILE);
                $canonicalApproved = realpath($approvedPath);
                $liveFile = $connectedIdentity['file'];

                if (empty($liveFile) || is_link($liveFile)) {
                    $this->error("Safety violation: Connected SQLite database path is empty or a symlink. Aborting.");
                    return 1;
                }

                $canonicalLive = realpath($liveFile);
                if ($canonicalLive === false || $canonicalApproved === false || $canonicalLive !== $canonicalApproved) {
                    $this->error("Safety violation: Actual live connected SQLite database '{$liveFile}' does not match approved disposable canonical path '{$approvedPath}'. Aborting.");
                    return 1;
                }
            }
        }

        // 11. Storage Isolation Verification: Ensure shared mock storage is not purged
        try {
            $disposableStorageDir = $this->getVerifiedDisposableStoragePath();
        } catch (\DomainException $e) {
            $this->error("Safety violation: " . $e->getMessage());
            return 1;
        }

        // 12. Interactive confirmation (bypassed ONLY with --force, NEVER bypasses isolation checks)
        if (!$this->option('force')) {
            if (!$this->confirm("WARNING: This will wipe applicant accounts, applications, and documents from verified disposable test database '{$database}'. Categories, barangays, and admin accounts will be PRESERVED. Proceed?")) {
                $this->info('Cleanup cancelled.');
                return 0;
            }
        }

        $this->info("Starting safe cleanup of user test data in verified disposable database '{$database}'...");

        DB::connection($defaultConn)->beginTransaction();

        try {
            // 1. Delete transactional records on verified connection
            $docsCount = Document::on($defaultConn)->count();
            Document::on($defaultConn)->delete();
            $this->line("  - Deleted {$docsCount} document records.");

            // 2. Purge local mock storage only if verified isolated disposable storage root is established
            if ($disposableStorageDir === null) {
                $this->line("  - Storage isolation not established (shared mock root detected); filesystem deletion disabled.");
            } else {
                $this->purgeVerifiedDisposableStorage($disposableStorageDir);
            }

            if (Schema::connection($defaultConn)->hasTable('application_status_history')) {
                $historyCount = DB::connection($defaultConn)->table('application_status_history')->count();
                DB::connection($defaultConn)->table('application_status_history')->delete();
                $this->line("  - Deleted {$historyCount} application history records.");
            }

            $appsCount = Application::on($defaultConn)->count();
            Application::on($defaultConn)->delete();
            $this->line("  - Deleted {$appsCount} application records.");

            $profilesCount = ApplicantProfile::on($defaultConn)->count();
            ApplicantProfile::on($defaultConn)->delete();
            $this->line("  - Deleted {$profilesCount} applicant profile records.");

            $notifsCount = Notification::on($defaultConn)->count();
            Notification::on($defaultConn)->delete();
            $this->line("  - Deleted {$notifsCount} notifications.");

            $auditsCount = AuditLog::on($defaultConn)->count();
            AuditLog::on($defaultConn)->delete();
            $this->line("  - Deleted {$auditsCount} audit logs.");

            $verifsCount = EmailVerification::on($defaultConn)->count();
            EmailVerification::on($defaultConn)->delete();
            $this->line("  - Deleted {$verifsCount} email verifications.");

            if (Schema::connection($defaultConn)->hasTable('personal_access_tokens')) {
                $tokensCount = DB::connection($defaultConn)->table('personal_access_tokens')->count();
                DB::connection($defaultConn)->table('personal_access_tokens')->delete();
                $this->line("  - Cleared {$tokensCount} personal access tokens.");
            }

            // 3. Delete non-admin user accounts, strictly preserving ALL admin and super_admin accounts
            $nonAdminQuery = User::on($defaultConn)->whereNotIn('role', ['admin', 'super_admin'])
                ->where(function ($q) {
                    $q->where('email', '!=', 'cswdd.admin1@butuan.gov.ph')
                      ->orWhereNull('email');
                });
            
            $nonAdminCount = $nonAdminQuery->count();
            $nonAdminQuery->delete();
            $this->line("  - Deleted {$nonAdminCount} non-admin user account(s).");

            // 4. Ensure Super Admin account exists WITHOUT overwriting any existing password
            $superAdmin = User::on($defaultConn)->where('role', 'super_admin')->first();
            if (!$superAdmin) {
                $seedPassword = env('SEED_ADMIN_PASSWORD');
                if ($seedPassword) {
                    User::on($defaultConn)->create([
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

            DB::connection($defaultConn)->commit();

            // 5. Ensure reference data is preserved and intact
            $categoryCount = Category::on($defaultConn)->count();
            if ($categoryCount === 0) {
                $this->warn('  ! Categories were empty, re-seeding now...');
                (new CategorySeeder())->run();
                $categoryCount = Category::on($defaultConn)->count();
            }

            $reqsCount = DB::connection($defaultConn)->table('documentary_requirements')->count();

            // 6. Application-specific cache invalidation (NO global Cache::flush)
            $scopedCacheKeys = [
                'public_categories_list',
                'public_resources_list',
                'public_announcements_list',
                'public_stats_counts',
                'public_landing_full_data',
            ];
            foreach ($scopedCacheKeys as $cacheKey) {
                Cache::forget($cacheKey);
            }
            $this->line("  - Invalidated portal application cache keys (preserved non-portal/shared caches).");

            $this->newLine();
            $this->info('═════════════════════════════════════════════════════');
            $this->info('  CLEANUP COMPLETE — SYSTEM INTEGRITY VERIFIED');
            $this->info('═════════════════════════════════════════════════════');
            $this->info("  Preserved Categories:    {$categoryCount} categories");
            $this->info("  Preserved Requirements:  {$reqsCount} requirements");
            if (Schema::connection($defaultConn)->hasTable('barangays')) {
                $barangaysCount = DB::connection($defaultConn)->table('barangays')->count();
                $this->info("  Preserved Barangays:     {$barangaysCount} barangays");
            }
            $this->info("  Preserved Admin Users:   " . User::on($defaultConn)->whereIn('role', ['admin', 'super_admin'])->count() . " admin(s)");
            $this->info('═════════════════════════════════════════════════════');
            $this->info('System is clean and ready for new applicant registration.');

            return 0;
        } catch (\Exception $e) {
            DB::connection($defaultConn)->rollBack();
            $this->error('Cleanup failed: ' . $e->getMessage());
            return 1;
        }
    }

    /**
     * Resolve and verify the isolated disposable storage root.
     * Returns the verified canonical directory path, or null if storage isolation is not established
     * (in which case filesystem deletion is strictly disabled to protect shared local files).
     *
     * @throws \DomainException If an invalid, escaping, or unapproved storage path is configured.
     */
    protected function getVerifiedDisposableStoragePath(): ?string
    {
        $configured = config('services.supabase.disposable_storage_path')
            ?: config('filesystems.disposable_storage_root')
            ?: env('DISPOSABLE_STORAGE_ROOT')
            ?: env('DISPOSABLE_STORAGE_PATH');

        $candidate = $configured ?: storage_path('app/' . self::ALLOWED_DISPOSABLE_STORAGE_DIR);

        $generalMockPath = storage_path('app/mock_supabase');
        $canonicalGeneral = realpath($generalMockPath);

        // Normalize paths
        $normCandidate = str_replace('\\', '/', $candidate);
        $normGeneral = $canonicalGeneral ? str_replace('\\', '/', $canonicalGeneral) : str_replace('\\', '/', $generalMockPath);

        // Check if candidate matches or resides within shared mock storage
        if ($normCandidate === $normGeneral || str_starts_with($normCandidate, $normGeneral . '/')) {
            if ($configured) {
                throw new \DomainException("Configured disposable storage root '{$candidate}' targets shared mock storage. Refusing execution to prevent cross-environment data loss.");
            }
            return null;
        }

        if (!file_exists($candidate)) {
            if ($configured) {
                throw new \DomainException("Configured disposable storage root does not exist: {$candidate}");
            }
            return null;
        }

        $canonicalCandidate = realpath($candidate);
        if ($canonicalCandidate === false || is_link($candidate)) {
            throw new \DomainException("Disposable storage root cannot be a symlink or unresolved path: {$candidate}");
        }

        // Prohibited system and app roots
        $appStorageBase = realpath(storage_path('app'));
        if ($appStorageBase === false || !str_starts_with($canonicalCandidate, $appStorageBase . DIRECTORY_SEPARATOR)) {
            throw new \DomainException("Disposable storage root '{$candidate}' escapes approved storage boundary.");
        }

        $baseDirname = basename($canonicalCandidate);
        if ($baseDirname !== self::ALLOWED_DISPOSABLE_STORAGE_DIR && !str_starts_with($baseDirname, 'disposable_e2e')) {
            throw new \DomainException("Disposable storage directory name '{$baseDirname}' is not an approved disposable target (must be '" . self::ALLOWED_DISPOSABLE_STORAGE_DIR . "').");
        }

        return $canonicalCandidate;
    }

    /**
     * Safely purge files inside the verified isolated disposable storage directory.
     */
    protected function purgeVerifiedDisposableStorage(string $disposableStorageDir): void
    {
        $canonicalBase = realpath($disposableStorageDir);
        if ($canonicalBase === false || is_link($disposableStorageDir)) {
            $this->warn("  ! Disposable storage directory is invalid or symlinked. Skipping filesystem cleanup.");
            return;
        }

        $deletedFilesCount = 0;
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($canonicalBase, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $item) {
            $itemPath = $item->getPathname();
            if (is_link($itemPath)) {
                @unlink($itemPath);
                continue;
            }

            $canonicalItem = realpath($itemPath);
            if ($canonicalItem === false || !str_starts_with($canonicalItem, $canonicalBase . DIRECTORY_SEPARATOR)) {
                continue;
            }

            if ($item->isFile()) {
                @unlink($canonicalItem);
                $deletedFilesCount++;
            } elseif ($item->isDir()) {
                @rmdir($canonicalItem);
            }
        }

        $this->line("  - Cleared isolated disposable storage ({$deletedFilesCount} file(s) removed).");
    }

    /**
     * Independently query and return the connected database identity.
     *
     * @return array{driver: string, database: string, file: string}
     */
    protected function getConnectedDatabaseIdentity(string $connection, string $driver, \PDO $pdo): array
    {
        if ($driver === 'pgsql' || $driver === 'postgres') {
            $connectedDbRow = DB::connection($connection)->selectOne("SELECT current_database() AS db");
            return [
                'driver'   => 'pgsql',
                'database' => (string) ($connectedDbRow->db ?? ''),
                'file'     => '',
            ];
        }

        if ($driver === 'sqlite') {
            $stmt = $pdo->query('PRAGMA database_list');
            $rows = $stmt ? $stmt->fetchAll(\PDO::FETCH_ASSOC) : [];
            $mainFile = '';
            foreach ($rows as $row) {
                if (($row['name'] ?? '') === 'main') {
                    $mainFile = (string) ($row['file'] ?? '');
                    break;
                }
            }
            return [
                'driver'   => 'sqlite',
                'database' => $mainFile ? basename($mainFile) : ':memory:',
                'file'     => $mainFile,
            ];
        }

        return [
            'driver'   => (string) $pdo->getAttribute(\PDO::ATTR_DRIVER_NAME),
            'database' => '',
            'file'     => '',
        ];
    }
}
