<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\User;
use Google_Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GoogleAuthController extends Controller
{
    /**
     * Return the Google OAuth URL for the frontend to redirect to.
     */
    public function redirectUrl()
    {
        $client = $this->getGoogleClient();
        $authUrl = $client->createAuthUrl();

        return response()->json(['url' => $authUrl]);
    }

    /**
     * Exchange a single-use Google OAuth authorization ticket for the Sanctum token and user profile.
     * The ticket is atomically retrieved and deleted to prevent replay attacks.
     */
    public function exchangeCode(Request $request)
    {
        $request->validate([
            'code' => ['required', 'string', 'min:32', 'max:128'],
        ]);

        $code = (string) $request->input('code');
        $cacheKey = "google_oauth_ticket_{$code}";

        // Atomically pull and invalidate ticket
        $payload = Cache::pull($cacheKey);

        if (!$payload) {
            return response()->json([
                'message' => 'Authorization code is invalid, expired, or has already been used.',
            ], 400);
        }

        return response()->json([
            'token' => $payload['token'],
            'user'  => $payload['user'],
        ]);
    }

    /**
     * Handle the Google OAuth callback.
     * Exchange the authorization code for tokens, extract user info,
     * find or create the user, issue a Sanctum token, and redirect to the frontend.
     */
    public function callback(Request $request)
    {
        $frontendUrl = config('app.frontend_url', 'http://localhost:3000');

        if ($request->has('error')) {
            Log::warning('Google OAuth error', ['error' => $request->error]);
            return redirect($frontendUrl . '/login?error=google_auth_failed');
        }

        $code = $request->query('code');
        if (!$code) {
            return redirect($frontendUrl . '/login?error=no_code');
        }

        try {
            $client = $this->getGoogleClient();
            $tokenData = $client->fetchAccessTokenWithAuthCode($code);

            if (isset($tokenData['error'])) {
                Log::error('Google token exchange failed', $tokenData);
                return redirect($frontendUrl . '/login?error=token_exchange_failed');
            }

            $client->setAccessToken($tokenData);

            // Allow clock skew to avoid "Cannot handle token with iat prior to..." errors
            \Firebase\JWT\JWT::$leeway = 300; // 5 minutes leeway

            // Get user info from the ID token (strict cryptographic verification)
            $payload = null;
            try {
                $payload = $client->verifyIdToken($tokenData['id_token']);
            } catch (\Exception $verifyEx) {
                Log::error('Google verifyIdToken failed', [
                    'error' => $verifyEx->getMessage(),
                ]);
            }

            if (!$payload) {
                Log::error('Invalid or unverified Google ID token received', ['has_id_token' => !empty($tokenData['id_token'])]);
                return redirect($frontendUrl . '/login?error=invalid_token');
            }

            $googleId = $payload['sub'];
            $email = $payload['email'];
            $name = $payload['name'] ?? ($payload['given_name'] ?? '') . ' ' . ($payload['family_name'] ?? '');
            $picture = $payload['picture'] ?? null;
            $firstName = $payload['given_name'] ?? null;
            $lastName = $payload['family_name'] ?? null;

            // Find or create user
            // First try to find by google_id
            $user = User::where('google_id', $googleId)->first();

            if (!$user) {
                // Try to find by email (user might have registered manually first)
                $user = User::where('email', $email)->first();

                if ($user) {
                    // Security check: Never bypass administrative suspension via OAuth linking
                    if (!$user->is_active) {
                        return redirect($frontendUrl . '/login?error=account_inactive');
                    }

                    // Link Google account to existing user without overriding active status
                    $user->update([
                        'google_id' => $googleId,
                        'auth_provider' => 'google',
                        'picture' => $picture ?? $user->picture,
                        'email_verified_at' => $user->email_verified_at ?? now(),
                    ]);
                } else {
                    // Create new user — Google-authenticated users are verified by Google
                    $user = User::create([
                        'email' => $email,
                        'full_name' => trim($name),
                        'role' => 'applicant',
                        'auth_provider' => 'google',
                        'google_id' => $googleId,
                        'picture' => $picture,
                        'is_active' => true,
                        'email_verified_at' => now(), // Google already verified the email
                    ]);
                }
            } else {
                // Update picture if available
                if ($picture && $picture !== $user->picture) {
                    $user->update(['picture' => $picture]);
                }
            }

            // Ensure ApplicantProfile exists for applicants
            if ($user->role === 'applicant') {
                \App\Models\ApplicantProfile::firstOrCreate(
                    ['user_id' => $user->id],
                    [
                        'first_name' => $firstName ?: null,
                        'last_name' => $lastName ?: null,
                    ]
                );
            }

            if (!$user->is_active) {
                return redirect($frontendUrl . '/login?error=account_inactive');
            }

            // Issue Sanctum token
            $token = $user->createToken('google_auth_token')->plainTextToken;

            // Generate single-use, short-lived authorization ticket (60s TTL)
            // Bearer tokens and profile data are NEVER transmitted in URL query parameters
            $ticket = Str::random(64);
            Cache::put("google_oauth_ticket_{$ticket}", [
                'token' => $token,
                'user'  => [
                    'id'            => $user->id,
                    'email'         => $user->email,
                    'full_name'     => $user->full_name,
                    'role'          => $user->role,
                    'auth_provider' => $user->auth_provider,
                    'picture'       => $user->picture,
                    'is_active'     => $user->is_active,
                    'created_at'    => $user->created_at->toIso8601String(),
                ],
            ], now()->addSeconds(60));

            return redirect($frontendUrl . "/auth/google/callback?auth_code={$ticket}");

        } catch (\Exception $e) {
            Log::error('Google OAuth exception', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return redirect($frontendUrl . '/login?error=google_auth_exception');
        }
    }

    /**
     * Create and configure the Google API client with robust network and DNS handling.
     */
    private function getGoogleClient(): Google_Client
    {
        $client = new Google_Client();

        $curlOptions = [
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_CONNECTTIMEOUT => 10,
        ];

        // Pre-resolve Google API hosts to bypass router DNS refusal on Windows
        $resolveMappings = $this->resolveGoogleHosts();
        if (!empty($resolveMappings)) {
            $curlOptions[CURLOPT_RESOLVE] = $resolveMappings;
        }

        $guzzleConfig = [
            'curl' => $curlOptions,
            'timeout' => 25,
            'connect_timeout' => 10,
        ];

        // Disable SSL verification in local development to prevent cURL error 60
        if (app()->environment('local')) {
            $guzzleConfig['verify'] = false;
        }

        $guzzleClient = new \GuzzleHttp\Client($guzzleConfig);
        $client->setHttpClient($guzzleClient);

        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect'));
        $client->addScope('openid');
        $client->addScope('email');
        $client->addScope('profile');
        $client->setAccessType('online');
        $client->setPrompt('select_account');

        return $client;
    }

    /**
     * Resolve Google OAuth domains to IPv4 addresses.
     * Uses system DNS, fallback public DNS (8.8.8.8, 1.1.1.1), and known Google Anycast IPs.
     */
    private function resolveGoogleHosts(): array
    {
        $hosts = ['oauth2.googleapis.com', 'www.googleapis.com', 'accounts.google.com'];
        $resolve = [];

        $fallbacks = [
            'oauth2.googleapis.com' => '142.251.170.95',
            'www.googleapis.com'    => '172.217.117.4',
            'accounts.google.com'   => '64.233.189.84',
        ];

        foreach ($hosts as $host) {
            $ip = null;

            // 1. Try PHP dns_get_record for IPv4
            $records = @dns_get_record($host, DNS_A);
            if (!empty($records[0]['ip'])) {
                $ip = $records[0]['ip'];
            }

            // 2. Try direct UDP query to 8.8.8.8 or 1.1.1.1 if local DNS refused
            if (!$ip) {
                $ip = $this->queryDnsUdp($host, '8.8.8.8') ?: $this->queryDnsUdp($host, '1.1.1.1');
            }

            // 3. Fallback to Google Anycast IP
            if (!$ip && isset($fallbacks[$host])) {
                $ip = $fallbacks[$host];
            }

            if ($ip) {
                $resolve[] = "{$host}:443:{$ip}";
                $resolve[] = "{$host}:80:{$ip}";
            }
        }

        return $resolve;
    }

    /**
     * Query a DNS server directly via UDP to resolve A records when local resolver fails.
     */
    private function queryDnsUdp(string $hostname, string $dnsServer = '8.8.8.8', int $timeout = 2): ?string
    {
        $socket = @fsockopen("udp://$dnsServer", 53, $errno, $errstr, $timeout);
        if (!$socket) {
            return null;
        }
        stream_set_timeout($socket, $timeout);

        $id = rand(1000, 9999);
        $header = pack('n6', $id, 0x0100, 1, 0, 0, 0);

        $question = '';
        foreach (explode('.', $hostname) as $part) {
            $question .= chr(strlen($part)) . $part;
        }
        $question .= chr(0) . pack('n2', 1, 1);

        fwrite($socket, $header . $question);
        $response = fread($socket, 512);
        fclose($socket);

        if (strlen($response) < 12) {
            return null;
        }

        $ancount = (ord($response[6]) << 8) + ord($response[7]);
        if ($ancount < 1) {
            return null;
        }

        $offset = 12 + strlen($question);
        for ($i = 0; $i < $ancount; $i++) {
            if ($offset >= strlen($response)) {
                break;
            }
            if ((ord($response[$offset]) & 0xc0) == 0xc0) {
                $offset += 2;
            } else {
                while ($offset < strlen($response) && ord($response[$offset]) != 0) {
                    $offset += ord($response[$offset]) + 1;
                }
                $offset++;
            }
            $type = (ord($response[$offset]) << 8) + ord($response[$offset + 1]);
            $offset += 8;
            $rdlength = (ord($response[$offset]) << 8) + ord($response[$offset + 1]);
            $offset += 2;
            if ($type == 1 && $rdlength == 4) {
                return ord($response[$offset]) . '.' . ord($response[$offset + 1]) . '.' . ord($response[$offset + 2]) . '.' . ord($response[$offset + 3]);
            }
            $offset += $rdlength;
        }

        return null;
    }
}
