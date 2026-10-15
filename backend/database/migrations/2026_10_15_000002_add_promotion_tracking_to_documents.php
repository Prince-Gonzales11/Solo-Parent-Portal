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
        Schema::table('application_documents', function (Blueprint $table) {
            if (!Schema::hasColumn('application_documents', 'promotion_error')) {
                $table->text('promotion_error')->nullable()->after('promoted_at');
            }
            if (!Schema::hasColumn('application_documents', 'promotion_attempts')) {
                $table->integer('promotion_attempts')->default(0)->after('promotion_error');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            $table->dropColumn(['promotion_error', 'promotion_attempts']);
        });
    }
};
