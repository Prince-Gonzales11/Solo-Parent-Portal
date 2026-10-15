<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\ApplicantProfile;
use App\Models\Application;
use App\Models\Category;
use App\Models\Announcement;
use App\Models\Notification;
use App\Models\Document;

class PortalController extends Controller
{
    /**
     * Consolidated bootstrap summary for the applicant dashboard.
     * Consolidates 6 separate API calls into a single lightning-fast roundtrip.
     */
    public function dashboardSummary(Request $request)
    {
        $user = $request->user();

        // 1. Get profile & latest application
        $profile = ApplicantProfile::where('user_id', $user->id)->first();
        
        $activeApp = Application::where('user_id', $user->id)
            ->whereNotIn('status', ['rejected', 'expired', 'released', 'completed', 'cancelled'])
            ->with(['form', 'familyMembers', 'category'])
            ->orderBy('created_at', 'desc')
            ->first();

        // If no active in-progress application, get latest application (for completed / historical overview)
        $displayApp = $activeApp ?: Application::where('user_id', $user->id)
            ->with(['form', 'familyMembers', 'category'])
            ->orderBy('created_at', 'desc')
            ->first();

        // 2. Compute completion
        $sections = $this->buildSections($profile, $displayApp?->form, $displayApp);
        $completed = collect($sections)->where('complete', true)->count();
        $total = count($sections);
        $pct = $total > 0 ? (int) round(($completed / $total) * 100) : 0;

        $completion = [
            'percentage'  => $pct,
            'is_complete' => $pct >= 100,
            'sections'    => $sections,
        ];

        // 3. Document count (active docs)
        $activeDocCount = Document::where('user_id', $user->id)
            ->where('review_status', '!=', 'replaced')
            ->count();

        // 4. Notifications (latest 5 unread) + unread count
        $unreadCount = Notification::where('user_id', $user->id)
            ->where('is_read', false)
            ->count();

        $recentNotifications = Notification::where('user_id', $user->id)
            ->where('is_read', false)
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get();

        // 5. Cached public categories and announcements
        $categories = Cache::remember('public_categories_list', 3600, function () {
            return Category::with('requirements')
                ->where('is_active', true)
                ->orderBy('display_order')
                ->orderBy('code')
                ->get()
                ->toArray();
        });

        $announcements = Cache::remember('public_announcements_list', 1800, function () {
            return Announcement::where('is_published', true)
                ->orderBy('published_at', 'desc')
                ->take(5)
                ->get();
        });

        $documentsApproved = false;
        if ($displayApp) {
            $category = $displayApp->category;
            if ($category) {
                $requiredReqs = $category->requirements()->where('is_required', true)->pluck('id');
                $totalRequired = $requiredReqs->count();
                if ($totalRequired > 0) {
                    $approvedCount = Document::where('application_id', $displayApp->id)
                        ->whereIn('requirement_id', $requiredReqs)
                        ->whereIn('review_status', ['approved', 'verified'])
                        ->distinct('requirement_id')
                        ->count('requirement_id');
                    $documentsApproved = ($approvedCount >= $totalRequired);
                } else {
                    $documentsApproved = true;
                }
            }
            if ($displayApp->are_documents_complete && in_array($displayApp->status, [
                'under_initial_review', 'document_verification', 'under_final_assessment',
                'under_final_verification', 'approved', 'ready_for_printing', 'ready_for_release',
                'ready_for_pickup', 'released', 'completed'
            ])) {
                $documentsApproved = true;
            }
        }

        return response()->json([
            'completion'         => $completion,
            'application'        => $displayApp,
            'all_applications'   => Application::where('user_id', $user->id)->with('category')->orderBy('created_at', 'desc')->get(),
            'is_active'          => ($activeApp !== null),
            'documents_approved' => $documentsApproved,
            'rejection_reason'   => $displayApp?->status === 'rejected' ? $displayApp?->status_reason : null,
            'announcements'      => $announcements,
            'categories'         => $categories,
            'notifications'      => $recentNotifications,
            'unread_count'       => $unreadCount,
            'doc_info'           => [
                'uploaded' => $activeDocCount,
                'required' => 0
            ]
        ]);
    }

    private function buildSections($p, $f, $app)
    {
        $hasMembers = $app && $app->familyMembers && $app->familyMembers->count() > 0;
        return [
            [
                'key' => 'personal',
                'label' => 'Personal Information',
                'complete' => (bool) ($p && $p->first_name && $p->last_name && $p->birth_date && $p->sex && $p->contact_number && $p->city_municipality),
            ],
            [
                'key' => 'household',
                'label' => 'Household Composition',
                'complete' => (bool) ($hasMembers || ($f && $f->num_children > 0)),
            ],
            [
                'key' => 'solo_parent',
                'label' => 'Solo Parent Category',
                'complete' => (bool) ($app && $app->category_id && $f && $f->solo_parent_since),
            ],
            [
                'key' => 'needs',
                'label' => 'Needs & Problems',
                'complete' => (bool) ($f && !empty(trim($f->needs_problems ?? ''))),
            ],
            [
                'key' => 'emergency',
                'label' => 'Emergency Contact',
                'complete' => (bool) ($f && $f->emergency_contact_name && $f->emergency_contact_number),
            ],
        ];
    }
}
