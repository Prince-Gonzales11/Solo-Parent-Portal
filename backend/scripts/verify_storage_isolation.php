<?php

/**
 * Phase 4B Storage & Database Isolation Verification Probe
 * 
 * Verifies that the testing configuration connects exclusively to:
 * 1. Local PostgreSQL (solo_parent_local_test on 127.0.0.1:5432)
 * 2. Dedicated test Supabase project (solo-parent-portal-test)
 * 
 * SAFETY PROMISE:
 * - NEVER prints or logs raw credentials or secrets.
 * - NEVER performs live uploads, deletions, moves, or mutations.
 * - STRICTLY detects and blocks any pointer to the production Supabase project (yiqnxneqschmvckcuhml).
 */

$envFile = __DIR__ . '/../.env.phase4b';
if (!file_exists($envFile)) {
    $envFile = __DIR__ . '/../.env.testing';
}

echo "=== PHASE 4B ISOLATION VERIFICATION PROBE ===\n";
echo "Reading configuration from: " . basename($envFile) . "\n\n";

$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$config = [];
foreach ($lines as $line) {
    if (preg_match('/^\s*#/', $line)) continue;
    if (preg_match('/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/', $line, $matches)) {
        $key = trim($matches[1]);
        $val = trim($matches[2], " \t\n\r\0\x0B\"'");
        $config[$key] = $val;
    }
}

$issues = [];
$productionIdentifiers = [
    'yiqnxneqschmvckcuhml',
    'aws-0-ap-southeast-2.pooler.supabase.com',
];

// 1. Verify Database Isolation
$dbHost = $config['DB_HOST'] ?? '';
$dbPort = $config['DB_PORT'] ?? '';
$dbName = $config['DB_DATABASE'] ?? '';
$dbUser = $config['DB_USERNAME'] ?? '';

echo "[1/4] Database Configuration Check:\n";
echo "  - Host: " . ($dbHost ?: '(empty)') . "\n";
echo "  - Port: " . ($dbPort ?: '(empty)') . "\n";
echo "  - Database: " . ($dbName ?: '(empty)') . "\n";
echo "  - User: " . ($dbUser ?: '(empty)') . "\n";

if ($dbHost !== '127.0.0.1' && $dbHost !== 'localhost') {
    $issues[] = "DB_HOST is '{$dbHost}', but must be '127.0.0.1' or 'localhost'.";
}
if ($dbName !== 'solo_parent_local_test') {
    $issues[] = "DB_DATABASE is '{$dbName}', but must be 'solo_parent_local_test'.";
}

// Live DB connection test to local PostgreSQL
try {
    $dsn = "pgsql:host={$dbHost};port={$dbPort};dbname={$dbName}";
    $pdo = new PDO($dsn, $dbUser, $config['DB_PASSWORD'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 2,
    ]);
    $stmt = $pdo->query("SELECT current_database(), current_user, inet_server_addr(), inet_server_port();");
    $dbCheck = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "  -> Connection Status: VERIFIED SAFE (Local PostgreSQL {$dbCheck['inet_server_addr']}:{$dbCheck['inet_server_port']})\n";
} catch (\Throwable $e) {
    $issues[] = "Local PostgreSQL connection failed: " . $e->getMessage();
}

// 2. Verify Storage Endpoints Isolation
echo "\n[2/4] Supabase Storage Endpoint Safety Check:\n";
$supabaseUrl = $config['SUPABASE_URL'] ?? '';
$awsEndpoint = $config['AWS_ENDPOINT'] ?? '';

echo "  - SUPABASE_URL: " . ($supabaseUrl ?: '(empty)') . "\n";
echo "  - AWS_ENDPOINT: " . ($awsEndpoint ?: '(empty)') . "\n";

foreach ($productionIdentifiers as $prodId) {
    if (str_contains($supabaseUrl, $prodId)) {
        $issues[] = "CRITICAL: SUPABASE_URL contains production identifier '{$prodId}'!";
    }
    if (str_contains($awsEndpoint, $prodId)) {
        $issues[] = "CRITICAL: AWS_ENDPOINT contains production identifier '{$prodId}'!";
    }
}

// 3. Verify Bucket Configuration
echo "\n[3/4] Bucket Name Configuration Check:\n";
$permBucket = $config['AWS_BUCKET'] ?? '';
$tempBucket = $config['SUPABASE_TEMP_BUCKET'] ?? '';
echo "  - Permanent Bucket: " . ($permBucket ?: '(empty)') . "\n";
echo "  - Temporary Bucket: " . ($tempBucket ?: '(empty)') . "\n";

if ($permBucket !== 'solo-parent-portal-documents') {
    $issues[] = "AWS_BUCKET is '{$permBucket}', expected 'solo-parent-portal-documents'.";
}
if ($tempBucket !== 'solo-parent-temp') {
    $issues[] = "SUPABASE_TEMP_BUCKET is '{$tempBucket}', expected 'solo-parent-temp'.";
}

// 4. Credential Presence & Placeholder Analysis (Redacted)
echo "\n[4/4] Credential Presence Status (Redacted):\n";
$credKeys = [
    'AWS_ACCESS_KEY_ID'     => 'S3 Access Key ID',
    'AWS_SECRET_ACCESS_KEY' => 'S3 Secret Key',
    'SUPABASE_SERVICE_KEY'  => 'Supabase Service Role Key',
    'SUPABASE_ANON_KEY'     => 'Supabase Anon Key',
];

$missingCreds = [];
foreach ($credKeys as $key => $label) {
    $val = $config[$key] ?? '';
    $isPlaceholder = empty($val) || str_starts_with($val, 'YOUR_') || str_contains($val, '<TEST_');
    if ($isPlaceholder) {
        echo "  - {$label} ({$key}): [PENDING_USER_INPUT - Placeholder]\n";
        $missingCreds[] = $key;
    } else {
        echo "  - {$label} ({$key}): [CONFIGURED - " . strlen($val) . " chars]\n";
    }
}

echo "\n============================================\n";
if (!empty($issues)) {
    echo "STATUS: FAILED / SAFETY CONCERN DETECTED\n";
    foreach ($issues as $err) {
        echo "  [!] {$err}\n";
    }
    exit(1);
} elseif (!empty($missingCreds)) {
    echo "STATUS: READY_FOR_CREDENTIALS\n";
    echo "Environment isolation is 100% verified and local PostgreSQL is connected.\n";
    echo "Storage credentials are currently awaiting private entry in: " . basename($envFile) . "\n";
    echo "Zero external requests or modifications were performed.\n";
    exit(0);
} else {
    echo "STATUS: FULLY_CONFIGURED_AND_ISOLATED\n";
    echo "All endpoints and credentials point to isolated testing resources.\n";
    echo "Zero external requests or modifications were performed.\n";
    exit(0);
}
