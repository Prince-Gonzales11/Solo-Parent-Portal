<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <style>
        @page {
            size: A4;
            margin: 20mm 18mm;
        }
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            color: #000;
        }
        .title {
            color: #075985;
            font-size: 20pt;
            font-weight: bold;
            margin-bottom: 5pt;
        }
        .subtitle {
            font-size: 11pt;
            margin-bottom: 5pt;
        }
        .meta {
            font-size: 9pt;
            color: gray;
            margin-bottom: 10mm;
        }
        h2 {
            color: #075985;
            font-size: 14pt;
            margin-top: 10mm;
            margin-bottom: 4mm;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
        }
        th {
            background-color: #075985;
            color: white;
            font-weight: bold;
            text-align: left;
            padding: 6pt 8pt;
            border: 0.5pt solid #cbd5e1;
        }
        td {
            padding: 6pt 8pt;
            border: 0.5pt solid #cbd5e1;
        }
        tr:nth-child(even) td {
            background-color: #f1f5f9;
        }
        .col-1 { width: 100mm; }
        .col-2 { width: 60mm; }
    </style>
</head>
<body>

    <div class="title">Solo Parent Portal</div>
    <div class="subtitle">Statistics Report &mdash; Expanded Solo Parents Welfare Act (RA 11861)</div>
    <div class="meta">Generated: {{ $generated_at }} UTC &nbsp;&bull;&nbsp; By: {{ $admin_email }}</div>

    <h2>Summary</h2>
    <table>
        <tr>
            <th class="col-1">Metric</th>
            <th class="col-2">Value</th>
        </tr>
        <tr>
            <td>Registered Applicants</td>
            <td>{{ $total_applicants }}</td>
        </tr>
        <tr>
            <td>Total Applications</td>
            <td>{{ $total_applications }}</td>
        </tr>
        <tr>
            <td>Total Documents</td>
            <td>{{ $total_docs }}</td>
        </tr>
        <tr>
            <td>Documents Pending Verification</td>
            <td>{{ $pending_docs }}</td>
        </tr>
    </table>

    <h2>Applications by Status</h2>
    <table>
        <tr>
            <th class="col-1">Status</th>
            <th class="col-2">Count</th>
        </tr>
        @foreach($status_data as $status => $count)
        <tr>
            <td>{{ $status }}</td>
            <td>{{ $count }}</td>
        </tr>
        @endforeach
    </table>

    <h2>Monthly Application Trend</h2>
    <table>
        <tr>
            <th class="col-1">Month</th>
            <th class="col-2">Applications</th>
        </tr>
        @forelse($trend_data as $month => $count)
        <tr>
            <td>{{ $month }}</td>
            <td>{{ $count }}</td>
        </tr>
        @empty
        <tr>
            <td>No data</td>
            <td>0</td>
        </tr>
        @endforelse
    </table>

</body>
</html>
