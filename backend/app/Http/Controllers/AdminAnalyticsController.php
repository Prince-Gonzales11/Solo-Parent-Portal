<?php

namespace App\Http\Controllers;

use App\Models\Application;
use App\Models\ApplicantProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminAnalyticsController extends Controller
{
    /**
     * Overview KPIs: counts per status, near expiry, totals.
     */
    public function overview(Request $request)
    {
        $applicantUserScope = function ($uq) {
            $uq->whereNotIn('role', ['super_admin', 'admin', 'staff']);
        };

        $baseApps = Application::whereHas('user', $applicantUserScope);

        $byStatus = (clone $baseApps)->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $totalUsers = User::where('role', 'applicant')->count();

        // Only count as registered solo parents after final approval / release / completion (distinct qualifying people)
        $totalRegistered = (clone $baseApps)->where(function ($q) {
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
        })->distinct('user_id')->count('user_id');

        // Approved applications milestone count: distinct applications that have been officially approved
        $approvedCount = (clone $baseApps)->where(function ($query) {
            $query->whereIn('status', [
                'approved',
                'ready_for_printing',
                'ready_for_release',
                'ready_for_pickup',
                'released',
                'completed'
            ])->orWhere(function ($q) {
                $q->whereNotNull('decided_at')->whereNotIn('status', ['draft', 'rejected', 'cancelled']);
            });
        })->count();

        // Released IDs milestone count: distinct applications where the ID was physically claimed and marked completed / released
        $releasedCount = (clone $baseApps)->whereIn('status', ['completed', 'released'])->count();

        // Applications submitted within the last 30 days whose released_at is within 30 days from now
        $nearExpiry = (clone $baseApps)->whereIn('status', ['released', 'completed'])
            ->where('renewal_reminder_sent', false)
            ->whereNotNull('released_at')
            ->where('released_at', '>=', now()->subYear()->addDays(335))
            ->count();

        $initialReviews = (clone $baseApps)->whereIn('status', [
            'submitted',
            'document_verification',
            'pending_additional_requirements',
            'under_initial_review',
        ])->count();

        $finalReviews = (clone $baseApps)->whereIn('status', [
            'under_final_assessment',
            'under_final_verification',
        ])->count();

        $needsReview = $initialReviews + $finalReviews;

        $renewalCount = (clone $baseApps)->where('application_type', 'renewal')
            ->whereNotIn('status', ['rejected', 'expired'])
            ->count();

        return response()->json([
            'total_applications'    => (clone $baseApps)->count(),
            'total_registered'      => $totalRegistered,
            'total_users'           => $totalUsers,
            'approved_count'        => $approvedCount,
            'released_count'        => $releasedCount,
            'by_status'             => $byStatus,
            'needs_review_count'    => $needsReview,
            'pending_reviews'       => $needsReview,
            'initial_review_count'  => $initialReviews,
            'final_review_count'    => $finalReviews,
            'near_expiry_count'     => $nearExpiry,
            'active_renewals'       => $renewalCount,
        ]);
    }

    /**
     * Demographic breakdowns: gender, age group, barangay, category, civil_status, employment.
     */
    public function demographics(Request $request)
    {
        $base = ApplicantProfile::query();

        // Optional barangay filter
        if ($request->barangay) {
            $base->where('barangay', $request->barangay);
        }

        // Gender distribution
        $byGender = (clone $base)->select('sex', DB::raw('count(*) as count'))
            ->whereNotNull('sex')
            ->groupBy('sex')
            ->pluck('count', 'sex');

        // Category distribution (from Application)
        $byCategory = Application::select('categories.code', DB::raw('count(*) as count'))
            ->join('solo_parent_categories as categories', 'applications.category_id', '=', 'categories.id')
            ->whereNotNull('applications.category_id')
            ->groupBy('categories.code')
            ->orderByDesc('count')
            ->pluck('count', 'code');

        // Barangay distribution (top 15)
        $byBarangay = (clone $base)->select('barangay', DB::raw('count(*) as count'))
            ->whereNotNull('barangay')
            ->groupBy('barangay')
            ->orderByDesc('count')
            ->limit(15)
            ->pluck('count', 'barangay');

        // Civil status (from ApplicationForm)
        $byCivilStatus = \App\Models\ApplicationForm::select('civil_status', DB::raw('count(*) as count'))
            ->whereNotNull('civil_status')
            ->groupBy('civil_status')
            ->pluck('count', 'civil_status');

        // Employment status (from ApplicationForm)
        $byEmployment = \App\Models\ApplicationForm::select('employment_status', DB::raw('count(*) as count'))
            ->whereNotNull('employment_status')
            ->groupBy('employment_status')
            ->pluck('count', 'employment_status');

        // Age group distribution — computed in DB using Postgres age()
        $ageGroupsRaw = (clone $base)->whereNotNull('birth_date')
            ->select(DB::raw("
                CASE 
                    WHEN EXTRACT(YEAR FROM age(CAST(birth_date AS date))) < 18 THEN 'Under 18'
                    WHEN EXTRACT(YEAR FROM age(CAST(birth_date AS date))) BETWEEN 18 AND 24 THEN '18–24'
                    WHEN EXTRACT(YEAR FROM age(CAST(birth_date AS date))) BETWEEN 25 AND 34 THEN '25–34'
                    WHEN EXTRACT(YEAR FROM age(CAST(birth_date AS date))) BETWEEN 35 AND 44 THEN '35–44'
                    WHEN EXTRACT(YEAR FROM age(CAST(birth_date AS date))) BETWEEN 45 AND 54 THEN '45–54'
                    WHEN EXTRACT(YEAR FROM age(CAST(birth_date AS date))) BETWEEN 55 AND 64 THEN '55–64'
                    ELSE '65+' 
                END as age_group
            "), DB::raw('count(*) as count'))
            ->groupBy('age_group')
            ->pluck('count', 'age_group')
            ->toArray();

        $ageGroups = ['Under 18' => 0, '18–24' => 0, '25–34' => 0, '35–44' => 0, '45–54' => 0, '55–64' => 0, '65+' => 0];
        foreach ($ageGroupsRaw as $group => $count) {
            if (array_key_exists($group, $ageGroups)) {
                $ageGroups[$group] = $count;
            }
        }

        return response()->json([
            'by_gender'        => $byGender,
            'by_category'      => $byCategory,
            'by_barangay'      => $byBarangay,
            'by_civil_status'  => $byCivilStatus,
            'by_employment'    => $byEmployment,
            'by_age_group'     => $ageGroups,
        ]);
    }

    /**
     * Application trends over time — supports period: daily, weekly, monthly, yearly.
     */
    public function trends(Request $request)
    {
        $period   = $request->get('period', 'monthly');
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');

        $query = Application::whereNotNull('submitted_at');

        if ($dateFrom) $query->where('submitted_at', '>=', $dateFrom . ' 00:00:00');
        if ($dateTo)   $query->where('submitted_at', '<=', $dateTo . ' 23:59:59');

        $format = match ($period) {
            'daily'   => 'YYYY-MM-DD',
            'weekly'  => 'IYYY-IW',
            'yearly'  => 'YYYY',
            default   => 'YYYY-MM',    // monthly
        };

        $trends = $query
            ->select(DB::raw("TO_CHAR(submitted_at, '{$format}') as period"), DB::raw('count(*) as count'))
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        // Also separate new vs renewal for the same period
        $renewalTrends = (clone $query)
            ->where('application_type', 'renewal')
            ->select(DB::raw("TO_CHAR(submitted_at, '{$format}') as period"), DB::raw('count(*) as count'))
            ->groupBy('period')
            ->orderBy('period')
            ->pluck('count', 'period');

        return response()->json([
            'trends'          => $trends,
            'renewal_by_period' => $renewalTrends,
        ]);
    }
}
