<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Category;
use App\Models\Document;
use App\Models\DocumentaryRequirement;
use App\Models\User;
use App\Services\SupabaseStorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

class DocumentMultiUploadTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected User $admin;
    protected Category $category;
    protected DocumentaryRequirement $req1;
    protected DocumentaryRequirement $req2;
    protected Application $application;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock Supabase storage calls so no external network requests are made
        $mockStorage = Mockery::mock(SupabaseStorageService::class);
        $mockStorage->shouldReceive('uploadTemporary')->andReturn(['path' => 'temp/path', 'bucket' => 'temp-bucket']);
        $mockStorage->shouldReceive('deleteTemporary')->andReturn(true);
        $mockStorage->shouldReceive('getTemporarySignedUrl')->andReturn('https://supabase.example.com/signed-url');
        $this->app->instance(SupabaseStorageService::class, $mockStorage);

        // Create applicant user
        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'applicant@example.com',
            'full_name' => 'Test Applicant',
            'role' => 'user',
            'is_active' => true,
        ]);

        // Create admin user
        $this->admin = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'admin@example.com',
            'full_name' => 'Admin Officer',
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Create category and requirements
        $this->category = Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'CAT_A',
            'name' => 'Solo Parent Category A',
            'is_active' => true,
        ]);

        $this->req1 = DocumentaryRequirement::create([
            'id' => (string) Str::uuid(),
            'category_id' => $this->category->id,
            'name' => 'Birth Certificate',
            'description' => 'PSA Birth Certificate of child',
            'is_required' => true,
        ]);

        $this->req2 = DocumentaryRequirement::create([
            'id' => (string) Str::uuid(),
            'category_id' => $this->category->id,
            'name' => 'Proof of Income',
            'description' => 'ITR or Certificate of Indigency',
            'is_required' => true,
        ]);

        // Create application
        $this->application = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'category_id' => $this->category->id,
            'reference_no' => 'APP-2026-0001',
            'status' => 'draft',
            'application_type' => 'new_id',
        ]);
    }

    protected function makeImage(string $name, int $w = 100, int $h = 100): UploadedFile
    {
        return UploadedFile::fake()->image($name, $w, $h);
    }

    protected function makePdf(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
    }

    public function test_single_file_upload_backward_compatibility(): void
    {
        $file = $this->makeImage('birth_cert.jpg');

        $response = $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'file' => $file,
            'doc_type' => 'req_CAT_A_0',
            'requirement_id' => $this->req1->id,
            'requirement_name' => 'Birth Certificate',
            'application_id' => $this->application->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure(['id', 'original_filename', 'documents']);
        $this->assertEquals(1, count($response->json('documents')));
        $this->assertDatabaseHas('application_documents', [
            'application_id' => $this->application->id,
            'requirement_id' => $this->req1->id,
            'original_filename' => 'birth_cert.jpg',
        ]);
    }

    public function test_multiple_files_uploaded_simultaneously_under_same_requirement(): void
    {
        $files = [
            $this->makeImage('Birth_Certificate_Page_1.jpg', 120, 120),
            $this->makeImage('Birth_Certificate_Page_2.jpg', 130, 130),
            $this->makeImage('Birth_Certificate_Page_3.jpg', 140, 140),
        ];

        $response = $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'files' => $files,
            'doc_type' => 'req_CAT_A_0',
            'requirement_id' => $this->req1->id,
            'requirement_name' => 'Birth Certificate',
            'application_id' => $this->application->id,
        ]);

        $response->assertStatus(201);
        $docs = $response->json('documents');
        $this->assertCount(3, $docs);

        // Verify all 3 attachments exist in database under the exact same requirement
        $dbDocs = Document::where('application_id', $this->application->id)
            ->where('requirement_id', $this->req1->id)
            ->get();
        $this->assertCount(3, $dbDocs);
        $filenames = $dbDocs->pluck('original_filename')->toArray();
        $this->assertContains('Birth_Certificate_Page_1.jpg', $filenames);
        $this->assertContains('Birth_Certificate_Page_2.jpg', $filenames);
        $this->assertContains('Birth_Certificate_Page_3.jpg', $filenames);
    }

    public function test_adding_more_files_later_does_not_replace_previous_files(): void
    {
        // First batch: 2 files
        $file1 = $this->makeImage('Birth_Cert_Part1.jpg', 100, 100);
        $file2 = $this->makeImage('Birth_Cert_Part2.jpg', 110, 110);

        $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'files' => [$file1, $file2],
            'doc_type' => 'req_CAT_A_0',
            'requirement_id' => $this->req1->id,
            'requirement_name' => 'Birth Certificate',
            'application_id' => $this->application->id,
        ])->assertStatus(201);

        $this->assertEquals(2, Document::where('application_id', $this->application->id)->where('requirement_id', $this->req1->id)->count());

        // Second batch: 1 additional file
        $file3 = $this->makeImage('Birth_Cert_Part3.jpg', 120, 120);

        $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'files' => [$file3],
            'doc_type' => 'req_CAT_A_0',
            'requirement_id' => $this->req1->id,
            'requirement_name' => 'Birth Certificate',
            'application_id' => $this->application->id,
        ])->assertStatus(201);

        // All 3 attachments must persist under the same requirement
        $this->assertEquals(3, Document::where('application_id', $this->application->id)->where('requirement_id', $this->req1->id)->count());
    }

    public function test_deleting_one_attachment_retains_other_attachments(): void
    {
        $file1 = $this->makeImage('Page1.jpg', 100, 100);
        $file2 = $this->makeImage('Page2.jpg', 110, 110);
        $file3 = $this->makeImage('Page3.jpg', 120, 120);

        $res = $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'files' => [$file1, $file2, $file3],
            'doc_type' => 'req_CAT_A_0',
            'requirement_id' => $this->req1->id,
            'application_id' => $this->application->id,
        ])->assertStatus(201);

        $uploadedDocs = $res->json('documents');
        $docToDelete = $uploadedDocs[1]; // Page2

        $delRes = $this->actingAs($this->user)->deleteJson("/api/documents/{$docToDelete['id']}");
        $delRes->assertStatus(200);

        // Check that Page 2 is deleted, while Page 1 and Page 3 remain
        $this->assertDatabaseMissing('application_documents', ['id' => $docToDelete['id']]);
        $remaining = Document::where('application_id', $this->application->id)
            ->where('requirement_id', $this->req1->id)
            ->get();
        $this->assertCount(2, $remaining);
        $this->assertContains('Page1.jpg', $remaining->pluck('original_filename')->toArray());
        $this->assertContains('Page3.jpg', $remaining->pluck('original_filename')->toArray());
    }

    public function test_multiple_requirement_categories_remain_isolated(): void
    {
        // 2 files under Birth Certificate
        $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'files' => [
                $this->makeImage('Birth_1.jpg', 100, 100),
                $this->makeImage('Birth_2.jpg', 110, 110),
            ],
            'doc_type' => 'req_CAT_A_0',
            'requirement_id' => $this->req1->id,
            'application_id' => $this->application->id,
        ])->assertStatus(201);

        // 1 PDF file under Proof of Income
        $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'files' => [
                $this->makePdf('ITR_2025.pdf'),
            ],
            'doc_type' => 'req_CAT_A_1',
            'requirement_id' => $this->req2->id,
            'application_id' => $this->application->id,
        ])->assertStatus(201);

        $this->assertEquals(2, Document::where('requirement_id', $this->req1->id)->count());
        $this->assertEquals(1, Document::where('requirement_id', $this->req2->id)->count());
    }

    public function test_duplicate_file_rejection_under_same_requirement(): void
    {
        $file = $this->makeImage('ExactSameName.jpg', 150, 150);

        // First upload succeeds
        $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'files' => [$file],
            'doc_type' => 'req_CAT_A_0',
            'requirement_id' => $this->req1->id,
            'application_id' => $this->application->id,
        ])->assertStatus(201);

        // Duplicate upload (same name + same size) must return 409
        $dupFile = $this->makeImage('ExactSameName.jpg', 150, 150);
        $res = $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'files' => [$dupFile],
            'doc_type' => 'req_CAT_A_0',
            'requirement_id' => $this->req1->id,
            'application_id' => $this->application->id,
        ]);

        $res->assertStatus(409);
    }

    public function test_admin_can_retrieve_all_attachments_per_requirement(): void
    {
        $file1 = $this->makeImage('Birth_P1.jpg', 100, 100);
        $file2 = $this->makeImage('Birth_P2.jpg', 110, 110);

        $this->actingAs($this->user)->postJson('/api/documents/upload', [
            'files' => [$file1, $file2],
            'doc_type' => 'req_CAT_A_0',
            'requirement_id' => $this->req1->id,
            'application_id' => $this->application->id,
        ])->assertStatus(201);

        // Admin queries application documents
        $adminRes = $this->actingAs($this->admin)->getJson("/api/admin/applications/{$this->application->id}/documents");
        $adminRes->assertStatus(200);

        $reqList = $adminRes->json('requirements');
        $birthCertReq = collect($reqList)->firstWhere('id', $this->req1->id);

        $this->assertNotNull($birthCertReq);
        $this->assertEquals(2, $birthCertReq['attachments_count']);
        $this->assertCount(2, $birthCertReq['documents']);
    }

    public function test_security_applicant_cannot_delete_another_users_document(): void
    {
        // Another applicant
        $otherUser = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'other@example.com',
            'full_name' => 'Other Applicant',
            'role' => 'user',
            'is_active' => true,
        ]);

        $otherApp = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $otherUser->id,
            'category_id' => $this->category->id,
            'reference_no' => 'APP-OTHER-' . Str::random(5),
            'status' => 'draft',
            'application_type' => 'new_id',
        ]);

        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'user_id' => $otherUser->id,
            'application_id' => $otherApp->id,
            'requirement_id' => $this->req1->id,
            'original_filename' => 'other_doc.jpg',
            'storage_path' => 'temp/other.jpg',
            'mime_type' => 'image/jpeg',
            'file_size' => 1024,
            'review_status' => 'pending',
        ]);

        // Attempt deletion by original user
        $delRes = $this->actingAs($this->user)->deleteJson("/api/documents/{$doc->id}");
        $delRes->assertStatus(403);
    }
}
