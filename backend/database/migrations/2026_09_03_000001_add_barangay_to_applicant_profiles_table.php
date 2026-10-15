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
        Schema::table('applicant_profiles', function (Blueprint $table) {
            if (!Schema::hasColumn('applicant_profiles', 'barangay')) {
                $table->string('barangay', 160)->nullable()->after('telephone');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applicant_profiles', function (Blueprint $table) {
            if (Schema::hasColumn('applicant_profiles', 'barangay')) {
                $table->dropColumn('barangay');
            }
        });
    }
};
