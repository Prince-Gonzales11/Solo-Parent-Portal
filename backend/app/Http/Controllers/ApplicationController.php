<?php

namespace App\Http\Controllers;

use App\Models\Application;
use App\Models\Document;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ApplicationController extends Controller
{
    public function getUserApplications(Request $request)
    {
        $applications = Application::where('user_id', $request->user()->id)
                            ->with('statusHistory')
                            ->orderBy('created_at', 'desc')
                            ->get();

        return response()->json($applications);
    }

    public function getMyApp(Request $request)
    {
        $query = Application::where('user_id', $request->user()->id)
            ->with(['category', 'category.requirements', 'form', 'statusHistory']);

        $appId = $request->input('application_id') ?? $request->input('id');
        if ($appId) {
            $application = $query->where('id', $appId)->first();
            $activeApp = ($application && !in_array($application->status, ['rejected', 'expired', 'cancelled', 'completed', 'released'])) ? $application : null;
        } else {
            if ($request->filled('type')) {
                $query->where('application_type', $request->type);
            }
            // First look for active / in-progress application
            $activeApp = (clone $query)
                ->whereNotIn('status', ['rejected', 'expired', 'cancelled', 'completed', 'released'])
                ->orderBy('created_at', 'desc')
                ->first();

            // If no active app, get the latest one (so rejected or released applications remain visible with actions)
            $application = $activeApp ?: $query->orderBy('created_at', 'desc')->first();
        }

        // All applications history for this user
        $allApplications = Application::where('user_id', $request->user()->id)
            ->with(['category'])
            ->orderBy('created_at', 'desc')
            ->get();

        $history = [];
        $documentsComplete = false;
        $documentsApproved = false;

        if ($application) {
            $history = $application->statusHistory ? $application->statusHistory->sortBy('created_at')->values() : [];

            // Dynamically compute documents completeness and approval in PHP memory
            $category = $application->category;
            if (!$category && $application->category_id) {
                $category = \App\Models\Category::find($application->category_id);
            }

            if ($category) {
                $requiredReqs = $category->requirements->where('is_required', true)->pluck('id')->toArray();
                $totalRequired = count($requiredReqs);

                if ($totalRequired > 0) {
                    $appDocs = Document::where('application_id', $application->id)
                        ->get(['requirement_id', 'review_status']);

                    $uploadedCount = $appDocs->whereIn('requirement_id', $requiredReqs)
                        ->whereNotIn('review_status', ['replaced', 'rejected'])
                        ->pluck('requirement_id')
                        ->unique()
                        ->count();

                    $documentsComplete = $uploadedCount >= $totalRequired;

                    $approvedCount = $appDocs->whereIn('requirement_id', $requiredReqs)
                        ->whereIn('review_status', ['approved', 'verified'])
                        ->pluck('requirement_id')
                        ->unique()
                        ->count();

                    $documentsApproved = ($approvedCount >= $totalRequired);
                } else {
                    $documentsComplete = true;
                    $documentsApproved = true;
                }
            }

            // Also check if admin has already approved/qualified the applicant
            if ($application->are_documents_complete && in_array($application->status, [
                'under_initial_review', 'document_verification', 'under_final_assessment',
                'under_final_verification', 'approved', 'ready_for_printing', 'ready_for_release', 'released',
                'ready_for_pickup', 'completed'
            ])) {
                $documentsApproved = true;
            }
        }

        $isRegistered = $application && in_array($application->status, [
            'approved', 'ready_for_printing', 'ready_for_release', 'released', 'ready_for_pickup', 'completed'
        ]);

        // ── Post-completion Eligibility Rules ────────────────────────────
        $hasActiveApp = ($activeApp !== null);
        $latestCompleted = $allApplications->first(fn($a) => in_array($a->status, ['completed', 'released']));

        $canApplyNew = true;
        $canApplyNewReason = null;
        if ($hasActiveApp) {
            $canApplyNew = false;
            $canApplyNewReason = 'You already have an active application in progress.';
        } elseif ($latestCompleted) {
            $canApplyNew = false;
            $canApplyNewReason = 'You already hold an official Solo Parent ID record. If your card is expiring, apply for Renewal. If lost, select Loss of SPIC.';
        }

        $canApplyRenewal = true;
        $canApplyRenewalReason = null;
        $spicValidUntil = null;
        $daysUntilExpiry = null;
        if ($hasActiveApp) {
            $canApplyRenewal = false;
            $canApplyRenewalReason = 'You already have an active application in progress.';
        } elseif ($latestCompleted) {
            $baseDate = $latestCompleted->date_issued ?: ($latestCompleted->released_at ?: $latestCompleted->updated_at);
            if ($baseDate) {
                $expiryDate = \Carbon\Carbon::parse($baseDate)->addYear();
                $spicValidUntil = $expiryDate->format('M d, Y');
                $daysUntilExpiry = (int) now()->diffInDays($expiryDate, false);

                // Both active IDs and expired IDs can submit a Renewal application for CSWDD evaluation
                $canApplyRenewal = true;
                $canApplyRenewalReason = $daysUntilExpiry <= 0
                    ? "Your Solo Parent ID expired on {$spicValidUntil}. You are eligible to submit a Renewal application."
                    : "Your Solo Parent ID is active and valid until {$spicValidUntil} ({$daysUntilExpiry} days remaining). You are eligible to submit a Renewal application.";
            }
        }

        $canApplyLoss = true;
        $canApplyLossReason = null;
        if ($hasActiveApp) {
            $canApplyLoss = false;
            $canApplyLossReason = 'You already have an active application in progress.';
        }

        return response()->json([
            'application'        => $application,
            'history'            => $history,
            'all_applications'   => $allApplications,
            'documents_complete' => $documentsComplete,
            'documents_approved' => $documentsApproved,
            'is_registered'      => $isRegistered,
            'is_active'          => ($activeApp !== null),
            'rejection_reason'   => ($application && $application->status === 'rejected') ? $application->status_reason : null,
            'eligibility'        => [
                'can_apply_new'            => $canApplyNew,
                'can_apply_new_reason'     => $canApplyNewReason,
                'can_apply_renewal'        => $canApplyRenewal,
                'can_apply_renewal_reason' => $canApplyRenewalReason,
                'can_apply_loss'           => $canApplyLoss,
                'can_apply_loss_reason'    => $canApplyLossReason,
                'spic_valid_until'         => $spicValidUntil,
                'days_until_expiry'        => $daysUntilExpiry,
            ],
        ]);
    }

    public function getReviewApplication(Request $request)
    {
        $user = $request->user();
        $profile = \App\Models\ApplicantProfile::where('user_id', $user->id)->first();
        
        $appQuery = Application::with(['category', 'form', 'familyMembers'])
            ->where('user_id', $user->id);

        $appId = $request->input('application_id') ?? $request->input('id');
        if ($appId) {
            $application = $appQuery->where('id', $appId)->first();
        } else {
            $application = (clone $appQuery)
                ->whereNotIn('status', ['rejected', 'expired', 'released', 'completed', 'cancelled'])
                ->orderBy('created_at', 'desc')
                ->first()
                ?: $appQuery->orderBy('created_at', 'desc')->first();
        }

        $documents = [];
        if ($application) {
            $documents = Document::where('application_id', $application->id)->get();
        }

        return response()->json([
            'profile'     => $profile,
            'application' => $application,
            'documents'   => $documents
        ]);
    }

    public function submissionCheck(Request $request)
    {
        $user = $request->user();
        $profile = \App\Models\ApplicantProfile::where('user_id', $user->id)->first();
        $appId = $request->input('application_id') ?? $request->input('id') ?? $request->route('id');
        $appQuery = Application::where('user_id', $user->id);
        if ($appId) {
            $application = $appQuery->where('id', $appId)->first();
        } else {
            $application = $appQuery
                ->whereNotIn('status', ['rejected', 'expired', 'released', 'completed', 'cancelled'])
                ->orderBy('created_at', 'desc')
                ->first();
        }

        $form = $application ? \App\Models\ApplicationForm::where('application_id', $application->id)->first() : null;

        $missing_profile_fields = [];
        $missing_field_details = [];

        $isShortcutApp = $application && in_array($application->application_type, ['renewal', 'loss_spic']);

        // Personal and Form Information Checks
        if (!$isShortcutApp) {
        if (!$profile || !trim($profile->first_name ?? '')) {
            $missing_profile_fields[] = 'First Name';
            $missing_field_details[] = [
                'name' => 'First Name',
                'section' => 'personal',
                'section_label' => 'Section I: Personal Information',
                'field' => 'first_name',
                'step' => 'form',
                'button_label' => 'Fill First Name',
                'hint' => 'Enter your first name as shown on your government ID.'
            ];
        }
        if (!$profile || !trim($profile->last_name ?? '')) {
            $missing_profile_fields[] = 'Last Name';
            $missing_field_details[] = [
                'name' => 'Last Name',
                'section' => 'personal',
                'section_label' => 'Section I: Personal Information',
                'field' => 'last_name',
                'step' => 'form',
                'button_label' => 'Fill Last Name',
                'hint' => 'Enter your last name as shown on your government ID.'
            ];
        }
        if (!$profile || !$profile->birth_date) {
            $missing_profile_fields[] = 'Date of Birth';
            $missing_field_details[] = [
                'name' => 'Date of Birth',
                'section' => 'personal',
                'section_label' => 'Section I: Personal Information',
                'field' => 'birth_date',
                'step' => 'form',
                'button_label' => 'Set Date of Birth',
                'hint' => 'Specify your date of birth.'
            ];
        }
        if (!$profile || !$profile->sex) {
            $missing_profile_fields[] = 'Sex';
            $missing_field_details[] = [
                'name' => 'Sex',
                'section' => 'personal',
                'section_label' => 'Section I: Personal Information',
                'field' => 'sex',
                'step' => 'form',
                'button_label' => 'Select Sex',
                'hint' => 'Please select your sex.'
            ];
        }
        $hasBarangay = $profile && (!empty($profile->barangay_id) || !empty(trim($profile->barangay ?? '')));
        if (!$profile || !$hasBarangay) {
            $missing_profile_fields[] = 'Address';
            $missing_field_details[] = [
                'name' => 'Residential Address (Barangay)',
                'section' => 'personal',
                'section_label' => 'Section I: Personal Information',
                'field' => 'barangay',
                'step' => 'form',
                'button_label' => 'Select Barangay',
                'hint' => 'Select your official Butuan City barangay jurisdiction.'
            ];
        }
        if (!$profile || !trim($profile->contact_number ?? '')) {
            $missing_profile_fields[] = 'Contact Number';
            $missing_field_details[] = [
                'name' => 'Contact Number',
                'section' => 'personal',
                'section_label' => 'Section I: Personal Information',
                'field' => 'contact_number',
                'step' => 'form',
                'button_label' => 'Enter Contact Number',
                'hint' => 'Provide a valid contact mobile or phone number.'
            ];
        }

        // Solo Parent Category Checks
        if (!$application || !$application->category_id) {
            $missing_profile_fields[] = 'Solo Parent Category';
            $missing_field_details[] = [
                'name' => 'Solo Parent Category',
                'section' => 'solo_parent',
                'section_label' => 'Section III: Solo Parent Category',
                'field' => 'solo_parent_category',
                'step' => 'form',
                'button_label' => 'Select Category',
                'hint' => 'Select your qualifying Solo Parent category under RA 11861.'
            ];
        }
        if (!$form || empty($form->solo_parent_since)) {
            $missing_profile_fields[] = 'Solo Parent Since Date';
            $missing_field_details[] = [
                'name' => 'Solo Parent Since Date',
                'section' => 'solo_parent',
                'section_label' => 'Section III: Solo Parent Category',
                'field' => 'solo_parent_since',
                'step' => 'form',
                'button_label' => 'Set Since Date',
                'hint' => 'Indicate when you became a solo parent.'
            ];
        }

        // Needs & Problems Checks
        if (!$form || empty(trim($form->needs_problems ?? ''))) {
            $missing_profile_fields[] = 'Needs & Problems';
            $missing_field_details[] = [
                'name' => 'Needs & Problems',
                'section' => 'needs',
                'section_label' => 'Section IV: Needs & Problems',
                'field' => 'needs_problems',
                'step' => 'form',
                'button_label' => 'Fill Needs & Problems',
                'hint' => 'Describe your needs, challenges, and support required.'
            ];
        }

        // Emergency Contact Checks
        if (!$form || empty(trim($form->emergency_contact_name ?? '')) || empty(trim($form->emergency_contact_number ?? ''))) {
            $missing_profile_fields[] = 'Emergency Contact';
            $missing_field_details[] = [
                'name' => 'Emergency Contact Details',
                'section' => 'emergency',
                'section_label' => 'Section V: Emergency Contact',
                'field' => 'emergency_contact_name',
                'step' => 'form',
                'button_label' => 'Fill Emergency Contact',
                'hint' => 'Provide emergency contact person name and mobile number.'
            ];
        }
        } // End of !$isShortcutApp check

        // Documentary requirements
        $missing_documents = [];
        $missing_document_details = [];
        $total_required = 0;
        $uploaded_required = 0;

        if ($application && $application->category_id) {
            $category = $application->category;
            if ($category) {
                $docs = Document::where('application_id', $application->id)->get();
                $idx = 0;
                foreach ($category->requirements as $req) {
                    if ($req->is_required) {
                        $total_required++;
                        $hasDoc = $docs->contains('requirement_id', $req->id);
                        if ($hasDoc) {
                            $uploaded_required++;
                        } else {
                            $missing_documents[] = $req->name;
                            $missing_document_details[] = [
                                'id' => $req->id,
                                'name' => $req->name,
                                'index' => $idx,
                                'step' => 'documents',
                                'button_label' => 'Upload Document',
                                'hint' => 'Required documentary attachment for this category.'
                            ];
                        }
                    }
                    $idx++;
                }
            }
        }

        $ready = count($missing_profile_fields) === 0 && count($missing_documents) === 0;

        return response()->json([
            'ready' => $ready,
            'missing_profile_fields' => array_values(array_unique($missing_profile_fields)),
            'missing_field_details' => $missing_field_details,
            'missing_documents' => $missing_documents,
            'missing_document_details' => $missing_document_details,
            'total_required_documents' => $total_required,
            'uploaded_required_documents' => $uploaded_required
        ]);
    }

    public function submitApplication(Request $request)
    {
        if ($request->user() && in_array($request->user()->role, ['super_admin', 'admin', 'staff'])) {
            return response()->json(['detail' => 'Administrative accounts cannot submit Solo Parent applications.'], 403);
        }

        $activeApp = Application::where('user_id', $request->user()->id)
            ->whereNotIn('status', ['rejected', 'expired', 'released', 'completed', 'cancelled'])
            ->first();

        if ($activeApp) {
            // If category was passed and not yet attached to application, attach it
            if ($request->category && !$activeApp->category_id) {
                $catQuery = \App\Models\Category::whereRaw('LOWER(code) = ?', [strtolower($request->category)]);
                if (Str::isUuid($request->category)) {
                    $catQuery->orWhere('id', $request->category);
                }
                $cat = $catQuery->first();
                if ($cat) {
                    $activeApp->update(['category_id' => $cat->id]);
                }
            }
            return response()->json($activeApp->load(['category', 'category.requirements']), 200);
        }

        // Enforce post-completion eligibility rule:
        // Applicants who already have a completed/released registered SPIC cannot submit a 'new' application
        $hasCompleted = Application::where('user_id', $request->user()->id)
            ->whereIn('status', ['completed', 'released'])
            ->exists();

        if ($hasCompleted) {
            return response()->json([
                'detail' => 'You already hold an official Solo Parent ID record. If your card has expired or is expiring, please apply for Renewal. If lost, select Loss of SPIC.'
            ], 422);
        }

        $refNo = 'SP-' . date('Ym') . '-' . strtoupper(Str::random(6));

        $categoryId = null;
        if ($request->category) {
            $catQuery = \App\Models\Category::whereRaw('LOWER(code) = ?', [strtolower($request->category)]);
            if (Str::isUuid($request->category)) {
                $catQuery->orWhere('id', $request->category);
            }
            $cat = $catQuery->first();
            $categoryId = $cat?->id;
        }

        $application = Application::create([
            'user_id'          => $request->user()->id,
            'reference_no'     => $refNo,
            'application_type' => 'new',
            'status'           => 'draft',
            'category_id'      => $categoryId,
        ]);

        $application->statusHistory()->create([
            'from_status' => null,
            'to_status'   => 'draft',
            'note'        => 'Application draft created by applicant.',
        ]);

        return response()->json($application->load(['category', 'category.requirements']), 201);
    }

    /**
     * POST /applications/{id}/submit-requirements
     * Applicant submits uploaded documentary requirements for CSWDD qualification review.
     */
    public function submitRequirements($id, Request $request)
    {
        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        // 1. Resolve category
        $category = $application->category;
        if (!$category && $application->category_id) {
            $category = \App\Models\Category::find($application->category_id);
        }
        if (!$category) {
            $catCode = $request->category ?? $request->category_id;
            if ($catCode) {
                $catQuery = \App\Models\Category::whereRaw('LOWER(code) = ?', [strtolower($catCode)]);
                if (Str::isUuid($catCode)) {
                    $catQuery->orWhere('id', $catCode);
                }
                $category = $catQuery->first();
                if ($category) {
                    $application->update(['category_id' => $category->id]);
                }
            }
        }

        $isRenewalOrLoss = in_array($application->application_type, ['renewal', 'loss_spic']);

        if (!$category && !$isRenewalOrLoss) {
            return response()->json(['detail' => 'Please select your solo parent category before submitting requirements.'], 422);
        }

        // 2. Validate solo parent since (ONLY FOR NEW SOLO PARENT ID APPLICATIONS)
        if (!$isRenewalOrLoss) {
            $soloParentSince = $request->solo_parent_since 
                ?? $application->form?->solo_parent_since;

            if (!$soloParentSince) {
                return response()->json(['detail' => 'Please enter the date you became a solo parent before submitting.'], 422);
            }

            // Save solo parent since to application form if needed
            $form = \App\Models\ApplicationForm::firstOrCreate(['application_id' => $application->id]);
            if (empty($form->solo_parent_since) || $form->solo_parent_since !== $soloParentSince) {
                $form->update(['solo_parent_since' => $soloParentSince]);
            }
        }

        // 3. Verify all required documents are uploaded
        if ($category) {
            $requiredReqs = $category->requirements()->where('is_required', true)->pluck('id');
            $totalRequired = $requiredReqs->count();

            if ($totalRequired > 0) {
                $uploadedCount = Document::where('application_id', $application->id)
                    ->whereIn('requirement_id', $requiredReqs)
                    ->whereNotIn('review_status', ['replaced', 'rejected'])
                    ->distinct('requirement_id')
                    ->count('requirement_id');

                if ($uploadedCount < $totalRequired) {
                    $missingCount = $totalRequired - $uploadedCount;
                    return response()->json([
                        'detail' => "Please upload all {$totalRequired} required documents before submitting for review ({$missingCount} missing).",
                    ], 422);
                }
            }
        }

        // For NEW applications: only mark documents as complete — the applicant still
        // needs to fill out the Solo Parent Application Form before final submission.
        // For renewal/loss_spic: submit directly since no full form is required.
        if (!$isRenewalOrLoss) {
            $application->update([
                'are_documents_complete' => true,
            ]);

            \App\Models\AuditLog::record($request, 'requirements.saved', 'Application', $application->id, [
                'reference_no' => $application->reference_no,
                'category'     => $category->code,
            ]);

            return response()->json([
                'message'     => 'Documentary requirements saved. Please proceed to fill out the Application Form.',
                'application' => $application->fresh(['category', 'statusHistory']),
            ]);
        }

        // Renewal / Loss of SPIC: submit directly
        $oldStatus = $application->status;
        $newStatus = 'submitted';

        $application->update([
            'status'                 => $newStatus,
            'submitted_at'           => now(),
            'are_documents_complete' => true,
            'is_form_complete'       => true,
        ]);

        $application->statusHistory()->create([
            'from_status' => $oldStatus,
            'to_status'   => $newStatus,
            'note'        => 'Documentary requirements submitted by applicant for CSWDD qualification review.',
        ]);

        \App\Models\AuditLog::record($request, 'requirements.submitted', 'Application', $application->id, [
            'reference_no' => $application->reference_no,
            'category'     => $category ? $category->code : 'N/A',
        ]);

        Notification::create([
            'user_id' => $request->user()->id,
            'type'    => 'requirements_submitted',
            'title'   => 'Requirements Submitted for Review',
            'message' => 'Your documentary requirements (Ref. ' . $application->reference_no . ') have been submitted and are now queued for review by the CSWDD Admin.',
            'link'    => '/portal/my-application?step=documents',
        ]);

        // Notify admins about requirements submission
        $user = $request->user();
        $admins = \App\Models\User::whereIn('role', ['admin', 'super_admin'])->get();
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'type'    => 'requirements_submitted',
                'title'   => 'Requirements Submitted for Review',
                'message' => "Applicant {$user->name} submitted documentary requirements for review (Ref: {$application->reference_no}).",
                'link'    => "/admin/applications/{$application->id}",
            ]);
        }

        return response()->json([
            'message'     => 'Documentary requirements submitted successfully.',
            'application' => $application->fresh(['category', 'statusHistory']),
        ]);
    }

    public function commitApplication($id, Request $request)
    {
        $application = Application::where('id', $id)
                        ->where('user_id', $request->user()->id)
                        ->firstOrFail();

        if ($application->status !== 'draft') {
            return response()->json(['detail' => 'This application is already submitted and cannot be resubmitted.'], 422);
        }

        // Final validation gate (ensuring target application ID is validated)
        $request->merge(['application_id' => $id]);
        $check = $this->submissionCheck($request)->getData(true);
        if (!$check['ready']) {
            return response()->json(['detail' => 'Submission incomplete. Please ensure all required fields and documents are completed.'], 422);
        }

        $oldStatus = $application->status;
        $application->update([
            'status'                 => 'submitted',
            'submitted_at'           => now(),
            'is_form_complete'       => true,
            'are_documents_complete' => true,
        ]);

        $application->statusHistory()->create([
            'from_status' => $oldStatus,
            'to_status'   => 'submitted',
            'note'        => 'Documentary requirements and completed Solo Parent Application Form submitted together by applicant for CSWDD review.',
            'changed_by'  => $request->user()->id,
        ]);

        // Create in-app notification for applicant
        Notification::create([
            'user_id' => $request->user()->id,
            'type'    => 'application_submitted',
            'title'   => 'Application Submitted for CSWDD Review',
            'message' => 'Your Solo Parent ID application (Ref. ' . $application->reference_no . ') has been submitted with all requirements and application form, and is now awaiting review by CSWDD.',
            'link'    => '/portal/my-application?step=status',
        ]);

        // Notify admins
        $admins = \App\Models\User::whereIn('role', ['admin', 'super_admin'])->get();
        $applicantName = $request->user()->full_name ?? $request->user()->name ?? 'Applicant';
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'type'    => 'application_submitted',
                'title'   => 'New Solo Parent Application Ready for Review',
                'message' => "Applicant {$applicantName} submitted their documentary requirements and Solo Parent Application Form for review (Ref: {$application->reference_no}).",
                'link'    => "/admin/applications/{$application->id}",
            ]);
        }

        return response()->json($application);
    }

    /**
     * POST /applications/{id}/reapply
     * Re-opens a rejected application back to draft so the applicant can update requirements or form.
     */
    public function reapplyApplication($id, Request $request)
    {
        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'rejected')
            ->firstOrFail();

        $oldStatus = $application->status;

        $application->update([
            'status'        => 'draft',
            'status_reason' => null,
            'decided_at'    => null,
        ]);

        $application->statusHistory()->create([
            'from_status' => $oldStatus,
            'to_status'   => 'draft',
            'note'        => 'Applicant initiated re-application following rejection feedback.',
            'changed_by'  => $request->user()->id,
        ]);

        \App\Models\AuditLog::record($request, 'application.reapply', 'Application', $application->id, [
            'reference_no' => $application->reference_no,
        ]);

        return response()->json([
            'message'     => 'Application is now open for updates and re-submission.',
            'application' => $application->fresh(['category', 'category.requirements', 'form']),
        ]);
    }

    /**
     * Renewal: clones the existing released/expired application into a new draft.
     */
    public function renewApplication(Request $request)
    {
        $user = $request->user();

        if ($user && in_array($user->role, ['super_admin', 'admin', 'staff'])) {
            return response()->json(['detail' => 'Administrative accounts cannot submit Solo Parent applications.'], 403);
        }

        // Check if user already has an active application in progress
        $activeApp = Application::where('user_id', $user->id)
            ->whereNotIn('status', ['rejected', 'expired', 'released', 'completed', 'cancelled'])
            ->first();

        if ($activeApp) {
            if ($activeApp->application_type === 'renewal') {
                return response()->json($activeApp, 200);
            }
            return response()->json(['detail' => 'You already have an active application in progress.'], 409);
        }


        $request->validate([
            'existing_spic_no'         => 'nullable|string|max:100',
            'previous_id_card_number'  => 'nullable|string|max:100',
            'existing_issue_date'      => 'nullable|date',
            'existing_spic_issue_date' => 'nullable|date',
            'existing_expiry_date'     => 'nullable|date',
            'existing_spic_expiry_date'=> 'nullable|date',
        ]);

        // Optional check for historical portal application (never mandatory)
        $existing = Application::where('user_id', $user->id)
            ->whereIn('status', ['released', 'completed', 'expired'])
            ->orderBy('created_at', 'desc')
            ->first();

        $renewalCategory = \App\Models\Category::where('code', 'RENEWAL')->first();
        if (!$renewalCategory) {
            return response()->json(['detail' => 'Renewal category not configured in the system.'], 500);
        }

        $refNo = 'RN-' . date('Ym') . '-' . strtoupper(Str::random(6));

        $prevIdCardNo = $request->existing_spic_no ?: ($request->previous_id_card_number ?: ($existing ? $existing->id_card_number : null));
        $issueDate    = $request->existing_issue_date ?: ($request->existing_spic_issue_date ?: ($existing ? $existing->date_issued : null));
        $expiryDate   = $request->existing_expiry_date ?: ($request->existing_spic_expiry_date ?: null);

        $renewal = Application::create([
            'user_id'                  => $user->id,
            'reference_no'             => $refNo,
            'status'                   => 'draft',
            'application_type'         => 'renewal',
            'previous_application_id'  => $existing ? $existing->id : null,
            'previous_id_card_number'  => $prevIdCardNo,
            'existing_spic_issue_date' => $issueDate,
            'existing_spic_expiry_date'=> $expiryDate,
            'category_id'              => $renewalCategory->id,
        ]);

        if ($existing && $existing->form) {
            $clonedForm = $existing->form->replicate();
            $clonedForm->application_id = $renewal->id;
            $clonedForm->save();

            if ($existing->familyMembers) {
                foreach ($existing->familyMembers as $member) {
                    $clonedMember = $member->replicate();
                    $clonedMember->application_id = $renewal->id;
                    $clonedMember->save();
                }
            }
        }

        $noteInfo = $existing 
            ? " Previous portal application: {$existing->reference_no}." 
            : ($prevIdCardNo ? " Existing SPIC: {$prevIdCardNo}." : '');

        $renewal->statusHistory()->create([
            'from_status' => null,
            'to_status'   => 'draft',
            'note'        => 'Renewal application draft created.' . $noteInfo,
            'changed_by'  => $user->id,
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type'    => 'renewal_started',
            'title'   => 'Renewal Application Started',
            'message' => 'Your Solo Parent ID renewal (Ref. ' . $refNo . ') has been started. Please upload the required documents.',
            'link'    => '/portal/my-application?step=documents',
        ]);

        return response()->json($renewal, 201);
    }

    /**
     * Loss of SPIC: Creates a new draft application specifically for replacing a lost ID.
     * Completely independent from any previous portal application.
     */
    public function lossApplication(Request $request)
    {
        $user = $request->user();

        if ($user && in_array($user->role, ['super_admin', 'admin', 'staff'])) {
            return response()->json(['detail' => 'Administrative accounts cannot submit Solo Parent applications.'], 403);
        }

        // Check if user already has an active application in progress
        $activeApp = Application::where('user_id', $user->id)
            ->whereNotIn('status', ['rejected', 'expired', 'released', 'completed', 'cancelled'])
            ->first();

        if ($activeApp) {
            if ($activeApp->application_type === 'loss_spic') {
                return response()->json($activeApp, 200);
            }
            return response()->json(['detail' => 'You already have an active application in progress.'], 409);
        }

        $request->validate([
            'existing_spic_no'  => 'nullable|string|max:100',
            'loss_circumstance' => 'nullable|string|max:2000',
        ]);

        // Optional check for historical portal application (never mandatory)
        $existing = Application::where('user_id', $user->id)
            ->whereIn('status', ['released', 'completed', 'expired'])
            ->orderBy('created_at', 'desc')
            ->first();

        $lossCategory = \App\Models\Category::where('code', 'LOSS_SPIC')->first();
        if (!$lossCategory) {
            return response()->json(['detail' => 'Loss of SPIC category not configured in the system.'], 500);
        }

        $refNo = 'LS-' . date('Ym') . '-' . strtoupper(Str::random(6));

        $prevIdCardNo = $request->existing_spic_no ?: ($existing ? $existing->id_card_number : null);

        $lossApp = Application::create([
            'user_id'                 => $user->id,
            'reference_no'            => $refNo,
            'status'                  => 'draft',
            'application_type'        => 'loss_spic',
            'previous_application_id' => $existing ? $existing->id : null,
            'previous_id_card_number' => $prevIdCardNo,
            'loss_circumstance'       => $request->loss_circumstance,
            'category_id'             => $lossCategory->id,
        ]);

        if ($existing && $existing->form) {
            $clonedForm = $existing->form->replicate();
            $clonedForm->application_id = $lossApp->id;
            $clonedForm->save();

            if ($existing->familyMembers) {
                foreach ($existing->familyMembers as $member) {
                    $clonedMember = $member->replicate();
                    $clonedMember->application_id = $lossApp->id;
                    $clonedMember->save();
                }
            }
        }

        $noteInfo = $existing 
            ? " Previous portal application: {$existing->reference_no}." 
            : ($prevIdCardNo ? " Reported lost SPIC: {$prevIdCardNo}." : '');

        $lossApp->statusHistory()->create([
            'from_status' => null,
            'to_status'   => 'draft',
            'note'        => 'Lost SPIC replacement application created.' . $noteInfo,
            'changed_by'  => $user->id,
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type'    => 'loss_spic_started',
            'title'   => 'Loss of SPIC Replacement Started',
            'message' => 'Your Lost SPIC replacement application (Ref. ' . $refNo . ') has been started. Please upload the required documents.',
            'link'    => '/portal/my-application?step=documents',
        ]);

        return response()->json($lossApp, 201);
    }

    /**
     * Cancel an active draft application permanently.
     */
    public function cancelDraft(Request $request)
    {
        $app = Application::where('user_id', $request->user()->id)
            ->where('status', 'draft')
            ->first();

        if (!$app) {
            return response()->json(['message' => 'No active draft application found.'], 404);
        }

        // Delete associated documents
        $documents = \App\Models\Document::where('application_id', $app->id)->get();
        foreach ($documents as $doc) {
            $doc->delete();
        }

        \App\Models\ApplicationForm::where('application_id', $app->id)->delete();
        $app->statusHistory()->delete();
        $app->delete();

        return response()->json(['message' => 'Draft application deleted permanently.']);
    }

    /**
     * Cancel an application (draft is hard-deleted; submitted is soft-cancelled/archived).
     */
    public function cancelApplication($id, Request $request)
    {
        $app = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if (in_array($app->status, ['completed', 'released'])) {
            return response()->json(['detail' => 'Completed applications cannot be cancelled.'], 422);
        }

        if ($app->status === 'draft') {
            $documents = \App\Models\Document::where('application_id', $app->id)->get();
            foreach ($documents as $doc) {
                $doc->delete();
            }
            \App\Models\ApplicationForm::where('application_id', $app->id)->delete();
            $app->statusHistory()->delete();
            $app->delete();

            \App\Models\AuditLog::record($request, 'application.draft_deleted', 'Application', $app->id, [
                'reference_no' => $app->reference_no,
            ]);

            return response()->json(['message' => 'Draft application cancelled and deleted.']);
        }

        // For submitted applications: soft-cancel so CSWDD retains audit history
        $oldStatus = $app->status;
        $reason = $request->reason ?: 'Applicant cancelled application to start a new service.';

        $app->update([
            'status'        => 'cancelled',
            'status_reason' => $reason,
        ]);

        $app->statusHistory()->create([
            'from_status' => $oldStatus,
            'to_status'   => 'cancelled',
            'note'        => 'Applicant cancelled: ' . $reason,
            'changed_by'  => $request->user()->id,
        ]);

        \App\Models\AuditLog::record($request, 'application.cancelled', 'Application', $app->id, [
            'reference_no' => $app->reference_no,
            'from_status'  => $oldStatus,
            'to_status'    => 'cancelled',
            'reason'       => $reason,
        ]);

        return response()->json(['message' => 'Application has been cancelled.']);
    }

    /**
     * Applicant verification step after qualification.
     */
    public function verifySubmittedInformation($id, Request $request)
    {
        $app = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if (!in_array($app->status, ['qualified', 'under_final_assessment', 'under_final_verification'])) {
            return response()->json(['detail' => 'Application is not currently awaiting applicant verification.'], 422);
        }

        $app->update([
            'applicant_verified_at' => now(),
            'status'                => 'applicant_verification',
        ]);

        $app->statusHistory()->create([
            'from_status' => 'qualified',
            'to_status'   => 'applicant_verification',
            'note'        => 'Applicant reviewed and confirmed all submitted information and documents.',
            'changed_by'  => $request->user()->id,
        ]);

        \App\Models\AuditLog::record($request, 'application.applicant_verified', 'Application', $app->id, [
            'reference_no' => $app->reference_no,
        ]);

        return response()->json([
            'message'     => 'Submitted information verified successfully.',
            'application' => $app->fresh(['category', 'category.requirements', 'form']),
        ]);
    }

    public function getApplicationDetails($id, Request $request)
    {
        $application = Application::where('id', $id)
                        ->where('user_id', $request->user()->id)
                        ->with('statusHistory')
                        ->firstOrFail();

        return response()->json($application);
    }

    // ---- Admin methods ----

    public function adminIndex(Request $request)
    {
        $query = Application::whereHas('user', function ($uq) {
            $uq->whereNotIn('role', ['super_admin', 'admin', 'staff']);
        })->with([
            'user:id,full_name,email,phone_number',
            'user.profile:id,user_id,barangay,barangay_id,contact_number',
            'user.profile.barangayRecord:id,name',
            'category:id,code,name',
            'form:id,application_id,solo_parent_since'
        ])->orderBy('created_at', 'desc');

        // Tab Handling
        $tab = $request->get('tab', 'all');

        if ($tab === 'registered') {
            // Distinct qualifying Solo Parents: get latest qualifying application ID per registered user
            $registeredAppIds = Application::whereHas('user', function ($uq) {
                    $uq->whereNotIn('role', ['super_admin', 'admin', 'staff']);
                })
                ->where(function ($q) {
                    $q->whereIn('status', [
                        'approved',
                        'ready_for_printing',
                        'ready_for_release',
                        'ready_for_pickup',
                        'released',
                        'completed'
                    ])->orWhere(function ($sub) {
                        $sub->whereNotNull('decided_at')->whereNotIn('status', ['draft', 'cancelled', 'rejected']);
                    });
                })
                ->orderBy('created_at', 'desc')
                ->get(['id', 'user_id'])
                ->unique('user_id')
                ->pluck('id');

            $query->whereIn('id', $registeredAppIds);
        } elseif ($tab === 'approved') {
            $query->where(function ($q) {
                $q->whereIn('status', [
                    'approved',
                    'ready_for_printing',
                    'ready_for_release',
                    'ready_for_pickup',
                    'released',
                    'completed'
                ])->orWhere(function ($sub) {
                    $sub->whereNotNull('decided_at')->whereNotIn('status', ['draft', 'cancelled', 'rejected']);
                });
            });
        } elseif ($tab === 'released') {
            $query->whereIn('status', ['completed', 'released']);
        }

        // Filter by 'needs_review' group (e.g. from Pending Review card or review stage filter)
        if ($request->group === 'needs_review' || $request->status === 'pending_review') {
            $query->whereIn('status', [
                'submitted', 'under_initial_review', 'document_verification',
                'pending_additional_requirements', 'under_final_assessment', 'under_final_verification',
            ]);
        } elseif ($request->has('status') && $request->status !== 'all') {
            if ($request->status === 'approved') {
                $query->where(function ($q) {
                    $q->whereIn('status', [
                        'approved',
                        'ready_for_printing',
                        'ready_for_release',
                        'ready_for_pickup',
                        'completed',
                        'released'
                    ])->orWhere(function ($sub) {
                        $sub->whereNotNull('decided_at')->whereNotIn('status', ['draft', 'cancelled', 'rejected']);
                    });
                });
            } elseif ($request->status === 'completed' || $request->status === 'released') {
                $query->whereIn('status', ['completed', 'released']);
            } else {
                $query->where('status', $request->status);
            }
        }

        // Filter by application type (check both application_type and type)
        $appType = $request->application_type ?: $request->type;
        if ($appType && $appType !== 'all') {
            $query->where('application_type', $appType);
        }

        // Filter by category
        if ($request->category && $request->category !== 'all') {
            $catVal = $request->category;
            $isUuid = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $catVal);
            
            $query->where(function ($q) use ($catVal, $isUuid) {
                if ($isUuid) {
                    $q->where('category_id', $catVal);
                } else {
                    $q->whereHas('category', function($cq) use ($catVal) {
                        $cq->whereRaw('LOWER(code) = ?', [strtolower($catVal)]);
                    });
                }
            });
        }

        $likeOp = \Illuminate\Support\Facades\DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        // Filter by barangay
        if ($request->barangay && $request->barangay !== 'all') {
            $bVal = $request->barangay;
            $isUuid = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $bVal);
            $query->whereHas('user.profile', function ($pq) use ($bVal, $isUuid, $likeOp) {
                if ($isUuid) {
                    $pq->where('barangay_id', $bVal);
                } else {
                    $pq->whereHas('barangayRecord', function ($bq) use ($bVal, $likeOp) {
                        $bq->where('name', $likeOp, "%{$bVal}%");
                    });
                }
            });
        }

        // Rich search: reference_no, ID card number, beneficiary code, applicant name, email, phone, barangay
        if ($request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s, $likeOp) {
                $q->where('reference_no', $likeOp, "%{$s}%")
                  ->orWhere('id_card_number', $likeOp, "%{$s}%")
                  ->orWhere('beneficiary_code', $likeOp, "%{$s}%")
                  ->orWhereHas('user', function ($uq) use ($s, $likeOp) {
                      $uq->where('full_name', $likeOp, "%{$s}%")
                         ->orWhere('email', $likeOp, "%{$s}%")
                         ->orWhere('phone_number', $likeOp, "%{$s}%");
                  })
                  ->orWhereHas('user.profile', function ($pq) use ($s, $likeOp) {
                      $pq->where('contact_number', $likeOp, "%{$s}%");
                  })
                  ->orWhereHas('user.profile.barangayRecord', function ($bq) use ($s, $likeOp) {
                      $bq->where('name', $likeOp, "%{$s}%");
                  });
            });
        }

        $perPage = (int) ($request->per_page ?: 25);
        $applications = $query->paginate($perPage);

        // Append waiting_days, review_stage and helpers to each item
        $applications->getCollection()->transform(function ($app) {
            $app->waiting_days = $app->submitted_at
                ? (int) now()->diffInDays($app->submitted_at)
                : 0;
            $app->applicant_name   = $app->user?->full_name;
            $app->applicant_email  = $app->user?->email;
            $app->applicant_phone  = $app->user?->phone_number ?? $app->user?->profile?->contact_number ?? null;
            $app->beneficiary_id   = $app->beneficiary_code ?: ($app->id_card_number ?: ($app->user?->profile?->beneficiary_code ?: ($app->user?->profile?->id_card_number ?: $app->reference_no)));
            $app->barangay         = $app->user?->profile?->barangayRecord?->name ?? $app->user?->profile?->barangay ?? null;
            $app->solo_parent_since= $app->form?->solo_parent_since ?? null;
            $app->review_stage     = in_array($app->status, ['submitted', 'document_verification']) ? 'initial' : (in_array($app->status, ['under_final_assessment', 'under_final_verification']) ? 'final' : ($app->status === 'under_initial_review' ? 'form_in_progress' : ($app->status === 'ready_for_pickup' ? 'pickup' : (in_array($app->status, ['completed', 'released']) ? 'released' : 'other'))));
            return $app;
        });

        return response()->json($applications);
    }

    /**
     * Valid status transitions enforced on the backend.
     * Format: 'from_status' => ['allowed_to_status_1', 'allowed_to_status_2', ...]
     */
    private const STATUS_TRANSITIONS = [
        'draft'               => ['submitted'],
        'submitted'           => ['under_review', 'under_initial_review', 'approved', 'rejected'],
        'under_review'        => ['approved', 'rejected', 'for_document_correction'],
        'under_initial_review'=> ['approved', 'rejected', 'under_review', 'for_document_correction', 'document_verification', 'under_final_assessment'],
        'document_verification' => ['approved', 'rejected', 'under_review', 'for_document_correction', 'under_final_assessment'],
        'for_document_correction' => ['under_review', 'submitted', 'rejected'],
        'under_final_assessment' => ['approved', 'rejected', 'under_review'],
        'under_final_verification' => ['approved', 'rejected', 'under_review'],
        'approved'            => ['ready_for_pickup', 'completed', 'released', 'under_review', 'rejected'],
        'rejected'            => ['under_review', 'draft'],  // reopen or re-apply
        'ready_for_pickup'    => ['completed', 'released', 'under_review', 'reopened_for_review'],
        'completed'           => ['reopened_for_review'],
        'released'            => ['reopened_for_review'],
        'reopened_for_review' => ['under_review', 'approved', 'rejected'],
        'qualified'           => ['approved', 'rejected', 'ready_for_pickup', 'under_review'],
        'cancelled'           => [],
        'expired'             => [],
    ];

    public function adminUpdateStatus($id, Request $request)
    {
        $validStatuses = array_keys(self::STATUS_TRANSITIONS);

        $request->validate([
            'status' => ['required', 'string', \Illuminate\Validation\Rule::in($validStatuses)],
            'note'   => 'nullable|string',
        ]);

        $status = $request->status;

        // Reopening or rejecting requires an explanation
        if (in_array($status, ['rejected', 'reopened_for_review']) && !$request->filled('note')) {
            return response()->json([
                'detail' => $status === 'rejected'
                    ? 'A rejection reason is mandatory when disqualifying an applicant.'
                    : 'A reason is mandatory when reopening an application for review.',
            ], 422);
        }

        $application = Application::findOrFail($id);
        $oldStatus   = $application->status;

        // Idempotency: if application is already in the requested status, safely return current state without duplicate events
        if ($oldStatus === $status) {
            return response()->json([
                'message'     => "Application is already in '{$status}' status.",
                'application' => $application->fresh(['category', 'user.profile', 'statusHistory']),
            ], 200);
        }

        // QA-P1-08: Enforce valid status transitions with fail-closed guarantee
        if (!array_key_exists($oldStatus, self::STATUS_TRANSITIONS)) {
            return response()->json([
                'detail' => "Current status '{$oldStatus}' is not recognized or does not allow transitions.",
            ], 422);
        }

        $allowedTransitions = self::STATUS_TRANSITIONS[$oldStatus];
        if (!in_array($status, $allowedTransitions)) {
            return response()->json([
                'detail' => "Cannot transition from '{$oldStatus}' to '{$status}'. Allowed transitions: " . (empty($allowedTransitions) ? 'none (terminal state)' : implode(', ', $allowedTransitions)) . '.',
            ], 422);
        }

        // Set decided_at when making a final decision
        $decisionStatuses = ['approved', 'rejected', 'qualified'];
        $releaseStatuses  = ['released', 'completed'];
        $updates = [
            'status'      => $status,
            'reviewed_by' => $request->user()->id,
        ];

        if (in_array($status, $decisionStatuses)) {
            if (empty($application->decided_at)) {
                $updates['decided_at'] = now();
            }
            if ($request->filled('note')) {
                $updates['status_reason'] = $request->note;
            }
        }
        if (in_array($status, ['qualified', 'approved'])) {
            $updates['are_documents_complete'] = true;
        }
        if (in_array($status, $releaseStatuses)) {
            if (empty($application->released_at)) {
                $updates['released_at'] = now();
            }
        }

        $adminId = $request->user()->id;
        $adminName = $request->user()->full_name ?? $request->user()->name ?? 'Administrator';

        // Atomically commit status change and status history
        DB::transaction(function () use ($application, $updates, $oldStatus, $status, $request, $adminId, $adminName) {
            $application->update($updates);

            $application->statusHistory()->create([
                'from_status'      => $oldStatus,
                'to_status'        => $status,
                'note'             => $request->note,
                'changed_by'       => $adminId,
                'changed_by_name'  => $adminName,
            ]);
        });

        // Gracefully promote any remaining temporary documents to permanent storage
        if (in_array($status, ['approved', 'released', 'completed', 'under_final_verification'])) {
            @set_time_limit(120);
            $tempDocs = \App\Models\Document::where('application_id', $application->id)
                ->whereIn('review_status', ['approved', 'verified'])
                ->where('storage_status', 'temporary')
                ->get();
            if ($tempDocs->isNotEmpty()) {
                $storage = app(\App\Services\SupabaseStorageService::class);
                foreach ($tempDocs as $doc) {
                    $storage->promoteDocumentRecord($doc);
                }
            }
        }

        // Audit log
        \App\Models\AuditLog::record($request, 'application.status_changed', 'Application', $application->id, [
            'reference_no' => $application->reference_no,
            'from_status'  => $oldStatus,
            'to_status'    => $status,
            'note'         => $request->note,
        ]);

        // Application-type-aware notification messages
        $appType = $application->application_type ?? 'new';
        $typeLabel = match ($appType) {
            'renewal'   => 'renewed Solo Parent ID',
            'loss_spic' => 'replacement Solo Parent ID',
            default     => 'Solo Parent ID',
        };

        $statusLabels = [
            'submitted'                       => 'Submitted',
            'under_review'                    => 'Under Review',
            'under_initial_review'            => 'Under Review',
            'documents_under_review'          => 'Documents Under Review',
            'for_document_correction'         => 'For Document Correction',
            'qualified'                       => 'Qualified by CSWDD',
            'applicant_verification'          => 'Applicant Verification',
            'ready_for_pickup'                => 'Ready for Pickup',
            'completed'                       => 'Completed',
            'rejected'                        => 'Application Rejected',
            'cancelled'                       => 'Cancelled',
            'reopened_for_review'             => 'Reopened for Review',
            'document_verification'           => 'Document Verification',
            'under_final_assessment'          => 'Under Final Assessment',
            'under_final_verification'        => 'Under Final Verification',
            'approved'                        => 'Approved',
            'ready_for_printing'              => 'Ready for Printing',
            'ready_for_release'               => 'Ready for Release',
            'released'                        => 'ID Released',
        ];

        $label = $statusLabels[$status] ?? ucfirst(str_replace('_', ' ', $status));

        $customMessage = match ($status) {
            'under_review', 'under_initial_review' => 'Your application (Ref. ' . $application->reference_no . ') is now being reviewed by CSWDD.',
            'approved'            => 'Your application (Ref. ' . $application->reference_no . ') has been approved by CSWDD.',
            'for_document_correction' => 'Your application (Ref. ' . $application->reference_no . ') requires document correction. Please upload the required replacement document(s).',
            'ready_for_pickup'     => 'Your ' . $typeLabel . ' (Ref. ' . $application->reference_no . ') is ready for pickup at the CSWDD Office.',
            'completed'            => 'Your ' . $typeLabel . ' transaction (Ref. ' . $application->reference_no . ') is now completed. Thank you!',
            'reopened_for_review'  => 'Your application (Ref. ' . $application->reference_no . ') was reopened for review by CSWDD. Reason: ' . ($request->note ?? 'Review update.'),
            'rejected'             => 'Your application (Ref. ' . $application->reference_no . ') was not approved. Reason: ' . ($request->note ?? 'Please contact CSWDD for details.'),
            default                => 'Your application (Ref. ' . $application->reference_no . ') status has been updated to: ' . $label . ($request->note ? '. Note: ' . $request->note : ''),
        };

        Notification::create([
            'user_id' => $application->user_id,
            'type'    => 'status_update',
            'title'   => 'Application Status: ' . $label,
            'message' => $customMessage,
            'link'    => '/portal/my-application?step=status',
        ]);

        return response()->json([
            'message'     => "Application status updated to '{$status}'.",
            'application' => $application->fresh(['category', 'user.profile', 'statusHistory']),
        ]);
    }

    /**
     * POST /admin/applications/{id}/disqualify
     * Admin marks applicant as not qualified during document/qualification review with a required reason.
     */
    public function adminDisqualify($id, Request $request)
    {
        $request->validate([
            'reason' => 'required|string|min:3|max:2000',
        ]);

        $application = Application::findOrFail($id);
        $oldStatus   = $application->status;
        $reason      = trim($request->reason);

        $application->update([
            'status'        => 'rejected',
            'status_reason' => $reason,
            'decided_at'    => now(),
            'reviewed_by'   => $request->user()->id,
        ]);

        $application->statusHistory()->create([
            'from_status' => $oldStatus,
            'to_status'   => 'rejected',
            'note'        => 'Application rejected during qualification review. Reason: ' . $reason,
            'changed_by'  => $request->user()->id,
        ]);

        // Mark unreviewed documents with rejection note
        Document::where('application_id', $application->id)
            ->whereIn('review_status', ['pending', 'submitted', 'under_review'])
            ->update([
                'review_status' => 'rejected',
                'review_note'   => $reason,
                'reviewed_by'   => $request->user()->id,
                'reviewed_at'   => now(),
            ]);

        \App\Models\AuditLog::record($request, 'application.disqualified', 'Application', $application->id, [
            'reference_no' => $application->reference_no,
            'from_status'  => $oldStatus,
            'to_status'    => 'rejected',
            'reason'       => $reason,
        ]);

        // Send clear notification to applicant with the explanation
        Notification::create([
            'user_id' => $application->user_id,
            'type'    => 'status_update',
            'title'   => 'Application Notice: Not Qualified',
            'message' => 'Your Solo Parent ID application (Ref. ' . $application->reference_no . ') was not approved during qualification review. Reason: ' . $reason,
            'link'    => '/portal/my-application?step=overview',
        ]);

        return response()->json([
            'message'     => 'Applicant marked as not qualified / rejected.',
            'application' => $application->fresh()->load('statusHistory'),
        ]);
    }

    public function adminGetApplication($id, Request $request)
    {
        $application = Application::with(['user', 'user.profile', 'statusHistory', 'category', 'form', 'familyMembers'])->findOrFail($id);

        // Get documents strictly belonging to this specific application
        $rawDocs = Document::with(['requirement'])
            ->where('application_id', $application->id)
            ->whereNotIn('review_status', ['replaced'])
            ->orderBy('created_at', 'asc')
            ->get();

        // Guarded fallback for unlinked/legacy documents: ONLY allowed for user's initial 'new' application
        // NEVER allow legacy documents from previous applications to be pulled into a Renewal or Loss review!
        if ($rawDocs->isEmpty() && ($application->application_type === 'new' || !$application->application_type)) {
            $earliestApp = Application::where('user_id', $application->user_id)->orderBy('created_at', 'asc')->first();
            if ($earliestApp && $earliestApp->id === $application->id) {
                $rawDocs = Document::with(['requirement'])
                    ->whereNull('application_id')
                    ->where('user_id', $application->user_id)
                    ->whereNotIn('review_status', ['replaced'])
                    ->orderBy('created_at', 'asc')
                    ->get();
                // Normalize legacy documents to belong to this application
                foreach ($rawDocs as $legacyDoc) {
                    $legacyDoc->update(['application_id' => $application->id]);
                }
            }
        }

        $documents = $rawDocs->map(function ($doc) {
                $arr = $doc->toArray();
                $reqName = $doc->requirement?->name ?? $doc->requirement_name ?? null;
                $arr['requirement_name'] = $reqName;
                $arr['requirement_description'] = $doc->requirement?->description ?? null;
                $arr['is_required'] = (bool) ($doc->requirement?->is_required ?? true);
                $arr['label'] = $reqName ?: $doc->original_filename;
                $arr['verification_status'] = $doc->review_status ?? 'pending';
                $arr['status'] = $doc->review_status ?? 'pending';
                $arr['review_status'] = $doc->review_status ?? 'pending';
                $arr['verification_remark'] = $doc->review_note ?? $doc->verification_remark ?? null;
                return $arr;
            });

        // Flatten for frontend convenience
        return response()->json([
            'application' => $application,
            'applicant'   => $application->user,
            'profile'     => $application->user?->profile,
            'documents'   => $documents,
            'history'     => $application->statusHistory->sortBy('created_at')->values(),
        ]);
    }

    /**
     * Admin: save official fields (case number, ID card number, etc.)
     */
    public function adminSaveOfficialFields($id, Request $request)
    {
        $application = Application::findOrFail($id);

        $allowed = [
            'case_number', 'beneficiary_code', 'id_card_number',
            'category_id', 'date_issued',
        ];

        $application->update($request->only($allowed));

        \App\Models\AuditLog::record($request, 'application.official_fields_saved', 'Application', $application->id, [
            'reference_no' => $application->reference_no,
            'fields'       => $request->only($allowed),
        ]);

        return response()->json($application->fresh());
    }

    /**
     * Manually trigger renewal reminders for expiring SPIC IDs.
     * Finds released applications whose released_at + 1 year is within 30 days,
     * creates a notification, and marks reminder as sent.
     */
    public function triggerRenewalReminders(Request $request)
    {
        $cutoff = now()->addDays(30);

        $applications = Application::where('status', 'released')
            ->where('renewal_reminder_sent', false)
            ->whereNotNull('released_at')
            ->whereRaw("(released_at + INTERVAL '1 year') <= ?", [$cutoff])
            ->get();

        $count = 0;
        foreach ($applications as $app) {
            Notification::create([
                'user_id' => $app->user_id,
                'type'    => 'renewal_reminder',
                'title'   => 'Solo Parent ID Expiring Soon',
                'message' => 'Your Solo Parent ID (Ref: ' . $app->reference_no . ') is expiring within 30 days. Please log in and renew your ID to continue enjoying your benefits.',
                'link'    => '/portal/dashboard',
                'is_read' => false,
            ]);

            $app->update(['renewal_reminder_sent' => true]);
            $count++;
        }

        \App\Models\AuditLog::record($request, 'maintenance.renewal_reminders', 'Application', null, [
            'sent' => $count,
        ]);

        return response()->json([
            'sent'    => $count,
            'message' => $count > 0
                ? "Sent {$count} renewal reminder(s)."
                : 'No expiring IDs found. All renewal reminders are up to date.',
        ]);
    }
}
