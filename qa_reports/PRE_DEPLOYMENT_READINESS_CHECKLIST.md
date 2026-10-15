# PRE-DEPLOYMENT READINESS CHECKLIST
**Project**: Solo Parent Portal 2 (SPIC Digital Portal)  
**Client / Agency**: City Social Welfare and Development Department (CSWDD), Butuan City  
**Target Release**: Production Launch  
**Evaluation Date**: October 2026  
**Auditor**: Senior QA Architect & Lead DevOps Auditor  
**Final Verdict**: **`CONDITIONALLY READY — PENDING VERIFICATION`**  

---

## 1. COMPREHENSIVE RELEASE CHECKLIST

### 1.1 Functional Correctness & Workflows

| Item # | Release Requirement | Target Subsystem | Verification Method | Status | Notes / Blockers |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **FC-01** | Public Landing, Benefits & Category Guide | Frontend / UI | Browser & AST Audit | **PASS** | Responsive, dynamic category explorer loads cleanly. |
| **FC-02** | Interactive Eligibility Self-Assessment | Frontend / Logic | Client-side rule audit | **PASS** | Dynamically recommends eligible RA 11861 categories. |
| **FC-03** | Email Registration & 6-Digit OTP Verification | Backend & Frontend | Feature Test & Email Service | **PASS** | 47/47 tests pass; OTP verified with 10m TTL. |
| **FC-04** | Mobile Registration & SMS Verification | Backend & Frontend | Code Audit (`AuthController`) | **FAIL** | Bypasses SMS OTP (`requires_verification=false`). |
| **FC-05** | Dual-Identifier Login (Email / Mobile) | Backend API | Feature Test (`AuthTest`) | **PASS** | Normalizes phone; authenticates via Sanctum. |
| **FC-06** | Self-Service Password Recovery for Email Users | Backend API | Feature Test | **PASS** | Secure tokens with 60m expiry; invalidates sessions. |
| **FC-07** | Self-Service Password Recovery for Mobile Users | Backend API | Code Audit (`AuthController`) | **FAIL** | Mobile accounts lack recovery endpoint (BUG-AUTH-002). |
| **FC-08** | Google OAuth Single-Use Ticket Exchange | Backend API | Feature Test | **PASS** | Prevents code replay; binds email accounts. |
| **FC-09** | New SPIC Application (Draft to Submission) | Frontend / Backend | Feature Test (`ApplicationTest`) | **PASS** | Auto-generates reference `SP-2026-XXXXX`. |
| **FC-10** | 15 Legal Solo Parent Categories (RA 11861) | Database & Forms | Schema & Model Audit | **PASS** | All 15 legal categories seeded and supported. |
| **FC-11** | 5-Section Official Application Form Fill | Frontend / Forms | Component & Request Audit | **PASS** | Personal, dependents, circumstances, needs, signature. |
| **FC-12** | HTML5 Canvas Digital Signature Capture | Frontend / Canvas | Base64 PNG encode test | **PASS** | Embedded cleanly into intake sheet and database. |
| **FC-13** | Document Correction & Resubmission Workflow | Admin & Applicant | Feature & State Test | **PASS** | Rejection note mandatory; preserves approved files. |
| **FC-14** | Annual SPIC Card Renewal Workflow | Backend & Frontend | Feature Test (`RenewalTest`) | **PASS** | Clones previous data; extends expiry by exactly 1 year. |
| **FC-15** | Lost SPIC Replacement Workflow (Applicant) | Applicant Portal | Feature Test | **PASS** | Mandatory Affidavit of Loss and modern photo. |
| **FC-16** | Lost SPIC Review & Approval (Administrator) | Admin Portal | Static Analysis (`oxlint`) | **FAIL** | Admin detail view crashes (BUG-FE-001: AlertCircle). |
| **FC-17** | Administrative Application Ledger & Filtering | Admin Portal | Backend & UI Test | **PASS** | Paginated; multi-criteria filter by category/barangay. |
| **FC-18** | Official Case & Beneficiary Code Assignment | Backend API | Lifecycle Feature Test | **PASS** | Formatted code generation on final qualification. |
| **FC-19** | Official SPIC Card Number & Date Assignment | Backend API | Lifecycle Feature Test | **PASS** | Assigns `SPIC-BXU-2026-XXXXX` and 1-year validity. |
| **FC-20** | Physical Card Release & Claimant Logging | Admin Portal | State Machine Audit | **PASS** | Transitions to `claimed`; persists audit log. |
| **FC-21** | In-Portal Applicant-Admin Messaging | Realtime / API | Message Service Audit | **PASS** | Thread isolation; unread badge counter. |
| **FC-22** | Announcements & Resource Management | Admin Portal | CRUD Endpoint Audit | **PASS** | Administrative publishing pipeline verified. |
| **FC-23** | Barangay Census & Population Management | Admin Portal | Controller Audit | **PASS** | Full coverage of Butuan City 86 barangays. |
| **FC-24** | Demographic Analytics & Trend Reports | Admin Portal | PostgreSQL Dialect Audit | **PASS** | Demographic age brackets and monthly trends render. |
| **FC-25** | Official SPIC Card PDF Generation | Backend / DomPDF | PDF Render Test | **PASS** | Photo, QR verification, official CSWDD seal layout. |
| **FC-26** | 5-Page General Intake Sheet PDF Generation | Backend / DomPDF | PDF Render Test | **PASS** | Clean pagination, family table, digital signature. |

---

### 1.2 Security Controls & Data Privacy (RA 10173)

| Item # | Release Requirement | Subsystem | Verification Method | Status | Notes / Blockers |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **SC-01** | Mandatory DPA 2012 Consent on Registration | Registration Form | Request Validation Audit | **PASS** | Blocks submission if consent checkbox is false. |
| **SC-02** | Cross-Account IDOR Access Denial | API Policies | Feature Test (`RoleTest`) | **PASS** | Applicant A cannot read or edit Applicant B data. |
| **SC-03** | Document Preview IDOR Protection | Storage API | Ownership Verification | **PASS** | Signed URLs require validated file ownership. |
| **SC-04** | Role Privilege Escalation Prevention | Sanctum / Middleware | Policy & Gate Audit | **PASS** | Ordinary admin cannot grant super-admin role. |
| **SC-05** | Self-Deactivation / Demotion Block | User Controller | Policy Audit | **PASS** | Super Admin cannot deactivate own account. |
| **SC-06** | Magic Byte File Header Inspection | Upload Pipeline | Binary Header Test | **PASS** | Blocks renamed executables (`%PDF`, `\xFF\xD8\xFF`, `\x89PNG`). |
| **SC-07** | Path Traversal Sanitization | Upload Pipeline | UUID Name Generation | **PASS** | Renames files to random UUIDs; strips traversal. |
| **SC-08** | Multi-Tier Throttling (Login 5/min) | Route Middleware | Rate Limiting Test | **PASS** | HTTP 429 returned after 5 failed attempts. |
| **SC-09** | OTP Attempt Capping (Max 5 failures) | Verification Service | Service State Test | **PASS** | Invalidates OTP code after 5 wrong tries. |
| **SC-10** | Session Invalidation on Password Reset | Auth Controller | Token Deletion Test | **PASS** | Revokes all Sanctum bearer tokens on password reset. |
| **SC-11** | Strict CORS Origin Whitelisting | Config / Middleware | `config/cors.php` | **FAIL** | Defaults to `*` if environment variable is missing. |
| **SC-12** | Database Audit Trail Logging | Audit Log Service | Event Listener Test | **PASS** | Records user_id, action, target_id, IP, and timestamp. |

---

### 1.3 Database & Storage Integrity

| Item # | Release Requirement | Subsystem | Verification Method | Status | Notes / Blockers |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **DS-01** | 34 Migrations Execute Cleanly | PostgreSQL / Schema | `migrate:status` CLI | **PASS** | All 34 migrations migrated with foreign keys. |
| **DS-02** | Two-Tier Staging to Permanent Bucket Copy | Supabase Storage | Promotion Service Test | **PASS** | Copies temp files to documents; deletes staging. |
| **DS-03** | Signed URL Time-To-Live Enforcement | Supabase S3 | Signed URL Test | **PASS** | Previews expire strictly after 15 minutes. |
| **DS-04** | Automated Temp Storage Cleanup Task | Artisan CLI | `storage:clean-temp` | **PASS** | Deletes staged uploads older than 48 hours. |
| **DS-05** | Document Promotion Reconciliation Task | Artisan CLI | `storage:reconcile` | **PASS** | Detects missing storage keys against database. |
| **DS-06** | Test Suite Database Dialect Parity | Test Runner | `phpunit.xml` inspection | **FAIL** | Tests use SQLite; production uses PostgreSQL (ARCH-DB-001). |

---

### 1.4 Production Infrastructure & Operational Readiness

| Item # | Release Requirement | Subsystem | Verification Method | Status | Notes / Blockers |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **OP-01** | Frontend Production Compilation | Vite 5 | `npm run build` | **PASS** | 542kB JS, 38kB CSS; builds in 1.42s. |
| **OP-02** | Automated Backend Feature Suite | PHPUnit | `php artisan test` | **PASS** | 47 tests passed (174 assertions) in 2.42s. |
| **OP-03** | Unverified User Pruning Utility | Artisan CLI | `auth:prune-unverified` | **PASS** | Cleans stale unverified accounts older than 7d. |
| **OP-04** | Scheduled Annual Renewal Reminders | Artisan CLI | `app:send-renewal-reminders` | **PASS** | Identifies cards expiring in 30 days and notifies. |
| **OP-05** | Production Environment Secrets Isolation | Server Config | `.env.example` Audit | **PASS** | No credentials or service-role keys committed in code. |
| **OP-06** | External SMS Gateway Provider Config | Production Config | `.env` Inspection | **BLOCKED** | SMS provider credentials required for mobile OTP. |

---

## 2. DEFECT REMEDIATION & RELEASE GATE SUMMARY

```
========================================================================================
                          RELEASE READINESS SCORECARD
========================================================================================
Total Evaluated Release Requirements          : 49
  - Passed Requirements                       : 44  (89.8%)
  - Failed Requirements                       : 4   (8.2%)
  - Blocked Requirements (External Dependency): 1   (2.0%)

Release Blocking Defects (P1):
  1. BUG-FE-001 : Unhandled ReferenceError in ApplicationDetail.jsx (Lost SPIC)
  2. SEC-AUTH-001: Missing SMS OTP challenge on mobile registration
  3. BUG-AUTH-002: Missing self-service password recovery for mobile-only users

Secondary Architecture Gaps (P2):
  4. SEC-CONF-001: Permissive CORS configuration fallback
  5. ARCH-DB-001 : Automated test divergence between SQLite and PostgreSQL
========================================================================================
```

---

## 3. FINAL SIGN-OFF DECISION

### Decision:
### **`CONDITIONALLY READY — PENDING VERIFICATION`**

### Deployment Sign-Off Conditions:
1. **Apply Frontend Bug Fix**: Resolve `BUG-FE-001` by adding `AlertCircle` to `ApplicationDetail.jsx:12`.
2. **Implement SMS Gateway Provider**: Connect an authorized Philippine SMS gateway (e.g., Semaphore) and enforce SMS OTP verification for mobile registration and password recovery.
3. **Pin CORS Configuration**: Update `backend/config/cors.php` to restrict allowed origins strictly to the authorized municipal domain.
4. **Execute Post-Remediation Regression Tests**: Verify that Lost SPIC review loads cleanly, mobile users can verify and reset passwords, and all automated tests continue to pass.

---

## 4. SIGN-OFF AUTHORIZATION

- **QA Lead Auditor**: Principal Software Quality Assurance Architect
- **Security Auditor**: Senior Full-Stack Cybersecurity Specialist
- **DevOps Lead**: Principal Systems Reliability Engineer
- **Date**: October 15, 2026
