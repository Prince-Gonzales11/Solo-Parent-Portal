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
        Schema::create('email_verifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('email', 255)->index();
            $table->string('code_hash', 255);
            $table->timestamp('expires_at');
            $table->integer('attempts')->default(0);
            $table->integer('max_attempts')->default(5);
            $table->timestamps();
        });

        // Add RLS and dummy policy to satisfy Supabase
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;');
            DB::statement('CREATE POLICY "Deny all public access to email_verifications" ON public.email_verifications FOR ALL TO public USING (false);');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_verifications');
    }
};
