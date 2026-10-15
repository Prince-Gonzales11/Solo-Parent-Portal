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
        // Add new columns to application_documents table
        Schema::table('application_documents', function (Blueprint $table) {
            $table->string('temporary_storage_path', 500)->nullable()->after('storage_path');
            $table->string('permanent_storage_path', 500)->nullable()->after('temporary_storage_path');
            $table->string('storage_status', 20)->default('temporary')->after('permanent_storage_path');
            $table->timestamp('promoted_at')->nullable()->after('storage_status');
        });

        // Migrate existing documents
        // Documents that are approved or verified are considered promoted
        DB::table('application_documents')
            ->whereIn('review_status', ['approved', 'verified'])
            ->update([
                'permanent_storage_path' => DB::raw('storage_path'),
                'storage_status' => 'promoted',
                'promoted_at' => now(),
            ]);

        // Documents that are pending or rejected are temporary
        DB::table('application_documents')
            ->whereNotIn('review_status', ['approved', 'verified'])
            ->update([
                'temporary_storage_path' => DB::raw('storage_path'),
                'storage_status' => 'temporary',
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            $table->dropColumn([
                'temporary_storage_path',
                'permanent_storage_path',
                'storage_status',
                'promoted_at'
            ]);
        });
    }
};
