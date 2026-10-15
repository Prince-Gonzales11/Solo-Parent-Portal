<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->index('application_type');
            $table->index('created_at');
            $table->index('submitted_at');
        });

        Schema::table('applicant_profiles', function (Blueprint $table) {
            $table->index('birth_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex(['application_type']);
            $table->dropIndex(['created_at']);
            $table->dropIndex(['submitted_at']);
        });

        Schema::table('applicant_profiles', function (Blueprint $table) {
            $table->dropIndex(['birth_date']);
        });
    }
};
