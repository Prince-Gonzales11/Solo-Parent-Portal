<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\User;
use App\Models\ApplicantProfile;
use App\Models\Application;
use App\Models\Document;
use Carbon\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\DB;
use setasign\Fpdi\Fpdi;

class PdfController extends Controller
{
    private function getBase64Image($path)
    {
        if (File::exists($path)) {
            $type = pathinfo($path, PATHINFO_EXTENSION);
            $data = File::get($path);
            return 'data:image/' . $type . ';base64,' . base64_encode($data);
        }
        return null;
    }

    private function getPdfData($user_id, $application_id = null)
    {
        $user = User::findOrFail($user_id);
        $profile = ApplicantProfile::where('user_id', $user_id)->first();
        $application = null;
        if ($application_id) {
            $application = Application::where('id', $application_id)->where('user_id', $user_id)->first();
        }
        if (!$application) {
            // fallback
            $application = Application::where('user_id', $user_id)->orderBy('created_at', 'desc')->first();
            if (!$application) {
                // mock one
                $application = new Application(['reference_no' => 'N/A']);
            }
        }

        // Load form data so blade template can access extended fields
        $application->load(['form', 'familyMembers', 'category']);
        $form = $application->form;

        $full_name = '';
        if ($profile) {
            $parts = array_filter([$profile->first_name, $profile->middle_name, $profile->last_name, $profile->suffix]);
            $full_name = implode(' ', $parts);
        }
        if (!$full_name) {
            $full_name = $user->full_name;
        }

        $dob_display = '';
        if ($profile && $profile->birth_date) {
            try {
                $dob = Carbon::parse($profile->birth_date);
                $age = $dob->age;
                $dob_display = $profile->birth_date . ' (Age: ' . $age . ')';
            } catch (\Exception $e) {
                $dob_display = $profile->birth_date;
            }
        }

        $address = '';
        if ($profile) {
            $barangayName = $profile->barangayRecord?->name ?? $profile->barangay ?? '';
            $parts = array_filter([
                $profile->house_no, $profile->street, $barangayName,
                $profile->city_municipality, $profile->province, 
                $profile->region, $profile->zip_code
            ]);
            $address = implode(', ', $parts);
        }

        $date_str = $application->submitted_at 
            ? Carbon::parse($application->submitted_at)->format('F d, Y') 
            : now()->format('F d, Y');

        $status_mark = 'New';
        if ($application->status == 'rejected') $status_mark = 'Disapproved';
        elseif ($application->status == 'expired') $status_mark = 'Terminated';
        elseif ($application->is_renewal) $status_mark = 'Renewal';

        $cat = $application->category?->code ?? $application->category_id;

        $date_issued = $application->date_issued ? Carbon::parse($application->date_issued)->format('M d, Y') : null;
        $valid_until = '';
        if ($application->date_issued) {
            try {
                $valid_until = Carbon::parse($application->date_issued)->addYear()->format('M d, Y');
            } catch (\Exception $e) { }
        }

        $assets_path = base_path('../frontend/public/images');

        // Build a unified profile object that merges ApplicantProfile + ApplicationForm
        // This allows the blade template to use $profile->field for all fields
        $mergedProfile = new \stdClass();
        if ($profile) {
            foreach ($profile->toArray() as $key => $value) {
                $mergedProfile->{$key} = $value;
            }
        }
        // Override/add form fields
        $formFields = [
            'philsys_card_number', 'place_of_birth', 'civil_status', 'religion',
            'nationality', 'educational_attainment', 'occupation', 'employment_status',
            'employer_name', 'company_agency', 'monthly_income',
            'is_indigent', 'is_4ps_beneficiary', 'household_id_4ps',
            'is_indigenous', 'indigenous_affiliation', 'is_lgbtqia', 'is_pwd',
            'solo_parent_since', 'classification_details', 'needs_problems',
            'emergency_contact_name', 'emergency_contact_relationship',
            'emergency_contact_address', 'emergency_contact_number',
            'signature_data'
        ];
        foreach ($formFields as $field) {
            $mergedProfile->{$field} = $form?->{$field} ?? null;
        }
        // Set solo_parent_classification from classification_details
        $mergedProfile->solo_parent_classification = $form?->classification_details ?? '';
        // Build household_members from familyMembers relationship
        $mergedProfile->household_members = ($application->familyMembers ?? collect())->map(function ($m) {
            return [
                'name' => $m->name ?? '',
                'sex' => '',
                'relationship' => $m->relationship ?? '',
                'age' => $m->age !== null ? (string) $m->age : '',
                'birthdate' => $m->date_of_birth ? $m->date_of_birth->format('m/d/Y') : '',
                'civil_status' => $m->civil_status ?? '',
                'educational_attainment' => $m->educational_attainment ?? '',
                'occupation' => '',
                'monthly_income' => $m->monthly_income ?? '',
            ];
        })->toArray();

        return compact(
            'user', 'application', 'full_name', 'dob_display', 
            'address', 'date_str', 'status_mark', 'cat', 'date_issued', 'valid_until'
        ) + [
            'profile' => $mergedProfile,
            'butuan_seal' => $this->getBase64Image($assets_path . '/seal.gif'),
            'cswdd_logo' => $this->getBase64Image($assets_path . '/cswdd.jpg'),
        ];
    }

    /**
     * Generate the Solo Parent Application Form PDF using the official CSWDD template.
     *
     * Uses FPDI to import the official PDF as a background and overlays applicant
     * data at the correct coordinates. This preserves the exact visual layout of
     * the official form.
     */
    public function generateApplicationForm(Request $request, $id = null)
    {
        $userId = $request->user()->id;

        // ── 1. Load application with all required relationships ──
        $query = Application::with(['form', 'familyMembers', 'category'])
            ->where('user_id', $userId);

        if ($id) {
            $query->where('id', $id);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $application = $query->first();

        if (!$application) {
            abort(404, 'Application not found.');
        }

        // Verify ownership
        if ($application->user_id !== $userId) {
            abort(403, 'Unauthorized.');
        }

        $user = User::findOrFail($userId);
        $profile = ApplicantProfile::where('user_id', $userId)->with('barangayRecord')->first();
        $form = $application->form;

        if (!$form) {
            $prevApp = $application->previousApplication 
                ?: Application::where('user_id', $userId)->where('id', '!=', $application->id)->whereHas('form')->latest()->first();
            $form = $prevApp?->form;
        }

        if (!$application->relationLoaded('familyMembers') || $application->familyMembers->isEmpty()) {
            $prevAppWithMembers = $application->previousApplication 
                ?: Application::where('user_id', $userId)->where('id', '!=', $application->id)->whereHas('familyMembers')->latest()->first();
            if ($prevAppWithMembers && $prevAppWithMembers->familyMembers->isNotEmpty()) {
                $application->setRelation('familyMembers', $prevAppWithMembers->familyMembers);
            }
        }

        $category = $application->category;

        // ── 2. Build unified PDF data ──
        $data = $this->buildApplicationFormData($user, $profile, $form, $application, $category);

        // ── 3. Import official PDF template (FIRST PAGE ONLY) ──
        $templatePath = resource_path('pdf-templates/solo_parent_application_form.pdf');

        if (!File::exists($templatePath)) {
            abort(500, 'Official PDF template not found.');
        }

        $pdf = new Fpdi('P', 'mm', [210, 297]);
        $pdf->SetAutoPageBreak(false);
        $pdf->SetMargins(0, 0, 0);

        $pdf->setSourceFile($templatePath);

        // Import ONLY page 1 as background
        $tplId = $pdf->importPage(1);
        $size = $pdf->getTemplateSize($tplId);
        $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
        $pdf->useTemplate($tplId, 0, 0, $size['width'], $size['height']);

        // ── 4. Overlay applicant data onto page 1 ──
        $this->overlayApplicationData($pdf, $data);

        // ── 5. Generate continuation page for overflow household members ──
        if (!empty($data['household_overflow'])) {
            $this->addHouseholdContinuationPage($pdf, $data);
        }

        // ── 6. Return PDF ──
        $refNo = $application->reference_no ?: 'form';
        $filename = 'Solo-Parent-Application-' . $refNo . '.pdf';

        return response($pdf->Output('S', $filename), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Build a clean, unified data structure for the PDF overlay.
     */
    private function buildApplicationFormData($user, $profile, $form, $application, $category)
    {
        // ── Full name ──
        $nameParts = array_filter([
            $profile?->first_name,
            $profile?->middle_name,
            $profile?->last_name,
            $profile?->suffix,
        ]);
        $fullName = implode(' ', $nameParts) ?: ($user->full_name ?? '');

        // ── Date of birth + age ──
        $dobDisplay = '';
        $age = '';
        if ($profile?->birth_date) {
            try {
                $dob = Carbon::parse($profile->birth_date);
                $age = (string) $dob->age;
                $dobDisplay = $dob->format('F d, Y');
            } catch (\Exception $e) {
                $dobDisplay = $profile->birth_date;
            }
        }

        // ── Address ──
        $barangayName = $profile?->barangayRecord?->name ?? $profile?->barangay ?? '';
        $addressParts = array_filter([
            $profile?->house_no,
            $profile?->street,
            $barangayName,
            $profile?->city_municipality,
            $profile?->province,
            $profile?->region,
            $profile?->zip_code,
        ]);
        $address = implode(', ', $addressParts);

        // ── Category ──
        $categoryCode = $category?->code ?? '';
        $categoryName = $category?->name ?? '';
        $categoryDisplay = '';
        if ($categoryCode && $categoryName) {
            $categoryDisplay = $categoryCode . ' - ' . $categoryName;
        } elseif ($categoryName) {
            $categoryDisplay = $categoryName;
        }

        // ── Status mapping to official form checkboxes ──
        $statusMark = 'New';
        if ($application->status === 'rejected') {
            $statusMark = 'Disapproved';
        } elseif ($application->status === 'expired') {
            $statusMark = 'Terminated';
        } elseif ($application->application_type === 'renewal') {
            $statusMark = 'Renewal';
        }

        // ── Date ──
        $dateStr = '';
        if ($application->submitted_at) {
            $dateStr = Carbon::parse($application->submitted_at)->format('F d, Y');
        }

        // ── Household members ──
        // The official form table has approximately 5 blank data rows
        $maxMainRows = 5;
        $allMembers = ($application->familyMembers ?? collect())->map(function ($m) {
            return [
                'name' => $m->name ?? '',
                'sex' => '',
                'relationship' => $m->relationship ?? '',
                'age' => $m->age !== null ? (string) $m->age : '',
                'birthdate' => $m->date_of_birth ? $m->date_of_birth->format('m/d/Y') : '',
                'civil_status' => $m->civil_status ?? '',
                'educational_attainment' => $m->educational_attainment ?? '',
                'occupation' => '',
                'monthly_income' => $m->monthly_income ?? '',
            ];
        })->toArray();

        return [
            // Reference
            'reference_no'   => $application->reference_no ?? '',
            'case_number'    => $application->case_number ?? '',

            // Section I: Identifying Information
            'full_name'               => $fullName,
            'dob_display'             => $dobDisplay,
            'age'                     => $age,
            'place_of_birth'          => !empty($form?->place_of_birth) ? $form->place_of_birth : 'Butuan City',
            'philsys_card_number'     => !empty($form?->philsys_card_number) ? $form->philsys_card_number : 'N/A',
            'sex'                     => !empty($profile?->sex) ? $profile->sex : 'N/A',
            'civil_status'            => !empty($form?->civil_status) ? $form->civil_status : 'Single',
            'religion'                => !empty($form?->religion) ? $form->religion : 'Roman Catholic',
            'nationality'             => !empty($form?->nationality) ? $form->nationality : 'Filipino',
            'educational_attainment'  => !empty($form?->educational_attainment) ? $form->educational_attainment : 'High School Level',
            'address'                 => $address,
            'occupation'              => !empty($form?->occupation) ? $form->occupation : 'None',
            'company_agency'          => !empty($form?->company_agency) ? $form->company_agency : 'N/A',
            'monthly_income'          => !empty($form?->monthly_income) ? $form->monthly_income : '0.00',
            'employment_status'       => !empty($form?->employment_status) ? $form->employment_status : 'Self-employed',
            'contact_number'          => !empty($profile?->contact_number) ? $profile->contact_number : ($user->phone_number ?? 'N/A'),
            'email'                   => $user->email ?? 'N/A',
            'is_4ps_beneficiary'      => (bool) ($form?->is_4ps_beneficiary),
            'household_id_4ps'        => $form?->household_id_4ps ?? '',
            'is_indigenous'           => (bool) ($form?->is_indigenous),
            'indigenous_affiliation'  => $form?->indigenous_affiliation ?? '',
            'is_lgbtqia'              => (bool) ($form?->is_lgbtqia),
            'is_pwd'                  => (bool) ($form?->is_pwd),

            // Section II: Household Composition
            'household_main'     => array_slice($allMembers, 0, $maxMainRows),
            'household_overflow' => array_slice($allMembers, $maxMainRows),

            // Section III: Classification
            'solo_parent_category_display' => $categoryDisplay,
            'classification_details'       => $form?->classification_details ?? '',

            // Section IV: Needs/Problems
            'needs_problems' => $form?->needs_problems ?? '',

            // Section V: Emergency Contact
            'emergency_contact_name'         => $form?->emergency_contact_name ?? '',
            'emergency_contact_relationship' => $form?->emergency_contact_relationship ?? '',
            'emergency_contact_number'       => $form?->emergency_contact_number ?? '',
            'emergency_contact_address'      => $form?->emergency_contact_address ?? '',

            // Signature
            'signature_data' => $form?->signature_data ?? '',
            'date_str'       => $dateStr,

            // Admin / SPD section (hand-written by CSWDD personnel — left blank)
            'status_mark'      => $statusMark,
            'id_card_number'   => $application->id_card_number ?? '',
            'beneficiary_code' => $application->beneficiary_code ?? '',
            'date_issued'      => $application->date_issued
                ? Carbon::parse($application->date_issued)->format('F d, Y')
                : '',
            'category_code' => $categoryCode,
        ];
    }

    /**
     * Overlay applicant data onto the official PDF template.
     *
     * COORDINATE MAP — calibrated from debug_pdf_grid.pdf screenshot
     * =================================================================
     * Page size: ~210mm x 297mm (A4)
     *
     * Visible layout (from debug grid screenshot):
     *   Header/seals:           y ≈ 10–40
     *   Title bar:              y ≈ 43–47
     *   Case Number line:       y ≈ 50
     *   Section I header:       y ≈ 55
     *     Full Name row:        y ≈ 60–65  (Full Name | PhilSys Card Number)
     *     DOB row:              y ≈ 65–70  (DOB | Age | Place of Birth | Sex)
     *     Address row:          y ≈ 70–75
     *     Educ/Civil row:       y ≈ 75–80  (Educational Attainment | Civil Status)
     *     Occ/Religion row:     y ≈ 80–85  (Occupation | Religion)
     *     Company/Income row:   y ≈ 85–90  (Company/Agency | Monthly Income)
     *     Employment row:       y ≈ 90–95  (Employment Status checkboxes)
     *     Contact/Email row:    y ≈ 95–100 (Contact | Email Address)
     *     4Ps/Indigenous row:   y ≈ 100–105 (Pantawid? Y/N | Indigenous? Y/N | LGBTQ?)
     *     Sub-row:              y ≈ 105–110 (Household ID# | Affiliation | PWD?)
     *   Section II header:      y ≈ 110–115
     *     Table header:         y ≈ 115–120
     *     Table rows:           y ≈ 120+ (each ~7mm)
     *   Note text:              y ≈ 155
     *   Section III header:     y ≈ 158
     *     Content area:         y ≈ 162–173
     *   Section IV header:      y ≈ 173
     *     Content area:         y ≈ 177–188
     *   Section V header:       y ≈ 188
     *     Name/Relationship:    y ≈ 192–197
     *     Address:              y ≈ 197–202
     *   Certification text:     y ≈ 204–215
     *   Signature line:         y ≈ 220
     *   SPD/SPO section:        y ≈ 225+ (hand-written area)
     *
     * Column layout:
     *   Left margin:  ≈ 15mm
     *   Right margin: ≈ 200mm
     *   For 2-col:    col1 x≈15, col2 x≈115  (each ~85mm wide)
     *   For 3-col:    col1 x≈15, col2 x≈90, col3 x≈145 (varied)
     *   For 4-col:    col1 x≈15, col2 x≈90, col3 x≈120, col4 x≈160
     */
    private function overlayApplicationData(Fpdi $pdf, array $d)
    {
        $pdf->SetFont('Helvetica', '', 10);
        $pdf->SetTextColor(0, 0, 0);

        // ── Case Number line (y ≈ 44) ──
        $this->placeText($pdf, 105, 44, 90, $d['case_number'], 10);

        // ══════════════════════════════════════════════════════════════
        // Section I: IDENTIFYING INFORMATION
        // ══════════════════════════════════════════════════════════════

        // Row: Full Name (x≈15, y≈56.5) | PhilSys Card Number (x≈120, y≈56.5)
        $this->placeText($pdf, 35, 56.5, 80, $d['full_name'], 10);
        $this->placeText($pdf, 140, 56.5, 60, $d['philsys_card_number'], 10);

        // Row: Date of Birth (x≈15, y≈62) | Age (x≈100, y≈62) | Place of Birth (x≈115, y≈62) | Sex (x≈165, y≈62)
        $this->placeText($pdf, 35, 62, 55, $d['dob_display'], 10);
        $this->placeText($pdf, 103, 62, 12, $d['age'], 10);
        $this->placeText($pdf, 131, 62, 35, $d['place_of_birth'], 10);
        $this->placeText($pdf, 172, 62, 25, $d['sex'], 10);

        // Row: Address (full width, y≈67.5)
        $this->placeText($pdf, 30, 67.5, 168, $d['address'], 9);

        // Row: Educational Attainment (x≈15, y≈73) | Civil Status (x≈120, y≈73)
        $this->placeText($pdf, 48, 73, 65, $d['educational_attainment'], 10);
        $this->placeText($pdf, 137, 73, 60, $d['civil_status'], 10);

        // Row: Occupation (x≈15, y≈78.5) | Religion (x≈120, y≈78.5)
        $this->placeText($pdf, 35, 78.5, 75, $d['occupation'], 10);
        $this->placeText($pdf, 137, 78.5, 60, $d['religion'], 10);

        // Row: Company/Agency (x≈15, y≈84) | Monthly Income (x≈120, y≈84)
        $this->placeText($pdf, 40, 84, 72, $d['company_agency'], 10);
        $this->placeText($pdf, 148, 84, 50, $d['monthly_income'], 10);

        // Row: Employment Status (y≈89.5) — checkmark approach
        // The form has: "Employed ___ Self-employed ___ Not employed"
        $empStatus = strtolower($d['employment_status'] ?? '');
        if (str_contains($empStatus, 'self')) {
            $this->placeText($pdf, 102, 89.5, 5, 'X', 12, 'B'); // Self-employed checkbox
        } elseif (str_contains($empStatus, 'not') || str_contains($empStatus, 'un')) {
            $this->placeText($pdf, 140, 89.5, 5, 'X', 12, 'B'); // Not employed checkbox
        } elseif (!empty($empStatus)) {
            $this->placeText($pdf, 70, 89.5, 5, 'X', 12, 'B'); // Employed checkbox
        }

        // Row: Contact number/s (x≈15, y≈95) | Email Address (x≈120, y≈95)
        $this->placeText($pdf, 42, 95, 70, $d['contact_number'], 10);
        $this->placeText($pdf, 142, 95, 58, $d['email'], 9);

        // Row: Pantawid Beneficiary? (y≈100.5) Y/N | Indigenous Person? Y/N | LGBTQ+? Y/N
        if ($d['is_4ps_beneficiary']) {
            $this->placeText($pdf, 81, 100.5, 5, 'X', 12, 'B');  // Y checkbox
        }
        if ($d['is_indigenous']) {
            $this->placeText($pdf, 119, 100.5, 5, 'X', 12, 'B');  // Y checkbox
        }
        if ($d['is_lgbtqia']) {
            $this->placeText($pdf, 148, 100.5, 5, 'X', 12, 'B');  // Y checkbox
        }

        // Sub-row: Household ID# (y≈104) | Name of Affiliation | PWD? Y/N
        $this->placeText($pdf, 44, 104, 45, $d['household_id_4ps'], 10);
        $this->placeText($pdf, 123, 104, 40, $d['indigenous_affiliation'], 10);
        if ($d['is_pwd']) {
            $this->placeText($pdf, 148, 104, 5, 'X', 12, 'B');  // Y checkbox
        }

        // ══════════════════════════════════════════════════════════════
        // Section II: HOUSEHOLD COMPOSITION (table starts y≈117)
        // ══════════════════════════════════════════════════════════════
        $this->overlayHouseholdTable($pdf, $d['household_main']);

        // ══════════════════════════════════════════════════════════════
        // Section III: CLASSIFICATION/CIRCUMSTANCES (y≈156)
        // ══════════════════════════════════════════════════════════════
        $classText = $d['solo_parent_category_display'];
        if ($d['classification_details']) {
            $classText .= ($classText ? ' - ' : '') . $d['classification_details'];
        }
        $this->placeMultilineText($pdf, 16, 156, 180, $classText, 10);

        // ══════════════════════════════════════════════════════════════
        // Section IV: NEEDS/PROBLEMS (y≈171)
        // ══════════════════════════════════════════════════════════════
        $this->placeMultilineText($pdf, 16, 171, 180, $d['needs_problems'], 10);

        // ══════════════════════════════════════════════════════════════
        // Section V: IN CASE OF EMERGENCY (y≈188)
        // ══════════════════════════════════════════════════════════════
        // Row 1: Name (x≈15) | Relationship (x≈120) 
        $this->placeText($pdf, 30, 188, 85, $d['emergency_contact_name'], 10);
        $this->placeText($pdf, 139, 188, 60, $d['emergency_contact_relationship'], 10);

        // Row 2: Address (x≈15, y≈193.5) | Contact number/s (x≈120, y≈193.5)
        $this->placeText($pdf, 30, 193.5, 85, $d['emergency_contact_address'], 9);
        $this->placeText($pdf, 147, 193.5, 52, $d['emergency_contact_number'], 10);

        // ══════════════════════════════════════════════════════════════
        // Signature area (y≈220) — HAND-WRITTEN by solo parent
        // Only overlay if digital signature_data exists
        // ══════════════════════════════════════════════════════════════
        if (!empty($d['signature_data'])) {
            $this->overlaySignature($pdf, $d['signature_data']);
        }

        // ══════════════════════════════════════════════════════════════
        // FOR SPD/SPO USE ONLY section — HAND-WRITTEN by CSWDD personnel
        // This section is intentionally left blank.
        // ══════════════════════════════════════════════════════════════
    }

    /**
     * Place text at the given coordinates on the PDF.
     * Leaves the cell blank if the text is empty (no dashes/placeholders).
     */
    private function placeText(Fpdi $pdf, float $x, float $y, float $w, string $text, int $fontSize = 8, string $style = '')
    {
        if ($text === '' || $text === null) {
            return;
        }
        $pdf->SetFont('Helvetica', $style, $fontSize);
        $pdf->SetXY($x, $y);
        $pdf->Cell($w, 5, utf8_decode($text), 0, 0, 'L');
    }

    /**
     * Place multiline text with word wrapping at the given coordinates.
     */
    private function placeMultilineText(Fpdi $pdf, float $x, float $y, float $w, string $text, int $fontSize = 7)
    {
        if ($text === '' || $text === null) {
            return;
        }
        $pdf->SetFont('Helvetica', '', $fontSize);
        $pdf->SetXY($x, $y);
        $pdf->MultiCell($w, 3.5, utf8_decode($text), 0, 'L');
    }

    /**
     * Overlay household/family member data onto the table rows in Section II.
     *
     * Calibrated from the debug grid PDF screenshot.
     * The household table header row is at approximately y=118.
     * Data rows start at y≈123 and each row is ≈7mm tall.
     *
     * Column positions (from grid screenshot):
     *   Name:       x≈16,  w≈32
     *   Sex:        x≈49,  w≈9
     *   Relationship: x≈58, w≈20
     *   Age:        x≈78,  w≈10
     *   Birthdate:  x≈89,  w≈18
     *   Civil:      x≈107, w≈15
     *   Education:  x≈122, w≈22
     *   Occupation: x≈144, w≈22
     *   Income:     x≈166, w≈30
     */
    private function overlayHouseholdTable(Fpdi $pdf, array $members)
    {
        if (empty($members)) {
            return;
        }

        $tableStartY = 117;
        $rowHeight   = 7;

        $columns = [
            ['key' => 'name',                   'x' => 16,  'w' => 32],
            ['key' => 'sex',                    'x' => 49,  'w' => 9],
            ['key' => 'relationship',           'x' => 58,  'w' => 20],
            ['key' => 'age',                    'x' => 78,  'w' => 10],
            ['key' => 'birthdate',              'x' => 89,  'w' => 18],
            ['key' => 'civil_status',           'x' => 107, 'w' => 15],
            ['key' => 'educational_attainment', 'x' => 122, 'w' => 22],
            ['key' => 'occupation',             'x' => 144, 'w' => 22],
            ['key' => 'monthly_income',         'x' => 166, 'w' => 30],
        ];

        $pdf->SetFont('Helvetica', '', 9);

        foreach ($members as $idx => $member) {
            $y = $tableStartY + ($idx * $rowHeight);

            foreach ($columns as $col) {
                $val = $member[$col['key']] ?? '';
                if ($val !== '') {
                    $pdf->SetXY($col['x'], $y + 1);
                    $pdf->Cell($col['w'], $rowHeight - 1, utf8_decode($val), 0, 0, 'L');
                }
            }
        }
    }

    /**
     * Overlay the digital signature image onto the signature area.
     * Signature is displayed above the "Signature/Thumbmark over Printed Name" line.
     */
    private function overlaySignature(Fpdi $pdf, string $signatureData)
    {
        if (empty($signatureData)) {
            return;
        }

        // Signature stored as base64 data URI: data:image/png;base64,...
        if (preg_match('#^data:image/(png|jpeg|jpg|gif);base64,(.+)$#', $signatureData, $matches)) {
            $rawData = base64_decode($matches[2]);

            if ($rawData !== false) {
                $ext = strtolower($matches[1] === 'jpg' ? 'jpeg' : $matches[1]);
                $tmpFile = tempnam(sys_get_temp_dir(), 'sig_') . '.' . $ext;
                file_put_contents($tmpFile, $rawData);

                try {
                    // Place signature centered above the signature line (y≈204-214)
                    $pdf->Image($tmpFile, 40, 204, 35, 10);
                } catch (\Exception $e) {
                    // Signature rendering failed — leave area blank
                } finally {
                    @unlink($tmpFile);
                }
            }
        }
    }

    /**
     * Add a continuation page when household members exceed the main table capacity.
     */
    private function addHouseholdContinuationPage(Fpdi $pdf, array $data)
    {
        $overflow = $data['household_overflow'];
        if (empty($overflow)) {
            return;
        }

        $pdf->AddPage('P', [210, 297]);
        $pdf->SetFont('Helvetica', 'B', 12);
        $pdf->SetXY(10, 15);
        $pdf->Cell(190, 8, utf8_decode('HOUSEHOLD COMPOSITION (Continuation)'), 0, 1, 'C');

        $pdf->SetXY(10, 25);
        $pdf->SetFont('Helvetica', '', 8);
        $pdf->Cell(190, 5, utf8_decode('Reference No.: ' . ($data['reference_no'] ?? '')), 0, 1, 'L');

        // Table header
        $y = 33;
        $headers = ['Name', 'Sex', 'Relationship', 'Age', 'Birthdate', 'Civil Status', 'Education', 'Occupation', 'Income'];
        $widths  = [40,     12,    22,             10,    22,          16,             24,          22,           22];
        $x = 10;

        $pdf->SetFont('Helvetica', 'B', 7);
        $pdf->SetFillColor(7, 89, 133);
        $pdf->SetTextColor(255, 255, 255);
        foreach ($headers as $i => $header) {
            $pdf->SetXY($x, $y);
            $pdf->Cell($widths[$i], 6, $header, 1, 0, 'L', true);
            $x += $widths[$i];
        }

        // Table rows
        $pdf->SetFont('Helvetica', '', 7);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetFillColor(248, 250, 252);

        $keys = ['name', 'sex', 'relationship', 'age', 'birthdate', 'civil_status', 'educational_attainment', 'occupation', 'monthly_income'];

        foreach ($overflow as $idx => $member) {
            $y += 6;
            $x = 10;
            $fill = ($idx % 2 === 1);
            foreach ($keys as $ki => $key) {
                $val = $member[$key] ?? '';
                $pdf->SetXY($x, $y);
                $pdf->Cell($widths[$ki], 6, utf8_decode($val), 1, 0, 'L', $fill);
                $x += $widths[$ki];
            }
        }
    }

    public function generateIdCard(Request $request, $id = null)
    {
        // Load the application to get the correct applicant's user_id
        $application = Application::findOrFail($id);
        $data = $this->getPdfData($application->user_id, $id);
        
        $pdf = Pdf::loadView('pdf.id_card', $data)
            ->setPaper([0, 0, 260.787, 164.409], 'landscape')
            ->setOptions(['isHtml5ParserEnabled' => true, 'isRemoteEnabled' => true]);

        return $pdf->download('id_card.pdf');
    }

    public function generateStatistics(Request $request)
    {
        $total_applicants = User::where('role', 'applicant')->count();
        
        $status_rows = Application::select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->get();
            
        $by_status = $status_rows->pluck('total', 'status')->toArray();
        $total_applications = array_sum($by_status);
        
        $pending_docs = Document::where('review_status', 'pending')->count();
        $total_docs = Document::count();
        
        $created = Application::whereNotNull('created_at')->pluck('created_at');
        $buckets = [];
        foreach ($created as $c) {
            $month = Carbon::parse($c)->format('Y-m');
            if (!isset($buckets[$month])) $buckets[$month] = 0;
            $buckets[$month]++;
        }
        ksort($buckets);
        $trend_data = $buckets;
        
        $status_labels = [
            "draft" => "Draft", "submitted" => "Submitted", "under_initial_review" => "Under Initial Review",
            "pending_additional_requirements" => "Pending Requirements", "under_final_verification" => "Under Final Verification",
            "approved" => "Approved", "rejected" => "Rejected", "expired" => "Expired", "released" => "Released",
        ];
        $status_data = [];
        foreach ($status_labels as $key => $label) {
            $status_data[$label] = $by_status[$key] ?? 0;
        }

        $data = [
            'generated_at' => now()->format('Y-m-d H:i'),
            'admin_email' => $request->user()->email,
            'total_applicants' => $total_applicants,
            'total_applications' => $total_applications,
            'total_docs' => $total_docs,
            'pending_docs' => $pending_docs,
            'status_data' => $status_data,
            'trend_data' => $trend_data,
        ];
        
        $pdf = Pdf::loadView('pdf.statistics', $data)
            ->setPaper('a4', 'portrait')
            ->setOptions(['isHtml5ParserEnabled' => true, 'isRemoteEnabled' => true]);

        return $pdf->download('statistics.pdf');
    }

    /**
     * Export all applications as CSV for admin reports.
     */
    public function exportCsv(Request $request)
    {
        $applications = Application::with(['user', 'user.profile'])
            ->orderBy('created_at', 'desc')
            ->get();

        $filename = 'solo_parent_report_' . date('Y_m_d') . '.csv';

        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        $callback = function () use ($applications) {
            $handle = fopen('php://output', 'w');

            // Header row
            fputcsv($handle, [
                'Reference No', 'Status', 'Applicant Name', 'Email',
                'Category', 'Is Renewal', 'Submitted At', 'Created At',
                'Barangay', 'City', 'Province', 'Employment Status', 'Monthly Income',
            ]);

            foreach ($applications as $app) {
                $profile = $app->user?->profile;
                fputcsv($handle, [
                    $app->reference_no,
                    $app->status,
                    $app->user?->full_name ?? 'N/A',
                    $app->user?->email ?? 'N/A',
                    $app->category?->code ?? 'N/A',
                    $app->application_type === 'renewal' ? 'Yes' : 'No',
                    $app->submitted_at?->format('Y-m-d H:i') ?? 'Not submitted',
                    $app->created_at?->format('Y-m-d H:i') ?? '',
                    $profile?->barangay?->name ?? '',
                    $profile?->city_municipality ?? '',
                    $profile?->province ?? '',
                    $app->form?->employment_status ?? '',
                    $app->form?->monthly_income ?? '',
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }
}
