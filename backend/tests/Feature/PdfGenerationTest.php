<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\ApplicantProfile;
use App\Models\Category;
use App\Models\Application;
use App\Models\Barangay;
use Illuminate\Support\Str;

class PdfGenerationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $user;
    protected Application $application;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'admin.pdf@example.com',
            'full_name' => 'Admin PDF Tester',
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'applicant.pdf@example.com',
            'full_name' => 'Applicant PDF Tester',
            'role' => 'applicant',
            'is_active' => true,
        ]);

        $barangay = Barangay::create([
            'id' => (string) Str::uuid(),
            'name' => 'Barangay Antongalon',
            'code' => 'ANTONGALON',
        ]);

        ApplicantProfile::create([
            'user_id' => $this->user->id,
            'first_name' => 'John',
            'last_name' => 'Doe',
            'birth_date' => '1988-11-20',
            'sex' => 'Male',
            'barangay_id' => $barangay->id,
            'barangay' => 'Barangay Antongalon',
            'contact_number' => '09191234567',
        ]);

        $this->category = Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'CAT_A',
            'name' => 'Category A - Death of Spouse',
            'is_active' => true,
        ]);

        $this->application = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'category_id' => $this->category->id,
            'reference_no' => 'APP-2026-PDF-01',
            'application_type' => 'new_id',
            'status' => 'approved',
            'case_number' => 'CASE-2026-99',
            'id_card_number' => 'SPIC-2026-99',
            'date_issued' => '2026-10-11',
            'submitted_at' => now(),
        ]);
    }

    public function test_generate_application_form_pdf(): void
    {
        $res = $this->actingAs($this->user)->get("/api/applications/{$this->application->id}/form.pdf");
        $res->assertStatus(200);
        $this->assertEquals('application/pdf', $res->headers->get('Content-Type'));
        $this->assertNotEmpty($res->getContent());
    }

    public function test_admin_generate_id_card_pdf(): void
    {
        $res = $this->actingAs($this->admin)->get("/api/admin/applications/{$this->application->id}/id-card.pdf");
        $res->assertStatus(200);
        $this->assertEquals('application/pdf', $res->headers->get('Content-Type'));
        $this->assertNotEmpty($res->getContent());
    }

    public function test_admin_generate_statistics_pdf(): void
    {
        $res = $this->actingAs($this->admin)->get("/api/admin/reports/statistics.pdf");
        $res->assertStatus(200);
        $this->assertEquals('application/pdf', $res->headers->get('Content-Type'));
        $this->assertNotEmpty($res->getContent());
    }

    public function test_admin_export_csv(): void
    {
        $res = $this->actingAs($this->admin)->get("/api/admin/reports/export.csv");
        $res->assertStatus(200);
        $this->assertStringContainsString('text/csv', strtolower($res->headers->get('Content-Type')));
    }
}
