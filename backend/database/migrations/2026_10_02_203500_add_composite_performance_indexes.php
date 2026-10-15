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
            $table->index(['status', 'created_at'], 'idx_apps_status_created_at');
            $table->index(['user_id', 'status'], 'idx_apps_user_status');
            $table->index(['category_id', 'status'], 'idx_apps_cat_status');
        });

        Schema::table('application_documents', function (Blueprint $table) {
            $table->index(['application_id', 'requirement_id', 'review_status'], 'idx_docs_app_req_status');
        });

        Schema::table('application_status_history', function (Blueprint $table) {
            $table->index(['application_id', 'created_at'], 'idx_status_hist_app_created');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex('idx_apps_status_created_at');
            $table->dropIndex('idx_apps_user_status');
            $table->dropIndex('idx_apps_cat_status');
        });

        Schema::table('application_documents', function (Blueprint $table) {
            $table->dropIndex('idx_docs_app_req_status');
        });

        Schema::table('application_status_history', function (Blueprint $table) {
            $table->dropIndex('idx_status_hist_app_created');
        });
    }
};
