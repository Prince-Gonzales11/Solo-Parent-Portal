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
        $query = User::with('profile')
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

        // Transform to include computed status fields
        $users->getCollection()->transform(function ($user) {
            $profile = $user->profile;
            $latestApp = $user->applications()->with(['category'])->orderBy('created_at', 'desc')->first();

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

        $user = User::findOrFail($id);
        $user->update(['is_active' => $request->is_active]);

        AuditLog::record($request, $request->is_active ? 'user.activated' : 'user.suspended', 'User', $user->id, [
            'user_email' => $user->email,
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
        if (!$actor || $actor->role !== 'super_admin') {
            return response()->json([
                'detail' => 'Unauthorized. Only super administrators can create staff or administrator accounts.',
            ], 403);
        }

        $request->validate([
            'full_name' => 'required|string|max:200',
            'email'     => 'required|email|unique:users,email',
            'role'      => 'required|in:admin,super_admin',
            'password'  => 'required|string|min:8',
        ]);

        $user = User::create([
            'full_name'      => $request->full_name,
            'email'          => $request->email,
            'role'           => $request->role,
            'password_hash'  => Hash::make($request->password),
            'auth_provider'  => 'local',
            'is_active'      => true,
        ]);

        AuditLog::record($request, 'user.created', 'User', $user->id, [
            'email' => $user->email,
            'role'  => $user->role,
        ]);

        return response()->json($user, 201);
    }
}
