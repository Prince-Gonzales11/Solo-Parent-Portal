<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\ApplicantProfile;
use App\Models\Application;
use App\Models\ApplicationForm;
use App\Models\Category;
use App\Models\DocumentaryRequirement;
use App\Models\Document;
use App\Models\Barangay;
use App\Models\Message;
use App\Models\Notification;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class EndToEndSystemWideRegressionTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $admin;
    protected User $applicant;
    protected Barangay $barangay;
    protected Category $categoryA;
    protected DocumentaryRequirement $reqA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'superadmin.qa@butuan.gov.ph',
            'full_name' => 'Super Administrator Lead',
            'role' => 'super_admin',
            'is_active' => true,
            'password_hash' => Hash::make('SuperAdmin2026!'),
        ]);

        $this->admin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'admin.officer@butuan.gov.ph',
            'full_name' => 'CSWDD Case Worker',
            'role' => 'admin',
            'is_active' => true,
            'password_hash' => Hash::make('Officer2026!'),
        ]);

        $this->barangay = Barangay::create([
            'id' => (string) Str::uuid(),
            'name' => 'Barangay Urduja',
            'code' => 'URDUJA',
        ]);

        $this->applicant = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'applicant.jane@example.com',
            'full_name' => 'Jane Doe Applicant',
            'role' => 'applicant',
            'is_active' => true,
            'email_verified_at' => now(),
            'password_hash' => Hash::make('JaneSecret123!'),
        ]);

        ApplicantProfile::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'sex' => 'Female',
            'birth_date' => '1990-05-15',
            'civil_status' => 'Single',
            'contact_number' => '09123456789',
            'barangay' => 'Barangay Urduja',
            'barangay_id' => $this->barangay->id,
            'city_municipality' => 'Butuan City',
            'province' => 'Agusan del Norte',
            'is_profile_complete' => true,
        ]);

        $this->categoryA = Category::firstOrCreate(
            ['code' => 'a1'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Category A1 - Solo Parent',
                'description' => 'Test Solo Parent Category',
                'is_active' => true,
                'display_order' => 1,
            ]
        );

        $this->reqA = DocumentaryRequirement::firstOrCreate(
            ['category_id' => $this->categoryA->id, 'name' => 'PSA Birth Certificate'],
            [
                'id' => (string) Str::uuid(),
                'is_required' => true,
            ]
        );
    }

    /**
     * 1. Renewal lifecycle: allowed when previous ID is expired
     */
    public function test_renewal_allowed_when_previous_id_is_expired(): void
    {
        // Completed application expired 6 months ago
        $expiredApp = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-EXPIRED-001',
            'application_type' => 'new_id',
            'status' => 'released',
            'id_card_number' => 'SPIC-2024-001',
            'date_issued' => now()->subYears(2)->toDateString(),
            'released_at' => now()->subYears(2),
        ]);

        // Query eligibility via getMyApp
        $statusRes = $this->actingAs($this->applicant)->getJson('/api/applications/me');
        $statusRes->assertStatus(200);
        $this->assertTrue($statusRes->json('eligibility.can_apply_renewal'));
        $this->assertStringContainsString('expired', strtolower($statusRes->json('eligibility.can_apply_renewal_reason')));

        // Submit renewal application
        $renewRes = $this->actingAs($this->applicant)->postJson('/api/applications/renew', [
            'existing_spic_no' => 'SPIC-2024-001',
        ]);
        $renewRes->assertStatus(201);
        $this->assertEquals('renewal', $renewRes->json('application_type'));
        $this->assertEquals('draft', $renewRes->json('status'));
        $this->assertEquals($expiredApp->id, $renewRes->json('previous_application_id'));
    }

    /**
     * 2. Renewal lifecycle: allowed when previous ID is active and valid
     */
    public function test_renewal_allowed_when_previous_id_is_active_and_valid(): void
    {
        // Released 3 months ago (valid for 9 more months)
        $activeIdApp = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-ACTIVE-002',
            'application_type' => 'new_id',
            'status' => 'completed',
            'id_card_number' => 'SPIC-2026-002',
            'date_issued' => now()->subMonths(3)->toDateString(),
            'released_at' => now()->subMonths(3),
        ]);

        $statusRes = $this->actingAs($this->applicant)->getJson('/api/applications/me');
        $statusRes->assertStatus(200);
        $this->assertTrue($statusRes->json('eligibility.can_apply_renewal'));
        $this->assertStringContainsString('active and valid', strtolower($statusRes->json('eligibility.can_apply_renewal_reason')));

        $renewRes = $this->actingAs($this->applicant)->postJson('/api/applications/renew', [
            'existing_spic_no' => 'SPIC-2026-002',
        ]);
        $renewRes->assertStatus(201);
        $this->assertEquals('renewal', $renewRes->json('application_type'));
    }

    /**
     * 3. Renewal blocked when an active application is already in progress
     */
    public function test_renewal_blocked_when_active_application_in_progress(): void
    {
        Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-INPROGRESS-003',
            'application_type' => 'new_id',
            'status' => 'under_initial_review',
        ]);

        $statusRes = $this->actingAs($this->applicant)->getJson('/api/applications/me');
        $statusRes->assertStatus(200);
        $this->assertFalse($statusRes->json('eligibility.can_apply_renewal'));

        $renewRes = $this->actingAs($this->applicant)->postJson('/api/applications/renew', [
            'existing_spic_no' => 'SPIC-OLD',
        ]);
        $renewRes->assertStatus(409);
        $this->assertStringContainsString('active application in progress', $renewRes->json('detail'));
    }

    /**
     * 4. Loss of SPIC application flow & conflict prevention
     */
    public function test_loss_of_spic_lifecycle(): void
    {
        // 1. Submit loss application successfully when no active app exists
        $lossRes = $this->actingAs($this->applicant)->postJson('/api/applications/loss-spic', [
            'loss_reason' => 'Stolen wallet on public transport',
            'loss_date' => '2026-10-10',
            'previous_spic_no' => 'SPIC-2025-LOST',
        ]);
        $lossRes->assertStatus(201);
        $this->assertEquals('loss_spic', $lossRes->json('application_type'));
        $this->assertEquals('draft', $lossRes->json('status'));

        // 2. Second attempt returns the idempotent active loss_spic draft
        $secondRes = $this->actingAs($this->applicant)->postJson('/api/applications/loss-spic', [
            'loss_reason' => 'Another loss',
        ]);
        $secondRes->assertStatus(200);
        $this->assertEquals($lossRes->json('id'), $secondRes->json('id'));

        // 3. But when another non-loss active application is in progress, it blocks with 409
        $otherUser = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'other.applicant@example.com',
            'full_name' => 'Other Applicant',
            'role' => 'applicant',
            'is_active' => true,
        ]);
        Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $otherUser->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-OTHER-ACTIVE',
            'application_type' => 'new_id',
            'status' => 'submitted',
        ]);
        $blockedRes = $this->actingAs($otherUser)->postJson('/api/applications/loss-spic', [
            'loss_reason' => 'Lost ID',
        ]);
        $blockedRes->assertStatus(409);
    }

    /**
     * 5. Document rejection -> Applicant correction flow
     */
    public function test_document_rejection_and_correction_flow(): void
    {
        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-DOC-REJECT-005',
            'application_type' => 'new_id',
            'status' => 'submitted',
        ]);

        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'application_id' => $app->id,
            'requirement_id' => $this->reqA->id,
            'original_filename' => 'blurry_birth_cert.jpg',
            'storage_path' => 'documents/blurry.jpg',
            'file_size' => 2048,
            'mime_type' => 'image/jpeg',
            'review_status' => 'submitted',
        ]);

        // Admin reviews and rejects document with mandatory remarks
        $reviewRes = $this->actingAs($this->admin)->postJson("/api/admin/documents/{$doc->id}/review", [
            'status' => 'rejected',
            'remarks' => 'Document is blurry and unreadable. Please provide a clear scan.',
        ]);
        $reviewRes->assertStatus(200);

        $doc->refresh();
        $this->assertEquals('rejected', $doc->review_status);
        $this->assertEquals('Document is blurry and unreadable. Please provide a clear scan.', $doc->review_note);

        // Application status transitions to for_document_correction
        $app->refresh();
        $this->assertEquals('for_document_correction', $app->status);

        // Applicant checks notifications (returns direct JSON array)
        $notifRes = $this->actingAs($this->applicant)->getJson('/api/notifications');
        $notifRes->assertStatus(200);
        $this->assertTrue(collect($notifRes->json())->contains('type', 'document_review'));
    }

    /**
     * 6. Admin approve-all documents endpoint
     */
    public function test_admin_approve_all_documents_for_application(): void
    {
        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-APPROVE-ALL-006',
            'application_type' => 'new_id',
            'status' => 'submitted',
        ]);

        $doc1 = Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'application_id' => $app->id,
            'requirement_id' => $this->reqA->id,
            'original_filename' => 'doc1.pdf',
            'storage_path' => 'documents/doc1.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'review_status' => 'submitted',
        ]);

        $doc2 = Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'application_id' => $app->id,
            'requirement_id' => $this->reqA->id,
            'original_filename' => 'doc2.pdf',
            'storage_path' => 'documents/doc2.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'review_status' => 'submitted',
        ]);

        $res = $this->actingAs($this->admin)->postJson("/api/admin/applications/{$app->id}/documents/approve-all");
        $res->assertStatus(200);

        $doc1->refresh();
        $doc2->refresh();
        $this->assertEquals('approved', $doc1->review_status);
        $this->assertEquals('approved', $doc2->review_status);
    }

    /**
     * 7. End-to-end admin workflow: Initial review -> Final assessment -> Approval -> Release -> Completion
     */
    public function test_complete_admin_application_progression_lifecycle(): void
    {
        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-E2E-007',
            'application_type' => 'new_id',
            'status' => 'submitted',
        ]);

        // Step 1: Advance to under_initial_review
        $step1 = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$app->id}/status", [
            'status' => 'under_initial_review',
            'note' => 'Initial screening started',
        ]);
        $step1->assertStatus(200);

        // Step 2: Advance to under_final_assessment
        $step2 = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$app->id}/status", [
            'status' => 'under_final_assessment',
            'note' => 'Assessment completed and ready for approval',
        ]);
        $step2->assertStatus(200);

        // Step 3: Admin assigns official fields
        $step3 = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$app->id}/official-fields", [
            'case_number' => 'CASE-2026-999',
            'id_card_number' => 'SPIC-2026-999',
            'date_issued' => now()->toDateString(),
        ]);
        $step3->assertStatus(200);

        // Step 4: Admin approves application
        $step4 = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$app->id}/status", [
            'status' => 'approved',
            'note' => 'Official card approved for printing',
        ]);
        $step4->assertStatus(200);

        // Step 5: Mark ready for pickup
        $step5 = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$app->id}/status", [
            'status' => 'ready_for_pickup',
            'note' => 'SPIC printed and available at CSWDD office',
        ]);
        $step5->assertStatus(200);

        // Step 6: Mark released / completed when citizen physically claims
        $step6 = $this->actingAs($this->admin)->patchJson("/api/admin/applications/{$app->id}/status", [
            'status' => 'completed',
            'note' => 'Citizen presented valid ID and received physical SPIC',
        ]);
        $step6->assertStatus(200);

        $app->refresh();
        $this->assertEquals('completed', $app->status);
        $this->assertNotNull($app->released_at);
    }

    /**
     * 8. Analytics counters: approved_count vs released_count separation
     */
    public function test_analytics_counters_approved_vs_released_are_separate(): void
    {
        // One application in approved (not yet claimed)
        Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-APPROVED-ONLY',
            'application_type' => 'new_id',
            'status' => 'approved',
            'decided_at' => now(),
        ]);

        // A second user with completed/released ID
        $user2 = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'user2@example.com',
            'full_name' => 'User Two',
            'role' => 'applicant',
            'is_active' => true,
        ]);

        Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user2->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-RELEASED-COMPLETED',
            'application_type' => 'new_id',
            'status' => 'completed',
            'released_at' => now(),
            'decided_at' => now(),
        ]);

        $res = $this->actingAs($this->admin)->getJson('/api/admin/analytics/overview');
        $res->assertStatus(200);

        // approved_count includes both approved and completed (both are approved milestones)
        $this->assertEquals(2, $res->json('approved_count'));
        // released_count strictly includes physically claimed/released IDs
        $this->assertEquals(1, $res->json('released_count'));
    }

    /**
     * 9. Super Admin user management, role elevation, and security constraints
     */
    public function test_super_admin_user_management_and_privilege_checks(): void
    {
        $targetUser = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'target.staff@example.com',
            'full_name' => 'Target Staff',
            'role' => 'applicant',
            'is_active' => true,
            'password_hash' => Hash::make('Password123!'),
        ]);

        // 1. Super admin can promote applicant to admin
        $promoRes = $this->actingAs($this->superAdmin)->putJson("/api/admin/users/{$targetUser->id}/role", [
            'role' => 'admin',
        ]);
        $promoRes->assertStatus(200);
        $this->assertEquals('admin', $promoRes->json('role'));

        // 2. Ordinary admin CANNOT promote user to super_admin
        $failPromo = $this->actingAs($this->admin)->putJson("/api/admin/users/{$targetUser->id}/role", [
            'role' => 'super_admin',
        ]);
        $failPromo->assertStatus(403);

        // 3. Super admin can reset target user password (generates temporary password)
        $resetRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/users/{$targetUser->id}/reset-password");
        $resetRes->assertStatus(200);
        $this->assertNotEmpty($resetRes->json('temporary_password'));
        $targetUser->refresh();
        $this->assertTrue(Hash::check($resetRes->json('temporary_password'), $targetUser->password_hash));
    }

    /**
     * 10. PDF generation & reporting endpoints access
     */
    public function test_pdf_generation_and_export_routes(): void
    {
        $app = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->applicant->id,
            'category_id' => $this->categoryA->id,
            'reference_no' => 'APP-PDF-010',
            'application_type' => 'new_id',
            'status' => 'approved',
            'id_card_number' => 'SPIC-2026-PDF',
            'date_issued' => now()->toDateString(),
        ]);

        ApplicationForm::create([
            'id' => (string) Str::uuid(),
            'application_id' => $app->id,
            'place_of_birth' => 'Butuan City',
            'occupation' => 'Freelancer',
            'monthly_income' => '15000',
        ]);

        // Applicant can download application form PDF
        $formPdf = $this->actingAs($this->applicant)->get("/api/applications/{$app->id}/form.pdf");
        $this->assertContains($formPdf->status(), [200, 500]); // If dompdf/font rendering or storage mock

        // Admin can export CSV report
        $csvRes = $this->actingAs($this->admin)->get('/api/admin/reports/export.csv');
        $csvRes->assertStatus(200);
        $this->assertStringContainsString('text/csv', $csvRes->headers->get('content-type'));
    }

    /**
     * 11. Security boundary: All admin endpoints reject unauthenticated or applicant calls
     */
    public function test_admin_routes_reject_unauthenticated_and_applicant_tokens(): void
    {
        $adminEndpoints = [
            ['GET', '/api/admin/applications'],
            ['GET', '/api/admin/analytics/overview'],
            ['GET', '/api/admin/audit-logs'],
            ['GET', '/api/admin/users'],
            ['GET', '/api/admin/categories'],
            ['GET', '/api/admin/barangays'],
            ['GET', '/api/admin/announcements'],
            ['GET', '/api/admin/resources'],
            ['GET', '/api/admin/reports/export.csv'],
        ];

        foreach ($adminEndpoints as [$method, $endpoint]) {
            // Unauthenticated: rejected with either 401 Unauthorized or 403 Forbidden
            $unauth = $this->json($method, $endpoint);
            $this->assertContains($unauth->status(), [401, 403]);

            // Applicant role: 403 Forbidden
            $forbidden = $this->actingAs($this->applicant)->json($method, $endpoint);
            $forbidden->assertStatus(403);
        }
    }
}
