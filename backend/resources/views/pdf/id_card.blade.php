<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <style>
        @page {
            size: 92mm 58mm landscape;
            margin: 0;
        }
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background: white;
            color: #0f172a;
        }
        .page {
            width: 92mm;
            height: 58mm;
            position: relative;
            box-sizing: border-box;
            page-break-after: always;
        }
        .border-box {
            position: absolute;
            left: 1.5mm;
            top: 1.5mm;
            width: 89mm; /* 92 - 3 */
            height: 55mm; /* 58 - 3 */
            border: 0.8pt solid #cbd5e1;
            box-sizing: border-box;
        }
        
        /* Front specific */
        .front-header-band {
            position: absolute;
            left: 1.5mm;
            top: 1.5mm;
            width: 89mm;
            height: 13mm;
            background-color: #075985;
        }
        .front-logo {
            position: absolute;
            left: 4mm;
            top: 3.5mm;
            width: 9mm;
            height: 9mm;
            z-index: 10;
        }
        .front-title-1 {
            position: absolute;
            left: 15mm;
            top: 5mm;
            color: white;
            font-size: 8pt;
            font-weight: bold;
            z-index: 10;
        }
        .front-title-2 {
            position: absolute;
            left: 15mm;
            top: 9mm;
            color: white;
            font-size: 5.4pt;
            z-index: 10;
        }
        .photo-box {
            position: absolute;
            left: 4mm;
            top: 18mm;
            width: 21mm;
            height: 27mm;
            background-color: #eef2f7;
            border: 0.8pt solid #cbd5e1;
            text-align: center;
            display: table;
        }
        .photo-text {
            display: table-cell;
            vertical-align: middle;
            font-size: 5pt;
            color: #64748b;
        }
        
        .front-name {
            position: absolute;
            left: 28mm;
            top: 18mm;
            font-size: 9.5pt;
            font-weight: bold;
        }
        
        .field-label {
            font-size: 5.2pt;
            color: #64748b;
            text-transform: uppercase;
        }
        .field-val {
            font-size: 7.2pt;
            font-weight: bold;
        }
        
        .info-box-1 { position: absolute; left: 28mm; top: 23mm; }
        .info-box-2 { position: absolute; left: 28mm; top: 29.4mm; }
        .info-box-3 { position: absolute; left: 28mm; top: 35.8mm; }
        
        .bottom-left {
            position: absolute;
            left: 4mm;
            bottom: 3.5mm;
            font-size: 5.2pt;
            color: #64748b;
        }
        .bottom-right {
            position: absolute;
            right: 4mm;
            bottom: 3.5mm;
            font-size: 5.2pt;
            color: #64748b;
            text-align: right;
        }

        /* Back specific */
        .back-header-band {
            position: absolute;
            left: 1.5mm;
            top: 1.5mm;
            width: 89mm;
            height: 7mm;
            background-color: #075985;
            text-align: center;
            line-height: 7mm;
        }
        .back-header-title {
            color: white;
            font-size: 6.5pt;
            font-weight: bold;
        }
        
        .back-ec-title {
            position: absolute;
            left: 4mm;
            top: 11mm;
            font-size: 6pt;
            font-weight: bold;
        }
        
        .ec-line {
            font-size: 5pt;
            color: #64748b;
            position: absolute;
            left: 4mm;
        }
        .ec-val {
            font-size: 6pt;
            color: #0f172a;
            position: absolute;
            left: 28mm;
        }
        .b-line-1 { top: 15.5mm; }
        .b-line-2 { top: 19.7mm; }
        .b-line-3 { top: 23.9mm; }
        .b-line-4 { top: 28.1mm; }
        
        .divider {
            position: absolute;
            left: 4mm;
            top: 32mm;
            width: 84mm; /* 92 - 8 */
            border-top: 0.8pt solid #e2e8f0;
        }
        
        .sig-title {
            position: absolute;
            left: 4mm;
            top: 35mm;
            font-size: 5.5pt;
            font-weight: bold;
        }
        .sig-img {
            position: absolute;
            left: 4mm;
            top: 37mm;
            width: 40mm;
            height: 9mm;
            object-fit: contain;
        }
        .sig-line {
            position: absolute;
            left: 4mm;
            top: 47mm;
            width: 40mm;
            border-top: 0.8pt solid #94a3b8;
        }
        
        .office-info {
            position: absolute;
            bottom: 3mm;
            left: 0;
            width: 100%;
            text-align: center;
            font-size: 4.8pt;
            color: #64748b;
            line-height: 1.4;
        }
        
        .watermark {
            position: absolute;
            top: 25mm;
            left: 25mm;
            font-size: 24pt;
            font-weight: bold;
            color: #f1f5f9;
            transform: rotate(-25deg);
            z-index: 1;
        }
        
        /* Elevate text over watermark */
        .elevate {
            position: relative;
            z-index: 10;
        }
    </style>
</head>
<body>

    <!-- FRONT PAGE -->
    <div class="page">
        <div class="border-box"></div>
        <div class="front-header-band"></div>
        
        @if($cswdd_logo)
        <img src="{{ $cswdd_logo }}" class="front-logo">
        @endif
        
        <div class="front-title-1">SOLO PARENT IDENTIFICATION CARD</div>
        <div class="front-title-2">Republic of the Philippines  &bull;  City of Butuan  &bull;  CSWDD</div>
        
        <div class="photo-box">
            <div class="photo-text">PHOTO</div>
        </div>
        
        <div class="front-name elevate">{{ \Illuminate\Support\Str::limit($full_name, 36) }}</div>
        
        <div class="info-box-1 elevate">
            <div class="field-label">ID Number</div>
            <div class="field-val">{{ \Illuminate\Support\Str::limit($application->id_card_number ?: '—', 44) }}</div>
        </div>
        <div class="info-box-2 elevate">
            <div class="field-label">Category</div>
            <div class="field-val">{{ \Illuminate\Support\Str::limit($cat ?: '—', 44) }}</div>
        </div>
        <div class="info-box-3 elevate">
            <div class="field-label">Address</div>
            <div class="field-val">{{ \Illuminate\Support\Str::limit($address ?: '—', 44) }}</div>
        </div>
        
        <div class="bottom-left">Issued: {{ $date_issued ?: '—' }}</div>
        <div class="bottom-right">Valid until: {{ $valid_until }}</div>
    </div>
    
    <!-- BACK PAGE -->
    <div class="page" style="page-break-after: auto;">
        <div class="border-box"></div>
        <div class="back-header-band">
            <span class="back-header-title">CITY SOCIAL WELFARE AND DEVELOPMENT DEPARTMENT</span>
        </div>
        
        <div class="watermark">CSWDD</div>
        
        <div class="back-ec-title elevate">IN CASE OF EMERGENCY, PLEASE NOTIFY:</div>
        
        <div class="ec-line b-line-1 elevate">Name:</div>
        <div class="ec-val b-line-1 elevate">{{ \Illuminate\Support\Str::limit(($profile->emergency_contact_name ?? null) ?: '__________________', 46) }}</div>
        
        <div class="ec-line b-line-2 elevate">Relationship:</div>
        <div class="ec-val b-line-2 elevate">{{ \Illuminate\Support\Str::limit(($profile->emergency_contact_relationship ?? null) ?: '__________________', 46) }}</div>
        
        <div class="ec-line b-line-3 elevate">Contact No.:</div>
        <div class="ec-val b-line-3 elevate">{{ \Illuminate\Support\Str::limit(($profile->emergency_contact_number ?? null) ?: '__________________', 46) }}</div>
        
        <div class="ec-line b-line-4 elevate">Address:</div>
        <div class="ec-val b-line-4 elevate">{{ \Illuminate\Support\Str::limit(($profile->emergency_contact_address ?? null) ?: '__________________', 46) }}</div>
        
        <div class="divider"></div>
        
        <div class="sig-title elevate">CARDHOLDER'S SIGNATURE:</div>
        @if(!empty($profile->signature_data))
        <img src="{{ $profile->signature_data }}" class="sig-img elevate">
        @endif
        <div class="sig-line elevate"></div>
        
        <div class="office-info elevate">
            J.P. Rosales Ave., Tandang Sora, Butuan City<br>
            Tel: +63 956 224 1679 / +63 981 601 6317<br>
            Email: cswdobutuan@gmail.com
        </div>
    </div>

</body>
</html>
