<?php

namespace App\Http\Controllers;

use App\Http\Requests\Profile\ProfileUpsertRequest;
use App\Http\Resources\ProfileResource;
use App\Http\Resources\UserResource;
use App\Models\ApplicantProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function getProfile(Request $request)
    {
        $user = $request->user();
        $profile = ApplicantProfile::with('barangayRecord')->where('user_id', $user->id)->first();
        if (!$profile) {
            $profile = ApplicantProfile::create(['user_id' => $user->id]);
        }

        if (empty($profile->contact_number) && !empty($user->phone_number)) {
            $profile->contact_number = $user->phone_number;
            $profile->save();
        }

        $data = $profile->toArray();
        $data['email'] = $user->email;
        $data['phone_number'] = $user->phone_number;
        $data['picture'] = $user->picture;
        $data['auth_provider'] = $user->auth_provider;
        $data['barangay'] = $profile->barangay ?? $profile->barangayRecord?->name ?? null;
        $data['barangay_id'] = $profile->barangay_id;
        $data['is_profile_complete'] = (bool) $profile->is_profile_complete;
        $data['setup_completed'] = (bool) $profile->is_profile_complete;

        // Only load and merge full application form data if requested
        if ($request->query('with_form') === 'true') {
            $application = \App\Models\Application::where('user_id', $user->id)
                ->with(['form', 'familyMembers', 'category'])
                ->orderBy('created_at', 'desc')
                ->first();

            $formModel = $application?->form;
            $familyMembers = $application?->familyMembers ?? collect();

            if (!$formModel) {
                $prevWithForm = \App\Models\Application::where('user_id', $user->id)
                    ->whereHas('form')
                    ->with(['form', 'familyMembers', 'category'])
                    ->latest()
                    ->first();
                if ($prevWithForm) {
                    $formModel = $prevWithForm->form;
                    if ($familyMembers->isEmpty()) {
                        $familyMembers = $prevWithForm->familyMembers;
                    }
                }
            }

            if ($formModel) {
                $form = $formModel->toArray();
                $data = array_merge($data, $form);
                $data['solo_parent_category'] = $application?->category?->code ?? ($prevWithForm?->category?->code ?? null);
                $data['household_members'] = $familyMembers->map(function ($m) {
                    $arr = $m->toArray();
                    $arr['birthdate'] = $m->date_of_birth ? $m->date_of_birth->format('Y-m-d') : ($arr['date_of_birth'] ?? '');
                    return $arr;
                })->toArray();
            } else {
                $data['solo_parent_category'] = null;
                $data['household_members'] = [];
                $data['is_indigent'] = false;
                $data['is_4ps_beneficiary'] = false;
                $data['is_indigenous'] = false;
                $data['is_lgbtqia'] = false;
                $data['is_pwd'] = false;
                $data['num_children'] = 0;
            }
        }

        return response()->json(['data' => $data]);
    }

    public function initialProfileStatus(Request $request)
    {
        $profile = ApplicantProfile::where('user_id', $request->user()->id)->first();
        return response()->json([
            'is_initial_complete' => (bool) ($profile && $profile->is_profile_complete),
        ]);
    }

    public function upsertProfile(ProfileUpsertRequest $request)
    {
        $user = $request->user();
        $validated = $request->validated();
        
        // 1. Update ApplicantProfile (Short profile)
        $profileFields = collect($validated)->only([
            'first_name', 'middle_name', 'last_name', 'suffix', 'sex', 'birth_date',
            'contact_number', 'telephone', 'barangay', 'barangay_id', 'house_no', 'street',
            'city_municipality', 'province', 'region', 'zip_code'
        ])->toArray();

        $profile = ApplicantProfile::firstOrCreate(['user_id' => $user->id]);

        $brgyId = $validated['barangay_id'] ?? null;
        $brgyName = trim($validated['barangay'] ?? '');

        if (!empty($brgyId)) {
            $bRecord = \App\Models\Barangay::find($brgyId);
            if ($bRecord) {
                $profileFields['barangay_id'] = $bRecord->id;
                if (empty($brgyName)) {
                    $profileFields['barangay'] = $bRecord->name;
                }
            }
        }

        if (!empty($brgyName)) {
            $profileFields['barangay'] = $brgyName;
            if (empty($profileFields['barangay_id'])) {
                // Attempt exact or case-insensitive or partial match in Butuan City barangays
                $matchedBrgy = \App\Models\Barangay::where('name', $brgyName)
                    ->orWhereRaw('LOWER(TRIM(name)) = ?', [strtolower($brgyName)])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%' . strtolower($brgyName) . '%'])
                    ->first();
                if ($matchedBrgy) {
                    $profileFields['barangay_id'] = $matchedBrgy->id;
                }
            }
        }

        $profile->fill($profileFields);

        // Check if short profile is complete
        $hasBarangay = !empty($profile->barangay_id) || !empty(trim($profile->barangay ?? ''));
        $profile->is_profile_complete = (bool) (
            $profile->first_name &&
            $profile->last_name &&
            $profile->sex &&
            $profile->birth_date &&
            $profile->contact_number &&
            $profile->city_municipality &&
            $hasBarangay
        );
        
        $profile->save();

        // Sync User Name, Phone, and Email
        $userUpdates = [];
        if (isset($validated['first_name']) || isset($validated['last_name'])) {
            $fullName = trim(preg_replace('/\s+/', ' ', "{$profile->first_name} {$profile->middle_name} {$profile->last_name}"));
            if ($fullName) $userUpdates['full_name'] = $fullName;
        }
        if (!empty($validated['contact_number'])) {
            $userUpdates['phone_number'] = $validated['contact_number'];
        }
        if (!empty($validated['email']) && empty($user->email)) {
            $userUpdates['email'] = strtolower(trim($validated['email']));
        }
        if (!empty($userUpdates)) {
            $user->update($userUpdates);
        }

        // 2. Update ApplicationForm only for editable applications (QA-P1-06: protect completed/finalized records from mutation)
        $editableStatuses = ['draft', 'requirements_submitted', 'qualified', 'for_document_correction'];
        $activeApp = \App\Models\Application::where('user_id', $user->id)
            ->whereIn('status', $editableStatuses)
            ->latest()
            ->first();

        if ($activeApp) {
            if (isset($validated['solo_parent_category'])) {
                $cat = \App\Models\Category::where('code', $validated['solo_parent_category'])->first();
                if ($cat) {
                    $activeApp->category_id = $cat->id;
                    $activeApp->application_type = $activeApp->is_renewal ? 'renewal' : 'new';
                    $activeApp->save();
                }
            }

            $formFields = collect($validated)->except(array_keys($profileFields))->except(['solo_parent_category', 'household_members'])->toArray();
            
            $form = \App\Models\ApplicationForm::firstOrCreate(['application_id' => $activeApp->id]);
            $form->fill($formFields);
            $form->save();

            if (isset($validated['household_members']) && is_array($validated['household_members'])) {
                \App\Models\ApplicationFamilyMember::where('application_id', $activeApp->id)->delete();
                foreach ($validated['household_members'] as $member) {
                    $name = trim($member['name'] ?? '');
                    if (empty($name) && empty($member['relationship']) && empty($member['age']) && empty($member['birthdate']) && empty($member['date_of_birth'])) {
                        // Skip completely empty member rows
                        continue;
                    }

                    $age = null;
                    if (isset($member['age']) && $member['age'] !== '' && is_numeric($member['age'])) {
                        $age = (int) $member['age'];
                    }

                    $dob = null;
                    $rawDob = $member['birthdate'] ?? ($member['date_of_birth'] ?? null);
                    if (!empty($rawDob) && is_string($rawDob) && strtotime($rawDob) !== false) {
                        $dob = date('Y-m-d', strtotime($rawDob));
                    }

                    \App\Models\ApplicationFamilyMember::create([
                        'application_id' => $activeApp->id,
                        'name' => $name ?: 'Family Member',
                        'relationship' => !empty($member['relationship']) ? trim($member['relationship']) : null,
                        'age' => $age,
                        'civil_status' => !empty($member['civil_status']) ? trim($member['civil_status']) : null,
                        'educational_attainment' => !empty($member['educational_attainment']) ? trim($member['educational_attainment']) : null,
                        'date_of_birth' => $dob,
                        'monthly_income' => !empty($member['monthly_income']) ? trim((string)$member['monthly_income']) : null,
                        'member_type' => !empty($member['member_type']) ? trim($member['member_type']) : 'child',
                    ]);
                }
            }

            // Check full completion
            $activeApp->is_form_complete = $this->isFormComplete($profile, $form, $activeApp);
            $activeApp->save();
        }

        return $this->getProfile($request);
    }

    public function completionStatus(Request $request)
    {
        $user = $request->user();
        $profile = ApplicantProfile::where('user_id', $user->id)->first();
        
        $activeApp = \App\Models\Application::where('user_id', $user->id)
            ->with(['form', 'familyMembers'])
            ->orderBy('created_at', 'desc')
            ->first();

        $sections = $this->buildSections($profile, $activeApp?->form, $activeApp);
        $completed = collect($sections)->where('complete', true)->count();
        $total = count($sections);
        $pct = $total > 0 ? (int) round(($completed / $total) * 100) : 0;

        return response()->json([
            'percentage'  => $pct,
            'is_complete' => $pct >= 100,
            'sections'    => $sections,
        ]);
    }

    private function buildSections($p, $f, $app)
    {
        $hasMembers = $app && $app->familyMembers->count() > 0;
        return [
            [
                'key' => 'personal',
                'label' => 'Personal Information',
                'complete' => $p && $p->first_name && $p->last_name && $p->birth_date && $p->sex && $p->contact_number && $p->city_municipality,
            ],
            [
                'key' => 'household',
                'label' => 'Household Composition',
                'complete' => true, // Optional section
            ],
            [
                'key' => 'solo_parent',
                'label' => 'Solo Parent Category',
                'complete' => $app && $app->category_id && $f && $f->solo_parent_since,
            ],
            [
                'key' => 'needs',
                'label' => 'Needs & Problems',
                'complete' => $f && !empty(trim($f->needs_problems ?? '')),
            ],
            [
                'key' => 'emergency',
                'label' => 'Emergency Contact',
                'complete' => $f && $f->emergency_contact_name && $f->emergency_contact_number,
            ],
        ];
    }

    private function isFormComplete($p, $f, $app)
    {
        $sections = $this->buildSections($p, $f, $app);
        return collect($sections)->where('complete', true)->count() === count($sections);
    }

    /**
     * Upload and update user profile picture.
     */
    public function uploadAvatar(Request $request)
    {
        $request->validate([
            'avatar' => ['required', 'file', 'max:5120'], // 5MB max
        ]);

        $user = $request->user();
        $file = $request->file('avatar');

        $ext = strtolower($file->getClientOriginalExtension() ?: pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION));

        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
            throw ValidationException::withMessages([
                'avatar' => ['The avatar must be a valid image file (JPG, PNG, or WEBP).'],
            ]);
        }

        // Validate image magic bytes
        $header = file_get_contents($file->getRealPath(), false, null, 0, 16);
        $valid = false;
        if (in_array($ext, ['jpg', 'jpeg'])) {
            $valid = str_starts_with($header, "\xFF\xD8\xFF");
        } elseif ($ext === 'png') {
            $valid = str_starts_with($header, "\x89PNG");
        } elseif ($ext === 'webp') {
            $valid = str_starts_with($header, "RIFF") && str_contains($header, "WEBP");
        }

        if (!$valid) {
            throw ValidationException::withMessages([
                'avatar' => ['The file content does not match a valid image. Please upload a genuine JPG, PNG, or WEBP image.'],
            ]);
        }
        $filename = 'avatar-' . $user->id . '-' . time() . '.' . $ext;

        $avatarDir = public_path('storage/avatars');
        if (!file_exists($avatarDir)) {
            mkdir($avatarDir, 0755, true);
        }

        // Delete old avatar if local file
        if ($user->picture && str_contains($user->picture, '/storage/avatars/')) {
            $oldPath = public_path(parse_url($user->picture, PHP_URL_PATH));
            if (file_exists($oldPath)) {
                @unlink($oldPath);
            }
        }

        $file->move($avatarDir, $filename);
        $url = asset('storage/avatars/' . $filename);

        $user->update(['picture' => $url]);
        $user->load('profile');

        return response()->json([
            'message' => 'Profile picture updated successfully.',
            'picture' => $url,
            'user' => new UserResource($user),
        ]);
    }

    /**
     * Remove user profile picture.
     */
    public function deleteAvatar(Request $request)
    {
        $user = $request->user();
        if ($user->picture && str_contains($user->picture, '/storage/avatars/')) {
            $oldPath = public_path(parse_url($user->picture, PHP_URL_PATH));
            if (file_exists($oldPath)) {
                @unlink($oldPath);
            }
        }

        $user->update(['picture' => null]);
        $user->load('profile');

        return response()->json([
            'message' => 'Profile picture removed successfully.',
            'picture' => null,
            'user' => new UserResource($user),
        ]);
    }

    /**
     * Change user password.
     */
    public function changePassword(Request $request)
    {
        $user = $request->user();

        if ($user->auth_provider === 'local' && $user->password_hash) {
            $request->validate([
                'current_password' => ['required', 'string'],
                'new_password' => ['required', 'string', 'min:8', 'max:128'],
                'new_password_confirmation' => ['required', 'same:new_password'],
            ]);

            if (!Hash::check($request->current_password, $user->password_hash)) {
                throw ValidationException::withMessages([
                    'current_password' => ['The provided current password does not match our records.'],
                ]);
            }
        } else {
            $request->validate([
                'new_password' => ['required', 'string', 'min:8', 'max:128'],
                'new_password_confirmation' => ['required', 'same:new_password'],
            ]);
        }

        $user->update([
            'password_hash' => Hash::make($request->new_password),
        ]);

        // QA-P2-01: Revoke all other active sessions upon password change
        $currentToken = $user->currentAccessToken();
        if ($currentToken instanceof \Laravel\Sanctum\PersonalAccessToken) {
            $user->tokens()->where('id', '!=', $currentToken->id)->delete();
        }

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }

    /**
     * Delete user account and all associated data.
     */
    public function deleteAccount(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'super_admin' || $user->role === 'admin') {
            return response()->json([
                'message' => 'Administrator accounts cannot be deleted from here.'
            ], 403);
        }

        if ($user->auth_provider === 'local' && $user->password_hash) {
            $request->validate([
                'password' => ['required', 'string'],
            ]);

            if (!Hash::check($request->password, $user->password_hash)) {
                throw ValidationException::withMessages([
                    'password' => ['The provided password is incorrect.'],
                ]);
            }
        }

        DB::transaction(function () use ($user) {
            // Delete avatar file if exists
            if ($user->picture && str_contains($user->picture, '/storage/avatars/')) {
                $oldPath = public_path(parse_url($user->picture, PHP_URL_PATH));
                if (file_exists($oldPath)) {
                    @unlink($oldPath);
                }
            }

            // Revoke active personal access tokens
            $user->tokens()->delete();

            // Cascade deletes will clean up applicant_profile, applications, documents, notifications
            $user->delete();
        });

        return response()->json([
            'message' => 'Your account has been deleted permanently.'
        ]);
    }
}
