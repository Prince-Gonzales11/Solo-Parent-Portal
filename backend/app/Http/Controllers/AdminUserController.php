<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminUserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with([
                'profile.barangay',
                'applications' => function ($q) {
                    $q->with('category')->orderBy('created_at', 'desc');
                }
            ])
            ->withCount([
                'documents as doc_count' => function ($q) {
                    $q->where('review_status', '!=', 'replaced');
                }
            ])
            ->orderBy('created_at', 'desc');

        $likeOp = \Illuminate\Support\Facades\DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        if ($request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s, $likeOp) {
                $q->where('full_name', $likeOp, "%{$s}%")
                  ->orWhere('email', $likeOp, "%{$s}%")
                  ->orWhere('phone_number', $likeOp, "%{$s}%")
                  ->orWhereHas('profile', function ($pq) use ($s, $likeOp) {
                      $pq->whereHas('barangay', function ($bq) use ($s, $likeOp) {
                          $bq->where('name', $likeOp, "%{$s}%");
                      });
                  });
            });
        }

        if ($request->role && $request->role !== 'all') {
            $query->where('role', $request->role);
        }

        if ($request->has('is_active') && $request->is_active !== 'all') {
            $query->where('is_active', $request->is_active === 'true');
        }

        // Filter by barangay
        if ($request->barangay) {
            $query->whereHas('profile.barangay', function ($q) use ($request) {
                $q->where('name', $request->barangay);
            });
        }

        // Filter: has_application
        if ($request->has('has_application')) {
            if ($request->has_application === 'true') {
                $query->whereHas('applications');
            } else {
                $query->whereDoesntHave('applications');
            }
        }

        $users = $query->paginate(25);

        // Transform to include computed status fields without N+1 query execution
        $users->getCollection()->transform(function ($user) {
            $profile = $user->profile;
            $latestApp = $user->applications->first();

            $user->profile_complete = (bool) ($profile && $profile->is_profile_complete && $latestApp && $latestApp->is_form_complete);
            $user->barangay_name = $profile?->barangay?->name ?? null;
            $user->solo_parent_category = $latestApp?->category?->code ?? null;
            $user->latest_application_status = $latestApp?->status;
            $user->latest_application_ref = $latestApp?->reference_no;

            return $user;
        });

        return response()->json($users);
    }

    public function show($id)
    {
        $user = User::with(['profile', 'applications'])->findOrFail($id);
        return response()->json($user);
    }

    public function updateRole($id, Request $request)
    {
        $actor = $request->user();
        if (!$actor || $actor->role !== 'super_admin') {
            return response()->json([
                'detail' => 'Unauthorized. Only super administrators can modify user roles.',
            ], 403);
        }

        $request->validate([
            'role' => 'required|in:applicant,admin,super_admin',
        ]);

        $user = User::findOrFail($id);

        if ($user->id === $actor->id && $request->role !== 'super_admin') {
            return response()->json([
                'detail' => 'You cannot remove your own super administrator role.',
            ], 422);
        }

        $oldRole = $user->role;
        $user->update(['role' => $request->role]);

        AuditLog::record($request, 'user.role_changed', 'User', $user->id, [
            'user_email' => $user->email,
            'from_role'  => $oldRole,
            'to_role'    => $request->role,
            'changed_by' => $actor->email,
        ]);

        return response()->json($user->fresh());
    }

    public function updateStatus($id, Request $request)
    {
        $request->validate([
            'is_active' => 'required|boolean',
        ]);

        $actor = $request->user();
        $user  = User::findOrFail($id);

        // QA-P1-04: Prevent self-deactivation / administrative lockout
        if ($actor->id === $user->id && !$request->is_active) {
            return response()->json([
                'detail' => 'You cannot deactivate your own administrative account.',
            ], 422);
        }

        // QA-P1-04: Ordinary admins cannot alter status of super administrators or other admins
        if (in_array($user->role, ['admin', 'super_admin']) && $actor->role !== 'super_admin') {
            return response()->json([
                'detail' => 'Unauthorized. Only super administrators can modify administrative staff status.',
            ], 403);
        }

        $user->update(['is_active' => $request->is_active]);

        // QA-P1-04: Revoke all active bearer tokens upon suspension
        if (!$request->is_active) {
            $user->tokens()->delete();
        }

        AuditLog::record($request, $request->is_active ? 'user.activated' : 'user.suspended', 'User', $user->id, [
            'user_email' => $user->email,
            'actor_email' => $actor->email,
        ]);

        return response()->json($user->fresh());
    }

    public function resetPassword($id, Request $request)
    {
        $actor = $request->user();
        $user  = User::findOrFail($id);

        // Prevent self-reset via admin management panel
        if ($actor->id === $user->id) {
            return response()->json([
                'detail' => 'You cannot reset your own password here. Please use Account Settings.',
            ], 422);
        }

        // Only super_admin can reset credentials for administrative and staff accounts
        if (in_array($user->role, ['admin', 'super_admin']) && $actor->role !== 'super_admin') {
            return response()->json([
                'detail' => 'Unauthorized. Only super administrators can reset staff or administrator passwords.',
            ], 403);
        }

        $newPass = Str::random(12);

        $user->update(['password_hash' => Hash::make($newPass)]);

        // QA-P2-01: Revoke all active sessions upon administrative password reset
        $user->tokens()->delete();

        AuditLog::record($request, 'user.password_reset', 'User', $user->id, [
            'user_email'   => $user->email,
            'target_role'  => $user->role,
            'reset_by'     => $actor->email,
        ]);

        // Return the temporary password so authorized admin can relay it to the applicant
        return response()->json([
            'message'            => 'Password reset successfully.',
            'temporary_password' => $newPass,
        ]);
    }

    public function store(Request $request)
    {
        $actor = $request->user();

        // 1. Role validation
        $request->validate([
            'role' => 'required|in:applicant,admin,super_admin',
        ]);

        $role = $request->role;

        // QA-P1-12: Only super administrators can create staff or administrator accounts
        if (in_array($role, ['admin', 'super_admin']) && (!$actor || $actor->role !== 'super_admin')) {
            return response()->json([
                'detail' => 'Unauthorized. Only super administrators can create staff or administrator accounts.',
            ], 403);
        }

        $normalizedPhone = null;

        // 2. Role-specific validation rules
        if ($role === 'applicant') {
            $rules = [
                'full_name'            => 'required|string|max:200',
                'password'             => 'required|string|min:8|max:128',
                'dpa_consent_attested' => 'sometimes|accepted',
            ];

            $email = trim((string) $request->input('email', ''));
            $phone = trim((string) $request->input('phone_number', ''));

            if (empty($email) && empty($phone)) {
                return response()->json([
                    'message' => 'Please provide either an email address or a valid Philippine mobile number.',
                    'errors' => [
                        'identifier' => ['Please provide either an email address or a valid Philippine mobile number.'],
                    ],
                ], 422);
            }

            if (!empty($email)) {
                $rules['email'] = 'email|max:255|unique:users,email';
            }

            if (!empty($phone)) {
                if (!$this->isPhilippineMobile($phone)) {
                    return response()->json([
                        'message' => 'The mobile number must be a valid Philippine mobile number (e.g. 09171234567 or +639171234567).',
                        'errors' => [
                            'phone_number' => ['The mobile number must be a valid Philippine mobile number.'],
                        ],
                    ], 422);
                }
                $normalizedPhone = $this->normalizePhilippineMobile($phone);

                $phoneQuery = User::where('phone_number', $normalizedPhone);
                if (str_starts_with($normalizedPhone, '+63')) {
                    $phoneQuery->orWhere('phone_number', '0' . substr($normalizedPhone, 3))
                               ->orWhere('phone_number', substr($normalizedPhone, 1));
                }
                if ($phoneQuery->exists()) {
                    return response()->json([
                        'message' => 'An account with this mobile number already exists.',
                        'errors' => [
                            'phone_number' => ['An account with this mobile number already exists.'],
                        ],
                    ], 422);
                }
            }

            $request->validate($rules);
        } else {
            // Staff accounts (admin, super_admin) must have a valid official email
            $request->validate([
                'full_name' => 'required|string|max:200',
                'email'     => 'required|email|max:255|unique:users,email',
                'password'  => 'required|string|min:8|max:128',
            ]);
        }

        $consentAttested = $role === 'applicant' ? $request->boolean('dpa_consent_attested') : true;

        $user = User::create([
            'full_name'         => trim($request->full_name),
            'email'             => !empty($request->email) ? strtolower(trim($request->email)) : null,
            'phone_number'      => $normalizedPhone,
            'role'              => $role,
            'password_hash'     => Hash::make($request->password),
            'auth_provider'     => 'local',
            'is_active'         => true,
            'email_verified_at' => $role === 'applicant' ? null : now(),
            'dpa_consent'       => $consentAttested,
            'dpa_consented_at'  => $consentAttested ? now() : null,
            'dpa_consent_ip'    => null, // Caseworker IP must not be recorded as applicant's IP
        ]);

        // Provision applicant profile if created role is applicant
        if ($user->role === 'applicant') {
            $parts = explode(' ', trim($request->full_name), 2);
            \App\Models\ApplicantProfile::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name'     => $parts[0] ?? $request->full_name,
                    'last_name'      => $parts[1] ?? '',
                    'contact_number' => $normalizedPhone,
                ]
            );
        }

        AuditLog::record($request, 'user.created', 'User', $user->id, [
            'email'                => $user->email,
            'phone_number'         => $user->phone_number,
            'role'                 => $user->role,
            'created_by'           => $actor->email,
            'dpa_consent_channel'  => $role === 'applicant' ? ($consentAttested ? 'in_person_walkin' : null) : null,
            'dpa_consent_attested' => $role === 'applicant' ? $consentAttested : null,
            'attested_by_admin_id' => ($role === 'applicant' && $consentAttested) ? $actor->id : null,
            'caseworker_ip'        => $request->ip(),
        ]);

        return response()->json($user, 201);
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
