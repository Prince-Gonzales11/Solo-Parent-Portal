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
        if (!Schema::hasTable('messages')) {
            Schema::create('messages', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('application_id')->nullable()->index();
                $table->foreign('application_id')->references('id')->on('applications')->onDelete('cascade');
                
                $table->uuid('sender_id')->index();
                $table->foreign('sender_id')->references('id')->on('users')->onDelete('cascade');
                
                $table->uuid('recipient_id')->nullable()->index();
                $table->foreign('recipient_id')->references('id')->on('users')->onDelete('set null');
                
                $table->string('sender_type', 30)->default('applicant'); // 'applicant' or 'admin' / 'cswdd'
                $table->text('message');
                $table->boolean('is_read')->default(false);
                $table->timestamp('read_at')->nullable();
                $table->timestamps();

                $table->index(['application_id', 'created_at']);
                $table->index(['sender_id', 'created_at']);
                $table->index(['recipient_id', 'is_read']);
            });
        }

        Schema::table('applications', function (Blueprint $table) {
            if (!Schema::hasColumn('applications', 'existing_spic_issue_date')) {
                $table->date('existing_spic_issue_date')->nullable();
            }
            if (!Schema::hasColumn('applications', 'existing_spic_expiry_date')) {
                $table->date('existing_spic_expiry_date')->nullable();
            }
            if (!Schema::hasColumn('applications', 'loss_circumstance')) {
                $table->text('loss_circumstance')->nullable();
            }
            if (!Schema::hasColumn('applications', 'applicant_verified_at')) {
                $table->timestamp('applicant_verified_at')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');

        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn([
                'existing_spic_issue_date',
                'existing_spic_expiry_date',
                'loss_circumstance',
                'applicant_verified_at',
            ]);
        });
    }
};
