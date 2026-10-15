<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Application;
use App\Models\Category;
use App\Models\Barangay;
use App\Models\DocumentaryRequirement;
use App\Models\Document;
use Illuminate\Support\Str;

class AdminManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $regularUser;
    protected Category $category;
    protected Application $application;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'admin.chief@example.com',
            'full_name' => 'CSWDD Administrator',
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->regularUser = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'citizen@example.com',
            'full_name' => 'Citizen Applicant',
            'role' => 'applicant',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'CAT_A',
            'name' => 'Category A - Death of Spouse',
            'is_active' => true,
        ]);

        $this->application = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->regularUser->id,
            'category_id' => $this->category->id,
            'reference_no' => 'APP-2026-ADMIN',
            'application_type' => 'new_id',
            'status' => 'submitted',
        ]);
    }

    public function test_non_admin_blocked_from_admin_routes(): void
    {
        $res = $this->actingAs($this->regularUser)->getJson('/api/admin/applications');
        $res->assertStatus(403);
    }

    public function test_admin_can_list_and_search_applications(): void
    {
        $res = $this->actingAs($this->admin)->getJson('/api/admin/applications');
        $res->assertStatus(200);
        $res->assertJsonStructure(['data', 'current_page', 'total']);

        // Search by reference_no
        $searchRes = $this->actingAs($this->admin)->getJson('/api/admin/applications?search=APP-2026-ADMIN');
        $searchRes->assertStatus(200);
        $this->assertCount(1, $searchRes->json('data'));
    }

    public function test_admin_can_view_application_dossier(): void
    {
        $res = $this->actingAs($this->admin)->getJson("/api/admin/applications/{$this->application->id}");
        $res->assertStatus(200);
        $this->assertEquals($this->application->id, $res->json('application.id'));
    }

    public function test_admin_can_update_status_and_assign_official_fields(): void
    {
        // 1. Assign official fields
        $fieldsRes = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$this->application->id}/official-fields", [
            'case_number' => 'CASE-2026-001',
            'id_card_number' => 'SPIC-2026-001',
            'date_issued' => '2026-10-11',
        ]);
        $fieldsRes->assertStatus(200);

        $this->application->refresh();
        $this->assertEquals('CASE-2026-001', $this->application->case_number);
        $this->assertEquals('SPIC-2026-001', $this->application->id_card_number);

        // 2. Update status to approved
        $statusRes = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$this->application->id}/status", [
            'status' => 'approved',
            'note' => 'Qualified and verified under RA 11861.',
        ]);
        $statusRes->assertStatus(200);

        $this->application->refresh();
        $this->assertEquals('approved', $this->application->status);
    }

    public function test_admin_can_disqualify_application_with_reason(): void
    {
        $res = $this->actingAs($this->admin)->postJson("/api/admin/applications/{$this->application->id}/disqualify", [
            'reason' => 'Income exceeds threshold and does not qualify under indigency rules.',
        ]);
        $res->assertStatus(200);

        $this->application->refresh();
        $this->assertEquals('rejected', $this->application->status);
    }

    public function test_admin_barangay_crud(): void
    {
        // Create
        $createRes = $this->actingAs($this->admin)->postJson('/api/admin/barangays', [
            'name' => 'Barangay Test Unit',
            'code' => 'TEST_UNIT',
        ]);
        $createRes->assertStatus(201);
        $bId = $createRes->json('id');

        // Update
        $updateRes = $this->actingAs($this->admin)->putJson("/api/admin/barangays/{$bId}", [
            'name' => 'Barangay Test Unit Updated',
            'code' => 'TEST_UNIT_UPDATED',
        ]);
        $updateRes->assertStatus(200);

        // Delete
        $deleteRes = $this->actingAs($this->admin)->deleteJson("/api/admin/barangays/{$bId}");
        $deleteRes->assertStatus(200);
        $this->assertDatabaseMissing('barangays', ['id' => $bId]);
    }

    public function test_admin_analytics_overview(): void
    {
        $res = $this->actingAs($this->admin)->getJson('/api/admin/analytics/overview');
        $res->assertStatus(200);
        $res->assertJsonStructure(['total_applications', 'total_registered', 'total_users']);
    }

    public function test_admin_audit_logs(): void
    {
        $res = $this->actingAs($this->admin)->getJson('/api/admin/audit-logs');
        $res->assertStatus(200);
        $res->assertJsonStructure(['data']);
    }
}
