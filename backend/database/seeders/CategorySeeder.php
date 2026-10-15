<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    public function run()
    {
        // Default constraints for most documents
        $defaultFormats = ['.pdf', '.jpg', '.jpeg', '.png'];
        $defaultSize = 10; // MB

        $req = function($name, $desc = '', $required = true, $instructions = '') use ($defaultFormats, $defaultSize) {
            return [
                'name' => $name,
                'description' => $desc,
                'is_required' => $required,
                'formats' => $defaultFormats,
                'max_size_mb' => $defaultSize,
                'instructions' => $instructions ?: 'Please ensure the document is clear and readable.'
            ];
        };

        $commonReqs = [
            $req('Birth certificate/s of the child or children', 'Provide the PSA-issued birth certificate/s of your dependent child/children.'),
            $req('Solo Parents Orientation Seminar Certificate of Attendance', 'Provide the certificate of attendance for the Solo Parents Orientation Seminar.'),
            $req('Income Tax Return', 'Provide your latest Income Tax Return (ITR) or any verifiable proof of income.'),
        ];

        $categories = [
            [
                'code' => 'a1',
                'name' => 'Birth of a child as a consequence of rape',
                'description' => 'Solo parent due to the birth of a child as a consequence of rape, even without final conviction of the offender.',
                'display_order' => 1,
                'requirements' => [
                    $commonReqs[0],
                    $req('Complaint affidavit', 'A copy of the sworn complaint affidavit.'),
                    $req('Medical record on the incident of rape', 'Official medical records regarding the incident.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent has the sole parental care and support of the child or children at the time of the execution of affidavit.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, only the sworn affidavit shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'a2',
                'name' => 'Widow or Widower',
                'description' => 'Solo parent due to death of spouse.',
                'display_order' => 2,
                'requirements' => [
                    $commonReqs[0],
                    $req('Marriage certificate', 'PSA-issued Marriage Certificate.'),
                    $req('Death certificate of the spouse', 'PSA-issued Death Certificate of the deceased spouse.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent, and has the sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, only the sworn affidavit shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'a3',
                'name' => 'Spouse of person deprived of liberty',
                'description' => 'Solo parent due to detention or criminal conviction of spouse.',
                'display_order' => 3,
                'requirements' => [
                    $commonReqs[0],
                    $req('Marriage certificate', 'PSA-issued Marriage Certificate.'),
                    $req('Certificate of detention or certification', 'Certificate of detention or a certification that the spouse is serving sentence for at least three (3) months issued by the law-enforcement agency having actual custody or commitment order by the court.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent, and has the sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, requirement numbers (3) and (4) shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'a4',
                'name' => 'Spouse of person with physical or mental incapacity',
                'description' => 'Solo parent due to physical or mental incapacity of spouse as certified by a public medical practitioner.',
                'display_order' => 4,
                'requirements' => [
                    $commonReqs[0],
                    $req('Marriage certificate or affidavit of cohabitation', 'PSA-issued Marriage Certificate or Affidavit of Cohabitation.'),
                    $req('Medical records or certificate of confinement', 'Medical records, medical abstract, or a certificate of confinement in the National Center for Mental Health or any medical hospital/facility.', true, 'Must have been issued not more than three (3) months before the submission, or a valid PWD ID.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit that the solo parent is not cohabiting with a partner or co-parent and has sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, requirement numbers (3) and (4) shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                ] // PDF doesn't explicitly list Income Tax Return for A4.
            ],
            [
                'code' => 'a5',
                'name' => 'Due to legal separation or de facto separation',
                'description' => 'Solo parent due to legal separation or de facto separation from spouse for at least six (6) months.',
                'display_order' => 5,
                'requirements' => [
                    $commonReqs[0],
                    $req('Marriage certificate', 'PSA-issued Marriage Certificate.'),
                    $req('Judicial decree of legal separation or affidavit of 2 disinterested persons', 'Judicial decree of legal separation of the spouses or, in the case of de facto separation, an affidavit of two (2) disinterested persons attesting to the fact of separation.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent, and has sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, requirement numbers (3) and (4) shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'a6',
                'name' => 'Due to nullity or annulment of marriage',
                'description' => 'Solo parent due to declaration of nullity or annulment of marriage.',
                'display_order' => 6,
                'requirements' => [
                    $commonReqs[0],
                    $req('Marriage certificate', 'Marriage certificate, annotated with the fact of declaration of nullity of marriage or annulment of marriage.'),
                    $req('Judicial decree of nullity or annulment', 'Judicial decree of nullity or annulment of marriage or judicial recognition of foreign divorce.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent and has sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, only the sworn affidavit shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'a7',
                'name' => 'Abandonment by the spouse',
                'description' => 'Solo parent due to abandonment by the spouse for at least six (6) months.',
                'display_order' => 7,
                'requirements' => [
                    $commonReqs[0],
                    $req('Marriage certificates or affidavit of the applicant', 'Marriage certificates or affidavit of the applicant solo parent.'),
                    $req('Affidavit of two (2) disinterested persons', 'Affidavit of two (2) disinterested persons attesting to the fact of abandonment of the spouse.'),
                    $req('Police or barangay record', 'Police or barangay record of the fact of abandonment.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent, and has sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, only sworn affidavit shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'b1',
                'name' => 'Spouse of OFW',
                'description' => 'Spouse or any family member of an Overseas Filipino Worker (OFW).',
                'display_order' => 8,
                'requirements' => [
                    $req('Birth certificate/s of dependents', 'Birth certificate/s of dependents.'),
                    $req('Marriage certificate or proof of relationship', 'Marriage certificate, if the applicant is the spouse of the OFW, or birth certificate or other competent proof of the relationship between the applicant and the OFW, if a family member.'),
                    $req('POEA-SEC or equivalent document', 'Philippine Overseas Employment Administration Standard Employment Contract (POEA-SEC) or its equivalent document.'),
                    $req('Photocopy of the OFW\'s passport', 'Photocopy of the OFW\'s passport with stamps showing continuous twelve (12) months of overseas work, or a certification from the Bureau of Immigration.'),
                    $req('Proof of income', 'Proof of income of the OFW\'s spouse or family member.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent and has sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, requirement numbers (3), (4), (5), and (6) shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'b2',
                'name' => 'Relative of OFW',
                'description' => 'Any family member of an Overseas Filipino Worker (OFW) assuming sole parental care.',
                'display_order' => 9,
                'requirements' => [
                    $req('Birth certificate/s of dependents', 'Birth certificate/s of dependents.'),
                    $req('Birth certificate or proof of relationship', 'Birth certificate or other competent proof of the relationship between the applicant and the OFW.'),
                    $req('POEA-SEC or equivalent document', 'Philippine Overseas Employment Administration Standard Employment Contract (POEA-SEC) or its equivalent document.'),
                    $req('Photocopy of the OFW\'s passport', 'Photocopy of the OFW\'s passport with stamps showing continuous twelve (12) months of overseas work, or a certification from the Bureau of Immigration.'),
                    $req('Proof of income', 'Proof of income of the family member.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent and has sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, requirement numbers (3), (4), (5), and (6) shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'c',
                'name' => 'Unmarried person',
                'description' => 'Unmarried mother or father who has kept and reared the child/children.',
                'display_order' => 10,
                'requirements' => [
                    $commonReqs[0],
                    $req('Certificate of No Marriage (CENOMAR)', 'PSA-issued Certificate of No Marriage (CENOMAR).'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent and has sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, requirement numbers (2), (3) and (4) shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'd',
                'name' => 'Legal guardian / Adoptive parent / Foster parent',
                'description' => 'Any legal guardian, adoptive or foster parent who solely provides parental care and support to a child.',
                'display_order' => 11,
                'requirements' => [
                    $commonReqs[0],
                    $req('Proof of guardianship, adoption, or foster care', 'Proof of guardianship issued by a court; proof of adoption issued by DSWD/NACC; or Foster Parent License.'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent and has sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, requirement numbers (3) and (4) shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'e',
                'name' => 'Relative within the fourth civil degree',
                'description' => 'Any relative within the fourth (4th) civil degree of consanguinity or affinity assuming sole parental care.',
                'display_order' => 12,
                'requirements' => [
                    $commonReqs[0],
                    $req('Death certificate, certificate of incapacity, or judicial declaration of absence', 'Death certificate, certificate of incapacity, or judicial declaration of absence of the parents or legal guardian; police/barangay records evidencing disappearance for at least 6 months.'),
                    $req('Proof of relationship', 'Proof of relationship of the relative to the parent or legal guardian (birth certificate, marriage certificate, family records, etc.).'),
                    $req('Sworn affidavit declaring sole parental care', 'Sworn affidavit declaring that the solo parent has sole parental care and support of the child or children.', true, 'Note: For purposes of issuance of subsequent SPIC and booklet, requirement numbers (3) and (4) shall be submitted every year.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay and that the child or children is/are under the parental care and support of the solo parent.'),
                    $commonReqs[1],
                    $commonReqs[2],
                ]
            ],
            [
                'code' => 'f',
                'name' => 'Pregnant woman',
                'description' => 'A pregnant woman who provides sole parental care and support to her unborn child or children.',
                'display_order' => 13,
                'requirements' => [
                    $req('Medical record of her pregnancy', 'Official medical record or certificate of pregnancy.'),
                    $req('Affidavit of a barangay official', 'Affidavit of a barangay official attesting that the solo parent is a resident of the barangay.'),
                    $req('Sworn affidavit', 'Sworn affidavit declaring that the solo parent is not cohabiting with a partner or co-parent who is providing support to the pregnant woman.'),
                    $commonReqs[1],
                ]
            ],
        ];

        foreach ($categories as $cat) {
            $category = Category::where('code', $cat['code'])->first();
            if (!$category) {
                $category = Category::create([
                    'id' => (string) \Illuminate\Support\Str::uuid(),
                    'code' => $cat['code'],
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'display_order' => $cat['display_order'],
                    'is_active' => true,
                ]);
            } else {
                $category->update([
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'display_order' => $cat['display_order'],
                    'is_active' => true,
                ]);
            }

            foreach ($cat['requirements'] as $reqData) {
                $req = \App\Models\DocumentaryRequirement::where('category_id', $category->id)
                    ->where('name', $reqData['name'])
                    ->first();

                if (!$req) {
                    \App\Models\DocumentaryRequirement::create([
                        'id' => (string) \Illuminate\Support\Str::uuid(),
                        'category_id' => $category->id,
                        'name' => $reqData['name'],
                        'description' => $reqData['description'] ?? null,
                        'is_required' => $reqData['is_required'] ?? true,
                    ]);
                } else {
                    $req->update([
                        'description' => $reqData['description'] ?? null,
                        'is_required' => $reqData['is_required'] ?? true,
                    ]);
                }
            }
        }

        \Illuminate\Support\Facades\Cache::forget('public_categories_list');
    }
}
