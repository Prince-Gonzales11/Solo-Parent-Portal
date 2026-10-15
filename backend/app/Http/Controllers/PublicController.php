<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\Category;
use App\Models\ResourceItem;
use App\Models\Announcement;
use App\Models\User;
use App\Models\Application;

class PublicController extends Controller
{
    public function faqs()
    {
        return response()->json([
            [
                "q" => "Who is considered a solo parent under RA 11861?",
                "a" => "A solo parent is any individual who is left alone with the responsibility of parenthood due to death of spouse, detention or conviction of spouse, physical or mental incapacity of spouse, legal or de facto separation, annulment, abandonment, being an unmarried mother/father, or any family member assuming sole parental responsibility, among other circumstances defined by law."
            ],
            [
                "q" => "What is the Solo Parent Identification Card?",
                "a" => "The Solo Parent ID is an official document issued by your city or municipal social welfare office that entitles qualified solo parents to the benefits and privileges under the Expanded Solo Parents Welfare Act."
            ],
            [
                "q" => "How long is the Solo Parent ID valid?",
                "a" => "The Solo Parent ID is generally valid for one (1) year and is renewable upon submission of updated requirements."
            ],
            [
                "q" => "What documents do I need to apply?",
                "a" => "You will typically need a valid government-issued ID, your child's birth certificate, proof of residency (e.g., barangay certificate or utility bill), and, if applicable, a certificate of indigency and supporting affidavits."
            ],
            [
                "q" => "Is there a fee to apply?",
                "a" => "The issuance of the Solo Parent ID is free of charge in accordance with the law."
            ],
            [
                "q" => "How long does processing take?",
                "a" => "Processing time varies per local government unit but the online portal lets you track every stage of your application in real time."
            ]
        ]);
    }

    public function benefits()
    {
        return response()->json([
            ["title" => "Parental Leave", "desc" => "Seven (7) working days of parental leave with pay for solo parents who have rendered at least six months of service."],
            ["title" => "Educational Assistance", "desc" => "Scholarship programs and educational benefits for solo parents and their children."],
            ["title" => "Housing Benefits", "desc" => "Priority in government housing projects and liberal terms on payment."],
            ["title" => "Medical Assistance", "desc" => "Comprehensive health and medical care programs for solo parents and their children."],
            ["title" => "10% Discount & VAT Exemption", "desc" => "On baby needs such as milk, food supplements, medicines, and diapers for children up to six (6) years old (for qualified low-income solo parents)."],
            ["title" => "Flexible Work Schedule", "desc" => "Right to a flexible work arrangement subject to employer's operational requirements."]
        ]);
    }

    public function eligibility()
    {
        return response()->json([
            "A Filipino citizen residing in the Philippines.",
            "Solely providing parental care and support to a child or children.",
            "Falls under any of the recognized solo parent categories defined in RA 11861.",
            "Registered resident of the city or municipality where the application is filed."
        ]);
    }

    public function categories()
    {
        $categories = Cache::get('public_categories_list');
        if (is_array($categories) && !empty($categories) && !isset($categories['__PHP_Incomplete_Class_Name']) && isset($categories[0]['code'])) {
            return response()->json($categories);
        }

        // Self-healing: if no active categories exist in the database, automatically seed them
        if (Category::where('is_active', true)->count() === 0) {
            (new \Database\Seeders\CategorySeeder())->run();
        }

        $categories = Category::with('requirements')
            ->where('is_active', true)
            ->orderBy('display_order')
            ->orderBy('code')
            ->get()
            ->toArray();

        Cache::put('public_categories_list', $categories, 3600);

        return response()->json($categories);
    }

    public function resources()
    {
        $resources = Cache::remember('public_resources_list', 3600, function () {
            $items = ResourceItem::where('is_active', true)
                ->orderBy('display_order')
                ->orderBy('created_at')
                ->get();
            return $items->map(function ($r) {
                    return [
                        "name" => $r->name,
                        "type" => $r->file_type,
                        "url" => $r->url,
                        "description" => $r->description
                    ];
                })->values()->toArray();
        });

        if (empty($resources)) {
            return response()->json([
                [
                    "name" => "Solo Parent Categories and Requirements",
                    "type" => "PDF",
                    "url" => "/downloads/Solo_Parent_Categories_and_Requirements.pdf",
                    "description" => "Official complete guide of recognized solo parent categories (A1 to F), specific documentary requirements, additional benefits requirements, and general reminders."
                ],
                [
                    "name" => "Solo Parent Application Form",
                    "type" => "PDF",
                    "url" => "/downloads/Solo_Parent_Application_Form.pdf",
                    "description" => "Official CSWDD application form for the Solo Parent Identification Card (SPIC)."
                ],
                [
                    "name" => "Republic Act No. 11861 – Expanded Solo Parents Welfare Act",
                    "type" => "PDF",
                    "url" => "https://www.officialgazette.gov.ph/downloads/2022/06jun/20220604-RA-11861-RRD.pdf",
                    "description" => "Full official text of Republic Act No. 11861 providing expanded benefits, discounts, leaves, and protection for solo parents."
                ]
            ]);
        }

        return response()->json($resources);
    }

    public function announcements()
    {
        $announcements = Cache::remember('public_announcements_list', 1800, function () {
            return Announcement::where('is_published', true)
                ->orderBy('published_at', 'desc')
                ->take(10)
                ->get()
                ->toArray();
        });
        return response()->json($announcements);
    }

    public function stats()
    {
        $stats = Cache::remember('public_stats_counts', 1800, function () {
            $total_registered = User::where('role', 'applicant')->count();
            $total_approved = Application::whereIn('status', ['approved', 'released'])->count();
            return [
                "registered_parents" => $total_registered,
                "ids_issued" => $total_approved
            ];
        });
        return response()->json($stats);
    }

    public function landingData()
    {
        if (Category::where('is_active', true)->count() === 0) {
            (new \Database\Seeders\CategorySeeder())->run();
            Cache::forget('public_categories_list');
            Cache::forget('public_landing_full_data');
        }

        $data = Cache::remember('public_landing_full_data', 1800, function () {
            $categories = Category::with('requirements')
                ->where('is_active', true)
                ->orderBy('display_order')
                ->orderBy('code')
                ->get()
                ->toArray();

            $total_registered = User::where('role', 'applicant')->count();
            $total_approved = Application::whereIn('status', ['approved', 'released'])->count();

            $announcements = Announcement::where('is_published', true)
                ->orderBy('published_at', 'desc')
                ->take(10)
                ->get()
                ->toArray();

            $resourceItems = ResourceItem::where('is_active', true)
                ->orderBy('display_order')
                ->orderBy('created_at')
                ->get();
            $resources = $resourceItems->isEmpty()
                ? [
                    ["name" => "Solo Parent Categories and Requirements", "type" => "PDF", "url" => "/downloads/Solo_Parent_Categories_and_Requirements.pdf", "description" => "Official complete guide of recognized solo parent categories."],
                    ["name" => "Solo Parent Application Form", "type" => "PDF", "url" => "/downloads/Solo_Parent_Application_Form.pdf", "description" => "Official CSWDD application form for the Solo Parent Identification Card."],
                    ["name" => "Republic Act No. 11861", "type" => "PDF", "url" => "https://www.officialgazette.gov.ph/downloads/2022/06jun/20220604-RA-11861-RRD.pdf", "description" => "Full official text of Republic Act No. 11861."]
                ]
                : $resourceItems->map(fn($r) => ["name" => $r->name, "type" => $r->file_type, "url" => $r->url, "description" => $r->description])->values()->toArray();

            return [
                'categories' => $categories,
                'stats' => ["registered_parents" => $total_registered, "ids_issued" => $total_approved],
                'faqs' => $this->faqs()->original,
                'benefits' => $this->benefits()->original,
                'resources' => $resources,
                'announcements' => $announcements,
            ];
        });
        return response()->json($data);
    }
}
