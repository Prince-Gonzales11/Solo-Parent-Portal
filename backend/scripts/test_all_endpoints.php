<?php

$baseUrl = 'http://127.0.0.1:8080/api';

function callApi($method, $path, $token = null, $data = null, $files = null) {
    global $baseUrl;
    $url = $baseUrl . $path;
    $ch = curl_init();
    
    $headers = [
        'Accept: application/json',
    ];
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    if ($files) {
        // multipart form data
        $postData = $data ?: [];
        foreach ($files as $field => $fileInfo) {
            $postData[$field] = new CURLFile($fileInfo['path'], $fileInfo['mime'], $fileInfo['name']);
        }
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    } elseif ($data !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    
    if ($err) {
        return ['status' => 0, 'error' => $err, 'data' => null, 'raw' => ''];
    }
    
    $json = json_decode($response, true);
    return ['status' => $status, 'data' => $json, 'raw' => $response];
}

$results = [];

function testStep($name, $closure) {
    global $results;
    try {
        $res = $closure();
        $passed = $res['passed'];
        $results[] = [
            'name' => $name,
            'passed' => $passed,
            'status' => $res['status'] ?? null,
            'message' => $res['message'] ?? '',
            'details' => $res['details'] ?? null
        ];
        echo ($passed ? "[PASS] " : "[FAIL] ") . $name . ": " . ($res['message'] ?? '') . "\n";
    } catch (\Throwable $e) {
        $results[] = [
            'name' => $name,
            'passed' => false,
            'message' => 'Exception: ' . $e->getMessage()
        ];
        echo "[ERROR] $name: " . $e->getMessage() . "\n";
    }
}

echo "=== STARTING COMPREHENSIVE BACKEND API TESTS ===\n\n";

// 1. PUBLIC ENDPOINTS
testStep('Public: landing-data', function() {
    $res = callApi('GET', '/public/landing-data');
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Status ' . $res['status']];
});

testStep('Public: categories', function() {
    $res = callApi('GET', '/public/categories');
    $count = is_array($res['data']) ? count($res['data']) : 0;
    return ['passed' => $res['status'] === 200 && $count > 0, 'status' => $res['status'], 'message' => "Found $count categories"];
});

testStep('Public: barangays', function() {
    $res = callApi('GET', '/public/barangays');
    $count = is_array($res['data']) ? count($res['data']) : 0;
    return ['passed' => $res['status'] === 200 && $count > 0, 'status' => $res['status'], 'message' => "Found $count barangays"];
});

testStep('Public: faqs', function() {
    $res = callApi('GET', '/public/faqs');
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Status ' . $res['status']];
});

testStep('Public: benefits', function() {
    $res = callApi('GET', '/public/benefits');
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Status ' . $res['status']];
});

// 2. AUTHENTICATION
$applicantToken = null;
$adminToken = null;

testStep('Auth: Login Invalid Credentials', function() {
    $res = callApi('POST', '/auth/login', null, ['email' => 'invalid@example.com', 'password' => 'wrongpass']);
    return ['passed' => in_array($res['status'], [401, 422]), 'status' => $res['status'], 'message' => 'Correctly rejected invalid credentials'];
});

testStep('Auth: Login Applicant', function() use (&$applicantToken) {
    $res = callApi('POST', '/auth/login', null, [
        'email' => 'test.soloparent@example.com',
        'password' => 'Password123!'
    ]);
    $token = $res['data']['access_token'] ?? $res['data']['token'] ?? null;
    if ($res['status'] === 200 && !empty($token)) {
        $applicantToken = $token;
        return ['passed' => true, 'status' => 200, 'message' => 'Authenticated as ' . ($res['data']['user']['full_name'] ?? 'Applicant')];
    }
    return ['passed' => false, 'status' => $res['status'], 'message' => 'Failed to login: ' . json_encode($res['data'])];
});

testStep('Auth: Login Super Admin', function() use (&$adminToken) {
    $res = callApi('POST', '/auth/login', null, [
        'email' => 'cswdd.admin1@butuan.gov.ph',
        'password' => 'admin@CSWDD2026'
    ]);
    $token = $res['data']['access_token'] ?? $res['data']['token'] ?? null;
    if ($res['status'] === 200 && !empty($token)) {
        $adminToken = $token;
        return ['passed' => true, 'status' => 200, 'message' => 'Authenticated as ' . ($res['data']['user']['full_name'] ?? 'Admin')];
    }
    return ['passed' => false, 'status' => $res['status'], 'message' => 'Failed admin login: ' . json_encode($res['data'])];
});

testStep('Auth: GET /auth/me for Applicant', function() use (&$applicantToken) {
    $res = callApi('GET', '/auth/me', $applicantToken);
    $role = $res['data']['data']['role'] ?? $res['data']['role'] ?? '';
    return ['passed' => $res['status'] === 200 && $role === 'applicant', 'status' => $res['status'], 'message' => 'Role: ' . $role];
});

testStep('Auth: GET /auth/me for Admin', function() use (&$adminToken) {
    $res = callApi('GET', '/auth/me', $adminToken);
    $role = $res['data']['data']['role'] ?? $res['data']['role'] ?? '';
    return ['passed' => $res['status'] === 200 && in_array($role, ['admin', 'super_admin']), 'status' => $res['status'], 'message' => 'Role: ' . $role];
});

// 3. APPLICANT PROFILE
testStep('Profile: GET /profile', function() use (&$applicantToken) {
    $res = callApi('GET', '/profile', $applicantToken);
    $data = $res['data']['data'] ?? $res['data'] ?? [];
    return ['passed' => $res['status'] === 200 && !empty($data['first_name']), 'status' => $res['status'], 'message' => 'Name: ' . ($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? '')];
});

testStep('Profile: GET /profile/initial-status', function() use (&$applicantToken) {
    $res = callApi('GET', '/profile/initial-status', $applicantToken);
    return ['passed' => $res['status'] === 200 && isset($res['data']['is_initial_complete']), 'status' => $res['status'], 'message' => 'Complete: ' . ($res['data']['is_initial_complete'] ? 'true' : 'false')];
});

testStep('Profile: PUT /profile (Update Contact/Address)', function() use (&$applicantToken) {
    $res = callApi('PUT', '/profile', $applicantToken, [
        'first_name' => 'Maria',
        'middle_name' => 'Santos',
        'last_name' => 'Dela Cruz',
        'sex' => 'Female',
        'birth_date' => '1992-05-15',
        'contact_number' => '09171234567',
        'barangay' => 'Libertad',
        'city_municipality' => 'Butuan City',
        'province' => 'Agusan del Norte',
        'region' => 'Region XIII (Caraga)',
        'zip_code' => '8600'
    ]);
    return ['passed' => in_array($res['status'], [200, 204]), 'status' => $res['status'], 'message' => 'Profile updated successfully'];
});

// 4. PORTAL SUMMARY & NOTIFICATIONS
testStep('Portal: GET /portal/dashboard-summary', function() use (&$applicantToken) {
    $res = callApi('GET', '/portal/dashboard-summary', $applicantToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Status ' . $res['status']];
});

testStep('Notifications: GET /notifications', function() use (&$applicantToken) {
    $res = callApi('GET', '/notifications', $applicantToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Status ' . $res['status']];
});

testStep('Notifications: GET /notifications/unread-count', function() use (&$applicantToken) {
    $res = callApi('GET', '/notifications/unread-count', $applicantToken);
    return ['passed' => $res['status'] === 200 && isset($res['data']['count']), 'status' => $res['status'], 'message' => 'Count: ' . ($res['data']['count'] ?? 0)];
});

// 5. APPLICATION WORKFLOW
$newAppId = null;
$categoryCode = null;
$categoryId = null;
$requiredDocIds = [];

testStep('Application: Fetch Category Requirements', function() use (&$categoryCode, &$categoryId, &$requiredDocIds) {
    $res = callApi('GET', '/public/categories');
    if ($res['status'] === 200 && is_array($res['data']) && count($res['data']) > 0) {
        $selectedCat = null;
        foreach ($res['data'] as $cat) {
            if (in_array(strtolower($cat['code']), ['c', 'a2', 'a1'])) {
                $selectedCat = $cat;
                break;
            }
        }
        if (!$selectedCat) $selectedCat = $res['data'][0];

        $categoryCode = $selectedCat['code'];
        $categoryId = $selectedCat['id'];
        if (!empty($selectedCat['requirements'])) {
            foreach ($selectedCat['requirements'] as $r) {
                if ($r['is_required']) {
                    $requiredDocIds[] = $r['id'];
                }
            }
        }
        $reqCount = count($requiredDocIds);
        return ['passed' => true, 'status' => 200, 'message' => "Category: {$selectedCat['code']} ({$selectedCat['name']}), {$reqCount} required documents"];
    }
    return ['passed' => false, 'status' => $res['status'], 'message' => 'No categories found'];
});

testStep('Application: POST /applications (Create / Update Draft)', function() use (&$applicantToken, &$categoryCode, &$newAppId) {
    $payload = [
        'category' => $categoryCode,
        'solo_parent_category' => $categoryCode,
        'application_type' => 'new',
        'is_form_complete' => true,
        'first_name' => 'Maria',
        'middle_name' => 'Santos',
        'last_name' => 'Dela Cruz',
        'sex' => 'Female',
        'birth_date' => '1992-05-15',
        'place_of_birth' => 'Butuan City',
        'civil_status' => 'Single',
        'contact_number' => '09171234567',
        'barangay' => 'Libertad',
        'city_municipality' => 'Butuan City',
        'province' => 'Agusan del Norte',
        'educational_attainment' => 'College Graduate',
        'occupation' => 'Online Seller',
        'monthly_income' => 15000,
        'total_monthly_income' => 15000,
        'solo_parent_since' => '2020-01-01',
        'needs_problems' => 'Livelihood assistance and educational support for child.',
        'family_resources' => 'Small home business',
        'emergency_contact_name' => 'Juanita Santos',
        'emergency_contact_number' => '09181234567',
        'emergency_contact_relationship' => 'Mother',
        'emergency_contact_address' => 'Libertad, Butuan City',
        'household_members' => [
            [
                'name' => 'Juan Dela Cruz',
                'relationship' => 'Son',
                'birthdate' => '2018-03-20',
                'age' => 8,
                'civil_status' => 'Child',
                'educational_attainment' => 'Grade 2',
                'occupation' => 'Student',
                'monthly_income' => 0
            ]
        ]
    ];
    
    $res = callApi('POST', '/applications', $applicantToken, $payload);
    $app = $res['data']['application'] ?? $res['data'] ?? [];
    if (!empty($app['id'])) {
        $newAppId = $app['id'];
        
        // Also populate ApplicationForm via PUT /profile just like frontend ProfileForm does
        callApi('PUT', '/profile', $applicantToken, $payload);
        
        return ['passed' => true, 'status' => $res['status'], 'message' => "Application ID: {$newAppId}, Ref: " . ($app['reference_no'] ?? '')];
    }
    return ['passed' => false, 'status' => $res['status'], 'message' => 'Failed to save application: ' . json_encode($res['data'])];
});

testStep('Application: GET /applications/me', function() use (&$applicantToken, &$newAppId) {
    $res = callApi('GET', '/applications/me', $applicantToken);
    $app = $res['data']['application'] ?? null;
    return ['passed' => $res['status'] === 200 && $app !== null, 'status' => $res['status'], 'message' => "Found active application Ref: " . ($app['reference_no'] ?? 'N/A')];
});

// Create dummy test file for upload
$testFilePath = __DIR__ . '/test_doc.pdf';
if (!file_exists($testFilePath)) {
    file_put_contents($testFilePath, "%PDF-1.4 1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref 0 4 0000000000 65535 f 0000000009 00000 n 0000000052 00000 n 0000000098 00000 n trailer<</Size 4/Root 1 0 R>>startxref 178 %%EOF");
}

$uploadedDocId = null;
testStep('Document: Upload Document', function() use (&$applicantToken, &$newAppId, &$categoryCode, &$requiredDocIds, $testFilePath, &$uploadedDocId) {
    if (empty($requiredDocIds)) {
        return ['passed' => false, 'message' => 'No required document IDs found'];
    }
    $reqId = $requiredDocIds[0];
    $res = callApi('POST', '/documents/upload', $applicantToken, [
        'application_id' => $newAppId,
        'requirement_id' => $reqId,
        'doc_type' => "req_{$categoryCode}_0",
        'requirement_index' => 0,
    ], [
        'file' => [
            'path' => $testFilePath,
            'name' => 'test_birth_certificate.pdf',
            'mime' => 'application/pdf'
        ]
    ]);
    
    $doc = $res['data']['document'] ?? $res['data'] ?? [];
    if (!empty($doc['id'])) {
        $uploadedDocId = $doc['id'];
        return ['passed' => true, 'status' => $res['status'], 'message' => "Uploaded doc ID: {$uploadedDocId} for req: {$reqId}"];
    }
    return ['passed' => false, 'status' => $res['status'], 'message' => 'Upload failed: ' . json_encode($res['data'])];
});

testStep('Document: GET /documents/{id}/view', function() use (&$applicantToken, &$uploadedDocId) {
    if (!$uploadedDocId) return ['passed' => false, 'message' => 'No uploaded doc ID'];
    $res = callApi('GET', "/documents/{$uploadedDocId}/view", $applicantToken);
    return ['passed' => $res['status'] === 200 && (!empty($res['data']['url']) || !empty($res['data']['view_url'])), 'status' => $res['status'], 'message' => 'Generated view URL successfully'];
});

// Upload remaining required documents to make it ready
testStep('Document: Upload Remaining Requirements', function() use (&$applicantToken, &$newAppId, &$categoryCode, &$requiredDocIds, $testFilePath) {
    $uploadedCount = 0;
    foreach ($requiredDocIds as $idx => $reqId) {
        if ($idx === 0) continue; // already uploaded first
        $res = callApi('POST', '/documents/upload', $applicantToken, [
            'application_id' => $newAppId,
            'requirement_id' => $reqId,
            'doc_type' => "req_{$categoryCode}_{$idx}",
            'requirement_index' => $idx,
        ], [
            'file' => [
                'path' => $testFilePath,
                'name' => "test_requirement_{$idx}.pdf",
                'mime' => 'application/pdf'
            ]
        ]);
        if (!empty($res['data']['document']['id']) || $res['status'] === 200) {
            $uploadedCount++;
        }
    }
    return ['passed' => true, 'status' => 200, 'message' => "Uploaded {$uploadedCount} additional required documents"];
});

testStep('Application: Check /applications/submission-check', function() use (&$applicantToken, &$newAppId) {
    $res = callApi('GET', "/applications/submission-check?application_id={$newAppId}", $applicantToken);
    $ready = $res['data']['ready'] ?? false;
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Ready: ' . ($ready ? 'true' : 'false') . ', Missing docs: ' . count($res['data']['missing_documents'] ?? [])];
});

testStep('Application: POST /applications/{id}/submit (Commit Application)', function() use (&$applicantToken, &$newAppId) {
    $res = callApi('POST', "/applications/{$newAppId}/submit", $applicantToken);
    if ($res['status'] === 200) {
        return ['passed' => true, 'status' => 200, 'message' => 'Application committed and submitted for CSWDD review'];
    }
    return ['passed' => false, 'status' => $res['status'], 'message' => 'Submit response: ' . json_encode($res['data'])];
});

// 6. MESSAGING
$testMessageId = null;
testStep('Messages: Applicant sends message', function() use (&$applicantToken, &$testMessageId) {
    $res = callApi('POST', '/messages', $applicantToken, [
        'subject' => 'Question regarding my application requirements',
        'message' => 'Hello CSWDD Admin, I have submitted my requirements. Please check if everything is in order.'
    ]);
    if (!empty($res['data']['id']) || $res['status'] === 201 || $res['status'] === 200) {
        $testMessageId = $res['data']['id'] ?? null;
        return ['passed' => true, 'status' => $res['status'], 'message' => 'Message sent successfully'];
    }
    return ['passed' => false, 'status' => $res['status'], 'message' => 'Message send failed: ' . json_encode($res['data'])];
});

testStep('Messages: GET /messages for Applicant', function() use (&$applicantToken) {
    $res = callApi('GET', '/messages', $applicantToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Messages retrieved'];
});

testStep('Messages: GET /messages/unread-count', function() use (&$applicantToken) {
    $res = callApi('GET', '/messages/unread-count', $applicantToken);
    return ['passed' => $res['status'] === 200 && isset($res['data']['count']), 'status' => $res['status'], 'message' => 'Unread messages: ' . ($res['data']['count'] ?? 0)];
});

// 7. ADMIN ENDPOINTS & WORKFLOW
testStep('Admin: GET /admin/applications', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/applications', $adminToken);
    $data = $res['data']['data'] ?? $res['data'] ?? [];
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Found ' . count($data) . ' applications in registry'];
});

testStep('Admin: Filter Applications by Type (?type=new)', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/applications?type=new', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Filter works'];
});

testStep('Admin: Filter Applications by Type (?type=renewal)', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/applications?type=renewal', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Filter works'];
});

testStep('Admin: Filter Applications by Type (?type=loss_spic)', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/applications?type=loss_spic', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Filter works'];
});

testStep('Admin: GET /admin/applications/{id}', function() use (&$adminToken, &$newAppId) {
    if (!$newAppId) return ['passed' => false, 'message' => 'No application ID to inspect'];
    $res = callApi('GET', "/admin/applications/{$newAppId}", $adminToken);
    $hasApp = !empty($res['data']['application']['id']) || !empty($res['data']['id']);
    return ['passed' => $res['status'] === 200 && $hasApp, 'status' => $res['status'], 'message' => 'Retrieved application details: ' . ($res['data']['application']['reference_no'] ?? $res['data']['reference_no'] ?? '')];
});

testStep('Admin: GET /admin/applications/{appId}/documents', function() use (&$adminToken, &$newAppId) {
    if (!$newAppId) return ['passed' => false, 'message' => 'No application ID'];
    $res = callApi('GET', "/admin/applications/{$newAppId}/documents", $adminToken);
    $count = is_array($res['data']['requirements'] ?? null) ? count($res['data']['requirements']) : (is_array($res['data']) ? count($res['data']) : 0);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => "Found {$count} attached documents"];
});

testStep('Admin: Approve All Documents for Application', function() use (&$adminToken, &$newAppId) {
    if (!$newAppId) return ['passed' => false, 'message' => 'No application ID'];
    $res = callApi('POST', "/admin/applications/{$newAppId}/documents/approve-all", $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => $res['data']['message'] ?? 'Documents approved'];
});

testStep('Admin: Advance Application Status to Approved', function() use (&$adminToken, &$newAppId) {
    if (!$newAppId) return ['passed' => false, 'message' => 'No application ID'];
    $res = callApi('PATCH', "/admin/applications/{$newAppId}/status", $adminToken, [
        'status' => 'approved',
        'remarks' => 'Verified and qualified in accordance with RA 11861 requirements.'
    ]);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Status transitioned to approved: ' . ($res['data']['application']['status'] ?? '')];
});

testStep('Admin: Generate ID Card PDF', function() use (&$adminToken, &$newAppId) {
    if (!$newAppId) return ['passed' => false, 'message' => 'No application ID'];
    $res = callApi('GET', "/admin/applications/{$newAppId}/id-card.pdf", $adminToken);
    $isPdf = str_starts_with($res['raw'] ?? '', '%PDF') || strlen($res['raw'] ?? '') > 500;
    return ['passed' => $res['status'] === 200 && $isPdf, 'status' => $res['status'], 'message' => 'PDF ID card generated successfully (' . strlen($res['raw'] ?? '') . ' bytes)'];
});

testStep('Admin: GET /admin/categories', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/categories', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Categories count: ' . count($res['data'] ?? [])];
});

testStep('Admin: GET /admin/barangays', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/barangays', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Barangays count: ' . count($res['data'] ?? [])];
});

testStep('Admin: GET /admin/users', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/users', $adminToken);
    $users = $res['data']['data'] ?? $res['data'] ?? [];
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Users count: ' . count($users)];
});

testStep('Admin: GET /admin/announcements', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/announcements', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Announcements count: ' . count($res['data'] ?? [])];
});

testStep('Admin: GET /admin/resources', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/resources', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Resources count: ' . count($res['data'] ?? [])];
});

testStep('Admin: GET /admin/audit-logs', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/audit-logs', $adminToken);
    $logs = $res['data']['data'] ?? $res['data'] ?? [];
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Audit logs count: ' . count($logs)];
});

testStep('Admin: GET /admin/analytics/overview', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/analytics/overview', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Overview retrieved'];
});

testStep('Admin: GET /admin/analytics/demographics', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/analytics/demographics', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Demographics retrieved'];
});

testStep('Admin: GET /admin/analytics/trends', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/analytics/trends', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Trends retrieved'];
});

testStep('Admin: GET /admin/reports/export.csv', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/reports/export.csv', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'CSV report exported (' . strlen($res['raw']) . ' bytes)'];
});

testStep('Admin: GET /admin/messages', function() use (&$adminToken) {
    $res = callApi('GET', '/admin/messages', $adminToken);
    return ['passed' => $res['status'] === 200, 'status' => $res['status'], 'message' => 'Admin messages retrieved'];
});

// 8. RENEWAL & LOSS OF SPIC APPLICATIONS
testStep('Application: Renewal Submission (POST /applications/renew)', function() use (&$applicantToken) {
    $res = callApi('POST', '/applications/renew', $applicantToken, [
        'reason' => 'Annual renewal of Solo Parent Identification Card per RA 11861.',
    ]);
    $isOk = in_array($res['status'], [200, 201]) || ($res['status'] === 422 && strpos($res['raw'], 'active') !== false);
    return ['passed' => $isOk, 'status' => $res['status'], 'message' => 'Renewal response: ' . ($res['data']['message'] ?? $res['raw'])];
});

testStep('Application: Loss of SPIC Submission (POST /applications/loss-spic)', function() use (&$applicantToken) {
    $res = callApi('POST', '/applications/loss-spic', $applicantToken, [
        'circumstances' => 'ID card was misplaced during commute.',
        'date_lost' => '2026-09-15',
    ]);
    $isOk = in_array($res['status'], [200, 201]) || ($res['status'] === 422 && strpos($res['raw'], 'active') !== false);
    return ['passed' => $isOk, 'status' => $res['status'], 'message' => 'Loss of SPIC response: ' . ($res['data']['message'] ?? $res['raw'])];
});

// CLEANUP
if (file_exists($testFilePath)) {
    @unlink($testFilePath);
}

echo "\n=== BACKEND API TEST SUMMARY ===\n";
$total = count($results);
$passed = count(array_filter($results, fn($r) => $r['passed']));
$failed = $total - $passed;
echo "Total Tests: $total | Passed: $passed | Failed: $failed\n";
file_put_contents(__DIR__ . '/test_results.json', json_encode($results, JSON_PRETTY_PRINT));
