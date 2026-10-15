<?php
/**
 * Coordinate extraction helper for the official Solo Parent Application Form PDF.
 * 
 * Run: php scripts/extract_pdf_coords.php
 * 
 * This script imports the official PDF template using FPDI (with FPDF)
 * and generates a debug PDF with a coordinate grid overlay.
 */

require_once __DIR__ . '/../vendor/autoload.php';

use setasign\Fpdi\Fpdi;

$templatePath = __DIR__ . '/../resources/pdf-templates/solo_parent_application_form.pdf';
$outputPath = __DIR__ . '/../storage/app/debug_pdf_grid.pdf';

if (!file_exists($templatePath)) {
    echo "Template not found at: $templatePath\n";
    exit(1);
}

$pdf = new Fpdi('P', 'mm', 'A4');
$pdf->SetAutoPageBreak(false);
$pdf->SetMargins(0, 0, 0);

$pageCount = $pdf->setSourceFile($templatePath);

echo "Template: $templatePath\n";
echo "Page count: $pageCount\n";

for ($p = 1; $p <= $pageCount; $p++) {
    $tplId = $pdf->importPage($p);
    $size = $pdf->getTemplateSize($tplId);
    echo "Page $p: width={$size['width']}mm, height={$size['height']}mm, orientation={$size['orientation']}\n";
    
    $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
    $pdf->useTemplate($tplId, 0, 0, $size['width'], $size['height']);
    
    $w = $size['width'];
    $h = $size['height'];
    
    // Draw horizontal lines every 10mm
    $pdf->SetDrawColor(255, 0, 0);
    $pdf->SetTextColor(255, 0, 0);
    $pdf->SetFont('Helvetica', '', 5);
    
    for ($y = 0; $y <= $h; $y += 10) {
        $pdf->SetLineWidth(0.15);
        $pdf->Line(0, $y, $w, $y);
        $pdf->SetXY(1, $y);
        $pdf->Cell(8, 3, "y=$y", 0, 0, 'L');
        $pdf->SetXY($w - 12, $y);
        $pdf->Cell(10, 3, "y=$y", 0, 0, 'R');
    }
    
    // Draw 5mm intermediate lines
    $pdf->SetDrawColor(255, 180, 180);
    $pdf->SetLineWidth(0.08);
    for ($y = 5; $y <= $h; $y += 10) {
        $pdf->Line(0, $y, $w, $y);
    }
    
    // Draw vertical lines every 10mm
    $pdf->SetDrawColor(0, 0, 255);
    $pdf->SetTextColor(0, 0, 255);
    $pdf->SetLineWidth(0.15);
    for ($x = 10; $x <= $w; $x += 10) {
        $pdf->Line($x, 0, $x, $h);
        $pdf->SetXY($x, 3);
        $pdf->Cell(8, 3, "$x", 0, 0, 'L');
    }
    
    // Draw 5mm intermediate vertical lines
    $pdf->SetDrawColor(180, 180, 255);
    $pdf->SetLineWidth(0.08);
    for ($x = 5; $x <= $w; $x += 10) {
        $pdf->Line($x, 0, $x, $h);
    }
}

// Ensure output directory exists
$dir = dirname($outputPath);
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$pdf->Output('F', $outputPath);
echo "\nGrid PDF saved to: $outputPath\n";
echo "Open this file to verify field coordinates.\n";
