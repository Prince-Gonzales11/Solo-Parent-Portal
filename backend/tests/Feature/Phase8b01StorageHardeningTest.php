<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Category;
use App\Models\Document;
use App\Models\DocumentaryRequirement;
use App\Models\User;
use App\Services\SupabaseStorageService;
use Carbon\Carbon;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Tests\TestCase;

class Phase8b01StorageHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Category $category;
    protected DocumentaryRequirement $req;
    protected Application $application;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'applicant_hardening@example.com',
            'full_name' => 'Maria Santos Dela Cruz',
            'role' => 'applicant',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'CAT-TEST',
            'name' => 'Solo Parent Category',
            'description' => 'Test Category',
            'is_active' => true,
        ]);

        $this->req = DocumentaryRequirement::create([
            'id' => (string) Str::uuid(),
            'category_id' => $this->category->id,
            'name' => 'Birth Certificate',
            'is_required' => true,
            'max_size_mb' => 20,
            'sort_order' => 1,
        ]);

        $this->application = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'category_id' => $this->category->id,
            'status' => 'draft',
            'application_type' => 'new_id',
            'reference_no' => 'SP-2026-HARDEN-001',
        ]);
    }

    /**
     * 1. TLS verification enforcement:
     * Disabling TLS verification in production or staging with a cloud driver MUST fail closed.
     */
    public function test_tls_verification_fails_closed_in_production_and_staging_when_disabled(): void
    {
        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-key',
            'services.supabase.ssl_verify' => false,
        ]);

        // Production environment
        $this->app->detectEnvironment(fn () => 'production');
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Disabling TLS/SSL certificate verification is strictly prohibited in production and staging environments.');

        new SupabaseStorageService();
    }

    public function test_tls_verification_fails_closed_in_staging_when_disabled(): void
    {
        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-key',
            'services.supabase.ssl_verify' => false,
        ]);

        // Staging environment
        $this->app->detectEnvironment(fn () => 'staging');
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Disabling TLS/SSL certificate verification is strictly prohibited in production and staging environments.');

        new SupabaseStorageService();
    }

    public function test_custom_ca_bundle_fails_closed_if_file_missing(): void
    {
        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-key',
            'services.supabase.ssl_verify' => true,
            'services.supabase.ca_bundle' => '/nonexistent/path/to/ca-bundle.crt',
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Configured Supabase CA certificate bundle does not exist: /nonexistent/path/to/ca-bundle.crt');

        new SupabaseStorageService();
    }

    /**
     * 2. Complex Path Encoding and Traversal Guards
     */
    public function test_path_encoding_handles_complex_characters_and_filipino_names(): void
    {
        // Path with spaces
        $encoded1 = SupabaseStorageService::encodeStoragePath('Applicants/Juan Dela Cruz/ID.pdf');
        $this->assertEquals('Applicants/Juan%20Dela%20Cruz/ID.pdf', $encoded1);

        // Path with commas and parentheses
        $encoded2 = SupabaseStorageService::encodeStoragePath('Documents (Official), Batch 1/Copy (1).pdf');
        $this->assertEquals('Documents%20%28Official%29%2C%20Batch%201/Copy%20%281%29.pdf', $encoded2);

        // Path with Filipino characters: ñ, accented vowels, periods
        $encoded3 = SupabaseStorageService::encodeStoragePath('Applicants/Valenzuela, Ma. Niña/Barangay_Cert.pdf');
        $this->assertEquals('Applicants/Valenzuela%2C%20Ma.%20Ni%C3%B1a/Barangay_Cert.pdf', $encoded3);
    }

    public function test_path_encoding_strictly_rejects_directory_traversal_and_null_bytes(): void
    {
        $traversalAttempts = [
            '../secret.pdf',
            'documents/../../etc/passwd',
            'applicants/./doc.pdf',
            'applicants//empty_segment.pdf',
            "documents/file\0.pdf",
            'C:\Windows\System32\cmd.exe',
            '/absolute/path/file.pdf',
        ];

        foreach ($traversalAttempts as $attempt) {
            try {
                SupabaseStorageService::encodeStoragePath($attempt);
                $this->fail("Failed to reject unsafe storage path: {$attempt}");
            } catch (InvalidArgumentException $e) {
                $this->assertTrue(true);
            }
        }
    }

    /**
     * 3. HTTP Contracts with Http::preventStrayRequests()
     */
    public function test_upload_contract_with_http_fake(): void
    {
        Http::preventStrayRequests();

        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-service-key-12345',
            'services.supabase.bucket' => 'solo-parent-portal-documents',
            'services.supabase.ssl_verify' => true,
        ]);

        Http::fake([
            'https://test-project.supabase.co/storage/v1/object/solo-parent-portal-documents/applicants/doc%20test.pdf' => Http::response([
                'Key' => 'solo-parent-portal-documents/applicants/doc test.pdf'
            ], 200),
        ]);

        $storage = new SupabaseStorageService();
        $result = $storage->upload('applicants/doc test.pdf', 'file content', 'application/pdf');

        $this->assertEquals('applicants/doc test.pdf', $result['path']);
        $this->assertEquals('solo-parent-portal-documents', $result['bucket']);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://test-project.supabase.co/storage/v1/object/solo-parent-portal-documents/applicants/doc%20test.pdf'
                && $request->hasHeader('Authorization', 'Bearer test-service-key-12345')
                && $request->hasHeader('x-upsert', 'true')
                && $request->body() === 'file content';
        });
    }

    public function test_download_contract_with_http_fake(): void
    {
        Http::preventStrayRequests();

        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-service-key-12345',
            'services.supabase.bucket' => 'solo-parent-portal-documents',
            'services.supabase.ssl_verify' => true,
        ]);

        Http::fake([
            'https://test-project.supabase.co/storage/v1/object/solo-parent-portal-documents/applicants/doc%20test.pdf' => Http::response(
                'mock pdf payload',
                200,
                ['Content-Type' => 'application/pdf']
            ),
        ]);

        $storage = new SupabaseStorageService();
        $content = $storage->download('applicants/doc test.pdf');

        $this->assertEquals('mock pdf payload', $content);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://test-project.supabase.co/storage/v1/object/solo-parent-portal-documents/applicants/doc%20test.pdf'
                && $request->method() === 'GET'
                && $request->hasHeader('Authorization', 'Bearer test-service-key-12345');
        });
    }

    public function test_signed_url_generation_preserves_token_query_and_encodes_spaces(): void
    {
        Http::preventStrayRequests();

        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-service-key-12345',
            'services.supabase.bucket' => 'solo-parent-portal-documents',
            'services.supabase.ssl_verify' => true,
        ]);

        Http::fake([
            'https://test-project.supabase.co/storage/v1/object/sign/solo-parent-portal-documents/applicants/doc%20test.pdf' => Http::response([
                'signedURL' => '/object/sign/solo-parent-portal-documents/applicants/doc test.pdf?token=mock.jwt.token'
            ], 200),
        ]);

        $storage = new SupabaseStorageService();
        $signedUrl = $storage->getSignedUrl('applicants/doc test.pdf', 900);

        $expectedUrl = 'https://test-project.supabase.co/storage/v1/object/sign/solo-parent-portal-documents/applicants/doc%20test.pdf?token=mock.jwt.token';
        $this->assertEquals($expectedUrl, $signedUrl);
    }

    /**
     * 4. Error Sanitization and Secret Protection Tests
     */
    public function test_sanitizer_redacts_bearer_tokens_jwts_and_secrets(): void
    {
        $rawError = "Error connecting with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisToken and apikey=sb_super_secret_key_12345 at https://test.supabase.co/storage/v1/object/sign/bucket/doc.pdf?token=jwt_secret";

        $sanitized = SupabaseStorageService::sanitizePromotionError($rawError);

        $this->assertStringNotContainsString('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', $sanitized);
        $this->assertStringNotContainsString('doNotLeakThisToken', $sanitized);
        $this->assertStringNotContainsString('sb_super_secret_key_12345', $sanitized);
        $this->assertStringNotContainsString('jwt_secret', $sanitized);
        $this->assertStringContainsString('Bearer [REDACTED]', $sanitized);
        $this->assertStringContainsString('apikey=[REDACTED]', $sanitized);
    }

    public function test_sanitizer_masks_applicant_folders_in_log_paths(): void
    {
        $path = 'Applicants/Dela Cruz, Juan M./Documents/ID.pdf';
        $sanitized = SupabaseStorageService::sanitizeLogPath($path);

        $this->assertStringNotContainsString('Dela Cruz, Juan M.', $sanitized);
        $this->assertStringContainsString('Applicants/[APPLICANT_FOLDER]/Documents/ID.pdf', $sanitized);
    }

    /**
     * 5. Cross-Bucket Promotion and Deletion Consistency
     */
    public function test_promote_document_record_updates_database_and_is_idempotent(): void
    {
        Http::preventStrayRequests();

        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-service-key-12345',
            'services.supabase.bucket' => 'solo-parent-portal-documents',
            'services.supabase.temp_bucket' => 'solo-parent-temp',
            'services.supabase.ssl_verify' => true,
        ]);

        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'application_id' => $this->application->id,
            'requirement_id' => $this->req->id,
            'original_filename' => 'birth_certificate.pdf',
            'storage_path' => 'temp/birth_certificate.pdf',
            'temporary_storage_path' => 'temp/birth_certificate.pdf',
            'storage_status' => 'temporary',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'review_status' => 'approved',
        ]);

        Http::fake([
            // 1. Download from temp bucket
            'https://test-project.supabase.co/storage/v1/object/solo-parent-temp/temp/birth_certificate.pdf' => Http::response('mock document content', 200),
            // 2. Upload to permanent bucket
            'https://test-project.supabase.co/storage/v1/object/solo-parent-portal-documents/*' => Http::response(['Key' => 'perm-key'], 200),
            // 3. Delete from temp bucket
            'https://test-project.supabase.co/storage/v1/object/solo-parent-temp' => Http::response([['name' => 'temp/birth_certificate.pdf']], 200),
        ]);

        $storage = new SupabaseStorageService();
        $promoted = $storage->promoteDocumentRecord($doc);

        $this->assertTrue($promoted);

        $doc->refresh();
        $this->assertEquals('promoted', $doc->storage_status);
        $this->assertNotNull($doc->permanent_storage_path);
        $this->assertNotNull($doc->promoted_at);
        $this->assertNull($doc->promotion_error);

        // Idempotent test: calling promoteDocumentRecord again immediately returns true without HTTP calls
        $idempotentResult = $storage->promoteDocumentRecord($doc);
        $this->assertTrue($idempotentResult);
    }

    public function test_promote_to_permanent_is_resilient_when_temp_deletion_fails(): void
    {
        Http::preventStrayRequests();

        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-service-key-12345',
            'services.supabase.bucket' => 'solo-parent-portal-documents',
            'services.supabase.temp_bucket' => 'solo-parent-temp',
            'services.supabase.ssl_verify' => true,
        ]);

        Http::fake([
            // 1. Download succeeds
            'https://test-project.supabase.co/storage/v1/object/solo-parent-temp/temp/file.pdf' => Http::response('content', 200),
            // 2. Upload to permanent succeeds
            'https://test-project.supabase.co/storage/v1/object/solo-parent-portal-documents/perm/file.pdf' => Http::response(['Key' => 'perm-key'], 200),
            // 3. Delete returns 500 error
            'https://test-project.supabase.co/storage/v1/object/solo-parent-temp' => Http::response('Delete error', 500),
        ]);

        $storage = new SupabaseStorageService();
        // Promotion must succeed and not throw an exception, because permanent file was safely uploaded!
        $result = $storage->promoteToPermanent('temp/file.pdf', 'perm/file.pdf', 'application/pdf');

        $this->assertEquals('perm/file.pdf', $result);
    }

    /**
     * 6. CleanTempStorage Safeguards and Document Protection
     */
    public function test_clean_temp_storage_protects_all_unpromoted_and_active_documents(): void
    {
        Http::preventStrayRequests();

        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-service-key-12345',
            'services.supabase.temp_bucket' => 'solo-parent-temp',
            'services.supabase.bucket' => 'solo-parent-portal-documents',
            'services.supabase.ssl_verify' => true,
        ]);

        // Doc 1: Active draft document (unpromoted, 45 days old) -> MUST BE PROTECTED
        Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'application_id' => $this->application->id,
            'requirement_id' => $this->req->id,
            'original_filename' => 'draft_doc.pdf',
            'storage_path' => 'temp/draft_doc.pdf',
            'temporary_storage_path' => 'temp/draft_doc.pdf',
            'storage_status' => 'temporary',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'review_status' => 'pending',
            'created_at' => Carbon::now()->subDays(45),
        ]);

        // Doc 2: Promoted document whose temp copy is 45 days old -> SAFE TO DELETE
        Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'application_id' => $this->application->id,
            'requirement_id' => $this->req->id,
            'original_filename' => 'promoted_doc.pdf',
            'storage_path' => 'permanent/promoted_doc.pdf',
            'temporary_storage_path' => 'temp/promoted_doc.pdf',
            'permanent_storage_path' => 'permanent/promoted_doc.pdf',
            'storage_status' => 'promoted',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'review_status' => 'approved',
            'created_at' => Carbon::now()->subDays(45),
        ]);

        // Mock Supabase listing returning both files + 1 truly orphaned file
        Http::fake([
            'https://test-project.supabase.co/storage/v1/object/list/solo-parent-temp' => Http::response([
                [
                    'id' => 'file-1',
                    'name' => 'temp/draft_doc.pdf',
                    'created_at' => Carbon::now()->subDays(45)->toIso8601String(),
                ],
                [
                    'id' => 'file-2',
                    'name' => 'temp/promoted_doc.pdf',
                    'created_at' => Carbon::now()->subDays(45)->toIso8601String(),
                ],
                [
                    'id' => 'file-3',
                    'name' => 'temp/orphaned_doc.pdf',
                    'created_at' => Carbon::now()->subDays(45)->toIso8601String(),
                ],
            ], 200),
            'https://test-project.supabase.co/storage/v1/object/solo-parent-temp' => Http::response([], 200),
        ]);

        // Execute Dry Run
        $exitCode = Artisan::call('storage:clean-temp', ['--dry-run' => true]);
        $this->assertEquals(0, $exitCode);
        $output = Artisan::output();

        $this->assertStringContainsString('Skipping deletion of referenced document', $output);
        $this->assertStringContainsString('temp/draft_doc.pdf', $output);
        $this->assertStringContainsString('Would delete 2 orphaned files', $output);

        // Dry run must NOT send delete requests
        Http::assertNotSent(function ($request) {
            return $request->method() === 'DELETE';
        });

        // Execute Real Run with force
        $exitCodeReal = Artisan::call('storage:clean-temp', ['--force' => true]);
        $this->assertEquals(0, $exitCodeReal);

        // Verify DELETE request was sent ONLY for orphaned and promoted files, NEVER draft_doc.pdf
        Http::assertSent(function ($request) {
            if ($request->method() === 'DELETE') {
                $prefixes = $request->data()['prefixes'] ?? [];
                return in_array('temp/promoted_doc.pdf', $prefixes, true)
                    && in_array('temp/orphaned_doc.pdf', $prefixes, true)
                    && !in_array('temp/draft_doc.pdf', $prefixes, true);
            }
            return false;
        });
    }

    public function test_clean_temp_storage_aborts_if_bucket_matches_permanent_bucket(): void
    {
        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => 'https://test-project.supabase.co',
            'services.supabase.service_key' => 'test-service-key-12345',
            'services.supabase.temp_bucket' => 'solo-parent-portal-documents',
            'services.supabase.bucket' => 'solo-parent-portal-documents',
        ]);

        $exitCode = Artisan::call('storage:clean-temp');
        $this->assertEquals(1, $exitCode);
        $this->assertStringContainsString('Temporary storage bucket is identical to permanent bucket', Artisan::output());
    }

    public function test_clean_temp_storage_local_driver_isolation_makes_no_http_calls(): void
    {
        Http::preventStrayRequests();

        config([
            'services.supabase.driver' => 'local',
            'services.supabase.temp_bucket' => 'solo-parent-temp',
            'services.supabase.bucket' => 'solo-parent-portal-documents',
        ]);

        $localDir = storage_path('app/mock_supabase/solo-parent-temp');
        if (!is_dir($localDir)) {
            mkdir($localDir, 0750, true);
        }

        $testFile = $localDir . '/local_orphaned_file.pdf';
        file_put_contents($testFile, 'dummy content');
        touch($testFile, time() - (35 * 86400)); // 35 days old

        $exitCode = Artisan::call('storage:clean-temp', ['--force' => true]);
        $this->assertEquals(0, $exitCode);

        $this->assertFileDoesNotExist($testFile);
        $this->assertStringContainsString('Local cleanup completed: 1 file(s) deleted', Artisan::output());

        // Zero HTTP calls must have been made
        Http::assertNothingSent();
    }

    public function test_application_approval_triggers_document_promotion_via_storage_service(): void
    {
        $admin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'admin_harden@example.com',
            'full_name' => 'Admin Officer',
            'role' => 'admin',
            'is_active' => true,
        ]);

        config([
            'services.supabase.driver' => 'local',
            'services.supabase.bucket' => 'solo-parent-portal-documents',
            'services.supabase.temp_bucket' => 'solo-parent-temp',
        ]);

        $storage = app(SupabaseStorageService::class);
        $tempRelPath = 'temp/applicant_id_proof.pdf';
        $storage->uploadTemporary($tempRelPath, 'sample binary data', 'application/pdf');

        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'application_id' => $this->application->id,
            'requirement_id' => $this->req->id,
            'original_filename' => 'id_proof.pdf',
            'storage_path' => $tempRelPath,
            'temporary_storage_path' => $tempRelPath,
            'storage_status' => 'temporary',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'review_status' => 'approved',
        ]);

        $this->application->update(['status' => 'under_review']);

        $response = $this->actingAs($admin)->patchJson("/api/admin/applications/{$this->application->id}/status", [
            'status' => 'approved',
            'note' => 'All documentary requirements verified.',
        ]);

        $response->assertStatus(200);

        $doc->refresh();
        $this->assertEquals('promoted', $doc->storage_status);
        $this->assertNotNull($doc->permanent_storage_path);
        $this->assertNotNull($doc->promoted_at);
    }

    /**
     * 7. Destructive Administrative Command Security Tests (portal:clean-user-data)
     */
    public function test_clean_user_data_refuses_execution_in_production_environment(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
        $this->assertEquals(1, $exitCode);
        $this->assertStringContainsString('strictly prohibited in PRODUCTION environment', Artisan::output());
    }

    public function test_clean_user_data_refuses_execution_against_remote_database_host(): void
    {
        config(['database.connections.sqlite.host' => 'db.nntovqphomdbsomshbsp.supabase.co']);

        $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
        $this->assertEquals(1, $exitCode);
        $this->assertStringContainsString('strictly prohibited against non-local database host', Artisan::output());
    }

    public function test_clean_user_data_refuses_execution_against_cloud_database_name(): void
    {
        config(['database.connections.sqlite.database' => 'production_cloud_db']);

        $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
        $this->assertEquals(1, $exitCode);
        $this->assertStringContainsString('matches prohibited remote/cloud pattern', Artisan::output());
    }

    public function test_clean_user_data_refuses_execution_against_non_local_storage_driver(): void
    {
        config(['services.supabase.driver' => 'supabase']);

        $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
        $this->assertEquals(1, $exitCode);
        $this->assertStringContainsString("strictly prohibited against remote storage driver 'supabase'", Artisan::output());
    }

    public function test_clean_user_data_force_flag_cannot_bypass_environment_safeguards(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        // Force flag must NOT bypass production prohibition
        $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
        $this->assertEquals(1, $exitCode);
        $this->assertStringContainsString('strictly prohibited in PRODUCTION', Artisan::output());
    }

    public function test_clean_user_data_strictly_preserves_super_admin_and_admin_passwords(): void
    {
        config([
            'services.supabase.driver' => 'local',
            'database.connections.sqlite.host' => '127.0.0.1',
            'database.connections.sqlite.database' => ':memory:',
        ]);

        $customPassword = 'MySecretSuperAdminPassword_2026!';
        $superAdmin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'cswdd.admin1@butuan.gov.ph',
            'full_name' => 'Original Super Admin',
            'password_hash' => \Illuminate\Support\Facades\Hash::make($customPassword),
            'role' => 'super_admin',
            'is_active' => true,
        ]);

        $adminOfficer = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'cswdd.staff1@butuan.gov.ph',
            'full_name' => 'Regular Admin Staff',
            'password_hash' => \Illuminate\Support\Facades\Hash::make('AdminStaffPass123!'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $applicant = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'applicant_to_clean@example.com',
            'full_name' => 'Applicant User',
            'password_hash' => \Illuminate\Support\Facades\Hash::make('ApplicantPass123!'),
            'role' => 'applicant',
            'is_active' => true,
        ]);

        $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
        $this->assertEquals(0, $exitCode);

        // Applicant must be deleted
        $this->assertDatabaseMissing('users', ['id' => $applicant->id]);

        // Regular admin MUST be preserved
        $this->assertDatabaseHas('users', ['id' => $adminOfficer->id, 'role' => 'admin']);

        // Super Admin MUST be preserved AND its password hash MUST NOT have been overwritten
        $refreshedAdmin = User::find($superAdmin->id);
        $this->assertNotNull($refreshedAdmin);
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check($customPassword, $refreshedAdmin->password_hash));
    }
}
