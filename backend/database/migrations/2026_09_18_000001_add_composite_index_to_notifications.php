<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add composite index on notifications for faster unread count queries.
     * The individual indexes on user_id and is_read exist, but the combined
     * query WHERE user_id = ? AND is_read = false benefits from a composite index.
     */
    public function up(): void
    {
        DB::statement('CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_notifications_user_unread');
    }
};
