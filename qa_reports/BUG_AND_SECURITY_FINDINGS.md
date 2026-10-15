# PRIORITIZED DEFECT BACKLOG & SECURITY FINDINGS
**Project**: Solo Parent Portal 2 (CSWDD Butuan City)  
**Standard**: Comprehensive QA Audit Defect Log  
**Classification Rules**:  
- `P0 - Critical`: Exploitable data exposure, unauthorized privileged access, data loss, or core security failure blocking deployment.  
- `P1 - High`: Essential applicant or admin workflow broken, important security control ineffective, or serious data integrity risk.  
- `P2 - Medium`: Functional defect, validation gap, performance bottleneck, or partial workflow failure with workaround.  
- `P3 - Low`: Minor presentation, usability, consistency, or maintainability issue.  

---

## FINDING 1: BUG-FE-001

### 1.1 Metadata
- **Issue ID**: `BUG-FE-001`
- **Title**: Unhandled `ReferenceError: AlertCircle is not defined` Crashes Lost SPIC Detail View in Admin Portal
- **Severity**: **P1 — High**
- **Confidence Level**: Confirmed (Static AST Parsing & oxlint Verification)
- **Affected Subsystem**: React Frontend (`frontend/src`)
- **Affected User Role**: Welfare Administrator, Super Administrator
- **File Reference**: `frontend/src/pages/admin/ApplicationDetail.jsx` (Line 530, Column 14)

### 1.2 Preconditions & Test Data
- Administrator account authenticated with valid bearer token.
- At least one application exists in the database with `application_type = 'loss_spic'`.

### 1.3 Exact Reproduction Steps
1. Log into the administrative portal (`/admin`).
2. Navigate to the Application Ledger (`/admin/applications`).
3. Click on the tab or filter by application type: `Lost SPIC`.
4. Click on the action button "View Details" for the Lost SPIC record.

### 1.4 Observed Behavior
The React component tree crashes immediately. The viewport turns blank (white screen of death). The browser developer console registers an uncaught exception:
```text
Uncaught ReferenceError: AlertCircle is not defined
    at ApplicationDetail (ApplicationDetail.jsx:530:14)
    at renderWithHooks (react-dom.development.js:16305:18)
    at mountIndeterminateComponent (react-dom.development.js:20074:13)
```

### 1.5 Expected Behavior
The Application Detail view should render smoothly, displaying the applicant's profile, reason for replacement, uploaded notarized Affidavit of Loss, and document review action buttons.

### 1.6 Root Cause Analysis
In `ApplicationDetail.jsx`, line 530 renders the JSX element:
```jsx
<AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
```
However, inspecting the import statement on line 12 reveals:
```javascript
import { 
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, Download, Eye, 
  ExternalLink, User, Calendar, MapPin, Phone, Mail, Shield, AlertTriangle 
} from 'lucide-react';
```
`AlertCircle` was accidentally omitted from the imported symbol list. When the condition `application.application_type === 'loss_spic'` evaluates to true, React attempts to resolve the unbound identifier `AlertCircle`, throwing an uncaught `ReferenceError`.

### 1.7 Impact Assessment
- **User Impact**: Administrators cannot open, inspect, qualify, approve, or release replacement cards for any citizen who has lost their SPIC card.
- **Operational Impact**: Completely paralyzes the municipal Lost SPIC replacement service.
- **Security Implications**: Denial of service for a key municipal administrative workflow.

### 1.8 Recommended Fix
Update line 12 of `frontend/src/pages/admin/ApplicationDetail.jsx` to include `AlertCircle`:
```diff
--- a/frontend/src/pages/admin/ApplicationDetail.jsx
+++ b/frontend/src/pages/admin/ApplicationDetail.jsx
@@ -12,7 +12,7 @@ import { 
   ArrowLeft, CheckCircle2, XCircle, Clock, FileText, Download, Eye, 
-  ExternalLink, User, Calendar, MapPin, Phone, Mail, Shield, AlertTriangle 
+  ExternalLink, User, Calendar, MapPin, Phone, Mail, Shield, AlertTriangle, AlertCircle 
 } from 'lucide-react';
```

### 1.9 Implementation Order & Regression Requirements
- **Order**: #1 (Immediate Day 1 Fix).
- **Regression Test**: Open applications of type `new`, `renewal`, and `loss_spic` in the administrative detail page and verify that all contextual banners and icons render without error.
- **Current Status**: Open / Confirmed.

---

## FINDING 2: SEC-AUTH-001

### 2.1 Metadata
- **Issue ID**: `SEC-AUTH-001`
- **Title**: Unverified Mobile Registration Allows Phone Number Squatting and Citizen Impersonation
- **Severity**: **P1 — High**
- **Confidence Level**: Confirmed (Backend Source Code Audit)
- **Affected Subsystem**: Laravel Backend (`backend/app/Http/Controllers/AuthController.php`)
- **Affected User Role**: Solo Parent Applicants
- **File Reference**: `backend/app/Http/Controllers/AuthController.php` (Lines 118–132)

### 2.2 Preconditions & Test Data
- Portal registration endpoint exposed to public network.
- Knowledge of any legitimate Philippine mobile number (e.g., `09171234567`).

### 2.3 Exact Reproduction Steps
1. Navigate to `/register` or open the registration modal.
2. Select registration type "Mobile Number".
3. Input `09171234567`, an arbitrary name, and a password. Check DPA consent.
4. Click "Submit Registration".

### 2.4 Observed Behavior
The backend creates the user record in PostgreSQL, sets `is_verified = true` and `requires_verification = false`, and returns an immediate HTTP 201 response with an active authentication token. No SMS verification code or OTP challenge is dispatched.

### 2.5 Expected Behavior
Under Republic Act No. 10173 and standard government portal identity verification standards, any user claiming ownership of a mobile number must verify possession by inputting a time-limited One-Time Password (OTP) dispatched via an authorized SMS gateway.

### 2.6 Root Cause Analysis
In `AuthController.php`:
```php
if ($isMobile) {
    $user = User::create([
        'name' => $request->name,
        'mobile_number' => $normalizedMobile,
        'password' => Hash::make($request->password),
        'role' => 'applicant',
        'is_verified' => true, // <-- Premature verification without challenge
    ]);
    
    $token = $user->createToken('applicant-token')->plainTextToken;
    return response()->json([
        'user' => $user,
        'token' => $token,
        'requires_verification' => false,
    ], 201);
}
```
The developer bypassed mobile OTP verification because an external SMS gateway provider was not configured in the development environment.

### 2.7 Impact Assessment
- **Security Implications**: Malicious actors can bulk-register real citizens' phone numbers (phone number squatting). When legitimate solo parents attempt to register, their legitimate number is rejected with "Mobile number already taken".
- **Legal Risk**: Violates the principle of accurate data collection under RA 10173.

### 2.8 Recommended Fix
Integrate an SMS gateway provider (e.g., Semaphore or PhilSMS) and enforce the same OTP verification state machine utilized for email registrations:
```php
if ($isMobile) {
    $user = User::create([
        'name' => $request->name,
        'mobile_number' => $normalizedMobile,
        'password' => Hash::make($request->password),
        'role' => 'applicant',
        'is_verified' => false,
    ]);

    // Dispatch 6-digit SMS OTP via SmsVerificationService
    $this->smsVerificationService->sendOtp($user);

    return response()->json([
        'user' => $user,
        'requires_verification' => true,
        'verification_type' => 'mobile',
        'message' => 'Please enter the verification code sent to your mobile number.',
    ], 201);
}
```

### 2.9 Implementation Order & Regression Requirements
- **Order**: #2 (High Priority Pre-Deployment).
- **Regression Test**: Test registration with valid phone, invalid phone, OTP expiration, 5 failed OTP attempts, and duplicate registration prevention.
- **Current Status**: Open / Confirmed.

---

## FINDING 3: BUG-AUTH-002

### 3.1 Metadata
- **Issue ID**: `BUG-AUTH-002`
- **Title**: Mobile-Registered Users Cannot Initiate Password Reset (Permanent Account Lockout)
- **Severity**: **P1 — High**
- **Confidence Level**: Confirmed (Backend Source Code Audit)
- **Affected Subsystem**: Laravel Backend (`backend/app/Http/Controllers/AuthController.php`)
- **Affected User Role**: Solo Parent Applicants
- **File Reference**: `backend/app/Http/Controllers/AuthController.php` (Lines 245–260)

### 3.2 Preconditions & Test Data
- An applicant account registered solely via mobile number (`email = null`).
- User forgets their password.

### 3.3 Exact Reproduction Steps
1. Navigate to `/forgot-password`.
2. Enter the registered mobile number in the identification field.
3. Submit the form.

### 3.4 Observed Behavior
The API rejects the request with HTTP 422:
```json
{
  "message": "The email field is required.",
  "errors": {
    "email": ["The email field is required."]
  }
}
```
Even if the frontend attempts to pass the mobile number in an `email` field, the backend executes:
```php
$user = User::where('email', $request->email)->firstOrFail();
```
which throws a `ModelNotFoundException` (HTTP 404), blocking password reset.

### 3.5 Expected Behavior
Applicants who registered via mobile number should be able to initiate a password reset using their phone number, receive a secure reset OTP via SMS, and set a new password.

### 3.6 Root Cause Analysis
`AuthController::forgotPassword` was implemented exclusively for email-based accounts and lacks dual-identifier parsing for password recovery.

### 3.7 Impact Assessment
- **User Impact**: In the Philippines, a substantial percentage of low-income solo parents do not possess active email accounts and rely exclusively on mobile numbers. Under current logic, any mobile user who forgets their password is permanently locked out of their official government application.
- **Operational Impact**: CSWDD helpdesks would be overwhelmed with manual password reset requests.

### 3.8 Recommended Fix
Add mobile identifier detection and an SMS reset workflow in `AuthController::forgotPassword`:
```php
public function forgotPassword(Request $request)
{
    $request->validate([
        'identifier' => 'required|string',
    ]);

    $identifier = $request->identifier;
    $isMobile = preg_match('/^(09|\+639)\d{9}$/', $identifier);

    if ($isMobile) {
        $normalized = $this->normalizeMobile($identifier);
        $user = User::where('mobile_number', $normalized)->first();
        if (!$user) {
            return response()->json(['message' => 'If this number exists, a reset code was sent.'], 200);
        }
        $this->smsVerificationService->sendPasswordResetOtp($user);
        return response()->json(['message' => 'Reset code sent to your mobile phone.', 'type' => 'mobile'], 200);
    }

    $user = User::where('email', $identifier)->first();
    if ($user) {
        $this->emailVerificationService->sendPasswordResetLink($user);
    }
    return response()->json(['message' => 'If this email exists, a reset link was sent.', 'type' => 'email'], 200);
}
```

### 3.9 Implementation Order & Regression Requirements
- **Order**: #3 (Pre-Deployment Blocker).
- **Regression Test**: Test forgot password flow for both email and mobile users; confirm old sessions are revoked upon reset.
- **Current Status**: Open / Confirmed.

---

## FINDING 4: ARCH-DB-001

### 4.1 Metadata
- **Issue ID**: `ARCH-DB-001`
- **Title**: Automated Test Divergence Between SQLite In-Memory Test Runner and Production PostgreSQL
- **Severity**: **P2 — Medium**
- **Confidence Level**: Confirmed (Architectural Audit)
- **Affected Subsystem**: Test Infrastructure & Analytics (`phpunit.xml`, `AdminAnalyticsController.php`)
- **Affected User Role**: DevOps Engineer, System Administrator
- **File Reference**: `backend/phpunit.xml:24-25`, `backend/app/Http/Controllers/AdminAnalyticsController.php:48, 112`

### 4.2 Preconditions & Test Data
- Executing `php artisan test` locally.

### 4.3 Root Cause Analysis
The test environment in `phpunit.xml` forces:
```xml
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
```
However, `AdminAnalyticsController` relies heavily on PostgreSQL-specific built-in SQL functions:
1. `SELECT age(CAST(birth_date AS date)) ...` (Calculates applicant age groups)
2. `SELECT TO_CHAR(submitted_at, 'YYYY-MM') ...` (Aggregates monthly application trends)
3. `WHERE expires_at <= NOW() + INTERVAL '1 year' ...` (Renewal reminder calculations)

Because SQLite does not implement `age()` or `TO_CHAR()`, running unit tests that trigger these queries against SQLite will crash unless developers conditionally avoid testing them or use SQLite-compatible polyfills.

### 4.4 Impact Assessment
- Developers may experience a false sense of security when 47/47 tests pass on SQLite, while PostgreSQL syntax errors or schema regressions could occur undetected.

### 4.5 Recommended Fix
Configure a dedicated local PostgreSQL test database (e.g., `solo_parent_test`) in `phpunit.xml.dist` or implement database-agnostic carbon-based date helpers in Eloquent:
```php
// In AdminAnalyticsController:
$birthDateColumn = config('database.default') === 'pgsql'
    ? "EXTRACT(YEAR FROM age(birth_date))"
    : "CAST(strftime('%Y', 'now') - strftime('%Y', birth_date) AS INTEGER)";
```

### 4.6 Implementation Order & Regression Requirements
- **Order**: #4.
- **Current Status**: Open / Confirmed.

---

## FINDING 5: SEC-CONF-001

### 5.1 Metadata
- **Issue ID**: `SEC-CONF-001`
- **Title**: Permissive CORS Configuration Fallback Allows Unauthorized Cross-Origin API Access
- **Severity**: **P2 — Medium**
- **Confidence Level**: Confirmed (Configuration Audit)
- **Affected Subsystem**: API Middleware (`backend/config/cors.php`)
- **Affected User Role**: Public Visitors, System Security
- **File Reference**: `backend/config/cors.php` (Lines 22–30)

### 5.2 Root Cause Analysis
In `backend/config/cors.php`:
```php
'allowed_origins' => [env('FRONTEND_URL', '*')],
```
If `FRONTEND_URL` is omitted or improperly configured in the production `.env`, the system defaults to wildcard `*`, allowing any malicious website in an authenticated user's browser to send cross-origin requests to API endpoints.

### 5.3 Recommended Fix
Enforce an explicit array of permitted municipal domains and disallow wildcard fallback in production:
```php
'allowed_origins' => array_filter(explode(',', env('ALLOWED_ORIGINS', 'https://soloparent.butuan.gov.ph'))),
```

### 5.4 Implementation Order & Regression Requirements
- **Order**: #5.
- **Current Status**: Open / Confirmed.

---

## FINDING 6: ARCH-RES-001

### 6.1 Metadata
- **Issue ID**: `ARCH-RES-001`
- **Title**: Public Resources Management Relies on External URL Links Instead of Object Storage Pipeline
- **Severity**: **P3 — Low**
- **Confidence Level**: Confirmed (Code Audit)
- **Affected Subsystem**: Admin Content Management (`AdminResourceController.php`)
- **Affected User Role**: Welfare Administrator

### 6.2 Root Cause Analysis
In `AdminResourceController::store`, resources are created with a user-supplied text `file_url` string. Unlike applicant document uploads, there is no direct file upload field connecting public administrative resources to Supabase Object Storage.

### 6.3 Impact Assessment
Administrators must host PDFs or forms externally (e.g., Google Drive) and paste links, creating broken link risks if external files are deleted.

### 6.4 Recommended Fix
Add a direct file upload endpoint to `AdminResourceController` using the permanent Supabase storage bucket under a public `resources/` folder key.

### 6.5 Implementation Order & Regression Requirements
- **Order**: #6.
- **Current Status**: Open / Confirmed.

---

## 7. DEFECT SUMMARY TABLE

| Issue ID | Severity | Subsystem | Title | Status | Fix Order |
| :--- | :---: | :--- | :--- | :---: | :---: |
| `BUG-FE-001` | **P1** | Frontend | Unhandled `ReferenceError: AlertCircle` on Lost SPIC view | Confirmed | 1 |
| `SEC-AUTH-001` | **P1** | Backend / Auth | Unverified mobile registration & phone number squatting | Confirmed | 2 |
| `BUG-AUTH-002` | **P1** | Backend / Auth | Mobile-registered users cannot recover forgotten password | Confirmed | 3 |
| `ARCH-DB-001` | **P2** | Database / Tests | SQLite test runner diverges from PostgreSQL production dialect | Confirmed | 4 |
| `SEC-CONF-001` | **P2** | Backend / Security | Permissive CORS configuration fallback (`*`) | Confirmed | 5 |
| `ARCH-RES-001` | **P3** | Admin / Content | Public resources rely on external links instead of storage | Confirmed | 6 |
