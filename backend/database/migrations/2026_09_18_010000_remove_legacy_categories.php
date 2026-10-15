<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Remove legacy A–H categories from the original migration.
 *
 * These were placeholder categories that predate the proper RA 11861
 * categorisation (a1–a7, b1, b2, c, d, e, f) seeded by CategorySeeder.
 * No applications reference them (verified before migration).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('solo_parent_categories')) {
            return;
        }

        $legacyCodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        // Get legacy category IDs
        $legacyIds = DB::table('solo_parent_categories')
            ->whereIn('code', $legacyCodes)
            ->pluck('id')
            ->toArray();

        if (empty($legacyIds)) {
            return; // Already cleaned up
        }

        // Safety check: ensure no applications reference these categories
        if (Schema::hasTable('applications')) {
            $appCount = DB::table('applications')
                ->whereIn('category_id', $legacyIds)
                ->count();

            if ($appCount > 0) {
                throw new \RuntimeException(
                    "Cannot remove legacy categories: {$appCount} application(s) still reference them. " .
                    "Migrate those applications to the correct RA 11861 categories first."
                );
            }
        }

        // Delete orphaned documentary requirements for legacy categories
        if (Schema::hasTable('documentary_requirements')) {
            $deletedReqs = DB::table('documentary_requirements')
                ->whereIn('category_id', $legacyIds)
                ->delete();
        }

        // Delete the legacy categories themselves
        $deletedCats = DB::table('solo_parent_categories')
            ->whereIn('code', $legacyCodes)
            ->delete();

        // Clear cached category list
        \Illuminate\Support\Facades\Cache::forget('public_categories_list');
    }

    public function down(): void
    {
        // The legacy categories can be restored by re-running the original
        // 2026_08_19_022216_create_supabase_schema migration's seed block.
        // Not auto-reversible to prevent accidental re-creation.
    }
};
