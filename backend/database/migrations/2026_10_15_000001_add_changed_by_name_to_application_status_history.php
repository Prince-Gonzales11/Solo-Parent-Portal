<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_status_history', function (Blueprint $table) {
            if (!Schema::hasColumn('application_status_history', 'changed_by_name')) {
                $table->string('changed_by_name')->nullable()->after('changed_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('application_status_history', function (Blueprint $table) {
            if (Schema::hasColumn('application_status_history', 'changed_by_name')) {
                $table->dropColumn('changed_by_name');
            }
        });
    }
};
