<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <style>
        @page {
            size: A4;
            margin: 12mm 15mm;
        }
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 8.5pt;
            line-height: 1.1;
            color: #0f172a;
            margin: 0;
            padding: 0;
        }
        .text-primary { color: #075985; }
        .text-grey { color: #64748b; }
        .text-white { color: #ffffff; }
        .bg-primary { background-color: #075985; }
        .bg-light { background-color: #e2e8f0; }
        .bg-very-light { background-color: #f8fafc; }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .header-table {
            margin-bottom: 4mm;
        }
        .header-table td {
            vertical-align: middle;
        }
        .header-center {
            text-align: center;
        }
        .header-title {
            font-size: 9pt;
            font-weight: bold;
        }
        .header-sub {
            font-size: 9pt;
        }
        .header-address {
            font-size: 7.5pt;
            color: #64748b;
        }

        .title-bar {
            background-color: #075985;
            color: white;
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            padding: 6pt 0;
        }

        .ref-bar {
            margin-top: 3mm;
            margin-bottom: 3mm;
        }
        .ref-bar td {
            font-size: 7.5pt;
            color: #64748b;
        }
        .ref-bar td.right {
            text-align: right;
        }

        .section-header {
            background-color: #075985;
            color: white;
            font-weight: bold;
            font-size: 9.5pt;
            padding: 4pt 8pt;
        }

        .grid-table {
            border: 0.4pt solid #e2e8f0;
        }
        .grid-table td, .grid-table th {
            border: 0.4pt solid #e2e8f0;
            padding: 4pt 6pt;
            vertical-align: top;
        }
        
        .field-label {
            font-size: 6.5pt;
            color: #64748b;
            margin-bottom: 1pt;
            display: block;
        }
        .field-value {
            font-size: 9pt;
            color: #0f172a;
            display: block;
        }

        .hh-table th {
            background-color: #075985;
            color: white;
            font-size: 7pt;
            font-weight: bold;
            text-align: left;
            padding: 3pt 4pt;
        }
        .hh-table td {
            font-size: 7pt;
            padding: 3pt 4pt;
            vertical-align: middle;
        }
        .hh-row-alt {
            background-color: #f8fafc;
        }

        .spacer {
            height: 3mm;
        }

        .cert-text {
            font-size: 8pt;
            text-align: justify;
        }

        .sig-table {
            width: 100%;
            margin-top: 8mm;
        }
        .sig-table td {
            vertical-align: bottom;
            padding-top: 2pt;
        }
        .sig-box {
            width: 110mm;
            border-top: 0.6pt solid #94a3b8;
            text-align: center;
        }
        .date-box {
            width: 70mm;
            border-top: 0.6pt solid #94a3b8;
            text-align: center;
        }
        .sig-name {
            font-size: 9pt;
            font-weight: bold;
        }
        .sig-label {
            font-size: 7pt;
            color: #64748b;
        }

        .footer {
            font-size: 6.5pt;
            color: #94a3b8;
            text-align: center;
            margin-top: 4mm;
        }
    </style>
</head>
<body>

    <!-- Header -->
    <table class="header-table">
        <tr>
            <td style="width: 24mm; text-align: center;">
                <img src="{{ $butuan_seal }}" width="18mm" height="18mm" alt="Seal">
            </td>
            <td class="header-center" style="width: 132mm;">
                <div>Republic of the Philippines</div>
                <div class="header-title">CITY GOVERNMENT OF BUTUAN</div>
                <div class="header-sub">City Social Welfare and Development Department</div>
                <div class="header-address">J.P. Rosales Ave., Tandang Sora, Butuan City</div>
            </td>
            <td style="width: 24mm; text-align: center;">
                <img src="{{ $cswdd_logo }}" width="18mm" height="18mm" alt="Logo">
            </td>
        </tr>
    </table>

    <div class="title-bar">APPLICATION FORM FOR SOLO PARENT</div>

    <table class="ref-bar">
        <tr>
            <td>Reference No.: {{ $application->reference_no }}</td>
            <td class="right">Case Number: {{ $application->case_number ?: '________________' }}</td>
        </tr>
    </table>

    <!-- I. Identifying Info -->
    <div class="section-header">I. IDENTIFYING INFORMATION</div>
    <table class="grid-table" style="table-layout: fixed;">
        <tr>
            <td style="width: 33.33%;">
                <span class="field-label">Full Name</span>
                <span class="field-value">{{ $full_name }}</span>
            </td>
            <td style="width: 33.33%;">
                <span class="field-label">Date of Birth / Age</span>
                <span class="field-value">{{ $dob_display }}</span>
            </td>
            <td style="width: 33.33%;">
                <span class="field-label">Place of Birth</span>
                <span class="field-value">{{ $profile->place_of_birth ?: '—' }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="field-label">PhilSys Card Number</span>
                <span class="field-value">{{ $profile->philsys_card_number ?: '—' }}</span>
            </td>
            <td>
                <span class="field-label">Sex</span>
                <span class="field-value">{{ $profile->sex ?: '—' }}</span>
            </td>
            <td>
                <span class="field-label">Civil Status</span>
                <span class="field-value">{{ $profile->civil_status ?: '—' }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="field-label">Religion</span>
                <span class="field-value">{{ $profile->religion ?: '—' }}</span>
            </td>
            <td>
                <span class="field-label">Nationality</span>
                <span class="field-value">{{ $profile->nationality ?: '—' }}</span>
            </td>
            <td>
                <span class="field-label">Educational Attainment</span>
                <span class="field-value">{{ $profile->educational_attainment ?: '—' }}</span>
            </td>
        </tr>
    </table>
    <table class="grid-table" style="border-top: none;">
        <tr>
            <td>
                <span class="field-label">Address</span>
                <span class="field-value">{{ $address ?: '—' }}</span>
            </td>
        </tr>
    </table>
    <table class="grid-table" style="table-layout: fixed; border-top: none;">
        <tr>
            <td style="width: 33.33%;">
                <span class="field-label">Occupation</span>
                <span class="field-value">{{ $profile->occupation ?: '—' }}</span>
            </td>
            <td style="width: 33.33%;">
                <span class="field-label">Company / Agency</span>
                <span class="field-value">{{ $profile->company_agency ?: '—' }}</span>
            </td>
            <td style="width: 33.33%;">
                <span class="field-label">Monthly Income</span>
                <span class="field-value">{{ $profile->monthly_income ?: '—' }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="field-label">Employment Status</span>
                <span class="field-value">{{ $profile->employment_status ?: '—' }}</span>
            </td>
            <td>
                <span class="field-label">Contact Number/s</span>
                <span class="field-value">{{ $profile->contact_number ?: '—' }}</span>
            </td>
            <td>
                <span class="field-label">Email Address</span>
                <span class="field-value">{{ $user->email ?: '—' }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="field-label">Pantawid (4Ps) Beneficiary</span>
                <span class="field-value">{{ $profile->is_4ps_beneficiary ? 'Yes' : 'No' }}</span>
            </td>
            <td>
                <span class="field-label">Household ID #</span>
                <span class="field-value">{{ $profile->household_id_4ps ?: '—' }}</span>
            </td>
            <td>
                <span class="field-label">Indigenous Person</span>
                <span class="field-value">{{ $profile->is_indigenous ? 'Yes' : 'No' }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="field-label">IP Affiliation</span>
                <span class="field-value">{{ $profile->indigenous_affiliation ?: '—' }}</span>
            </td>
            <td>
                <span class="field-label">LGBTQIA+</span>
                <span class="field-value">{{ $profile->is_lgbtqia ? 'Yes' : 'No' }}</span>
            </td>
            <td>
                <span class="field-label">PWD</span>
                <span class="field-value">{{ $profile->is_pwd ? 'Yes' : 'No' }}</span>
            </td>
        </tr>
    </table>
    
    <div class="spacer"></div>

    <!-- II. Household Composition -->
    <div class="section-header">II. HOUSEHOLD COMPOSITION</div>
    <table class="grid-table hh-table" style="table-layout: fixed;">
        <tr>
            <th style="width: 30mm;">Name</th>
            <th style="width: 13mm;">Sex</th>
            <th style="width: 24mm;">Relationship</th>
            <th style="width: 11mm;">Age</th>
            <th style="width: 22mm;">Birthdate</th>
            <th style="width: 16mm;">Civil</th>
            <th style="width: 24mm;">Education</th>
            <th style="width: 22mm;">Occupation</th>
            <th style="width: 18mm;">Income</th>
        </tr>
        @forelse($profile->household_members ?? [] as $idx => $m)
        <tr class="{{ $idx % 2 == 1 ? 'hh-row-alt' : '' }}">
            <td>{{ $m['name'] ?? '—' }}</td>
            <td>{{ $m['sex'] ?? '—' }}</td>
            <td>{{ $m['relationship'] ?? '—' }}</td>
            <td>{{ $m['age'] ?? '—' }}</td>
            <td>{{ $m['birthdate'] ?? '—' }}</td>
            <td>{{ $m['civil_status'] ?? '—' }}</td>
            <td>{{ $m['educational_attainment'] ?? '—' }}</td>
            <td>{{ $m['occupation'] ?? '—' }}</td>
            <td>{{ $m['monthly_income'] ?? '—' }}</td>
        </tr>
        @empty
        <tr>
            <td colspan="9" style="color: #94a3b8;">No household members provided.</td>
        </tr>
        @endforelse
    </table>

    <div class="spacer"></div>

    <!-- III. Classification -->
    <div class="section-header">III. CLASSIFICATION / CIRCUMSTANCES OF BEING A SOLO PARENT</div>
    <table class="grid-table">
        <tr>
            <td>
                <span class="field-label">Category</span>
                <span class="field-value">{{ $application->solo_parent_category ?: ($profile->solo_parent_category ?: '—') }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="field-value">{{ $profile->solo_parent_classification ?: '—' }}</span>
            </td>
        </tr>
    </table>

    <div class="spacer" style="height: 2mm;"></div>

    <!-- IV. Needs -->
    <div class="section-header">IV. NEEDS / PROBLEMS OF BEING A SOLO PARENT</div>
    <table class="grid-table">
        <tr>
            <td>
                <span class="field-value">{{ $profile->needs_problems ?: '—' }}</span>
            </td>
        </tr>
    </table>

    <div class="spacer"></div>

    <!-- V. Emergency -->
    <div class="section-header">V. IN CASE OF EMERGENCY</div>
    <table class="grid-table" style="table-layout: fixed;">
        <tr>
            <td style="width: 33.33%;">
                <span class="field-label">Name</span>
                <span class="field-value">{{ $profile->emergency_contact_name ?: '—' }}</span>
            </td>
            <td style="width: 33.33%;">
                <span class="field-label">Relationship</span>
                <span class="field-value">{{ $profile->emergency_contact_relationship ?: '—' }}</span>
            </td>
            <td style="width: 33.33%;">
                <span class="field-label">Contact Number/s</span>
                <span class="field-value">{{ $profile->emergency_contact_number ?: '—' }}</span>
            </td>
        </tr>
    </table>
    <table class="grid-table" style="border-top: none;">
        <tr>
            <td>
                <span class="field-label">Address</span>
                <span class="field-value">{{ $profile->emergency_contact_address ?: '—' }}</span>
            </td>
        </tr>
    </table>

    <div class="spacer" style="height: 4mm;"></div>

    <!-- Cert & Sig -->
    <div class="cert-text">
        I hereby certify that the information given above are true and correct. I further understand that any misrepresentation that may have been made will subject me to criminal and civil liabilities provided for by existing laws. In addition, I hereby give my consent to share the information above to the member agencies of the Inter-Agency Coordinating and Monitoring Committee on solo parents.
    </div>

    <table class="sig-table">
        <tr>
            <td style="width: 110mm;">
                @if($profile->signature_data)
                <div style="text-align: center; height: 16mm;">
                    <img src="{{ $profile->signature_data }}" style="max-width: 45mm; max-height: 16mm; object-fit: contain;">
                </div>
                @else
                <div style="height: 16mm;"></div>
                @endif
                <div class="sig-box">
                    <div class="sig-name">{{ $full_name }}</div>
                    <div class="sig-label">Signature / Thumbmark over Printed Name</div>
                </div>
            </td>
            <td style="width: auto;"></td> <!-- spacer -->
            <td style="width: 70mm;">
                <div class="date-box">
                    <div class="sig-name">{{ $date_str }}</div>
                    <div class="sig-label">Date</div>
                </div>
            </td>
        </tr>
    </table>

    <div class="spacer" style="height: 5mm;"></div>

    <!-- Admin -->
    <div class="section-header">FOR SPD / SPO USE ONLY</div>
    <table class="grid-table">
        <tr>
            <td>
                <span class="field-label">Status</span>
                <span class="field-value">
                    {!! $status_mark == 'New' ? '[X]' : '[&nbsp;&nbsp;]' !!} New &nbsp;
                    {!! $status_mark == 'Renewal' ? '[X]' : '[&nbsp;&nbsp;]' !!} Renewal &nbsp;
                    {!! $status_mark == 'Terminated' ? '[X]' : '[&nbsp;&nbsp;]' !!} Terminated &nbsp;
                    {!! $status_mark == 'Disapproved' ? '[X]' : '[&nbsp;&nbsp;]' !!} Disapproved
                </span>
            </td>
        </tr>
    </table>
    <table class="grid-table" style="table-layout: fixed; border-top: none;">
        <tr>
            <td style="width: 50%;">
                <span class="field-label">Solo Parent ID Card Number</span>
                <span class="field-value">{{ $application->id_card_number ?: '—' }}</span>
            </td>
            <td style="width: 50%;">
                <span class="field-label">Solo Parent Category</span>
                <span class="field-value">{{ $cat ?: '—' }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="field-label">Date of Issuance</span>
                <span class="field-value">{{ $application->date_issued ?: '—' }}</span>
            </td>
            <td>
                <span class="field-label">Beneficiary Code</span>
                <span class="field-value">{{ $application->beneficiary_code ?: '—' }}</span>
            </td>
        </tr>
    </table>

    <!-- Footer -->
    <div class="footer">
        Phone: +639562241679 / +639816016317 &nbsp;&bull;&nbsp; Email: cswdobutuan@gmail.com &nbsp;&bull;&nbsp; Website: http://www.butuan.gov.ph &nbsp;&bull;&nbsp; Form No. CSWDD.DPSD.F.112.REV03
    </div>

</body>
</html>
