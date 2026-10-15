<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\ApplicantProfile;
use App\Models\Application;
use App\Models\Category;
use App\Models\DocumentaryRequirement;
use App\Models\Document;
use App\Models\Message;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class QaSecurityAndIntegrityFixesTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $admin;
    protected User $applicant1;
    protected User $applicant2;
    protected Category $categoryA;
    protected Category $categoryB;
    protected DocumentaryRequirement $reqA;
    protected DocumentaryRequirement $reqB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'superadmin@example.com',
            'full_name' => 'Super Administrator',
            'role' => 'super_admin',
            'is_active' => true,
            'password' => Hash::make('SuperSecretPass123!'),
        ]);

        $this->admin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'regularadmin@example.com',
            'full_name' => 'Regular Administrator',
            'role' => 'admin',
            'is_active' => true,
            'password' => Hash::make('AdminSecretPass123!'),
        ]);

        $this->applicant1 = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'applicant1@example.com',
            'full_name' => 'Applicant One',
            'role' => 'applicant',
            'is_active' => true,
            'password' => Hash::make('ApplicantSecret123!'),
        ]);

        $this->applicant2 = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'applicant2@example.com',
            'full_name' => 'Applicant Two',
            'role' => 'applicant',
            'is_active' => true,
            'password' => Hash::make('ApplicantSecret123!'),
        ]);

        $this->categoryA = Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'CAT_A',
            'name' => 'Category A - Death of Spouse',
            'is_active' => true,
        ]);

        $this->categoryB = Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'CAT_B',
            'name' => 'Category B - Abandonment',
            'is_active' => true,
        ]);

        $this->reqA = DocumentaryRequirement::create([
            'id' => (string) Str::uuid(),
            'category_id' => $this->categoryA->id,
            'name' => 'Death Certificate',
            'is_mandatory' => true,
        ]);

        $this->reqB = DocumentaryRequirement::create([
            'id' => (string) Str::uuid(),
            'category_id' => $this->categoryB->id,
            'name' => 'Barangay Certification of Abandonment',
            'is_mandatory' => true,
        ]);
    }

    /**
     * QA-P0-02 & QA-P1-11: Category table validator & cascade protection
     */
    public function test_category_management_validates_correct_table_and_prevents_destructive_delete(): void
    {
        // 1. Creating a category with duplicate code fails against solo_parent_categories
        $res = $this->actingAs($this->superAdmin)->postJson('/api/admin/categories', [
            'code' => 'CAT_A',
            'name' => 'Duplicate Code Category',
            'description' => 'Test',
            'is_active' => true,
        ]);
        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['code']);

        // 2. Cannot delete category with active application
        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant1->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-TEST-CAT-DEL',
            'application_type' => 'new_id',
            'status' => 'draft',
        ]);

        $delRes = $this->actingAs($this->superAdmin)->deleteJson("/api/admin/categories/{$this->categoryA->id}");
        $delRes->assertStatus(422);
        $this->assertStringContainsString('linked to existing applicant applications', $delRes->json('detail'));
        $this->assertDatabaseHas('solo_parent_categories', ['id' => $this->categoryA->id]);
    }

    /**
     * QA-P1-04 & QA-P1-12: Admin permissions, provisioning, and token revocation
     */
    public function test_admin_permissions_self_deactivation_and_role_hierarchy(): void
    {
        // 1. Admin cannot deactivate themselves
        $selfDeact = $this->actingAs($this->admin)->putJson("/api/admin/users/{$this->admin->id}/status", [
            'is_active' => false,
        ]);
        $selfDeact->assertStatus(422);

        // 2. Regular admin cannot alter super_admin role
        $roleRes = $this->actingAs($this->admin)->putJson("/api/admin/users/{$this->superAdmin->id}/role", [
            'role' => 'admin',
        ]);
        $roleRes->assertStatus(403);

        // 3. Regular admin cannot deactivate super_admin
        $statusRes = $this->actingAs($this->admin)->putJson("/api/admin/users/{$this->superAdmin->id}/status", [
            'is_active' => false,
        ]);
        $statusRes->assertStatus(403);

        // 4. Super admin can provision an applicant account with profile
        $provRes = $this->actingAs($this->superAdmin)->postJson('/api/admin/users', [
            'full_name' => 'Provisioned Applicant',
            'email' => 'provisioned@example.com',
            'password' => 'SecureP@ssw0rd2026!',
            'role' => 'applicant',
            'is_active' => true,
        ]);
        $provRes->assertStatus(201);
        $newUserId = $provRes->json('id');
        $this->assertDatabaseHas('users', ['id' => $newUserId, 'role' => 'applicant']);
        $this->assertDatabaseHas('applicant_profiles', ['user_id' => $newUserId]);
    }

    /**
     * QA-P1-05: Cross-account messaging isolation
     */
    public function test_messaging_isolation_prevents_cross_account_application_tagging(): void
    {
        $app1 = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant1->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-MSG-001',
            'application_type' => 'new_id',
            'status' => 'submitted',
        ]);

        // Applicant 2 cannot send a message tagged with Applicant 1's application
        $res = $this->actingAs($this->applicant2)->postJson('/api/messages', [
            'application_id' => $app1->id,
            'subject' => 'Unauthorized query',
            'message' => 'Sneaking into another application thread',
        ]);
        $res->assertStatus(403);

        // Applicant 1 can send message on their own application
        $goodRes = $this->actingAs($this->applicant1)->postJson('/api/messages', [
            'application_id' => $app1->id,
            'subject' => 'Legitimate inquiry',
            'message' => 'Status update please',
        ]);
        $goodRes->assertStatus(201);
    }

    /**
     * QA-P1-06: Profile update immutability for completed/finalized applications
     */
    public function test_profile_mutation_does_not_alter_approved_or_released_applications(): void
    {
        ApplicantProfile::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant1->id,
            'first_name' => 'Initial',
            'last_name' => 'Name',
        ]);

        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant1->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-FINAL-001',
            'application_type' => 'new_id',
            'status' => 'approved',
        ]);

        $appForm = \App\Models\ApplicationForm::create([
            'id' => (string) Str::uuid(),
            'application_id' => $app->id,
            'monthly_income' => '15000',
        ]);

        // Applicant updates profile
        $res = $this->actingAs($this->applicant1)->putJson('/api/profile', [
            'first_name' => 'Changed',
            'last_name' => 'Name',
            'monthly_income' => '99000',
        ]);
        $res->assertStatus(200);

        // Application form record remains unchanged at 15000
        $appForm->refresh();
        $this->assertEquals('15000', $appForm->monthly_income);
    }

    /**
     * QA-P1-07 & QA-P2-05: Document operations restricted on finalized applications and category requirement matching
     */
    public function test_document_operations_blocked_on_finalized_applications(): void
    {
        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant1->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-DOC-001',
            'application_type' => 'new_id',
            'status' => 'approved',
        ]);

        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant1->id,
            'application_id' => $app->id,
            'requirement_id' => $this->reqA->id,
            'original_filename' => 'death_cert.pdf',
            'storage_path' => 'docs/death_cert.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'review_status' => 'approved',
        ]);

        // Attempt delete on approved application
        $delRes = $this->actingAs($this->applicant1)->deleteJson("/api/documents/{$doc->id}");
        $delRes->assertStatus(422);
        $this->assertStringContainsString("Cannot delete documents from an application that is in 'approved' status", $delRes->json('detail'));
    }

    /**
     * QA-P1-08: Application state transition validation
     */
    public function test_application_state_transitions_fail_closed_for_invalid_steps(): void
    {
        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant1->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-STATE-001',
            'application_type' => 'new_id',
            'status' => 'draft',
        ]);

        // Attempt invalid jump from draft directly to approved
        $res = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$app->id}/status", [
            'status' => 'approved',
            'note' => 'Skipping all verification steps',
        ]);
        $res->assertStatus(422);
        $this->assertStringContainsString('Cannot transition', $res->json('detail'));

        // Attempt transition to unrecognized status
        $badRes = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$app->id}/status", [
            'status' => 'non_existent_status',
        ]);
        $badRes->assertStatus(422);
    }
}
