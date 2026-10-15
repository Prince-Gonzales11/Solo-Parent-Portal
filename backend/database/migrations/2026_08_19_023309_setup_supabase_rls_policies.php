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

        // Supabase specific Storage & RLS configuration
        
        $sql = "
            -- 1. Create the storage bucket if it doesn't exist
            INSERT INTO storage.buckets (id, name, public)
            VALUES ('solo parent portal documents', 'solo parent portal documents', false)
            ON CONFLICT (id) DO NOTHING;

            -- 2. Enable RLS on all relevant public schema tables
            ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
            ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
            ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
            ALTER TABLE public.application_forms ENABLE ROW LEVEL SECURITY;
            ALTER TABLE public.application_family_members ENABLE ROW LEVEL SECURITY;
            ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
            ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
            ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

            -- 3. Create policies for the public schema (Example: users can only see their own data, but this is a backend app with Service Role so it bypasses RLS)
            -- We just create basic rules for completeness. In our architecture, the Laravel backend uses the Service Role key which bypasses RLS automatically.
            
            -- Storage policies for the bucket (if accessed via frontend anon/authenticated keys)
            DO \$\$
            BEGIN
                -- Drop existing policies if any
                DROP POLICY IF EXISTS \"Give users access to own folder 1\" ON storage.objects;
                DROP POLICY IF EXISTS \"Allow users to upload to their folder\" ON storage.objects;
                DROP POLICY IF EXISTS \"Allow users to update their files\" ON storage.objects;
                DROP POLICY IF EXISTS \"Allow users to delete their files\" ON storage.objects;

                -- Allow users to read their own files (assuming folder name is their user_id)
                CREATE POLICY \"Give users access to own folder 1\" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'solo parent portal documents' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
                
                -- Allow users to upload to their own folder
                CREATE POLICY \"Allow users to upload to their folder\" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'solo parent portal documents' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

                -- Allow users to update their files
                CREATE POLICY \"Allow users to update their files\" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'solo parent portal documents' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
                
                -- Allow users to delete their files
                CREATE POLICY \"Allow users to delete their files\" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'solo parent portal documents' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
            END
            \$\$;
        ";

        DB::unprepared($sql);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 
    }
};
