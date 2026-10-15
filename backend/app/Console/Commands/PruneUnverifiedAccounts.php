<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\EmailVerification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PruneUnverifiedAccounts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'auth:prune-unverified 
                            {--hours=48 : Purge unverified registrations older than this number of hours} 
                            {--dry-run : Simulate the deletion without modifying the database}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Safely prune abandoned unverified accounts that never completed email/mobile OTP verification, strictly preserving real users and active applicants.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $hours = (int) $this->option('hours');
        if ($hours < 1) {
            $hours = 48;
        }

        $isDryRun = (bool) $this->option('dry-run');
        $cutoff = Carbon::now()->subHours($hours);

        $this->info("Scanning for abandoned unverified accounts created before {$cutoff->toDateTimeString()} ({$hours} hours ago)...");

        // Target unverified applicants who have no applications and no uploaded documents
        $query = User::whereNull('email_verified_at')
            ->where(function ($q) {
                $q->where('role', 'applicant')
                  ->orWhere('role', 'solo_parent');
            })
            ->where('created_at', '<', $cutoff)
            ->whereDoesntHave('applications')
            ->whereDoesntHave('documents');

        $count = $query->count();

        if ($count === 0) {
            $this->info('✓ No abandoned unverified accounts found matching criteria. Database is clean.');
            return 0;
        }

        if ($isDryRun) {
            $this->warn("[DRY RUN] Found {$count} abandoned unverified account(s) that would be safely pruned.");
            $query->limit(10)->get(['id', 'email', 'created_at'])->each(function ($user) {
                $this->line("  - ID: {$user->id} | {$user->email} | Created: {$user->created_at}");
            });
            if ($count > 10) {
                $this->line("  ... and " . ($count - 10) . " more.");
            }
            return 0;
        }

        $this->warn("Found {$count} abandoned unverified account(s). Purging safely...");

        DB::beginTransaction();
        try {
            $userIds = $query->pluck('id');

            // Delete associated pending email verification codes
            EmailVerification::whereIn('user_id', $userIds)->delete();

            // Delete applicant profiles if any draft existed without an application
            DB::table('applicant_profiles')->whereIn('user_id', $userIds)->delete();

            // Delete unverified users
            $deletedCount = User::whereIn('id', $userIds)->delete();

            DB::commit();

            $this->info("✓ Successfully pruned {$deletedCount} abandoned unverified account(s).");
            return 0;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error("Failed to prune accounts: " . $e->getMessage());
            return 1;
        }
    }
}
