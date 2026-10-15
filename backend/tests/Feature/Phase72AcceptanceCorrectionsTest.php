<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\ApplicantProfile;
use App\Services\SupabaseStorageService;
use Illuminate\Support\Str;

class Phase72AcceptanceCorrectionsTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;

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

        // 3. Signed URL (mock offline URL)
        $url = $service->getSignedUrl($testPath);
        $this->assertStringContainsString('/storage/mock/', $url);

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
        $this->expectExceptionMessage('Directory traversal detected in storage path');

        config(['services.supabase.driver' => 'local']);
        $service = new SupabaseStorageService();
        $service->upload('../secret.txt', 'malicious content', 'text/plain');
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
}
