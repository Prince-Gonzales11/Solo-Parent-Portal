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
            
            // Create a default deny-all policy to satisfy the Supabase Linter (rls_enabled_no_policy warning).
            // Since this application uses Laravel as a backend and accesses Supabase via the Service Role/Postgres user,
            // this policy won't block the backend application from accessing the database.
            $policyName = "Deny all public access to {$tableName}";
            
            DB::statement("
                DO \$\$
                BEGIN
                    -- Drop if exists to avoid errors on reruns
                    DROP POLICY IF EXISTS \"{$policyName}\" ON public.{$tableName};
                    
                    -- Create the deny-all policy
                    CREATE POLICY \"{$policyName}\" ON public.{$tableName} FOR ALL TO public USING (false);
                END
                \$\$;
            ");
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
            $policyName = "Deny all public access to {$tableName}";
            
            DB::statement("DROP POLICY IF EXISTS \"{$policyName}\" ON public.{$tableName};");
        }
    }
};
