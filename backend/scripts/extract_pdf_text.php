<?php
/**
 * Extract text positions from the front page of the Solo Parent Application Form.
 * Uses raw PDF parsing to find text operators and their coordinates.
 */

require_once __DIR__ . '/../vendor/autoload.php';

$templatePath = __DIR__ . '/../resources/pdf-templates/solo_parent_application_form.pdf';
$rawContent = file_get_contents($templatePath);

echo "File size: " . strlen($rawContent) . " bytes\n";
echo "Page dimensions: ~210mm x 297mm (A4)\n\n";

// Find all content streams in the PDF
// Decompress streams to find text operators
// Look for stream...endstream blocks
preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $rawContent, $streams);

echo "Found " . count($streams[1]) . " streams.\n\n";

$allTextEntries = [];

foreach ($streams[1] as $streamIdx => $stream) {
    // Try to decompress (most PDF streams are FlateDecode compressed)
    $decompressed = @gzuncompress($stream);
    if ($decompressed === false) {
        $decompressed = @gzinflate($stream);
    }
    if ($decompressed === false) {
        // Try raw - might not be compressed
        $decompressed = $stream;
    }
    
    // Look for text showing operators in the decompressed stream
    // BT = begin text, ET = end text
    // Tf = set font, Td/TD = move text position, Tm = set text matrix
    // Tj = show text string, TJ = show text with positioning, ' = show text on next line
    
    if (strpos($decompressed, 'BT') === false) {
        continue;
    }
    
    echo "=== Stream $streamIdx (text found) ===\n";
    
    // Split into BT...ET blocks
    preg_match_all('/BT(.*?)ET/s', $decompressed, $btBlocks);
    
    foreach ($btBlocks[1] as $blockIdx => $block) {
        // Track position state
        $x = 0;
        $y = 0;
        $fontSize = 0;
        
        // Parse Tm (text matrix) - gives absolute position
        // Format: a b c d tx ty Tm
        if (preg_match_all('/([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+Tm/s', $block, $tmMatches, PREG_SET_ORDER)) {
            foreach ($tmMatches as $tm) {
                $x = floatval($tm[5]); // tx in points
                $y = floatval($tm[6]); // ty in points
            }
        }
        
        // Parse Td (text displacement) - relative position
        if (preg_match_all('/([\d.-]+)\s+([\d.-]+)\s+Td/s', $block, $tdMatches, PREG_SET_ORDER)) {
            foreach ($tdMatches as $td) {
                $x = floatval($td[1]);
                $y = floatval($td[2]);
            }
        }
        
        // Parse Tf (font size)
        if (preg_match('/\/([\w]+)\s+([\d.]+)\s+Tf/', $block, $tfMatch)) {
            $fontSize = floatval($tfMatch[2]);
        }
        
        // Extract text from Tj operator: (text) Tj
        $text = '';
        preg_match_all('/\(([^)]*)\)\s*Tj/', $block, $tjMatches);
        if (!empty($tjMatches[1])) {
            $text = implode('', $tjMatches[1]);
        }
        
        // Extract text from TJ operator: [(text1) -kern (text2)] TJ
        if (empty($text)) {
            preg_match_all('/\(([^)]*)\)/', $block, $tjArrayMatches);
            if (!empty($tjArrayMatches[1])) {
                $text = implode('', $tjArrayMatches[1]);
            }
        }
        
        $text = trim($text);
        if (!empty($text) && strlen($text) >= 2) {
            // Convert points to mm (1 point = 0.3528mm)
            $xMm = round($x * 0.3528, 1);
            // PDF y-coordinate is from bottom; convert to from top for A4
            $yFromBottom = round($y * 0.3528, 1);
            $yFromTop = round(297 - $yFromBottom, 1);
            
            $allTextEntries[] = [
                'y_top' => $yFromTop,
                'x' => $xMm,
                'text' => $text,
                'fontSize' => $fontSize,
            ];
            
            echo sprintf(
                "  x=%-7.1f y_top=%-7.1f y_bot=%-7.1f fs=%-4s \"%s\"\n",
                $xMm, $yFromTop, $yFromBottom, $fontSize, substr($text, 0, 60)
            );
        }
    }
}

// Sort by y position (top to bottom) then x (left to right)
usort($allTextEntries, function($a, $b) {
    if (abs($a['y_top'] - $b['y_top']) < 2) {
        return $a['x'] <=> $b['x'];
    }
    return $a['y_top'] <=> $b['y_top'];
});

echo "\n\n=== SORTED BY POSITION (top-to-bottom, left-to-right) ===\n\n";
echo sprintf("%-8s %-8s %-5s %s\n", "x(mm)", "y(mm)", "fs", "Text");
echo str_repeat('-', 80) . "\n";

foreach ($allTextEntries as $entry) {
    echo sprintf(
        "%-8.1f %-8.1f %-5s %s\n",
        $entry['x'], $entry['y_top'], $entry['fontSize'], $entry['text']
    );
}

echo "\n\nTotal text entries found: " . count($allTextEntries) . "\n";
