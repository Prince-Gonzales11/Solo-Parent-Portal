<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Database\Seeders\CategorySeeder;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Ensure all 13 RA 11861 categories and documentary requirements exist in the database.
     */
    public function up(): void
    {
        if (Schema::hasTable('solo_parent_categories') && Schema::hasTable('documentary_requirements')) {
            $seeder = new CategorySeeder();
            $seeder->run();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reference master data should be preserved
    }
};
