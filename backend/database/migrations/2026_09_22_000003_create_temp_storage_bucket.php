<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $sql = "
            -- Create the temporary storage bucket if it doesn't exist
            INSERT INTO storage.buckets (id, name, public)
            VALUES ('solo-parent-temp', 'solo-parent-temp', false)
            ON CONFLICT (id) DO NOTHING;
        ";

        DB::unprepared($sql);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Deleting a bucket via migration is dangerous if it contains files, so we leave it empty.
    }
};
