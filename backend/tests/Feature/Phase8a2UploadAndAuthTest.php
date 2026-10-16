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

class Phase8a2UploadAndAuthTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Category $category;
    protected DocumentaryRequirement $req;
    protected Application $application;

    protected function setUp(): void
    {
        parent::setUp();

        $mockStorage = Mockery::mock(SupabaseStorageService::class);
        $mockStorage->shouldReceive('uploadTemporary')->andReturn(['path' => 'temp/path', 'bucket' => 'temp-bucket']);
        $mockStorage->shouldReceive('deleteTemporary')->andReturn(true);
        $mockStorage->shouldReceive('getTemporarySignedUrl')->andReturn('https://supabase.example.com/signed-url');
        $this->app->instance(SupabaseStorageService::class, $mockStorage);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'applicant_phase8a2@example.com',
            'full_name' => 'Phase8A2 Applicant',
            'role' => 'applicant',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'A1',
            'name' => 'Single Parent',
            'description' => 'Solo parent category',
            'is_active' => true,
        ]);

        $this->req = DocumentaryRequirement::create([
            'id' => (string) Str::uuid(),
            'category_id' => $this->category->id,
            'name' => 'Barangay Certificate',
            'is_required' => true,
            'max_size_mb' => 20,
            'sort_order' => 0,
        ]);

        $this->application = Application::create([
            'id' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'category_id' => $this->category->id,
            'status' => 'draft',
            'application_type' => 'new_id',
            'reference_no' => 'SP-2026-TEST8A2',
        ]);
    }

    /* ═══════════════════════════════════════════════════════════════════
       TASK 4: API AUTHENTICATION TESTS (401 JSON CONSISTENCY)
       ═══════════════════════════════════════════════════════════════════ */

    public function test_unauthenticated_api_request_without_accept_header_returns_401_json(): void
    {
        // Missing Accept header (default curl */*)
        $response = $this->get('/api/auth/me', ['Accept' => '*/*']);
        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_unauthenticated_api_request_with_json_accept_header_returns_401_json(): void
    {
        $response = $this->getJson('/api/auth/me');
        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_unauthenticated_api_request_with_html_accept_header_returns_401_json(): void
    {
        // Accept header set to text/html (e.g. browser direct navigation)
        $response = $this->get('/api/auth/me', ['Accept' => 'text/html,application/xhtml+xml']);
        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_unauthenticated_head_api_request_returns_401(): void
    {
        $response = $this->call('HEAD', '/api/auth/me');
        $response->assertStatus(401);
    }

    public function test_unauthenticated_preview_request_returns_401_json(): void
    {
        $fakeDocId = (string) Str::uuid();
        $response = $this->get("/api/documents/{$fakeDocId}/preview", ['Accept' => '*/*']);
        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_invalid_bearer_token_returns_401_json(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer invalid_token_12345')
            ->get('/api/auth/me', ['Accept' => '*/*']);
        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_authenticated_api_request_succeeds(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')->getJson('/api/auth/me');
        $response->assertStatus(200);
        $response->assertJsonFragment(['id' => $this->user->id, 'email' => $this->user->email]);
    }

    /* ═══════════════════════════════════════════════════════════════════
       TASKS 1, 2, 3: BATCH UPLOAD LIMITS & SINGLE TRANSMISSION TESTS
       ═══════════════════════════════════════════════════════════════════ */

    public function test_upload_rejects_more_than_10_files_with_422(): void
    {
        // Attempt to upload 11 files (exceeding MAX_FILES_PER_BATCH = 10)
        $files = [];
        for ($i = 1; $i <= 11; $i++) {
            $files[] = UploadedFile::fake()->createWithContent("doc_{$i}.pdf", "%PDF-1.4 test content {$i}");
        }

        $response = $this->actingAs($this->user, 'sanctum')->post('/api/documents/upload', [
            'files'            => $files,
            'doc_type'         => 'req_A1_0',
            'requirement_id'   => $this->req->id,
            'requirement_name' => $this->req->name,
            'application_id'   => $this->application->id,
        ]);

        $response->assertStatus(422);
        // Ensure no documents were saved
        $this->assertEquals(0, Document::where('application_id', $this->application->id)->count());
    }

    public function test_upload_rejects_batch_exceeding_28mb_with_422(): void
    {
        // 2 files of 15MB each = 30MB total (each file <= 20MB, but batch > 28MB)
        // Note: UploadedFile::fake()->create() allows specifying size in KB
        $file1 = UploadedFile::fake()->createWithContent('big1.pdf', "%PDF-1.4 " . str_repeat('A', 100));
        // Use reflection or custom size override for size testing without generating 15MB in RAM
        $file1 = new UploadedFile(
            $file1->getRealPath(),
            'big1.pdf',
            'application/pdf',
            null,
            true
        );

        // We can test the validation rule directly by creating files whose sum exceeds 28MB
        $files = [
            UploadedFile::fake()->create('file1.pdf', 15 * 1024, 'application/pdf'),
            UploadedFile::fake()->create('file2.pdf', 14 * 1024, 'application/pdf'),
        ];

        $response = $this->actingAs($this->user, 'sanctum')->post('/api/documents/upload', [
            'files'            => $files,
            'doc_type'         => 'req_A1_0',
            'requirement_id'   => $this->req->id,
            'requirement_name' => $this->req->name,
            'application_id'   => $this->application->id,
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('exceeds the maximum allowed batch size of 28 MB', $response->json('detail'));
        $this->assertEquals(0, Document::where('application_id', $this->application->id)->count());
    }

    public function test_upload_accepts_valid_batch_up_to_10_files(): void
    {
        $files = [];
        for ($i = 1; $i <= 5; $i++) {
            $files[] = UploadedFile::fake()->createWithContent("batch_doc_{$i}.pdf", "%PDF-1.4 genuine content {$i}");
        }

        $response = $this->actingAs($this->user, 'sanctum')->postJson('/api/documents/upload', [
            'files'            => $files,
            'doc_type'         => 'req_A1_0',
            'requirement_id'   => $this->req->id,
            'requirement_name' => $this->req->name,
            'application_id'   => $this->application->id,
        ]);

        $response->assertStatus(201);
        $response->assertJson(['count' => 5]);
        $this->assertEquals(5, Document::where('application_id', $this->application->id)->count());
    }

    public function test_upload_accepts_legacy_single_file_payload(): void
    {
        $file = UploadedFile::fake()->createWithContent('legacy_single.pdf', "%PDF-1.4 legacy content");

        $response = $this->actingAs($this->user, 'sanctum')->postJson('/api/documents/upload', [
            'file'             => $file,
            'doc_type'         => 'req_A1_0',
            'requirement_id'   => $this->req->id,
            'requirement_name' => $this->req->name,
            'application_id'   => $this->application->id,
        ]);

        $response->assertStatus(201);
        $response->assertJson(['count' => 1]);
        $this->assertEquals(1, Document::where('application_id', $this->application->id)->count());
    }

    public function test_single_file_in_files_array_is_processed_exactly_once(): void
    {
        $file = UploadedFile::fake()->createWithContent('single_in_array.pdf', "%PDF-1.4 array content");

        $response = $this->actingAs($this->user, 'sanctum')->postJson('/api/documents/upload', [
            'files'            => [$file],
            'doc_type'         => 'req_A1_0',
            'requirement_id'   => $this->req->id,
            'requirement_name' => $this->req->name,
            'application_id'   => $this->application->id,
        ]);

        $response->assertStatus(201);
        $response->assertJson(['count' => 1]);
        $this->assertEquals(1, Document::where('application_id', $this->application->id)->count());
    }
}
