<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\ApplicantProfile;
use App\Services\SupabaseStorageService;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class Phase72AcceptanceCorrectionsTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;
    protected User $applicant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'caseworker@cswdd.gov.ph',
            'full_name' => 'Caseworker Admin',
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->superAdmin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'superadmin@cswdd.gov.ph',
            'full_name' => 'Super Administrator',
            'role' => 'super_admin',
            'is_active' => true,
        ]);

        $this->applicant = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'applicant@test.com',
            'full_name' => 'Test Applicant',
            'role' => 'applicant',
            'is_active' => true,
            'dpa_consent' => true,
        ]);
    }

    public function test_admin_can_create_walkin_applicant_with_email_only(): void
    {
        $res = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'Maria Santos',
            'email'                => 'maria.santos@example.com',
            'role'                 => 'applicant',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => true,
        ]);

        $res->assertStatus(201);
        $userId = $res->json('id');
        $this->assertNotEmpty($userId);

        $user = User::find($userId);
        $this->assertNotNull($user);
        $this->assertEquals('maria.santos@example.com', $user->email);
        $this->assertNull($user->phone_number);
        $this->assertEquals('applicant', $user->role);
        $this->assertTrue($user->is_active);
        // Never falsely mark an email as verified
        $this->assertNull($user->email_verified_at);
        // Never falsely mark caseworker IP as applicant IP
        $this->assertNull($user->dpa_consent_ip);
        $this->assertTrue($user->dpa_consent);

        // ApplicantProfile must be provisioned
        $profile = ApplicantProfile::where('user_id', $userId)->first();
        $this->assertNotNull($profile);
        $this->assertEquals('Maria', $profile->first_name);
        $this->assertEquals('Santos', $profile->last_name);

        // Caseworker DPA attestation must be logged in audit trail
        $audit = AuditLog::where('entity_id', $userId)->where('action', 'user.created')->first();
        $this->assertNotNull($audit);
        $this->assertTrue($audit->new_state['dpa_consent_attested']);
        $this->assertEquals('in_person_walkin', $audit->new_state['dpa_consent_channel']);
        $this->assertEquals($this->admin->id, $audit->new_state['attested_by_admin_id']);
    }

    public function test_admin_can_create_walkin_applicant_with_mobile_only_and_authenticate(): void
    {
        $res = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'Juan Dela Cruz',
            'phone_number'         => '09181234567',
            'role'                 => 'applicant',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => true,
        ]);

        $res->assertStatus(201);
        $userId = $res->json('id');
        $this->assertNotEmpty($userId);

        $user = User::find($userId);
        $this->assertNotNull($user);
        $this->assertNull($user->email);
        // Mobile number normalized to Philippine standard +639XXXXXXXXX
        $this->assertEquals('+639181234567', $user->phone_number);
        $this->assertNull($user->email_verified_at);
        $this->assertNull($user->dpa_consent_ip);

        // Profile should have contact_number
        $profile = ApplicantProfile::where('user_id', $userId)->first();
        $this->assertNotNull($profile);
        $this->assertEquals('+639181234567', $profile->contact_number);

        // Now test applicant authentication using the mobile number and temporary password
        $loginRes = $this->postJson('/api/auth/login', [
            'email'    => '09181234567',
            'password' => 'TemporaryPass123!',
        ]);

        $loginRes->assertStatus(200);
        $this->assertNotEmpty($loginRes->json('access_token'));
        $this->assertEquals($user->id, $loginRes->json('user.id'));
    }

    public function test_duplicate_mobile_number_is_rejected_across_formats(): void
    {
        // First applicant created with 09181234567 (normalized to +639181234567)
        $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'Applicant One',
            'phone_number'         => '09181234567',
            'role'                 => 'applicant',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => true,
        ])->assertStatus(201);

        // Second applicant attempts same number with +63 format
        $dupRes = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'Applicant Two',
            'phone_number'         => '+639181234567',
            'role'                 => 'applicant',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => true,
        ]);

        $dupRes->assertStatus(422);
        $dupRes->assertJsonValidationErrors(['phone_number']);
    }

    public function test_missing_both_email_and_mobile_is_rejected(): void
    {
        $res = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'No Contact Applicant',
            'role'                 => 'applicant',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => true,
        ]);

        $res->assertStatus(422);
    }

    public function test_missing_dpa_attestation_is_rejected(): void
    {
        $res = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'No Attestation Applicant',
            'email'                => 'noattest@example.com',
            'role'                 => 'applicant',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => false,
        ]);

        $res->assertStatus(422);
    }

    public function test_ordinary_admin_cannot_create_staff_or_super_admin_accounts(): void
    {
        $adminRes = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'Attempted Admin',
            'email'                => 'attempted.admin@cswdd.gov.ph',
            'role'                 => 'admin',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => true,
        ]);

        $adminRes->assertStatus(403);
        $this->assertStringContainsString('Only super administrators can create staff', $adminRes->json('detail'));

        $superRes = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'Attempted Super',
            'email'                => 'attempted.super@cswdd.gov.ph',
            'role'                 => 'super_admin',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => true,
        ]);

        $superRes->assertStatus(403);
    }

    public function test_super_admin_can_create_staff_and_super_admin_accounts(): void
    {
        $staffRes = $this->actingAs($this->superAdmin)->postJson('/api/admin/users', [
            'full_name' => 'Official Caseworker',
            'email'     => 'official.caseworker@cswdd.gov.ph',
            'role'      => 'admin',
            'password'  => 'OfficialPass123!',
        ]);

        $staffRes->assertStatus(201);
        $this->assertEquals('admin', $staffRes->json('role'));
        $this->assertNotNull(User::where('email', 'official.caseworker@cswdd.gov.ph')->first());
    }

    public function test_supabase_storage_service_local_driver_isolation(): void
    {
        config(['services.supabase.driver' => 'local']);

        $service = new SupabaseStorageService();
        $testPath = 'testing/isolated_test_' . Str::random(8) . '.txt';
        $content = 'Solo Parent Portal isolated storage test content';

        // 1. Upload
        $uploadResult = $service->upload($testPath, $content, 'text/plain');
        $this->assertEquals($testPath, $uploadResult['path']);

        // 2. Download
        $downloaded = $service->download($testPath);
        $this->assertEquals($content, $downloaded);

        // 3. Preview URL
        $url = $service->getSignedUrl($testPath);
        $this->assertStringContainsString('/api/documents/', $url);

        // 4. Move
        $newPath = 'testing/moved_' . Str::random(8) . '.txt';
        $moveResult = $service->move($testPath, $newPath);
        $this->assertTrue($moveResult);
        $this->assertEquals($content, $service->download($newPath));

        // 5. Delete
        $deleteResult = $service->delete($newPath);
        $this->assertTrue($deleteResult);
    }

    public function test_supabase_storage_service_rejects_local_driver_in_production(): void
    {
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Local/mock Supabase storage driver is strictly prohibited in production environments.');

        app()->detectEnvironment(fn () => 'production');
        config(['services.supabase.driver' => 'local']);

        new SupabaseStorageService();
    }

    public function test_supabase_storage_service_rejects_directory_traversal(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        config(['services.supabase.driver' => 'local']);
        $service = new SupabaseStorageService();
        $service->upload('../secret.txt', 'malicious content', 'text/plain');
    }

    public function test_supabase_storage_service_rejects_malicious_bucket_names(): void
    {
        config(['services.supabase.driver' => 'local']);
        $service = new SupabaseStorageService();

        $maliciousBuckets = ['.', '..', 'bucket/with/slash', 'bucket.with.dots', 'bucket with spaces', ''];
        foreach ($maliciousBuckets as $badBucket) {
            try {
                $service->upload('safe/path.txt', 'data', 'text/plain', $badBucket);
                $this->fail("Failed to reject malicious bucket name: {$badBucket}");
            } catch (\InvalidArgumentException $e) {
                $this->assertStringContainsString('Invalid or unsafe storage bucket name', $e->getMessage());
            }
        }
    }

    public function test_supabase_storage_service_rejects_malicious_file_paths(): void
    {
        config(['services.supabase.driver' => 'local']);
        $service = new SupabaseStorageService();

        $maliciousPaths = [
            '',
            '/',
            '///',
            'C:/Windows/system32/cmd.exe',
            '/etc/passwd',
            '..',
            '../secret.txt',
            'folder/../../secret.txt',
            "test/\0evil.txt",
        ];

        foreach ($maliciousPaths as $badPath) {
            try {
                $service->upload($badPath, 'data', 'text/plain');
                $this->fail("Failed to reject malicious file path: {$badPath}");
            } catch (\InvalidArgumentException $e) {
                $this->assertTrue(true);
            }
        }
    }

    public function test_supabase_storage_service_fails_safely_when_live_credentials_missing(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Supabase storage is unconfigured');

        config([
            'services.supabase.driver' => 'supabase',
            'services.supabase.url' => '',
            'services.supabase.service_key' => '',
        ]);
        $service = new SupabaseStorageService();
        $service->upload('test/file.txt', 'content', 'text/plain');
    }

    public function test_walkin_creation_requires_dpa_consent_attestation(): void
    {
        // 1. Omitted key -> 422
        $omittedRes = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name' => 'Omitted Attestation Applicant',
            'email'     => 'omitted@example.com',
            'role'      => 'applicant',
            'password'  => 'TemporaryPass123!',
        ]);
        $omittedRes->assertStatus(422);
        $omittedRes->assertJsonValidationErrors(['dpa_consent_attested']);

        // 2. Explicit false -> 422
        $falseRes = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'False Attestation Applicant',
            'email'                => 'false@example.com',
            'role'                 => 'applicant',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => false,
        ]);
        $falseRes->assertStatus(422);
        $falseRes->assertJsonValidationErrors(['dpa_consent_attested']);

        // 3. Explicit true -> 201
        $trueRes = $this->actingAs($this->admin)->postJson('/api/admin/users', [
            'full_name'            => 'Valid Attested Applicant',
            'email'                => 'valid.attested@example.com',
            'role'                 => 'applicant',
            'password'             => 'TemporaryPass123!',
            'dpa_consent_attested' => true,
        ]);
        $trueRes->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email'       => 'valid.attested@example.com',
            'dpa_consent' => true,
        ]);
    }

    public function test_authenticated_document_preview_and_idor_protection(): void
    {
        config(['services.supabase.driver' => 'local']);

        // 1. Seed document owned by $this->applicant
        $storage = new SupabaseStorageService();
        $testDocPath = 'applications/test-uuid/id_card.pdf';
        $storage->upload($testDocPath, 'SYNTHETIC_PDF_BINARY_DATA', 'application/pdf');

        $category = \App\Models\Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'CAT_A_' . Str::random(4),
            'name' => 'Category A',
            'is_active' => true,
        ]);

        $req = \App\Models\DocumentaryRequirement::create([
            'id' => (string) Str::uuid(),
            'category_id' => $category->id,
            'name' => 'ID Card',
            'is_required' => true,
        ]);

        $app = \App\Models\Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'category_id' => $category->id,
            'reference_no' => 'APP-2026-PREVIEW',
            'status' => 'draft',
            'application_type' => 'new_id',
        ]);

        $doc = \App\Models\Document::create([
            'application_id'         => $app->id,
            'requirement_id'         => $req->id,
            'user_id'                => $this->applicant->id,
            'storage_path'           => $testDocPath,
            'permanent_storage_path' => $testDocPath,
            'original_filename'      => 'id_card.pdf',
            'mime_type'              => 'application/pdf',
            'file_size'              => 26,
            'storage_status'         => 'promoted',
            'review_status'          => 'approved',
        ]);

        $applicantToken = $this->applicant->createToken('test-applicant')->plainTextToken;
        $adminToken = $this->admin->createToken('test-admin')->plainTextToken;

        // 2. Applicant views own document via view endpoint - verify NO token is in URL
        $viewRes = $this->actingAs($this->applicant)->getJson("/api/documents/{$doc->id}/view");
        $viewRes->assertStatus(200);
        $this->assertStringContainsString("/api/documents/{$doc->id}/preview", $viewRes->json('url'));
        $this->assertStringNotContainsString('token=', $viewRes->json('url'));

        // 3. Security check: Token passed ONLY as query parameter must be REJECTED (401 Unauthenticated)
        app('auth')->forgetGuards();
        $queryTokenRes = $this->getJson("/api/documents/{$doc->id}/preview?token={$applicantToken}");
        $queryTokenRes->assertStatus(401);

        // 4. Applicant previews own document via standard Authorization header
        $this->flushHeaders();
        app('auth')->forgetGuards();
        $streamRes = $this->withToken($applicantToken)->get("/api/documents/{$doc->id}/preview");
        $streamRes->assertStatus(200);
        $this->assertEquals('application/pdf', $streamRes->headers->get('Content-Type'));
        $this->assertEquals('SYNTHETIC_PDF_BINARY_DATA', $streamRes->getContent());

        // 5. Admin previews applicant document via standard Authorization header
        $this->flushHeaders();
        app('auth')->forgetGuards();
        $adminStreamRes = $this->withToken($adminToken)->get("/api/admin/documents/{$doc->id}/preview");
        $adminStreamRes->assertStatus(200);
        $this->assertEquals('application/pdf', $adminStreamRes->headers->get('Content-Type'));
        $this->assertEquals('SYNTHETIC_PDF_BINARY_DATA', $adminStreamRes->getContent());

        // 6. Unauthorized access (IDOR): Another applicant attempts to access $doc via Authorization header -> 403
        $otherApplicant = User::create([
            'full_name'         => 'Other Citizen',
            'email'             => 'other.citizen@example.com',
            'password_hash'     => Hash::make('OtherPassword123!'),
            'role'              => 'applicant',
            'auth_provider'     => 'local',
            'is_active'         => true,
            'email_verified_at' => now(),
            'dpa_consent'       => true,
        ]);
        $otherToken = $otherApplicant->createToken('other-token')->plainTextToken;

        $this->flushHeaders();
        app('auth')->forgetGuards();
        $idorRes = $this->withToken($otherToken)->getJson("/api/documents/{$doc->id}/preview");
        $idorRes->assertStatus(403);

        // 7. Unauthenticated access without any token -> 401
        $this->flushHeaders();
        app('auth')->forgetGuards();
        $unauthRes = $this->getJson("/api/documents/{$doc->id}/preview");
        $unauthRes->assertStatus(401);

        // 8. Privilege escalation: Applicant attempting to access admin preview -> 403
        $this->flushHeaders();
        app('auth')->forgetGuards();
        $forbiddenAdminRes = $this->withToken($applicantToken)->getJson("/api/admin/documents/{$doc->id}/preview");
        $forbiddenAdminRes->assertStatus(403);
    }
}
