<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\ApplicantProfile;
use App\Models\Category;
use App\Models\DocumentaryRequirement;
use App\Models\Application;
use App\Models\Barangay;
use Illuminate\Support\Str;

class ApplicationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Category $category;
    protected Barangay $barangay;
    protected DocumentaryRequirement $req;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'app.user@example.com',
            'full_name' => 'Application Tester',
            'email_verified_at' => now(),
            'is_active' => true,
            'role' => 'applicant',
        ]);

        $this->barangay = Barangay::create([
            'id' => (string) Str::uuid(),
            'name' => 'Barangay Golden Ribbon',
            'code' => 'GOLDEN_RIBBON',
        ]);

        ApplicantProfile::create([
            'user_id' => $this->user->id,
            'first_name' => 'Application',
            'last_name' => 'Tester',
            'sex' => 'Female',
            'birth_date' => '1992-08-20',
            'civil_status' => 'Single',
            'contact_number' => '09187654321',
            'barangay' => 'Barangay Golden Ribbon',
            'barangay_id' => $this->barangay->id,
            'is_profile_complete' => true,
        ]);

        $this->category = Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'CAT_B',
            'name' => 'Category B - Abandonment',
            'is_active' => true,
        ]);

        $this->req = DocumentaryRequirement::create([
            'id' => (string) Str::uuid(),
            'category_id' => $this->category->id,
            'name' => 'Barangay Certification of Abandonment',
            'is_required' => true,
        ]);
    }

    public function test_get_my_app_returns_null_when_no_application(): void
    {
        $res = $this->actingAs($this->user)->getJson('/api/applications/me');
        $res->assertStatus(200);
        $this->assertNull($res->json('application'));
    }

    public function test_renewal_application_submission(): void
    {
        $res = $this->actingAs($this->user)->postJson('/api/applications/renew', [
            'existing_spic_no' => 'SPIC-2025-9999',
        ]);

        $res->assertStatus(201);
        $res->assertJsonStructure(['id', 'reference_no', 'status']);

        $app = Application::where('user_id', $this->user->id)->first();
        $this->assertNotNull($app);
        $this->assertEquals('renewal', $app->application_type);
        $this->assertEquals('draft', $app->status);
    }

    public function test_loss_of_spic_application_submission(): void
    {
        $res = $this->actingAs($this->user)->postJson('/api/applications/loss-spic', [
            'loss_reason' => 'Lost wallet with ID while traveling',
            'loss_date' => '2026-09-15',
        ]);

        $res->assertStatus(201);
        $res->assertJsonStructure(['id', 'reference_no', 'status']);

        $app = Application::where('user_id', $this->user->id)
            ->where('application_type', 'loss_spic')
            ->first();
        $this->assertNotNull($app);
        $this->assertEquals('draft', $app->status);
    }

    public function test_submission_check_identifies_incomplete_requirements(): void
    {
        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'category_id' => $this->category->id,
            'reference_no' => 'APP-2026-TEST',
            'application_type' => 'new_id',
            'status' => 'draft',
        ]);

        $res = $this->actingAs($this->user)->getJson("/api/applications/submission-check?application_id={$app->id}");
        $res->assertStatus(200);
        $res->assertJson([
            'ready' => false,
        ]);
    }

    public function test_cancel_draft_application(): void
    {
        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'category_id' => $this->category->id,
            'reference_no' => 'APP-2026-DRAFT',
            'application_type' => 'new_id',
            'status' => 'draft',
        ]);

        $res = $this->actingAs($this->user)->deleteJson('/api/applications/draft');
        $res->assertStatus(200);

        $this->assertDatabaseMissing('applications', ['id' => $app->id]);
    }
}
