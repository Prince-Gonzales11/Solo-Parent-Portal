<?php

namespace App\Http\Controllers;

use Illuminate\Support\Str;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Mail\VerificationCodeMail;
use App\Models\EmailVerification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Verification code expiration in minutes.
     */
    private const CODE_EXPIRY_MINUTES = 10;

    /**
     * Resend cooldown in seconds.
     */
    private const RESEND_COOLDOWN_SECONDS = 60;

    /**
     * Step 1: Start registration by creating a pending user and sending verification code (for email)
     * or skipping straight to password creation (for Philippine mobile number).
     */
    public function registerStart(Request $request)
    {
        // 1. Fine-grained rate limiting (Prevents 100-account flooding while allowing legitimate traffic)
        $ipThrottleKey = 'reg_start_ip:' . $request->ip();
        if (RateLimiter::tooManyAttempts($ipThrottleKey, 15)) {
            $retryAfter = RateLimiter::availableIn($ipThrottleKey);
            return response()->json([
                'message' => "Too many registration attempts from this network. Please wait {$retryAfter} seconds.",
                'retry_after' => $retryAfter,
            ], 429);
        }
        RateLimiter::hit($ipThrottleKey, 600);

        $rawIdentifier = $request->input('email') ?? $request->input('identifier') ?? $request->input('phone_number');
        $firstName = trim((string) $request->input('first_name', ''));
        $middleName = trim((string) $request->input('middle_name', ''));
        $lastName = trim((string) $request->input('last_name', ''));

        $fullName = trim((string) $request->input('full_name', ''));
        if (empty($fullName) && (!empty($firstName) || !empty($lastName))) {
            $fullName = trim(preg_replace('/\s+/', ' ', "{$firstName} {$middleName} {$lastName}"));
        }

        if (empty($fullName) || (empty($firstName) && empty($lastName) && strlen($fullName) < 2)) {
            return response()->json([
                'message' => 'First Name and Last Name are required.',
                'errors' => [
                    'first_name' => ['First name is required.'],
                    'last_name' => ['Last name is required.'],
                ]
            ], 422);
        }

        if (empty($rawIdentifier)) {
            return response()->json([
                'message' => 'Please enter a valid email address or mobile number.',
                'errors' => ['email' => ['Please enter a valid email address or mobile number.']]
            ], 422);
        }

        $trimmed = trim((string) $rawIdentifier);

        // Limit attempts per specific identifier
        $idThrottleKey = 'reg_start_id:' . Str::transliterate(Str::lower($trimmed));
        if (RateLimiter::tooManyAttempts($idThrottleKey, 5)) {
            $retryAfter = RateLimiter::availableIn($idThrottleKey);
            return response()->json([
                'message' => "Too many verification requests for this email or mobile number. Please wait {$retryAfter} seconds.",
                'retry_after' => $retryAfter,
            ], 429);
        }
        RateLimiter::hit($idThrottleKey, 600);

        // Case 1: Philippine Mobile Number
        if ($this->isPhilippineMobile($trimmed)) {
            $normalizedPhone = $this->normalizePhilippineMobile($trimmed);

            $user = User::where('phone_number', $normalizedPhone)->first();

            if ($user) {
                if ($user->is_active) {
                    return response()->json([
                        'message' => 'An account with this mobile number already exists. Please sign in instead.'
                    ], 409);
                }
                $user->update(['full_name' => $fullName]);
            } else {
                $user = User::create([
                    'phone_number' => $normalizedPhone,
                    'email' => null,
                    'full_name' => $fullName,
                    'password_hash' => Hash::make(Str::random(32)),
                    'role' => 'applicant',
                    'auth_provider' => 'local',
                    'is_active' => false,
                ]);
            }

            // Pre-populate ApplicantProfile with first_name, middle_name, last_name, and contact_number
            \App\Models\ApplicantProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name' => $firstName ?: null,
                    'middle_name' => $middleName ?: null,
                    'last_name' => $lastName ?: null,
                    'contact_number' => $normalizedPhone,
                ]
            );

            // Mobile flow: No SMS, No OTP, immediately allow proceeding to password creation
            return response()->json([
                'message' => 'Mobile number accepted.',
                'requires_verification' => false,
                'is_mobile' => true,
                'phone_number' => $normalizedPhone,
                'user_id' => $user->id,
            ], 200);
        }

        // Case 2: Email Address
        if (filter_var($trimmed, FILTER_VALIDATE_EMAIL)) {
            $email = strtolower($trimmed);

            $user = User::where('email', $email)->first();

            if ($user) {
                if ($user->is_active || $user->email_verified_at) {
                    return response()->json([
                        'message' => 'An account with this email address already exists. Please sign in instead.'
                    ], 409);
                }
                $user->update(['full_name' => $fullName]);
            } else {
                $user = User::create([
                    'email' => $email,
                    'phone_number' => null,
                    'full_name' => $fullName,
                    'password_hash' => Hash::make(Str::random(32)),
                    'role' => 'applicant',
                    'auth_provider' => 'local',
                    'is_active' => false,
                ]);
            }

            // Pre-populate ApplicantProfile with first_name, middle_name, last_name
            \App\Models\ApplicantProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name' => $firstName ?: null,
                    'middle_name' => $middleName ?: null,
                    'last_name' => $lastName ?: null,
                ]
            );

            // Generate and send verification code via email
            $code = $this->generateVerificationCode($user);
            $this->sendVerificationEmail($user, $code);

            return response()->json([
                'message' => 'Verification code sent to your email.',
                'requires_verification' => true,
                'is_mobile' => false,
                'email' => $this->maskEmail($user->email),
                'user_id' => $user->id,
            ], 200);
        }

        // Case 3: Invalid input
        return response()->json([
            'message' => 'Please enter a valid email address or mobile number.',
            'errors' => ['email' => ['Please enter a valid email address or mobile number.']]
        ], 422);
    }

    /**
     * Step 3: Complete registration by setting password and consent.
     */
    public function registerComplete(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
            'dpa_consent' => ['required', 'boolean', 'accepted'],
        ]);

        $user = User::findOrFail($validated['user_id']);

        if ($user->email && !$user->email_verified_at) {
            return response()->json([
                'message' => 'Email must be verified before completing registration.'
            ], 403);
        }

        if ($user->is_active) {
            return response()->json([
                'message' => 'Account is already active.'
            ], 400);
        }

        $user->update([
            'password_hash' => Hash::make($validated['password']),
            'dpa_consented_at' => now(),
            'dpa_consent_ip' => $request->ip(),
            'is_active' => true,
        ]);

        // Ensure user's profile has contact_number if registered via phone_number
        if ($user->phone_number) {
            $profile = \App\Models\ApplicantProfile::firstOrCreate(['user_id' => $user->id]);
            if (empty($profile->contact_number)) {
                $profile->update(['contact_number' => $user->phone_number]);
            }
        }

        $user->load('profile');

        // Issue token to log them in automatically
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Account created successfully.',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => new UserResource($user),
        ], 201);
    }

    /**
     * Login an existing user.
     */
    public function login(LoginRequest $request)
    {
        $validated = $request->validated();
        $raw = trim((string) $validated['email']);

        // Account + IP rate limit: 5 failed attempts per 60 seconds
        $throttleKey = 'login:' . Str::transliterate(Str::lower($raw) . '|' . $request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json([
                'message'     => "Too many login attempts. Please try again in {$seconds} seconds.",
                'retry_after' => $seconds,
            ], 429);
        }

        $userQuery = User::where('email', strtolower($raw))
            ->orWhere('phone_number', $raw);

        $cleanedPhone = preg_replace('/[\s\-]/', '', $raw);
        if ($cleanedPhone !== $raw) {
            $userQuery->orWhere('phone_number', $cleanedPhone);
        }

        if ($this->isPhilippineMobile($raw)) {
            $normalized = $this->normalizePhilippineMobile($raw);
            $userQuery->orWhere('phone_number', $normalized);

            // Also check alternate 09... and 639... formats
            if (str_starts_with($normalized, '+63')) {
                $userQuery->orWhere('phone_number', '0' . substr($normalized, 3));
                $userQuery->orWhere('phone_number', substr($normalized, 1));
            }
        }
        $user = $userQuery->first();

        if (!$user || !Hash::check($validated['password'], $user->password_hash)) {
            RateLimiter::hit($throttleKey, 60);
            throw ValidationException::withMessages([
                'email' => ['Invalid email, mobile number, or password.'],
            ]);
        }

        // Clear rate limiting counter upon successful authentication
        RateLimiter::clear($throttleKey);
        
        // Check if the user's email has been verified (only for accounts registered via email)
        if ($user->auth_provider === 'local' && $user->email && !$user->phone_number && !$user->email_verified_at) {
            return response()->json([
                'message' => 'Please verify your email address before signing in.',
                'email_not_verified' => true,
                'email' => $this->maskEmail($user->email),
                'user_id' => $user->id,
            ], 403);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Account is inactive.'],
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;
        $user->load('profile');

        return response()->json([
            'user' => new UserResource($user),
            'access_token' => $token,
            'token_type' => 'bearer'
        ]);
    }

    /**
     * Verify the email verification code.
     */
    public function verifyEmail(Request $request)
    {
        $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = User::findOrFail($request->user_id);

        // Don't allow re-verification
        if ($user->email_verified_at) {
            return response()->json([
                'message' => 'Email is already verified. You can sign in.',
                'already_verified' => true,
            ]);
        }

        // Rate limit verification attempts per user
        $rateLimitKey = 'verify:' . $user->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 10)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return response()->json([
                'message' => "Too many verification attempts. Please try again in {$seconds} seconds."
            ], 429);
        }
        RateLimiter::hit($rateLimitKey, 600); // 10 attempts per 10 minutes

        // Get the latest unused verification record
        $verification = EmailVerification::where('user_id', $user->id)
            ->whereNull('used_at')
            ->latest()
            ->first();

        if (!$verification) {
            return response()->json([
                'message' => 'No pending verification found. Please request a new code.',
                'no_pending' => true,
            ], 400);
        }

        // Check if expired
        if ($verification->isExpired()) {
            return response()->json([
                'message' => 'Verification code expired. Please request a new code.',
                'code_expired' => true,
            ], 400);
        }

        // Check if max attempts exceeded
        if ($verification->hasExceededAttempts()) {
            return response()->json([
                'message' => 'Maximum verification attempts exceeded. Please request a new code.',
                'max_attempts_exceeded' => true,
            ], 400);
        }

        // Increment attempt counter
        $verification->increment('attempts');

        // Check the code
        if (!$verification->verifyCode($request->code)) {
            $remaining = $verification->max_attempts - $verification->attempts;
            return response()->json([
                'message' => 'Invalid verification code. Please check your email and try again.',
                'invalid_code' => true,
                'attempts_remaining' => max(0, $remaining),
            ], 400);
        }

        // Code is valid — mark email as verified
        $verification->update(['used_at' => now()]);

        $user->update([
            'email_verified_at' => now(),
            // DO NOT set is_active = true here yet, wait for registerComplete
        ]);

        // Clear rate limiter
        RateLimiter::clear('verify:' . $user->id);

        return response()->json([
            'message' => 'Email verified successfully. You can now complete your registration.',
            'verified' => true,
        ]);
    }

    /**
     * Resend the verification code.
     */
    public function resendVerificationCode(Request $request)
    {
        $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
        ]);

        $user = User::findOrFail($request->user_id);

        // Don't resend if already verified
        if ($user->email_verified_at) {
            return response()->json([
                'message' => 'Email is already verified. You can sign in.',
                'already_verified' => true,
            ]);
        }

        // Resend cooldown
        $rateLimitKey = 'resend:' . $user->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 1)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return response()->json([
                'message' => "Please wait {$seconds} seconds before requesting a new code.",
                'cooldown_seconds' => $seconds,
            ], 429);
        }

        // Global resend rate limit (max 5 resends per hour per user)
        $globalKey = 'resend_global:' . $user->id;
        if (RateLimiter::tooManyAttempts($globalKey, 5)) {
            $seconds = RateLimiter::availableIn($globalKey);
            return response()->json([
                'message' => 'Too many resend requests. Please try again later.',
                'cooldown_seconds' => $seconds,
            ], 429);
        }

        // Invalidate all previous unused codes
        EmailVerification::where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        // Generate and send new code
        $code = $this->generateVerificationCode($user);
        $this->sendVerificationEmail($user, $code);

        // Set cooldowns
        RateLimiter::hit($rateLimitKey, self::RESEND_COOLDOWN_SECONDS);
        RateLimiter::hit($globalKey, 3600);

        return response()->json([
            'message' => 'A new verification code has been sent to your email.',
            'email' => $this->maskEmail($user->email),
            'cooldown_seconds' => self::RESEND_COOLDOWN_SECONDS,
        ]);
    }

    /**
     * Forgot Password Step 1: Send a reset verification code to the user's email.
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        $user = User::where('email', $request->email)->first();

        // Always return success to prevent email enumeration
        if (!$user || !$user->is_active || !$user->email_verified_at) {
            return response()->json([
                'message' => 'If an account with that email exists, a reset code has been sent.',
            ]);
        }

        // Google-only users cannot reset password
        if ($user->auth_provider === 'google' && !$user->password_hash) {
            return response()->json([
                'message' => 'If an account with that email exists, a reset code has been sent.',
            ]);
        }

        // Rate limit: max 3 reset requests per hour per email
        $rateLimitKey = 'forgot:' . $user->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 3)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return response()->json([
                'message' => "Too many reset requests. Please try again in " . ceil($seconds / 60) . " minute(s).",
            ], 429);
        }

        // Invalidate previous unused codes
        EmailVerification::where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        // Generate and send code
        $code = $this->generateVerificationCode($user);
        $this->sendVerificationEmail($user, $code);

        RateLimiter::hit($rateLimitKey, 3600);

        return response()->json([
            'message'   => 'If an account with that email exists, a reset code has been sent.',
            'user_id'   => $user->id,
            'email'     => $this->maskEmail($user->email),
            'code_sent' => true,
        ]);
    }

    /**
     * Forgot Password Step 2: Verify the code and set a new password.
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'user_id'  => ['required', 'uuid', 'exists:users,id'],
            'code'     => ['required', 'string', 'size:6'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
        ]);

        $user = User::findOrFail($request->user_id);

        // Rate limit verification attempts
        $rateLimitKey = 'reset_verify:' . $user->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 10)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return response()->json([
                'message' => "Too many attempts. Please try again in {$seconds} seconds.",
            ], 429);
        }
        RateLimiter::hit($rateLimitKey, 600);

        // Find the latest unused verification record
        $verification = EmailVerification::where('user_id', $user->id)
            ->whereNull('used_at')
            ->latest()
            ->first();

        if (!$verification) {
            return response()->json([
                'message' => 'No pending reset code found. Please request a new one.',
            ], 400);
        }

        // Check expiry
        if (now()->greaterThan($verification->expires_at)) {
            $verification->update(['used_at' => now()]);
            return response()->json([
                'message' => 'Reset code has expired. Please request a new one.',
                'expired' => true,
            ], 400);
        }

        // Verify the code
        if (!Hash::check($request->code, $verification->code_hash)) {
            $verification->increment('attempts');
            if ($verification->attempts >= $verification->max_attempts) {
                $verification->update(['used_at' => now()]);
                return response()->json([
                    'message' => 'Too many incorrect attempts. Please request a new code.',
                ], 400);
            }
            return response()->json([
                'message' => 'Incorrect code. Please check and try again.',
                'remaining_attempts' => $verification->max_attempts - $verification->attempts,
            ], 400);
        }

        // Mark verification as used
        $verification->update(['used_at' => now()]);

        // Update the password
        $user->update([
            'password_hash' => Hash::make($request->password),
        ]);

        // Revoke all existing tokens (force re-login)
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Password has been reset successfully. You can now sign in with your new password.',
            'success' => true,
        ]);
    }

    /**
     * Resend a forgot-password reset code.
     */
    public function resendResetCode(Request $request)
    {
        $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
        ]);

        $user = User::findOrFail($request->user_id);

        if (!$user->is_active || !$user->email_verified_at) {
            return response()->json(['message' => 'Invalid request.'], 400);
        }

        // Resend cooldown
        $rateLimitKey = 'resend_reset:' . $user->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 1)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return response()->json([
                'message' => "Please wait {$seconds} seconds before requesting a new code.",
                'cooldown_seconds' => $seconds,
            ], 429);
        }

        // Invalidate previous codes
        EmailVerification::where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $code = $this->generateVerificationCode($user);
        $this->sendVerificationEmail($user, $code);

        RateLimiter::hit($rateLimitKey, self::RESEND_COOLDOWN_SECONDS);

        return response()->json([
            'message' => 'A new reset code has been sent to your email.',
            'email' => $this->maskEmail($user->email),
            'cooldown_seconds' => self::RESEND_COOLDOWN_SECONDS,
        ]);
    }

    public function me(Request $request)
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Successfully logged out']);
    }

    // ─── Private Helpers ─────────────────────────────────────────────────

    /**
     * Generate a 6-digit verification code and store its hash.
     */
    private function generateVerificationCode(User $user): string
    {
        $code = str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);

        EmailVerification::create([
            'user_id' => $user->id,
            'email' => $user->email,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(self::CODE_EXPIRY_MINUTES),
            'attempts' => 0,
            'max_attempts' => 5,
        ]);

        return $code;
    }

    /**
     * Send the verification email.
     */
    private function sendVerificationEmail(User $user, string $code): void
    {
        Mail::to($user->email)->send(
            new VerificationCodeMail($code, $user->full_name, self::CODE_EXPIRY_MINUTES)
        );
    }

    /**
     * Mask an email address for display (e.g. "ju***@gmail.com").
     */
    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        $local = $parts[0];
        $domain = $parts[1] ?? '';

        if (strlen($local) <= 2) {
            $masked = $local[0] . '***';
        } else {
            $masked = substr($local, 0, 2) . str_repeat('*', max(3, strlen($local) - 2));
        }

        return $masked . '@' . $domain;
    }

    /**
     * Check if a given string is a valid Philippine mobile number.
     * Supports formats: 09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX, 9XXXXXXXXX
     */
    private function isPhilippineMobile(string $value): bool
    {
        $cleaned = preg_replace('/[\s\-]/', '', $value);
        return (bool) preg_match('/^(\+?63|0)?9\d{9}$/', $cleaned);
    }

    /**
     * Normalize Philippine mobile number to +639XXXXXXXXX
     */
    private function normalizePhilippineMobile(string $value): string
    {
        $cleaned = preg_replace('/[\s\-]/', '', $value);
        if (str_starts_with($cleaned, '09')) {
            return '+63' . substr($cleaned, 1);
        }
        if (str_starts_with($cleaned, '639')) {
            return '+' . $cleaned;
        }
        if (str_starts_with($cleaned, '+639')) {
            return $cleaned;
        }
        if (str_starts_with($cleaned, '9') && strlen($cleaned) === 10) {
            return '+63' . $cleaned;
        }
        return $cleaned;
    }
}
