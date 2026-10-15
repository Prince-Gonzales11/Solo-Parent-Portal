<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Drop unused placeholder tables flagged by Supabase Security Advisor.
     * These tables have no models, controllers, or data — they were empty stubs.
     */
    public function up(): void
    {
        Schema::dropIfExists('missing_public_tables');
        Schema::dropIfExists('resources_and_announcements_tables');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('missing_public_tables', function ($table) {
            $table->id();
            $table->timestamps();
        });
        Schema::create('resources_and_announcements_tables', function ($table) {
            $table->id();
            $table->timestamps();
        });
    }
};
