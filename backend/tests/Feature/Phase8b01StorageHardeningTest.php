<?php

namespace Tests\Feature;

use App\Console\Commands\CleanUserData;
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

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.driver' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'database.connections.sqlite.host' => '',
            'services.supabase.driver' => 'local',
            'cache.default' => 'array',
        ]);

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

    protected function tearDown(): void
    {
        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.driver' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'database.connections.sqlite.host' => '',
            'services.supabase.driver' => 'local',
            'cache.default' => 'array',
        ]);

        parent::tearDown();
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
        try {
            $this->app->detectEnvironment(fn () => 'production');

            $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString('strictly prohibited in PRODUCTION environment', Artisan::output());
        } finally {
            $this->app->detectEnvironment(fn () => 'testing');
        }
    }

    public function test_clean_user_data_refuses_execution_in_staging_environment(): void
    {
        try {
            $this->app->detectEnvironment(fn () => 'staging');

            $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString('strictly prohibited in STAGING environment', Artisan::output());
        } finally {
            $this->app->detectEnvironment(fn () => 'testing');
        }
    }

    public function test_clean_user_data_refuses_execution_against_remote_database_host(): void
    {
        try {
            config(['database.connections.sqlite.host' => 'db.nntovqphomdbsomshbsp.supabase.co']);

            $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString('strictly prohibited against non-local database host', Artisan::output());
        } finally {
            config(['database.connections.sqlite.host' => '']);
        }
    }

    public function test_clean_user_data_refuses_execution_against_cloud_database_name(): void
    {
        try {
            config([
                'services.supabase.driver' => 'local',
                'database.connections.sqlite.database' => 'production_cloud_db',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString('matches prohibited remote/cloud pattern', Artisan::output());
        } finally {
            config(['database.connections.sqlite.database' => ':memory:']);
        }
    }

    public function test_clean_user_data_refuses_execution_against_original_local_database_solo_parent_local_test(): void
    {
        try {
            config([
                'database.default' => 'pgsql',
                'database.connections.pgsql.driver' => 'pgsql',
                'database.connections.pgsql.host' => '127.0.0.1',
                'database.connections.pgsql.database' => 'solo_parent_local_test',
                'database.connections.pgsql.username' => 'solo_parent_tester',
                'services.supabase.driver' => 'local',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString("strictly prohibited against primary test database 'solo_parent_local_test'", Artisan::output());
        } finally {
            config([
                'database.default' => 'sqlite',
                'database.connections.pgsql.database' => 'laravel',
            ]);
        }
    }

    public function test_clean_user_data_refuses_execution_against_arbitrary_database_names(): void
    {
        try {
            config([
                'database.default' => 'pgsql',
                'database.connections.pgsql.driver' => 'pgsql',
                'database.connections.pgsql.host' => '127.0.0.1',
                'database.connections.pgsql.database' => 'solo_parent_db',
                'database.connections.pgsql.username' => 'solo_parent_tester',
                'services.supabase.driver' => 'local',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString("strictly prohibited against database 'solo_parent_db'", Artisan::output());
        } finally {
            config([
                'database.default' => 'sqlite',
                'database.connections.pgsql.database' => 'laravel',
            ]);
        }
    }

    public function test_clean_user_data_refuses_execution_against_lookalike_disposable_database_names(): void
    {
        try {
            config([
                'database.default' => 'pgsql',
                'database.connections.pgsql.driver' => 'pgsql',
                'database.connections.pgsql.host' => '127.0.0.1',
                'database.connections.pgsql.database' => 'solo_parent_disposable_e2e_fake',
                'database.connections.pgsql.username' => 'solo_parent_tester',
                'services.supabase.driver' => 'local',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString("Only exact allowlisted database '" . CleanUserData::ALLOWED_PGSQL_DATABASE . "' is permitted", Artisan::output());
        } finally {
            config([
                'database.default' => 'sqlite',
                'database.connections.pgsql.database' => 'laravel',
            ]);
        }
    }

    public function test_clean_user_data_refuses_execution_against_non_local_storage_driver(): void
    {
        try {
            config(['services.supabase.driver' => 'supabase']);

            $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString("strictly prohibited against non-local storage driver 'supabase'", Artisan::output());
        } finally {
            config(['services.supabase.driver' => 'local']);
        }
    }

    public function test_clean_user_data_refuses_execution_when_disposable_marker_is_missing(): void
    {
        $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
        $this->assertEquals(1, $exitCode);
        $this->assertStringContainsString('Missing required disposable environment identity marker', Artisan::output());
    }

    public function test_clean_user_data_refuses_execution_when_disposable_marker_is_incorrect(): void
    {
        $exitCode = Artisan::call('portal:clean-user-data', [
            '--force' => true,
            '--disposable-marker' => 'wrong_untrusted_token_123',
        ]);
        $this->assertEquals(1, $exitCode);
        $this->assertStringContainsString("Invalid disposable environment identity marker 'wrong_untrusted_token_123'", Artisan::output());
    }

    public function test_clean_user_data_refuses_execution_with_unauthorized_database_credentials(): void
    {
        try {
            // 1. Rejection of superuser account
            config([
                'database.default' => 'pgsql',
                'database.connections.pgsql.driver' => 'pgsql',
                'database.connections.pgsql.host' => '127.0.0.1',
                'database.connections.pgsql.database' => CleanUserData::ALLOWED_PGSQL_DATABASE,
                'database.connections.pgsql.username' => 'postgres',
                'services.supabase.driver' => 'local',
            ]);

            $exitCodeSuper = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCodeSuper);
            $this->assertStringContainsString("Database user 'postgres' has excessive administrative privileges", Artisan::output());

            // 2. Rejection of unlisted user account
            config(['database.connections.pgsql.username' => 'unauthorized_hacker']);

            $exitCodeUnauth = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCodeUnauth);
            $this->assertStringContainsString("Database user 'unauthorized_hacker' is not authorized", Artisan::output());
        } finally {
            config([
                'database.default' => 'sqlite',
                'database.connections.pgsql.username' => 'root',
                'database.connections.pgsql.database' => 'laravel',
            ]);
        }
    }

    public function test_clean_user_data_refuses_execution_against_arbitrary_sqlite_filenames(): void
    {
        try {
            config([
                'database.connections.sqlite.database' => database_path('arbitrary_test.sqlite'),
                'services.supabase.driver' => 'local',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString("is not an approved disposable target", Artisan::output());
        } finally {
            config(['database.connections.sqlite.database' => ':memory:']);
        }
    }

    public function test_clean_user_data_refuses_sqlite_file_with_same_basename_in_different_directory(): void
    {
        $altDir = storage_path('app/alt_test_dir');
        if (!is_dir($altDir)) {
            mkdir($altDir, 0750, true);
        }
        $altFile = $altDir . DIRECTORY_SEPARATOR . CleanUserData::ALLOWED_SQLITE_FILE;
        touch($altFile);

        try {
            config([
                'database.connections.sqlite.database' => $altFile,
                'services.supabase.driver' => 'local',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString("does not resolve to the canonical approved path", Artisan::output());
        } finally {
            config(['database.connections.sqlite.database' => ':memory:']);
            @unlink($altFile);
            @rmdir($altDir);
        }
    }

    public function test_clean_user_data_refuses_lookalike_sqlite_filenames(): void
    {
        try {
            config([
                'database.connections.sqlite.database' => database_path('disposable_e2e_fake.sqlite'),
                'services.supabase.driver' => 'local',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString("is not an approved disposable target", Artisan::output());
        } finally {
            config(['database.connections.sqlite.database' => ':memory:']);
        }
    }

    public function test_clean_user_data_refuses_connection_override_even_when_matching_default(): void
    {
        try {
            config([
                'database.default' => 'sqlite',
                'database.connections.sqlite.database' => ':memory:',
                'services.supabase.driver' => 'local',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--connection' => 'sqlite',
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);

            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString("Connection override '--connection' is disabled", Artisan::output());
        } finally {
            config(['database.default' => 'sqlite']);
        }
    }

    public function test_clean_user_data_refuses_connection_override_and_preserves_default_database(): void
    {
        $protectedUser = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'protected_default_user@example.com',
            'full_name' => 'Protected Default User',
            'role' => 'applicant',
            'is_active' => true,
        ]);

        try {
            config([
                'database.default' => 'sqlite',
                'database.connections.sqlite.database' => ':memory:',
                'database.connections.disposable_pg.driver' => 'pgsql',
                'database.connections.disposable_pg.host' => '127.0.0.1',
                'database.connections.disposable_pg.database' => CleanUserData::ALLOWED_PGSQL_DATABASE,
                'database.connections.disposable_pg.username' => 'solo_parent_tester',
                'services.supabase.driver' => 'local',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--connection' => 'disposable_pg',
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);

            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString('Connection mismatch detected', Artisan::output());

            // Default database records MUST be completely untouched
            $this->assertDatabaseHas('users', ['id' => $protectedUser->id]);
        } finally {
            config(['database.default' => 'sqlite']);
        }
    }

    public function test_clean_user_data_disables_storage_deletion_when_shared_mock_storage_detected(): void
    {
        $sharedMockDir = storage_path('app/mock_supabase');
        if (!is_dir($sharedMockDir)) {
            mkdir($sharedMockDir, 0750, true);
        }
        $sharedFile = $sharedMockDir . DIRECTORY_SEPARATOR . 'protected_shared_file.txt';
        file_put_contents($sharedFile, 'critical shared data');

        try {
            config([
                'services.supabase.driver' => 'local',
                'database.connections.sqlite.host' => '127.0.0.1',
                'database.connections.sqlite.database' => ':memory:',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);

            $this->assertEquals(0, $exitCode);
            $output = Artisan::output();
            $this->assertStringContainsString('Storage isolation not established (shared mock root detected); filesystem deletion disabled', $output);

            // Crucial: File in shared mock directory must STILL exist
            $this->assertFileExists($sharedFile);
        } finally {
            @unlink($sharedFile);
        }
    }

    public function test_clean_user_data_refuses_unauthorized_or_escaping_disposable_storage_root(): void
    {
        try {
            config([
                'services.supabase.driver' => 'local',
                'services.supabase.disposable_storage_path' => storage_path('app/mock_supabase'),
                'database.connections.sqlite.database' => ':memory:',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);

            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString('targets shared mock storage', Artisan::output());
        } finally {
            config(['services.supabase.disposable_storage_path' => null]);
        }
    }

    public function test_clean_user_data_purges_only_verified_isolated_disposable_storage_root(): void
    {
        $isolatedDir = storage_path('app/' . CleanUserData::ALLOWED_DISPOSABLE_STORAGE_DIR);
        if (!is_dir($isolatedDir)) {
            mkdir($isolatedDir, 0750, true);
        }
        $disposableFile = $isolatedDir . DIRECTORY_SEPARATOR . 'disposable_doc.pdf';
        file_put_contents($disposableFile, 'disposable test document');

        $sharedMockDir = storage_path('app/mock_supabase');
        if (!is_dir($sharedMockDir)) {
            mkdir($sharedMockDir, 0750, true);
        }
        $preservedFile = $sharedMockDir . DIRECTORY_SEPARATOR . 'preserved_shared_doc.pdf';
        file_put_contents($preservedFile, 'do not delete me');

        try {
            config([
                'services.supabase.driver' => 'local',
                'services.supabase.disposable_storage_path' => $isolatedDir,
                'database.connections.sqlite.database' => ':memory:',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);

            $this->assertEquals(0, $exitCode);
            $output = Artisan::output();
            $this->assertStringContainsString('Cleared isolated disposable storage', $output);

            // Disposable file was purged
            $this->assertFileDoesNotExist($disposableFile);

            // Shared file MUST still exist intact
            $this->assertFileExists($preservedFile);
        } finally {
            config(['services.supabase.disposable_storage_path' => null]);
            @unlink($disposableFile);
            @unlink($preservedFile);
            @rmdir($isolatedDir);
        }
    }

    public function test_clean_user_data_refuses_execution_with_shared_cache_backend(): void
    {
        try {
            config(['cache.default' => 'redis']);

            $exitCodeRedis = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCodeRedis);
            $this->assertStringContainsString("cannot run with shared cache store 'redis'", Artisan::output());

            config(['cache.default' => 'memcached']);
            $exitCodeMem = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCodeMem);
            $this->assertStringContainsString("cannot run with shared cache store 'memcached'", Artisan::output());
        } finally {
            config(['cache.default' => 'array']);
        }
    }

    public function test_clean_user_data_refuses_execution_against_unverified_localhost_forwarded_connections(): void
    {
        try {
            // 1. Rejection of suspected forwarded cloud pooler port (6543)
            config([
                'database.default' => 'pgsql',
                'database.connections.pgsql.driver' => 'pgsql',
                'database.connections.pgsql.host' => '127.0.0.1',
                'database.connections.pgsql.port' => 6543,
                'database.connections.pgsql.database' => CleanUserData::ALLOWED_PGSQL_DATABASE,
                'database.connections.pgsql.username' => 'solo_parent_tester',
                'services.supabase.driver' => 'local',
            ]);

            $exitCodePort = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCodePort);
            $this->assertStringContainsString('Detected potentially forwarded or tunneled remote database configuration', Artisan::output());

            // 2. Rejection of remote TLS verification on localhost
            config([
                'database.connections.pgsql.port' => 5432,
                'database.connections.pgsql.sslmode' => 'verify-full',
            ]);

            $exitCodeSsl = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(1, $exitCodeSsl);
            $this->assertStringContainsString('Detected potentially forwarded or tunneled remote database configuration', Artisan::output());
        } finally {
            config([
                'database.default' => 'sqlite',
                'database.connections.pgsql.port' => 5432,
                'database.connections.pgsql.sslmode' => 'prefer',
                'database.connections.pgsql.database' => 'laravel',
                'database.connections.pgsql.username' => 'root',
            ]);
        }
    }

    public function test_clean_user_data_refuses_execution_when_connected_database_identity_mismatches(): void
    {
        try {
            config([
                'database.default' => 'pgsql',
                'database.connections.pgsql.driver' => 'pgsql',
                'database.connections.pgsql.host' => '127.0.0.1',
                'database.connections.pgsql.port' => 5432,
                'database.connections.pgsql.database' => CleanUserData::ALLOWED_PGSQL_DATABASE,
                'database.connections.pgsql.username' => 'solo_parent_tester',
                'database.connections.pgsql.sslmode' => 'prefer',
                'services.supabase.driver' => 'local',
            ]);

            $mismatchedCommand = new class extends CleanUserData {
                protected function getConnectedDatabaseIdentity(string $connection, string $driver, \PDO $pdo): array
                {
                    return [
                        'driver' => 'pgsql',
                        'database' => 'unauthorized_different_database',
                        'file' => '',
                    ];
                }
            };
            $mismatchedCommand->setLaravel($this->app);

            $input = new \Symfony\Component\Console\Input\ArrayInput([
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $output = new \Symfony\Component\Console\Output\BufferedOutput();

            $exitCode = $mismatchedCommand->run($input, $output);

            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString("Actual connected database 'unauthorized_different_database' does not match allowed disposable database", $output->fetch());
        } finally {
            config([
                'database.default' => 'sqlite',
                'database.connections.pgsql.database' => 'laravel',
                'database.connections.pgsql.username' => 'root',
            ]);
        }
    }

    public function test_clean_user_data_force_flag_cannot_bypass_environment_safeguards(): void
    {
        try {
            $this->app->detectEnvironment(fn () => 'production');

            // Force flag must NOT bypass production prohibition
            $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString('strictly prohibited in PRODUCTION', Artisan::output());
        } finally {
            $this->app->detectEnvironment(fn () => 'testing');
        }
    }

    public function test_clean_user_data_force_flag_cannot_bypass_missing_disposable_marker(): void
    {
        try {
            config([
                'services.supabase.driver' => 'local',
                'database.connections.sqlite.host' => '127.0.0.1',
                'database.connections.sqlite.database' => ':memory:',
            ]);

            // Force flag without disposable marker must still fail closed
            $exitCode = Artisan::call('portal:clean-user-data', ['--force' => true]);
            $this->assertEquals(1, $exitCode);
            $this->assertStringContainsString('Missing required disposable environment identity marker', Artisan::output());
        } finally {
            config(['database.connections.sqlite.database' => ':memory:']);
        }
    }

    public function test_clean_user_data_confirms_zero_destructive_effects_when_safeguards_fail(): void
    {
        $applicant = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'protected_applicant@example.com',
            'full_name' => 'Protected Applicant',
            'role' => 'applicant',
            'is_active' => true,
        ]);

        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $applicant->id,
            'category_id' => $this->category->id,
            'status' => 'draft',
            'reference_no' => 'SP-PROTECT-001',
        ]);

        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $applicant->id,
            'application_id' => $app->id,
            'requirement_id' => $this->req->id,
            'original_filename' => 'protected_birth_cert.pdf',
            'storage_path' => 'mock_path/protected_birth_cert.pdf',
            'temporary_storage_path' => 'mock_path/protected_birth_cert.pdf',
            'storage_status' => 'temporary',
            'mime_type' => 'application/pdf',
            'file_size' => 2048,
            'review_status' => 'pending',
        ]);

        // Attempt destructive cleanup with invalid disposable marker
        $exitCode = Artisan::call('portal:clean-user-data', [
            '--force' => true,
            '--disposable-marker' => 'invalid_untrusted_marker',
        ]);

        $this->assertEquals(1, $exitCode);

        // Verify zero database writes/deletions occurred
        $this->assertDatabaseHas('users', ['id' => $applicant->id]);
        $this->assertDatabaseHas('applications', ['id' => $app->id]);
        $this->assertDatabaseHas('application_documents', ['id' => $doc->id]);
    }

    public function test_clean_user_data_permits_explicitly_verified_disposable_environment(): void
    {
        try {
            config([
                'services.supabase.driver' => 'local',
                'database.connections.sqlite.host' => '127.0.0.1',
                'database.connections.sqlite.database' => ':memory:',
            ]);

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);

            $this->assertEquals(0, $exitCode);
            $output = Artisan::output();
            $this->assertStringContainsString('CLEANUP COMPLETE — SYSTEM INTEGRITY VERIFIED', $output);
            $this->assertStringContainsString('Invalidated portal application cache keys', $output);
        } finally {
            config(['database.connections.sqlite.database' => ':memory:']);
        }
    }

    public function test_clean_user_data_strictly_preserves_super_admin_and_admin_passwords(): void
    {
        try {
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

            $exitCode = Artisan::call('portal:clean-user-data', [
                '--force' => true,
                '--disposable-marker' => CleanUserData::REQUIRED_DISPOSABLE_MARKER,
            ]);
            $this->assertEquals(0, $exitCode);

            // Applicant must be deleted
            $this->assertDatabaseMissing('users', ['id' => $applicant->id]);

            // Regular admin MUST be preserved
            $this->assertDatabaseHas('users', ['id' => $adminOfficer->id, 'role' => 'admin']);

            // Super Admin MUST be preserved AND its password hash MUST NOT have been overwritten
            $refreshedAdmin = User::find($superAdmin->id);
            $this->assertNotNull($refreshedAdmin);
            $this->assertTrue(\Illuminate\Support\Facades\Hash::check($customPassword, $refreshedAdmin->password_hash));
        } finally {
            config(['database.connections.sqlite.database' => ':memory:']);
        }
    }
}
