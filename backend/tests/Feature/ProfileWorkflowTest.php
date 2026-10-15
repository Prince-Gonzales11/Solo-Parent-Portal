<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\ApplicantProfile;
use App\Models\Barangay;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ProfileWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Barangay $barangay;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'profile.applicant@example.com',
            'password_hash' => Hash::make('CurrentSecret123!'),
            'full_name' => 'Profile Tester',
            'email_verified_at' => now(),
            'is_active' => true,
            'role' => 'applicant',
            'auth_provider' => 'local',
        ]);

        $this->barangay = Barangay::create([
            'id' => (string) Str::uuid(),
            'name' => 'Barangay Baan',
            'code' => 'BAAN',
        ]);
    }

    public function test_get_profile_auto_initializes_empty_profile(): void
    {
        $res = $this->actingAs($this->user)->getJson('/api/profile');
        $res->assertStatus(200);
        $res->assertJsonStructure(['data' => ['email', 'is_profile_complete']]);
        $this->assertDatabaseHas('applicant_profiles', ['user_id' => $this->user->id]);
    }

    public function test_upsert_profile_updates_demographics_and_barangay(): void
    {
        $payload = [
            'first_name' => 'Juan',
            'last_name' => 'Luna',
            'sex' => 'Male',
            'birth_date' => '1990-05-15',
            'civil_status' => 'Single',
            'contact_number' => '09123456789',
            'barangay' => 'Barangay Baan',
            'barangay_id' => $this->barangay->id,
            'monthly_income' => '15000',
            'philsys_card_number' => '1234-5678-9012',
        ];

        $res = $this->actingAs($this->user)->putJson('/api/profile', $payload);
        $res->assertStatus(200);

        $profile = ApplicantProfile::where('user_id', $this->user->id)->first();
        $this->assertNotNull($profile);
        $this->assertEquals('Juan', $profile->first_name);
        $this->assertEquals('Luna', $profile->last_name);
        $this->assertEquals('Barangay Baan', $profile->barangay);
    }

    public function test_initial_profile_status_and_completion_check(): void
    {
        $statusRes = $this->actingAs($this->user)->getJson('/api/profile/initial-status');
        $statusRes->assertStatus(200);
        $statusRes->assertJsonStructure(['is_initial_complete']);

        $compRes = $this->actingAs($this->user)->getJson('/api/profile/completion');
        $compRes->assertStatus(200);
        $compRes->assertJsonStructure(['is_complete', 'percentage']);
    }

    public function test_change_password_with_valid_and_invalid_current_password(): void
    {
        // 1. Wrong current password
        $failRes = $this->actingAs($this->user)->putJson('/api/profile/password', [
            'current_password' => 'WrongPassword!',
            'new_password' => 'NewSecretPassword123!',
            'new_password_confirmation' => 'NewSecretPassword123!',
        ]);
        $failRes->assertStatus(422);

        // 2. Correct current password
        $okRes = $this->actingAs($this->user)->putJson('/api/profile/password', [
            'current_password' => 'CurrentSecret123!',
            'new_password' => 'NewSecretPassword123!',
            'new_password_confirmation' => 'NewSecretPassword123!',
        ]);
        $okRes->assertStatus(200);

        // Verify password updated in DB
        $this->user->refresh();
        $this->assertTrue(Hash::check('NewSecretPassword123!', $this->user->password_hash));
    }

    public function test_upsert_profile_does_not_auto_create_application(): void
    {
        $this->assertEquals(0, \App\Models\Application::where('user_id', $this->user->id)->count());

        $payload = [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'sex' => 'Female',
            'birth_date' => '1995-02-14',
            'contact_number' => '09191234567',
            'barangay' => 'Barangay Baan',
            'barangay_id' => $this->barangay->id,
            'city_municipality' => 'Butuan City',
        ];

        $res = $this->actingAs($this->user)->putJson('/api/profile', $payload);
        $res->assertStatus(200);

        // Crucial requirement: No application should be auto-created
        $this->assertEquals(0, \App\Models\Application::where('user_id', $this->user->id)->count());
    }
}
