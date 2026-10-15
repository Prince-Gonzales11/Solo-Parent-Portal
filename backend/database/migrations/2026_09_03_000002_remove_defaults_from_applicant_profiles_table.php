<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            // Drop database defaults so newly inserted profiles start with NULL / empty values
            DB::statement('ALTER TABLE applicant_profiles ALTER COLUMN city_municipality DROP DEFAULT;');
            DB::statement('ALTER TABLE applicant_profiles ALTER COLUMN province DROP DEFAULT;');
            DB::statement('ALTER TABLE applicant_profiles ALTER COLUMN region DROP DEFAULT;');
            DB::statement('ALTER TABLE applicant_profiles ALTER COLUMN zip_code DROP DEFAULT;');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE applicant_profiles ALTER COLUMN city_municipality SET DEFAULT 'Butuan City';");
            DB::statement("ALTER TABLE applicant_profiles ALTER COLUMN province SET DEFAULT 'Agusan del Norte';");
            DB::statement("ALTER TABLE applicant_profiles ALTER COLUMN region SET DEFAULT 'Caraga';");
            DB::statement("ALTER TABLE applicant_profiles ALTER COLUMN zip_code SET DEFAULT '8600';");
        }
    }
};
