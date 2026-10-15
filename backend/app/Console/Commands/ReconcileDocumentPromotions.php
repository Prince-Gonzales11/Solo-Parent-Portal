<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Document;
use App\Services\SupabaseStorageService;

class ReconcileDocumentPromotions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'storage:reconcile-promotions {--limit=100 : Maximum number of documents to reconcile} {--force : Retry documents even if attempts exceed 5}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reconciles and retries promotion of approved documents from temporary to permanent Supabase storage.';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle(SupabaseStorageService $storage)
    {
        $limit = (int) $this->option('limit');
        $force = (bool) $this->option('force');

        $query = Document::whereIn('review_status', ['approved', 'verified'])
            ->where(function ($q) {
                $q->where('storage_status', '!=', 'promoted')
                  ->orWhereNull('storage_status')
                  ->orWhereNull('permanent_storage_path');
            });

        if (!$force) {
            $query->where('promotion_attempts', '<', 5);
        }

        $docs = $query->limit($limit)->get();

        if ($docs->isEmpty()) {
            $this->info('No approved documents requiring storage promotion reconciliation.');
            return 0;
        }

        $this->info("Found {$docs->count()} document(s) requiring promotion reconciliation.");
        $bar = $this->output->createProgressBar($docs->count());
        $bar->start();

        $successCount = 0;
        $failedCount = 0;

        foreach ($docs as $doc) {
            $result = $storage->promoteDocumentRecord($doc);
            if ($result) {
                $successCount++;
            } else {
                $failedCount++;
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("Reconciliation complete:");
        $this->line("  ✓ Successfully promoted: {$successCount}");
        if ($failedCount > 0) {
            $this->warn("  ✗ Failed promotions: {$failedCount} (check application_documents.promotion_error)");
        }

        return $failedCount > 0 ? 1 : 0;
    }
}
