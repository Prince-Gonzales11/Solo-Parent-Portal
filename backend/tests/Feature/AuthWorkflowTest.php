<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\EmailVerification;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_start_with_email_creates_pending_user_and_otp(): void
    {
        $payload = [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria.santos@example.com',
        ];

        $res = $this->postJson('/api/auth/register/start', $payload);
        $res->assertStatus(200);
        $res->assertJson([
            'requires_verification' => true,
            'is_mobile' => false,
        ]);

        $userId = $res->json('user_id');
        $this->assertDatabaseHas('users', ['id' => $userId, 'email' => 'maria.santos@example.com', 'is_active' => false]);
        $this->assertDatabaseHas('email_verifications', ['user_id' => $userId]);
    }

    public function test_register_start_with_philippine_mobile(): void
    {
        $payload = [
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'phone_number' => '09171234567',
        ];

        $res = $this->postJson('/api/auth/register/start', $payload);
        $res->assertStatus(200);
        $res->assertJson([
            'requires_verification' => false,
            'is_mobile' => true,
        ]);
    }

    public function test_verify_email_with_valid_and_invalid_codes(): void
    {
        // 1. Start registration
        $startRes = $this->postJson('/api/auth/register/start', [
            'first_name' => 'Elena',
            'last_name' => 'Reyes',
            'email' => 'elena@example.com',
        ]);
        $userId = $startRes->json('user_id');

        // Invalid code test
        $badRes = $this->postJson('/api/auth/email/verify', [
            'user_id' => $userId,
            'code' => '000000',
        ]);
        $badRes->assertStatus(400);

        // Retrieve valid OTP from database and set test code
        $verification = EmailVerification::where('user_id', $userId)->first();
        $this->assertNotNull($verification);

        $verification->update(['code_hash' => Hash::make('123456')]);

        $goodRes = $this->postJson('/api/auth/email/verify', [
            'user_id' => $userId,
            'code' => '123456',
        ]);
        $goodRes->assertStatus(200);

        $user = User::find($userId);
        $this->assertNotNull($user->email_verified_at);
    }

    public function test_register_complete_activates_account_and_issues_token(): void
    {
        $user = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'verified@example.com',
            'full_name' => 'Verified Applicant',
            'email_verified_at' => now(),
            'is_active' => false,
            'role' => 'applicant',
        ]);

        $res = $this->postJson('/api/auth/register', [
            'user_id' => $user->id,
            'password' => 'Password123!',
            'dpa_consent' => true,
        ]);

        $res->assertStatus(201);
        $res->assertJsonStructure(['access_token', 'token_type', 'user']);

        $user->refresh();
        $this->assertTrue($user->is_active);
    }

    public function test_login_success_and_invalid_credentials(): void
    {
        $user = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'active@example.com',
            'password_hash' => Hash::make('Secret123!'),
            'full_name' => 'Active User',
            'email_verified_at' => now(),
            'is_active' => true,
            'role' => 'applicant',
        ]);

        // Wrong password
        $fail = $this->postJson('/api/auth/login', [
            'email' => 'active@example.com',
            'password' => 'WrongPassword',
        ]);
        $fail->assertStatus(422);

        // Correct credentials
        $success = $this->postJson('/api/auth/login', [
            'email' => 'active@example.com',
            'password' => 'Secret123!',
        ]);
        $success->assertStatus(200);
        $success->assertJsonStructure(['access_token', 'user']);
    }

    public function test_auth_me_and_logout(): void
    {
        $user = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'session@example.com',
            'password_hash' => Hash::make('Secret123!'),
            'full_name' => 'Session User',
            'email_verified_at' => now(),
            'is_active' => true,
            'role' => 'applicant',
        ]);

        $token = $user->createToken('test_token')->plainTextToken;

        // /auth/me
        $meRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/me');
        $meRes->assertStatus(200);
        $this->assertEquals('session@example.com', $meRes->json('data.email'));

        // /auth/logout
        $logoutRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/auth/logout');
        $logoutRes->assertStatus(200);
    }

    public function test_captcha_generation_and_validation(): void
    {
        $captchaRes = $this->getJson('/api/auth/captcha');
        $captchaRes->assertStatus(200);
        $captchaRes->assertJsonStructure(['captcha_id', 'question']);

        $captchaId = $captchaRes->json('captcha_id');
        $question = $captchaRes->json('question');
        $this->assertNotEmpty($captchaId);
        $this->assertStringContainsString('=', $question);

        // Incorrect captcha answer fails
        $invalidRes = $this->postJson('/api/auth/register/start', [
            'first_name' => 'Maria',
            'last_name' => 'Test',
            'email' => 'captcha.test@example.com',
            'captcha_id' => $captchaId,
            'captcha_answer' => '999999',
        ]);
        $invalidRes->assertStatus(422);
        $invalidRes->assertJsonValidationErrors(['captcha']);
    }

    public function test_registration_rejects_honeypot_bot_submissions(): void
    {
        $res = $this->postJson('/api/auth/register/start', [
            'first_name' => 'Bot',
            'last_name' => 'User',
            'email' => 'bot@example.com',
            'website' => 'https://spam-bot.xyz',
        ]);
        $res->assertStatus(422);
        $res->assertJsonFragment(['message' => 'Spam bot submission detected.']);
    }

    public function test_registration_rate_limiting_enforcement(): void
    {
        \Illuminate\Support\Facades\RateLimiter::clear('reg_start_ip:127.0.0.1');

        // Rapid attempts hit rate limit
        for ($i = 0; $i < 15; $i++) {
            $this->postJson('/api/auth/register/start', [
                'first_name' => 'User',
                'last_name' => "Num{$i}",
                'email' => "user{$i}@example.com",
            ]);
        }

        $blockedRes = $this->postJson('/api/auth/register/start', [
            'first_name' => 'Blocked',
            'last_name' => 'User',
            'email' => 'blocked@example.com',
        ]);
        $blockedRes->assertStatus(429);
        $this->assertTrue($blockedRes->headers->has('Retry-After') || isset($blockedRes->json()['retry_after']));
    }

    public function test_prune_unverified_accounts_command(): void
    {
        // 1. Create an old unverified account (3 days ago)
        $oldUnverified = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'old.unverified@example.com',
            'full_name' => 'Old Unverified',
            'email_verified_at' => null,
            'is_active' => false,
            'role' => 'applicant',
        ]);
        \Illuminate\Support\Facades\DB::table('users')->where('id', $oldUnverified->id)->update([
            'created_at' => now()->subDays(3)
        ]);

        // 2. Create a recent unverified account (1 hour ago)
        $recentUnverified = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'recent.unverified@example.com',
            'full_name' => 'Recent Unverified',
            'email_verified_at' => null,
            'is_active' => false,
            'role' => 'applicant',
            'created_at' => now()->subHour(),
        ]);

        // 3. Create a verified active account (5 days ago)
        $verifiedUser = User::create([
            'id' => (string) Str::uuid(),
            'email' => 'legit.solo.parent@example.com',
            'full_name' => 'Legit Solo Parent',
            'email_verified_at' => now()->subDays(5),
            'is_active' => true,
            'role' => 'applicant',
            'created_at' => now()->subDays(5),
        ]);

        // Run dry-run first
        $this->artisan('auth:prune-unverified --dry-run')
            ->assertExitCode(0);

        $this->assertDatabaseHas('users', ['id' => $oldUnverified->id]);

        // Run actual prune
        $this->artisan('auth:prune-unverified --hours=48')
            ->assertExitCode(0);

        // Old unverified account should be pruned
        $this->assertDatabaseMissing('users', ['id' => $oldUnverified->id]);

        // Recent unverified account must be preserved
        $this->assertDatabaseHas('users', ['id' => $recentUnverified->id]);

        // Verified legit solo parent must be preserved
        $this->assertDatabaseHas('users', ['id' => $verifiedUser->id]);
    }
}

