<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // Get all tables in the public schema
        $tables = DB::select("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");

        foreach ($tables as $table) {
            $tableName = $table->tablename;
            // Enable RLS for each table
            DB::statement("ALTER TABLE public.{$tableName} ENABLE ROW LEVEL SECURITY;");
            
            // Optionally, we can also force RLS (so even table owners are subject to it, though Service Role bypasses this anyway)
            // DB::statement("ALTER TABLE public.{$tableName} FORCE ROW LEVEL SECURITY;");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = DB::select("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");

        foreach ($tables as $table) {
            $tableName = $table->tablename;
            DB::statement("ALTER TABLE public.{$tableName} DISABLE ROW LEVEL SECURITY;");
        }
    }
};
