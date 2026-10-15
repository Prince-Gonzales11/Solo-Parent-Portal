<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Enable RLS on public tables that were flagged by Supabase Security Advisor.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE public.missing_public_tables ENABLE ROW LEVEL SECURITY');
            DB::statement('ALTER TABLE public.resources_and_announcements_tables ENABLE ROW LEVEL SECURITY');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE public.missing_public_tables DISABLE ROW LEVEL SECURITY');
            DB::statement('ALTER TABLE public.resources_and_announcements_tables DISABLE ROW LEVEL SECURITY');
        }
    }
};
