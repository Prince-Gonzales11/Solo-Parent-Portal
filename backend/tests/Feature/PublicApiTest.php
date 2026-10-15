<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\Category;
use App\Models\DocumentaryRequirement;
use App\Models\Barangay;
use App\Models\Announcement;
use App\Models\ResourceItem;
use Illuminate\Support\Str;

class PublicApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed some sample categories, barangays, announcements, resources
        $cat = Category::create([
            'id' => (string) Str::uuid(),
            'code' => 'CAT_A',
            'name' => 'Category A - Death of Spouse',
            'description' => 'Solo parent due to death of spouse',
            'is_active' => true,
            'display_order' => 1,
        ]);

        DocumentaryRequirement::create([
            'id' => (string) Str::uuid(),
            'category_id' => $cat->id,
            'name' => 'Death Certificate of Spouse',
            'description' => 'PSA Copy of Death Certificate',
            'is_required' => true,
        ]);

        Barangay::create([
            'id' => (string) Str::uuid(),
            'name' => 'Barangay Libertad',
            'code' => 'LIBERTAD',
        ]);

        Announcement::create([
            'id' => (string) Str::uuid(),
            'title' => 'Solo Parent General Assembly',
            'body' => 'Annual assembly at Butuan City Hall.',
            'is_published' => true,
            'published_at' => now(),
        ]);

        ResourceItem::create([
            'id' => (string) Str::uuid(),
            'name' => 'CSWDD Citizen Charter',
            'description' => 'Guidelines on social welfare benefits',
            'url' => 'https://example.com/charter.pdf',
            'file_type' => 'pdf',
            'is_active' => true,
            'display_order' => 1,
        ]);
    }

    public function test_landing_data_returns_expected_structure(): void
    {
        $response = $this->getJson('/api/public/landing-data');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'stats',
            'announcements',
            'resources',
            'faqs',
            'benefits',
            'categories',
        ]);
    }

    public function test_categories_endpoint(): void
    {
        $response = $this->getJson('/api/public/categories');
        $response->assertStatus(200);
        $this->assertNotEmpty($response->json());
        $codes = collect($response->json())->pluck('code')->toArray();
        $this->assertContains('CAT_A', $codes);
    }

    public function test_barangays_endpoint(): void
    {
        $response = $this->getJson('/api/public/barangays');
        $response->assertStatus(200);
        $this->assertNotEmpty($response->json());
        $names = collect($response->json())->pluck('name')->toArray();
        $this->assertContains('Barangay Libertad', $names);
    }

    public function test_faqs_benefits_eligibility_endpoints(): void
    {
        $this->getJson('/api/public/faqs')->assertStatus(200)->assertJsonIsArray();
        $this->getJson('/api/public/benefits')->assertStatus(200)->assertJsonIsArray();
        $this->getJson('/api/public/eligibility')->assertStatus(200)->assertJsonIsArray();
    }

    public function test_announcements_and_resources_endpoints(): void
    {
        $this->getJson('/api/public/announcements')->assertStatus(200);
        $this->getJson('/api/public/resources')->assertStatus(200);
    }
}
