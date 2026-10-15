# Solo Parent Portal System: Comprehensive Technical Audit & System Architecture Report

**City Social Welfare and Development Department (CSWDD) — Butuan City**  
**Republic Act No. 11861 (Expanded Solo Parents Welfare Act) & Republic Act No. 10173 (Data Privacy Act of 2012)**

---

## Table of Contents
1. [Executive Summary & System Purpose](#1-executive-summary--system-purpose)
2. [Complete Technology Stack](#2-complete-technology-stack)
3. [Repository & Directory Structure Breakdown](#3-repository--directory-structure-breakdown)
4. [Database Architecture & Entity Relationships](#4-database-architecture--entity-relationships)
5. [Complete API Directory & Endpoint Specifications](#5-complete-api-directory--endpoint-specifications)
6. [Security Architecture & Cyber Defense Mechanisms](#6-security-architecture--cyber-defense-mechanisms)
7. [Rate Limiting & Throttling Matrix](#7-rate-limiting--throttling-matrix)
8. [Two-Tier Storage Architecture & Document Lifecycle](#8-two-tier-storage-architecture--document-lifecycle)
9. [End-to-End Business Logic & Workflows](#9-end-to-end-business-logic--workflows)
10. [PDF Generation & Template Coordinate Overlay Engine](#10-pdf-generation--template-coordinate-overlay-engine)
11. [Administrative Portal & Decision Support Engine](#11-administrative-portal--decision-support-engine)
12. [Automated Maintenance, Console Commands & Cron Tasks](#12-automated-maintenance-console-commands--cron-tasks)
13. [Deployment, Configuration & Handover Guide](#13-deployment-configuration--handover-guide)

---

## 1. Executive Summary & System Purpose

The **Solo Parent Portal System** is an enterprise-grade government web portal developed for the **City Social Welfare and Development Department (CSWDD) of Butuan City, Agusan del Norte, Philippines**. The system digitizes, automates, and accelerates the end-to-end registration, verification, qualification assessment, issuance, renewal, and replacement of **Solo Parent Identification Cards (SPIC)** in compliance with the mandates of **Republic Act No. 11861** (The Expanded Solo Parents Welfare Act) while safeguarding citizens' private identifying data pursuant to **Republic Act No. 10173** (The Data Privacy Act of 2012).

### Strategic Objectives
1. **Eliminate Bureaucratic Delays**: Transition from paper-heavy physical filing to a responsive, multi-channel self-service portal accessible 24/7 on mobile phones, tablets, and desktop computers.
2. **Strict Compliance with RA 11861**: Enforce standardized documentary requirements across all qualifying solo parent categories (Article 4, Sections A through F), official 1-year card validity lifecycles, and automated 30-day renewal reminders.
3. **Robust CSWDD Administrative Adjudication**: Empower social workers and administrative staff with comprehensive review tools, document verification interfaces, audit trails, and official PDF generation pipelines.
4. **Data Integrity & Storage Security**: Implement a two-tier object storage hierarchy (temporary staging vs. permanent archival) preventing unauthorized access, orphaned storage consumption, and data leakage.

---

## 2. Complete Technology Stack

The system is engineered as a decoupled full-stack web application with strict separation between client-side user experience and server-side business rules and persistence.

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                        |
|  React 19 + Vite 8 + Tailwind CSS 4 + Radix UI / Shadcn + Sonner + Signature Pad     |
+---------------------------------------------------------------------------------------+
                                           |  HTTPS / REST / JSON (Axios)
                                           v
+---------------------------------------------------------------------------------------+
|                                 APPLICATION BACKEND                                   |
|  Laravel 13 (PHP 8.3+) + Laravel Sanctum + Barryvdh DomPDF + FPDI / FPDF + Flysystem  |
+---------------------------------------------------------------------------------------+
                       |                                           |
                       v                                           v
+-----------------------------------------------+ +------------------------------------+
|               DATABASE TIER                   | |            STORAGE TIER            |
|  PostgreSQL (Supabase Engine)                 | |  S3-Compatible Supabase Object     |
|  - Relational Schema with UUID Primary Keys   | |  Storage:                          |
|  - Row-Level Security (RLS)                   | |  1. solo-parent-temp (Staging)     |
|  - Composite B-Tree Performance Indexes       | |  2. solo-parent-documents (Perm)   |
+-----------------------------------------------+ +------------------------------------+
```

### 2.1 Frontend Stack
- **Core Framework**: React 19.2.7 running on Vite 8.1.1 (Hot Module Replacement, ES Modules, dynamic code-splitting via `React.lazy` and `Suspense`).
- **Styling Architecture**: Tailwind CSS 4.3.3, `@tailwindcss/postcss`, PostCSS 8.5.20, Autoprefixer 10.5.4, and `tailwindcss-animate`.
- **UI Component System**: Custom Accessible Design System built on top of Radix UI primitives (`@radix-ui/react-*` including Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu, Label, Progress, Select, Separator, Slot, Switch, Tabs, Tooltip).
- **Icons & Visual Language**: `lucide-react` (v1.25.0) vector iconography.
- **Client Routing**: `react-router-dom` (v7.18.1) with role-based auth guards (`RequireAuth`, `RequireInitialProfile`).
- **HTTP Client**: Axios (v1.18.1) configured with dynamic LAN/WAN baseUrl resolution, in-flight request deduplication, and in-memory TTL caching.
- **Form State & Validation**: `react-hook-form` (v7.82.0), `@hookform/resolvers`, and `zod` (v4.4.3).
- **Digital Signature**: `signature_pad` (v5.1.3) capturing vector touch/mouse strokes as base64 PNG data URIs.
- **Notification Feedback**: `sonner` (v2.0.7) for toast messages.
- **OAuth Integration**: `@react-oauth/google` (v0.13.5).
- **Date Manipulation**: `date-fns` (v4.4.0).
- **Linter**: `oxlint` (v1.71.0) ultra-fast rust-based static analysis.

### 2.2 Backend Stack
- **Core Engine**: Laravel Framework 13.8 on PHP 8.3+.
- **Authentication**: Laravel Sanctum 4.3 (Stateful API tokens, hashed bearer tokens).
- **Database Engine**: PostgreSQL on Supabase (configured with UUID primary keys, connection pooling, and prepared statements).
- **Cloud Storage Client**: `league/flysystem-aws-s3-v3` (v3.35) and custom `SupabaseStorageService` interacting with Supabase Storage REST APIs via Laravel HTTP client.
- **PDF Generation**:
  - `barryvdh/laravel-dompdf` (v3.1): HTML/CSS-to-PDF rendering for ID cards and statistical reports.
  - `setasign/fpdi` (v2.6) & `setasign/fpdf` (v1.9): Coordinate-level binary PDF template overlay engine for the official CSWDD Solo Parent Application Form.
- **OAuth & API Client**: `google/apiclient` (v2.19) and `firebase/php-jwt`.
- **Mail Service**: Laravel Mail with Mailable classes (`VerificationCodeMail`), supporting SMTP, Postmark, Resend, and SES.
- **Queue & Scheduling**: Laravel Artisan Console & Task Scheduler (`Schedule::command('storage:clean-temp')->daily()`).

---

## 3. Repository & Directory Structure Breakdown

```
Solo Parent Portal System/
├── .agents/                    # Agent customization rules, workflows & IDE skills
├── backend/                    # Laravel 13 REST API Application
│   ├── app/
│   │   ├── Console/Commands/   # Artisan maintenance & data sanitation commands
│   │   ├── Http/
│   │   │   ├── Controllers/    # 18 Specialized REST API Controllers
│   │   │   ├── Middleware/     # EnsureAdmin, Sanctum Auth, Throttle Middleware
│   │   │   ├── Requests/       # Form Request Validation classes (Auth, Profile, Apps)
│   │   │   └── Resources/      # API Resource Transformers (User, Profile)
│   │   ├── Mail/               # Verification email mailables
│   │   ├── Models/             # 16 Eloquent Models with UUIDs and relationships
│   │   └── Services/           # Supabase Storage & Storage Path Builder Services
│   ├── bootstrap/              # App bootstrap, middleware aliasing, exception handlers
│   ├── config/                 # App, Auth, Cache, CORS, Database, Storage, Mail, Services
│   ├── database/
│   │   ├── migrations/         # 34 Postgres schema, RLS, index & table migrations
│   │   └── seeders/            # Categories, documentary requirements & admin seeders
│   ├── resources/
│   │   ├── pdf-templates/      # Official CSWDD application form PDF template
│   │   └── views/pdf/          # Blade templates for DomPDF (id_card, statistics)
│   ├── routes/
│   │   ├── api.php             # Comprehensive API routes definition
│   │   └── console.php         # Artisan commands and daily task schedules
│   └── tests/                  # Feature and unit test suites
├── frontend/                   # React 19 / Vite Single Page Application
│   ├── public/                 # Static assets (seal.gif, cswdd.jpg, logos)
│   └── src/
│       ├── assets/             # Brand graphics and images
│       ├── components/         # Reusable UI & Layout Components
│       │   ├── ui/             # 22 Shadcn/Radix atomic components
│       │   ├── AdminSidebar.jsx
│       │   ├── AdminTopBar.jsx
│       │   ├── GovernmentHeader.jsx
│       │   ├── Navbar.jsx
│       │   └── RequirementUploadField.jsx
│       ├── data/               # RA 11861 Client-side categories & requirements
│       ├── lib/                # API client (api.js), form validation, utilities
│       ├── pages/
│       │   ├── admin/          # 13 CSWDD Administrative Pages
│       │   ├── portal/         # 15 Solo Parent Applicant Portal Pages
│       │   ├── Landing.jsx     # Comprehensive public landing page
│       │   ├── Login.jsx       # Dual-channel login
│       │   ├── Register.jsx    # 3-Step registration with CAPTCHA & OTP
│       │   └── GoogleCallback.jsx # OAuth ticket exchange
│       ├── App.jsx             # Root Router & Layout Tree
│       └── main.jsx            # DOM entry point
└── extras/                     # Official PDF reference forms, CSWDD seals, ID assets
```

---

## 4. Database Architecture & Entity Relationships

The database utilizes **PostgreSQL** with 16 dedicated relational tables. All primary keys are 36-character **Universally Unique Identifiers (UUID v4)** generated server-side using Laravel's `HasUuids` trait.

```
                              +--------------------------+
                              |          users           |
                              |--------------------------|
                              | id (UUID, PK)            |
                              | email (string, unique)   |
                              | phone_number (string)    |
                              | password_hash (string)   |
                              | role (applicant/admin)   |
                              | is_active (bool)         |
                              +--------------------------+
                                     |            |
                     1-to-1          |            | 1-to-many
        +----------------------------+            +----------------------------+
        |                                                                      |
        v                                                                      v
+--------------------------+                                       +--------------------------+
|    applicant_profiles    |                                       |       applications       |
|--------------------------|                                       |--------------------------|
| id (UUID, PK)            |                                       | id (UUID, PK)            |
| user_id (FK -> users)    |                                       | user_id (FK -> users)    |
| first_name, last_name    |                                       | reference_no (unique)    |
| birth_date, sex, contact |                                       | application_type         |
| barangay_id (FK)         |                                       | category_id (FK)         |
| is_profile_complete      |                                       | status, status_reason    |
+--------------------------+                                       | id_card_number, case_no  |
                                                                   | submitted_at, decided_at |
                                                                   +--------------------------+
                                                                             |      |
                                        +------------------------------------+      |
                                 1-to-1 |                            1-to-many      | 1-to-many
                                        v                                           v
                       +----------------------------------+       +------------------------------------+
                       |        application_forms         |       |       application_documents        |
                       |----------------------------------|       |------------------------------------|
                       | id (UUID, PK)                    |       | id (UUID, PK)                      |
                       | application_id (FK)              |       | application_id (FK)                |
                       | philsys_card_number              |       | requirement_id (FK)                |
                       | place_of_birth, civil_status     |       | storage_path                       |
                       | employment_status, income        |       | temporary_storage_path             |
                       | is_indigent, is_4ps, is_pwd      |       | permanent_storage_path             |
                       | solo_parent_since, needs_probs   |       | storage_status (temporary/promoted)|
                       | emergency_contact_name / number  |       | review_status (pending/approved...) |
                       | signature_data (base64 PNG)      |       +------------------------------------+
                       +----------------------------------+
                                        |
                                 1-to-many
                                        v
                       +----------------------------------+
                       |    application_family_members    |
                       |----------------------------------|
                       | id (UUID, PK)                    |
                       | application_id (FK)              |
                       | name, relationship, age          |
                       | date_of_birth, educational_attain|
                       +----------------------------------+
```

### 4.1 Detailed Table Catalog

#### `users`
Core identity table supporting local email/password, Philippine mobile number login, and Google OAuth federated identities.
- `id` (UUID, Primary Key)
- `email` (VARCHAR 255, Nullable, Unique)
- `phone_number` (VARCHAR 40, Nullable, Unique index, normalized to `+639XXXXXXXXX`)
- `password_hash` (VARCHAR 255)
- `full_name` (VARCHAR 255)
- `role` (VARCHAR 30: `applicant`, `admin`, `super_admin`)
- `auth_provider` (VARCHAR 30: `local`, `google`)
- `picture` (VARCHAR 500, Nullable)
- `is_active` (BOOLEAN, default `false` until verified)
- `google_id` (VARCHAR 100, Nullable)
- `email_verified_at` (TIMESTAMP, Nullable)
- `dpa_consent` (BOOLEAN, default `false`)
- `dpa_consented_at` (TIMESTAMP, Nullable)
- `dpa_consent_ip` (VARCHAR 60, Nullable)
- `created_at`, `updated_at`

#### `email_verifications`
Cryptographically hashes verification codes for email activation and password resets.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `code_hash` (VARCHAR 255, bcrypt hashed 6-digit OTP)
- `type` (VARCHAR 30: `registration`, `password_reset`)
- `expires_at` (TIMESTAMP, 10-minute expiry window)
- `attempts` (INTEGER, default 0, max 5 attempts before invalidation)
- `used_at` (TIMESTAMP, Nullable, single-use gatekeeper)

#### `barangays`
The 86 official barangays of Butuan City for territorial jurisdiction assignment.
- `id` (UUID, Primary Key)
- `name` (VARCHAR 160, Unique)
- `is_active` (BOOLEAN, default `true`, indexed)

#### `applicant_profiles`
The primary demographic and geographic profile of each citizen.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE, Unique)
- `first_name`, `middle_name`, `last_name`, `suffix`
- `sex` (VARCHAR 20), `birth_date` (VARCHAR 20)
- `contact_number` (VARCHAR 40), `telephone` (VARCHAR 40)
- `barangay_id` (UUID, Foreign Key -> `barangays.id` ON DELETE SET NULL)
- `house_no`, `street`, `city_municipality` (default `'Butuan City'`), `province` (default `'Agusan del Norte'`), `region` (default `'Caraga'`), `zip_code` (default `'8600'`)
- `is_profile_complete` (BOOLEAN, default `false`)

#### `solo_parent_categories`
Qualifying classifications defined under Republic Act No. 11861.
- `id` (UUID, Primary Key)
- `code` (VARCHAR 20, Unique, e.g., `'a1'`, `'a2'`, `'c'`, `'RENEWAL'`, `'LOSS_SPIC'`)
- `name` (VARCHAR 220)
- `description` (TEXT, Nullable)
- `display_order` (INTEGER, default 0)
- `is_active` (BOOLEAN, default `true`, indexed)

#### `documentary_requirements`
Checklist requirements attached to each category.
- `id` (UUID, Primary Key)
- `category_id` (UUID, Foreign Key -> `solo_parent_categories.id` ON DELETE CASCADE)
- `name` (VARCHAR 255)
- `description` (TEXT, Nullable)
- `is_required` (BOOLEAN, default `true`)

#### `applications`
Core transactional application record tracking status, adjudication, and official card numbers.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE, Indexed)
- `reference_no` (VARCHAR 40, Unique Index, e.g., `'SP-202610-A1B2C3'`)
- `application_type` (VARCHAR 20: `'new'`, `'renewal'`, `'loss_spic'`)
- `category_id` (UUID, Foreign Key -> `solo_parent_categories.id` ON DELETE SET NULL)
- `status` (VARCHAR 48: `'draft'`, `'submitted'`, `'under_initial_review'`, `'documents_under_review'`, `'for_document_correction'`, `'qualified'`, `'applicant_verification'`, `'approved'`, `'ready_for_pickup'`, `'completed'`, `'released'`, `'rejected'`, `'cancelled'`, `'expired'`)
- `status_reason` (TEXT, Nullable, mandatory on rejection or cancellation)
- `id_card_number` (VARCHAR 60, Nullable, official SPIC ID number)
- `case_number` (VARCHAR 40, Nullable, CSWDD Case Docket number)
- `beneficiary_code` (VARCHAR 60, Nullable)
- `date_issued` (DATE, Nullable)
- `previous_application_id` (UUID, Nullable, links renewals to previous applications)
- `previous_id_card_number` (VARCHAR 60, Nullable)
- `renewal_reminder_sent` (BOOLEAN, default `false`)
- `existing_spic_issue_date`, `existing_spic_expiry_date` (DATE, Nullable)
- `loss_circumstance` (TEXT, Nullable, narrative for lost ID replacement)
- `applicant_verified_at` (TIMESTAMP, Nullable)
- `is_form_complete` (BOOLEAN, default `false`)
- `are_documents_complete` (BOOLEAN, default `false`)
- `submitted_at`, `decided_at`, `released_at` (TIMESTAMP, Nullable)
- `reviewed_by` (UUID, Foreign Key -> `users.id` ON DELETE SET NULL)

#### `application_forms`
Detailed survey information required on the official CSWDD application form.
- `id` (UUID, Primary Key)
- `application_id` (UUID, Foreign Key -> `applications.id` ON DELETE CASCADE, Unique)
- `philsys_card_number`, `place_of_birth`, `civil_status`, `religion`, `nationality`
- `educational_attainment`, `occupation`, `employment_status`, `employer_name`, `company_agency`, `monthly_income`
- `is_indigent`, `is_4ps_beneficiary`, `household_id_4ps`, `is_indigenous`, `indigenous_affiliation`, `is_lgbtqia`, `is_pwd`
- `solo_parent_since` (VARCHAR 20), `classification_details` (TEXT), `needs_problems` (TEXT)
- `emergency_contact_name`, `emergency_contact_relationship`, `emergency_contact_address`, `emergency_contact_number`
- `signature_data` (LONGTEXT, Base64 PNG signature string)

#### `application_family_members`
Household composition and dependent children.
- `id` (UUID, Primary Key)
- `application_id` (UUID, Foreign Key -> `applications.id` ON DELETE CASCADE, Indexed)
- `member_type` (VARCHAR 20: `'child'`, `'household'`)
- `name` (VARCHAR 200)
- `relationship` (VARCHAR 120, Nullable)
- `age` (INTEGER, Nullable)
- `civil_status` (VARCHAR 60, Nullable)
- `educational_attainment` (VARCHAR 120, Nullable)
- `date_of_birth` (DATE, Nullable)
- `monthly_income` (VARCHAR 60, Nullable)

#### `application_documents`
Documentary evidence records linking uploads to physical cloud storage objects.
- `id` (UUID, Primary Key)
- `application_id` (UUID, Foreign Key -> `applications.id` ON DELETE CASCADE, Indexed)
- `requirement_id` (UUID, Foreign Key -> `documentary_requirements.id` ON DELETE CASCADE, Indexed)
- `user_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE, Indexed)
- `original_filename` (VARCHAR 400)
- `storage_path` (VARCHAR 500, legacy path)
- `temporary_storage_path` (VARCHAR 500, Nullable)
- `permanent_storage_path` (VARCHAR 500, Nullable)
- `storage_status` (VARCHAR 20: `'temporary'`, `'promoted'`)
- `promoted_at` (TIMESTAMP, Nullable)
- `promotion_error` (TEXT, Nullable)
- `promotion_attempts` (INTEGER, default 0)
- `mime_type` (VARCHAR 120), `file_size` (BIGINT)
- `review_status` (VARCHAR 32: `'pending'`, `'under_review'`, `'approved'`, `'verified'`, `'rejected'`, `'needs_replacement'`, `'replaced'`)
- `review_note` (TEXT, Nullable)
- `reviewed_by` (UUID, Foreign Key -> `users.id` ON DELETE SET NULL)
- `reviewed_at` (TIMESTAMP, Nullable)

#### `application_status_history`
Append-only immutable audit trail of every status transition.
- `id` (UUID, Primary Key)
- `application_id` (UUID, Foreign Key -> `applications.id` ON DELETE CASCADE, Indexed)
- `from_status` (VARCHAR 48, Nullable)
- `to_status` (VARCHAR 48)
- `note` (TEXT, Nullable)
- `changed_by` (UUID, Foreign Key -> `users.id` ON DELETE SET NULL)
- `changed_by_name` (VARCHAR 255, Nullable)
- `created_at` (TIMESTAMP)

#### `audit_logs`
System-wide security and compliance activity log.
- `id` (UUID, Primary Key)
- `admin_id` (UUID, Foreign Key -> `users.id` ON DELETE SET NULL, Indexed)
- `action` (VARCHAR 80, e.g., `'application.status_changed'`, `'document.uploaded'`, `'barangay.created'`)
- `entity_type` (VARCHAR 60), `entity_id` (UUID, Nullable)
- `previous_state` (JSONB, Nullable), `new_state` (JSONB, Nullable)
- `reason` (TEXT, Nullable)
- `ip_address` (VARCHAR 60, Nullable)
- `created_at` (TIMESTAMP)

#### `notifications`
In-app notification system for status updates, review remarks, and reminders.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE, Indexed)
- `type` (VARCHAR 60: `'status_update'`, `'document_review'`, `'renewal_reminder'`, `'message_received'`)
- `title` (VARCHAR 200), `message` (TEXT), `link` (VARCHAR 300, Nullable)
- `is_read` (BOOLEAN, default `false`, Indexed)

#### `messages`
Bidirectional communication channel between solo parent applicants and CSWDD case workers.
- `id` (UUID, Primary Key)
- `application_id` (UUID, Foreign Key -> `applications.id` ON DELETE CASCADE, Nullable, Indexed)
- `sender_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE, Indexed)
- `recipient_id` (UUID, Foreign Key -> `users.id` ON DELETE SET NULL, Nullable, Indexed)
- `sender_type` (VARCHAR 30: `'applicant'`, `'admin'`)
- `message` (TEXT)
- `is_read` (BOOLEAN, default `false`)
- `read_at` (TIMESTAMP, Nullable)

#### `announcements` & `resource_items`
Public knowledge base items, news, policy advisories, downloadable sample affidavits, and guidelines.

### 4.2 Composite Performance Indexes
High-throughput database queries are accelerated via composite B-tree indexes defined in migration `2026_10_02_203500_add_composite_performance_indexes.php`:
- `idx_apps_status_created_at` on `applications (status, created_at)`
- `idx_apps_user_status` on `applications (user_id, status)`
- `idx_apps_cat_status` on `applications (category_id, status)`
- `idx_docs_app_req_status` on `application_documents (application_id, requirement_id, review_status)`
- `idx_status_hist_app_created` on `application_status_history (application_id, created_at)`
- `idx_messages_thread` on `messages (application_id, created_at)` and `messages (recipient_id, is_read)`

---

## 5. Complete API Directory & Endpoint Specifications

All endpoints are hosted under `/api`. All JSON responses adhere to predictable REST semantics.

### 5.1 Public Endpoints (Unauthenticated)

| Method | Endpoint | Throttle | Description |
|---|---|---|---|
| `GET` | `/api/auth/captcha` | 60/min | Generates a single-use mathematical challenge puzzle (`reg_captcha:{uuid}`) stored in Cache for 10 minutes. |
| `POST` | `/api/auth/register/start` | 15/min | Initiates 3-step registration. Checks honeypot, verifies CAPTCHA, normalizes Philippine mobile or email, sends 6-digit OTP for email. |
| `POST` | `/api/auth/register` | 15/min | Completes registration: sets password, records DPA consent (`dpa_consented_at`, `dpa_consent_ip`), activates account, issues Sanctum token. |
| `POST` | `/api/auth/login` | 5/min | Authenticates via email or mobile phone. Enforces rate limits, validates password against bcrypt hash, checks email verification. |
| `POST` | `/api/auth/email/verify` | 10/min | Validates 6-digit verification OTP. Checks max attempts (5) and expiry (10 min). |
| `POST` | `/api/auth/email/resend` | 3/min | Resends verification OTP. Enforces 60-second cooldown and 5-request hourly global ceiling. |
| `POST` | `/api/auth/forgot-password` | 5/min | Sends password reset OTP. Employs email enumeration prevention (generic response). |
| `POST` | `/api/auth/reset-password` | 5/min | Verifies reset OTP, hashes new password, revokes all existing Sanctum sessions. |
| `POST` | `/api/auth/reset-code/resend`| 3/min | Resends password reset code with rate limit restrictions. |
| `GET` | `/api/google/redirect` | None | Returns the Google OAuth 2.0 authorization URL with required scopes (`openid`, `profile`, `email`). |
| `POST` | `/api/google/exchange` | 15/min | Atomically exchanges a single-use OAuth ticket (`Cache::pull`) for a Sanctum token and user profile. |
| `GET` | `/api/public/landing-data` | None | Cached consolidated endpoint returning categories, statistics, FAQs, announcements, and benefits. |
| `GET` | `/api/public/categories` | None | Returns all active RA 11861 categories and their documentary requirements. |
| `GET` | `/api/public/barangays` | None | Returns the list of 86 Butuan City barangays for public dropdown menus. |
| `GET` | `/api/public/stats` | None | Returns high-level public metrics (registered solo parents, serviced barangays). |
| `GET` | `/api/public/faqs` | None | Returns official FAQs regarding RA 11861 benefits and procedures. |
| `GET` | `/api/public/benefits` | None | Returns statutory benefits under RA 11861 (10% discount, 7-day parental leave). |
| `GET` | `/api/public/resources` | None | Returns downloadable legal guidelines and affidavit templates. |
| `GET` | `/api/public/announcements` | None | Returns latest published CSWDD announcements. |
| `GET` | `/api/public/eligibility` | None | Returns rules for the interactive eligibility assessment wizard. |

---

### 5.2 Authenticated Applicant Endpoints (`auth:sanctum`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/me` | Returns the currently authenticated user profile, active roles, and avatar. |
| `POST` | `/api/auth/logout` | Revokes the current access token (`currentAccessToken()->delete()`). |
| `GET` | `/api/portal/dashboard-summary`| High-speed aggregated bootstrap endpoint consolidating 6 queries (profile, active application, completion percentage, document counts, notifications, categories). |
| `GET` | `/api/profile` | Fetches applicant profile details; supports `?with_form=true` to merge application form details. |
| `PUT` | `/api/profile` | Upserts `ApplicantProfile`, updates `User` name/phone, syncs `ApplicationForm` and `ApplicationFamilyMember` tables. |
| `GET` | `/api/profile/completion` | Returns calculated completion score across the 5 form sections. |
| `GET` | `/api/profile/initial-status`| Fast boolean check determining if the user completed their short onboarding profile. |
| `POST` | `/api/profile/avatar` | Uploads and updates the user's avatar image. |
| `DELETE`| `/api/profile/avatar` | Removes the user's custom avatar. |
| `PUT` | `/api/profile/password` | Changes the authenticated user's password (requires current password validation). |
| `DELETE`| `/api/account` | Self-service account deletion (guarded against active applications). |
| `GET` | `/api/applications` | Lists all historical and current applications submitted by the user. |
| `GET` | `/api/applications/me` | Retrieves the user's latest or active application with category, requirements, form, and post-completion eligibility status. |
| `GET` | `/api/applications/submission-check` | Comprehensive validation gate evaluating whether all profile fields and required documents are uploaded. |
| `GET` | `/api/applications/review` | Retrieves merged form data for pre-submission confirmation. |
| `POST` | `/api/applications` | Initiates a new Solo Parent ID application draft (`reference_no = SP-YYYYMM-XXXXXX`). |
| `POST` | `/api/applications/renew` | Initiates an ID renewal draft (`reference_no = RN-YYYYMM-XXXXXX`), auto-cloning previous form data. |
| `POST` | `/api/applications/loss-spic` | Initiates a lost ID replacement application (`reference_no = LS-YYYYMM-XXXXXX`). |
| `DELETE`| `/api/applications/draft` | Hard-deletes an unsubmitted draft application and its uploaded staging documents. |
| `POST` | `/api/applications/{id}/cancel` | Cancels an application (hard-deletes draft; soft-cancels submitted apps with audit reason). |
| `POST` | `/api/applications/{id}/submit-requirements` | Submits uploaded documents for CSWDD qualification review. |
| `POST` | `/api/applications/{id}/verify-submitted` | Applicant confirmation step following CSWDD document qualification. |
| `POST` | `/api/applications/{id}/submit` | Final formal submission of both documents and completed Application Form. |
| `POST` | `/api/applications/{id}/reapply` | Re-opens a rejected application back to `draft` for correction based on reviewer remarks. |
| `GET` | `/api/applications/{id}` | Fetches granular details and status history of a specific application. |
| `GET` | `/api/applications/{id}/form.pdf` | Generates and streams the official CSWDD Solo Parent Application Form PDF with dynamic overlay. |
| `GET` | `/api/documents` | Lists all uploaded documentary attachments for the user. |
| `POST` | `/api/documents/upload` | Uploads single or batch files for a requirement into the temporary Supabase bucket. |
| `POST` | `/api/documents/{id}/replace` | Replaces a rejected document with a newly uploaded file. |
| `GET` | `/api/documents/{id}/view` | Generates a 15-minute temporary signed URL for private document viewing. |
| `GET` | `/api/documents/{id}/preview`| Direct backend streaming proxy outputting binary content with appropriate `Content-Type` headers. |
| `DELETE`| `/api/documents/{id}` | Deletes an unapproved document from both storage and database. |
| `GET` | `/api/notifications` | Retrieves user's in-app notifications (paged, up to 50 items). |
| `GET` | `/api/notifications/unread-count`| Returns integer count of unread notifications. |
| `POST` | `/api/notifications/read-all`| Marks all notifications as read. |
| `POST` | `/api/notifications/{id}/read`| Marks a specific notification as read. |
| `GET` | `/api/messages` | Retrieves conversation thread with the CSWDD Office. |
| `POST` | `/api/messages` | Sends a message to the CSWDD case workers. |
| `GET` | `/api/messages/unread-count` | Returns count of unread messages from CSWDD. |

---

### 5.3 Administrative Endpoints (`auth:sanctum` + `EnsureAdmin`)

All routes located under `/api/admin/*` require administrative privileges (`admin` or `super_admin`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/applications` | Richly filterable application ledger (filters by tab, status group, category, barangay, search string, pagination). |
| `GET` | `/api/admin/applications/{id}`| Retrieves comprehensive application record: applicant user, profile, category, documents, status history. |
| `PATCH`| `/api/admin/applications/{id}/status` | Adjudicates application status based on the `STATUS_TRANSITIONS` state machine. Dispatches applicant notifications and promotes documents on approval. |
| `POST` | `/api/admin/applications/{id}/disqualify` | Disqualifies an applicant with a mandatory rejection narrative; rejects pending documents and updates audit trail. |
| `PATCH`| `/api/admin/applications/{id}/official-fields` | Sets official CSWDD metadata: Case Number, Beneficiary Code, SPIC ID Card Number, Date Issued. |
| `GET` | `/api/admin/applications/{appId}/documents` | Lists all documentary requirements mapped against uploaded attachments and revision histories. |
| `GET` | `/api/admin/documents/{id}/view` | Generates a signed preview URL for admin document inspection. |
| `GET` | `/api/admin/documents/{id}/preview` | Streams private document directly to the admin browser. |
| `POST` | `/api/admin/documents/{id}/review` | Approves or rejects a document with remarks. Triggers storage promotion upon approval. |
| `POST` | `/api/admin/applications/{appId}/documents/approve-all` | Bulk approves all submitted documents and promotes files to permanent storage. |
| `GET` | `/api/admin/applications/{id}/id-card.pdf` | Generates the official Solo Parent ID Card PDF (front and back layout, landscape badge dimensions). |
| `GET` | `/api/admin/reports/statistics.pdf` | Generates an executive statistical summary PDF report. |
| `GET` | `/api/admin/reports/export.csv` | Streams a full CSV spreadsheet of all registered solo parent applications. |
| `GET` | `/api/admin/analytics/overview` | Returns real-time KPI metrics (total applications, registered parents, pending reviews, near-expiry count). |
| `GET` | `/api/admin/analytics/demographics`| Computes demographic breakdowns: gender, category, top 15 barangays, civil status, employment, and age groups via PostgreSQL `age()`. |
| `GET` | `/api/admin/analytics/trends` | Time-series application submission volume (daily, weekly, monthly, yearly trends). |
| `GET` | `/api/admin/audit-logs` | Paged searchable compliance audit log entries. |
| `GET` | `/api/admin/users` | Manages registered user accounts (role filtering, profile completion status, document counts). |
| `POST` | `/api/admin/users` | Directly provisions a new user or administrative staff member. |
| `PUT` | `/api/admin/users/{id}/role` | Super Admin only: modifies user access role (`applicant`, `admin`, `super_admin`). |
| `PUT` | `/api/admin/users/{id}/status` | Activates or suspends user accounts (prevents self-deactivation). |
| `POST` | `/api/admin/users/{id}/reset-password` | Administrative password reset, terminating existing sessions. |
| `GET` | `/api/admin/categories` | Lists all qualifying categories and requirements. |
| `POST` | `/api/admin/categories` | Creates a new solo parent category and requirement checklist. |
| `PUT` | `/api/admin/categories/{id}` | Updates existing category definitions and ordering. |
| `DELETE`| `/api/admin/categories/{id}`| Deletes a category definition. |
| `GET` | `/api/admin/barangays` | Lists barangays with applicant counts. |
| `POST` | `/api/admin/barangays` | Adds a new barangay to the jurisdiction database. |
| `PUT` | `/api/admin/barangays/{id}` | Updates barangay details and active status. |
| `GET` | `/api/admin/barangays/{id}/applicants` | Paged list of solo parent applicants residing in a specific barangay. |
| `GET` | `/api/admin/announcements` | Lists announcements for portal administration. |
| `POST` | `/api/admin/announcements` | Publishes new public advisories or announcements. |
| `PUT` | `/api/admin/announcements/{id}` | Modifies published announcements. |
| `DELETE`| `/api/admin/announcements/{id}`| Removes announcements. |
| `GET` | `/api/admin/resources` | Manages downloadable citizen resources and legal guidelines. |
| `GET` | `/api/admin/messages` | Displays all applicant message threads with unread counts. |
| `POST` | `/api/admin/messages` | Sends a message from CSWDD to an applicant. |
| `POST` | `/api/admin/maintenance/renewal-reminders` | Manually triggers the renewal notification sweep for IDs expiring within 30 days. |

---

## 6. Security Architecture & Cyber Defense Mechanisms

The system implements security across the presentation, application, data, and storage layers.

```
       +-------------------------------------------------------------+
       |                     INCOMING REQUEST                        |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       | 1. Honeypot & Math Puzzle CAPTCHA                           |
       |    - Hidden spam trap fields (website, honeypot_field)      |
       |    - Cache-backed single-use dynamic math puzzle            |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       | 2. Rate Limiting & Sliding Window Throttling                |
       |    - IP-based sliding window limiter                        |
       |    - Normalized Identifier limiter (email/phone)            |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       | 3. Transport & Session Security                             |
       |    - Laravel Sanctum hashed Bearer tokens                   |
       |    - One-time Google OAuth exchange tickets                 |
       |    - CORS origin restriction & secure headers               |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       | 4. Role-Based Access Control (RBAC)                         |
       |    - EnsureAdmin Middleware checking user.role              |
       |    - Super-admin role protection & self-lockout prevention  |
       |    - Strict resource ownership validation ($doc->user_id)   |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       | 5. Deep File Inspection & Magic Byte Sniffing               |
       |    - Extension whitelist (.pdf, .jpg, .jpeg, .png, .docx)   |
       |    - Binary header signature verification                   |
       |    - Client-MIME spoofing neutralization                    |
       |    - 20MB file size ceiling & duplicate hash checks         |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       | 6. Data Privacy Act (RA 10173) & Audit Trail                |
       |    - Cryptographic OTP hashing (bcrypt)                     |
       |    - Explicit DPA consent recording (timestamp + client IP) |
       |    - Immutable append-only AuditLog persistence             |
       +-------------------------------------------------------------+
```

### 6.1 Authentication & Session Security
- **Bearer Token Architecture**: Uses Laravel Sanctum API tokens. Tokens are hashed with SHA-256 before database storage in `personal_access_tokens`. Tokens transmitted in HTTP headers (`Authorization: Bearer <token>`).
- **OAuth Single-Use Ticket Exchange**: When completing Google OAuth, the system avoids passing bearer tokens in redirect URLs. Instead, a cryptographically random UUID ticket is issued and stored in cache for 60 seconds (`Cache::put("google_oauth_ticket_{uuid}", $payload, 60)`). The frontend exchanges this ticket via `POST /api/google/exchange`, which atomically pulls and destroys the ticket (`Cache::pull`), preventing replay attacks and token leakage in browser histories.
- **Account Enumeration Prevention**: The password reset endpoint (`/api/auth/forgot-password`) always returns an identical success message (`"If an account with that email exists, a reset code has been sent."`) regardless of whether the email address exists in the database.
- **Bcrypt-Hashed Verification Codes**: 6-digit OTP verification codes are never stored in plaintext. They are hashed using `Hash::make()` and verified using `Hash::check()`.

### 6.2 File Upload Defense & Magic Byte Sniffing
To prevent malicious executable uploads (e.g., PHP web shells masked with `.jpg` extensions), `DocumentController` performs binary signature inspection (magic bytes) directly on the raw file stream, independent of the operating system's `fileinfo` extension:

```php
const MAGIC_BYTES = [
    'pdf'  => '%PDF',
    'jpg'  => ["\xFF\xD8\xFF"],
    'jpeg' => ["\xFF\xD8\xFF"],
    'png'  => ["\x89PNG"],
    'docx' => ["PK\x03\x04"],
    'doc'  => ["\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"],
];
```
- Files exceeding 20MB are rejected prior to processing.
- Duplicate detection checks for identical filename and file size under the same requirement to prevent redundant storage allocation.

### 6.3 Anti-Bot Protections & CAPTCHA
- **Honeypot Trap**: Forms include hidden trap inputs (`website`, `honeypot_field`). Automated spam bots that populate all form fields are detected and rejected (`HTTP 422`).
- **Dynamic Math CAPTCHA**: Lightweight mathematical challenge puzzles (`X + Y = ?`) generated server-side with random integers and operations. The expected solution is cached with a random UUID key for 10 minutes and consumed on first evaluation.

### 6.4 Data Privacy Act of 2012 (RA 10173) Compliance
- Consent is explicitly required during registration. The system records `dpa_consent = true`, the exact server timestamp `dpa_consented_at = now()`, and the client's network address `dpa_consent_ip = $request->ip()`.
- Uploaded applicant documents are private. No public bucket access is permitted. All document viewing requires either:
  1. An authenticated backend streaming proxy (`/api/documents/{id}/preview`) verifying `$doc->user_id === $request->user()->id`.
  2. A time-limited (900 seconds / 15 minutes) HMAC-signed Supabase Storage URL generated with the service role key.

---

## 7. Rate Limiting & Throttling Matrix

The system employs multi-layered throttling via Laravel's `throttle` middleware and `RateLimiter` facade to prevent credential brute-forcing, spam registration, and resource exhaustion.

| Scope | Key Format | Rate Limit | Action on Exceeded |
|---|---|---|---|
| **Login Attempts** | `login:{identifier}\|{ip}` | **5 attempts per 60 seconds** | HTTP 429; returns `retry_after` countdown in seconds. Counter clears upon successful authentication. |
| **Registration (IP)** | `reg_start_ip:{ip}` | **15 requests per 10 minutes** | HTTP 429; blocks rapid automated account creation from a single network. |
| **Registration (ID)** | `reg_start_id:{identifier}` | **5 requests per 10 minutes** | HTTP 429; blocks targeted OTP flooding against a specific email or phone. |
| **OTP Verification** | `verify:{user_id}` | **10 attempts per 10 minutes** | HTTP 429; locks verification attempts; requires new code after 5 wrong tries. |
| **OTP Resend (Cooldown)** | `resend:{user_id}` | **1 request per 60 seconds** | HTTP 429; enforces 60-second cooldown between resend requests. |
| **OTP Resend (Global)** | `resend_global:{user_id}` | **5 requests per hour** | HTTP 429; stops persistent SMS/email abuse. |
| **Forgot Password** | `forgot:{user_id}` | **3 requests per hour** | HTTP 429; prevents reset spam. |
| **Password Reset Verify**| `reset_verify:{user_id}` | **10 attempts per 10 minutes** | HTTP 429; protects password reset OTP from brute-force guessing. |
| **CAPTCHA Generation** | Route Throttle | **60 requests per minute** | HTTP 429; prevents challenge generation abuse. |
| **OAuth Code Exchange** | Route Throttle | **15 requests per minute** | HTTP 429; prevents ticket guessing. |

---

## 8. Two-Tier Storage Architecture & Document Lifecycle

To keep cloud storage performant, organized, and cost-effective, the system uses a **Two-Tier Storage Architecture**.

```
+-----------------------------------------------------------------------------------------+
|                                    APPLICANT UPLOAD                                     |
|  Applicant uploads requirement files (.pdf, .jpg, .png, .docx)                         |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
|                              TIER 1: STAGING / TEMPORARY                                |
|  Bucket: 'solo-parent-temp'                                                             |
|  Path: Applicants/{LastName., FirstName, MI}/{AppType}/{RefNo}/Requirements/{Req}/{Doc} |
|  Status: storage_status = 'temporary'                                                  |
|  Review Status: 'pending' / 'under_review' / 'for_document_correction'                  |
|  Retention: Cleaned automatically after 30 days if abandoned/unverified                 |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v (CSWDD Admin Approves Document / Application)
+-----------------------------------------------------------------------------------------+
|                              PROMOTION PIPELINE (ATOMIC)                                |
|  1. File bytes copied from temporary bucket to permanent bucket                         |
|  2. Temporary file safely unlinked from staging bucket                                   |
|  3. Database record updated:                                                            |
|     - permanent_storage_path set                                                        |
|     - storage_status = 'promoted'                                                       |
|     - promoted_at = now()                                                               |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
|                              TIER 2: PERMANENT ARCHIVAL                                 |
|  Bucket: 'solo-parent-documents'                                                        |
|  Path: Applicants/{LastName., FirstName, MI}/{AppType}/{RefNo}/Requirements/{Req}/{Doc} |
|  Status: storage_status = 'promoted'                                                    |
|  Access: Time-limited HMAC signed URLs (15 min) or authenticated backend stream proxy    |
|  Retention: Permanent government archival record under RA 11861                         |
+-----------------------------------------------------------------------------------------+
```

### 8.1 Path Formatting Conventions
All paths are built deterministically via `App\Services\StoragePathBuilder`:
```
Applicants/{LastName}., {FirstName}, {MI}/{Application Type}/{Reference Number}/Requirements/{Requirement Name}/{UUID}-{SanitizedFilename}.{ext}
```

*Example Real Path*:
```
Applicants/Dela Cruz., Juan, M/New ID/SP-202610-8F92A1/Requirements/Birth certificate of the child/a1b2c3d4-birth-certificate.pdf
```

### 8.2 Self-Healing Promotion Engine
Document promotion occurs automatically during:
1. Individual admin document approval (`/admin/documents/{id}/review`).
2. Bulk document approval (`/admin/applications/{appId}/documents/approve-all`).
3. Final application status transitions (`approved`, `ready_for_release`, `released`, `completed`).

If a transient network error prevents object copying during the review click, the system includes two self-healing layers:
- **On-Demand Self-Healing**: When generating viewing URLs (`DocumentController::view` or `adminView`), if `review_status === 'approved'` but `storage_status !== 'promoted'`, the server immediately attempts an inline promotion before returning the URL.
- **Background Reconciliation**: The Artisan console command `php artisan storage:reconcile-promotions` scans for approved documents lacking permanent paths and promotes them in bulk.

---

## 9. End-to-End Business Logic & Workflows

### 9.1 Registration & Onboarding Flow
1. **Initiation**: User visits `/register`, inputs First Name, Middle Name, Last Name, and either an Email Address or Philippine Mobile Number (`09XXXXXXXXX`, `+639XXXXXXXXX`).
2. **Security Checks**: Math CAPTCHA solved, honeypot verified empty, IP and identifier rate limits checked.
3. **Dual Verification Track**:
   - **Email Path**: A pending unverified user is created. A 6-digit cryptographic OTP is generated, hashed, and emailed via `VerificationCodeMail`. User enters OTP on the portal. Code is verified, setting `email_verified_at = now()`.
   - **Philippine Mobile Path**: Normalized directly into E.164 format (`+639...`). No third-party SMS gateway dependency is required; user immediately proceeds to set their password.
4. **Completion**: User establishes password (min 8 chars) and accepts Data Privacy Act consent. The account is activated (`is_active = true`), pre-populating an `ApplicantProfile` with names and contact details. A Sanctum bearer token is issued, logging the user in automatically.
5. **Initial Profile Gate**: Upon first login, user is routed to `/portal/setup-profile` (`RequireInitialProfile` guard). User selects their Butuan City Barangay, specifies date of birth, sex, and residential address. Once saved, the portal dashboard is unlocked.

---

### 9.2 New Solo Parent ID Application Workflow

```
[Applicant: Dashboard]
       |
       v
[Step 1: Select RA 11861 Category]
       |
       v
[Draft Created: Reference No SP-YYYYMM-XXXXXX]
       |
       v
[Step 2: Upload Documentary Requirements]
(Files saved to temporary staging bucket; validated via magic bytes)
       |
       v
[Step 3: Submit Requirements for CSWDD Review] (status: 'submitted')
       |
       +---------------------------------------------------------+
       |                                                         |
       v (CSWDD Admin Review)                                    v (CSWDD Admin Rejection)
[Status: 'under_initial_review']                 [Status: 'for_document_correction']
       |                                                         |
[Documents Approved by Admin]                                    v
(Files promoted to permanent storage)           [Applicant uploads replacement document]
       |                                                         |
       v                                                         v
[Status: 'qualified'] -------------------------------------------+
       |
       v
[Step 4: Applicant Completes Application Form]
(Section I: Personal, Section II: Household Dependents,
 Section III: Circumstances, Section IV: Needs,
 Section V: Emergency Contact + Digital Signature Pad)
       |
       v
[Step 5: Pre-Submission Review & Verification]
       |
       v
[Step 6: Final Submission to CSWDD] (status: 'submitted')
       |
       v
[CSWDD Final Assessment & Adjudication]
(Assigns Case No., Beneficiary Code, SPIC Card No., Issue Date)
       |
       v
[Status: 'approved']
       |
       v
[Status: 'ready_for_pickup'] (In-app notification dispatched to applicant)
       |
       v
[Applicant Claims Physical SPIC ID Card at CSWDD Office]
       |
       v
[Status: 'released' / 'completed'] (Validity: 1 Year from Date Issued)
```

---

### 9.3 ID Renewal Workflow
- **Eligibility Trigger**: Available for applicants holding an existing or expired SPIC ID record.
- **Automated Reminder Sweep**: A scheduled job detects released applications whose `released_at + 1 year` is within 30 days, dispatching a high-priority notification to the applicant.
- **Application Cloner**: Upon clicking **Apply for Renewal** (`/portal/renew`), the backend creates a renewal draft (`RN-YYYYMM-XXXXXX`), sets the category to `RENEWAL`, and duplicates the user's prior `ApplicationForm` and `ApplicationFamilyMember` records.
- **Renewal Requirements Checklist**:
  1. Notarized Affidavit of Solo Parent
  2. Notarized Affidavit of Barangay Official
  3. Latest Income Tax Return (ITR)
  4. Original / copy of previously issued Solo Parent ID
  5. Recent 1x1 ID Picture
- **Streamlined Path**: Once renewal documents are uploaded, the application submits directly to the CSWDD review queue without requiring manual re-entry of the full application form.

---

### 9.4 Loss of SPIC (Lost ID Replacement) Workflow
- **Purpose**: Designed for solo parents whose physical ID card was lost, destroyed, or stolen.
- **Workflow**: Accessible at `/portal/loss-spic`. Applicant specifies the lost SPIC number and loss circumstance narrative.
- **Dedicated Requirements Checklist (`LOSS_SPIC`)**:
  1. Notarized Affidavit of Loss
  2. Recent 1x1 ID Picture
  3. Sworn Affidavit of Sole Parental Care
  4. Affidavit of Barangay Official attesting to residency
- Submits directly into the CSWDD adjudication queue for rapid re-printing.

---

## 10. PDF Generation & Template Coordinate Overlay Engine

The portal contains two distinct PDF generation systems tailored for legal document fidelity and visual design.

### 10.1 Solo Parent Application Form Overlay (FPDI / FPDF)
The official CSWDD Solo Parent Application Form requires exact visual alignment with the government's pre-printed legal template. Rather than attempting to recreate complex tables and watermarks in HTML, the system utilizes **FPDI (FPDF Template Import)**:
1. **Background Import**: `PdfController::generateApplicationForm` imports Page 1 of `resources/pdf-templates/solo_parent_application_form.pdf` as a vector background canvas.
2. **Coordinate Placement Matrix**: Data fields are mapped onto exact millimeter coordinates `(x, y)`:
   - **Reference Number**: `x=148, y=28.5` (Helvetica Bold 8pt)
   - **Date of Application**: `x=148, y=32.5`
   - **Applicant Name**: `x=35, y=56` (Full name, uppercase)
   - **PhilSys Card Number**: `x=148, y=56`
   - **Date of Birth & Age**: `x=35, y=61`
   - **Place of Birth**: `x=120, y=61`
   - **Sex, Civil Status, Nationality**: `y=66.5`
   - **Residential Address (Barangay, City, Province)**: `x=35, y=72`
   - **Contact / Mobile Number**: `x=140, y=72`
   - **Employment Status & Monthly Income**: `y=88`
   - **Categorical Checkboxes**: PhilSys, 4Ps beneficiary, Indigent, Indigenous, LGBTQIA+, PWD checkboxes rendered with calibrated character marks.
3. **Household Composition Table Overlay**: Calibrated to Section II (`tableStartY = 117mm`, `rowHeight = 7mm`). Renders Name, Sex, Relationship, Age, Birthdate, Civil Status, Educational Attainment, Occupation, and Monthly Income across 9 columns.
4. **Dynamic Continuation Page**: If household dependents exceed the main table capacity (5 members), the engine dynamically appends an official continuation page with government headers, ensuring no family members are truncated.
5. **Digital Signature Decoding**: The base64 PNG signature captured via `signature_pad` is decoded, stored to a temporary scratch file, overlaid directly above the signature line (`x=40, y=204, w=35mm, h=10mm`), and immediately unlinked.
6. **Government Official Use Only Area**: The bottom certification block (`FOR SPD/SPO USE ONLY`) is left blank for physical signatures and official wet seals by CSWDD caseworkers.

### 10.2 Solo Parent ID Card Generation (DomPDF)
- Generates official ID card badges via `PdfController::generateIdCard`.
- **Dimensions**: Formatted to standard wallet card dimensions (`260.787pt x 164.409pt`, landscape orientation).
- **Visual Design**: Renders the City of Butuan Official Seal, CSWDD Logo, citizen photo, SPIC ID Card Number, QR code/reference number, full name, address, qualifying category, date issued, and validity period.

---

## 11. Administrative Portal & Decision Support Engine

The Administrative Portal (`/admin`) serves as the operational center for CSWDD personnel.

### 11.1 Key Modules & Features
1. **Executive Dashboard (`/admin`)**:
   - Real-time KPI counter cards: Total Applications, Registered Solo Parents, Pending Reviews, Final Reviews, Expiring IDs.
   - Filterable tabs: **All Applications**, **Needs Review**, **Registered Solo Parents**, **Approved Applications**, **Claimed / Released IDs**.
2. **Granular Application Detail (`/admin/applications/:id`)**:
   - Comprehensive applicant dossier: Personal information, demographic profile, household members list.
   - Interactive document reviewer: Side-by-side previewing of uploaded PDFs and images, approval buttons, and rejection modals requiring mandatory explanations.
   - Official metadata management: Edit Case Docket Numbers, Beneficiary Codes, and SPIC Card Numbers.
   - Status transition state machine restricting invalid lifecycle jumps.
3. **Demographics & Analytics Hub (`/admin/analytics`)**:
   - Gender ratios (Male vs. Female solo parents).
   - Category distribution charts under RA 11861.
   - Top 15 barangays by solo parent density.
   - Civil status and employment distribution.
   - Age cohort distribution calculated dynamically in PostgreSQL using `EXTRACT(YEAR FROM age(birth_date))` grouped into `<18`, `18-24`, `25-34`, `35-44`, `45-54`, `55-64`, and `65+`.
   - Time-series application volume trends (Daily, Weekly, Monthly, Yearly).
4. **Audit Logs Explorer (`/admin/audit-logs`)**:
   - Full compliance trail recording Actor Email, Action, Entity Type, Entity UUID, Client IP, and Before/After JSON states.
5. **Territorial Barangay Management (`/admin/barangays`)**:
   - Management of Butuan City's 86 barangays, applicant counts per barangay, and active status toggling.
6. **User Account Governance (`/admin/users`)**:
   - Comprehensive user table, profile completion flags, password resets, account deactivation, and Super Admin RBAC management.
7. **Official Reports & Exports (`/admin/reports`)**:
   - One-click CSV export streaming all application data for local reporting.
   - Executive statistics PDF summary generation.
8. **Direct Applicant Messaging (`/admin/messages`)**:
   - Real-time communication threads enabling case workers to request clarifications or notify applicants of pickup schedules directly.

---

## 12. Automated Maintenance, Console Commands & Cron Tasks

The system includes automated CLI maintenance commands registered in `app/Console/Commands`:

### 12.1 Command Catalog

#### `php artisan storage:clean-temp`
- **Class**: `App\Console\Commands\CleanTempStorage`
- **Schedule**: Scheduled daily in `routes/console.php`.
- **Function**: Scans the `solo-parent-temp` staging bucket. Deletes unpromoted temporary files older than 30 days while protecting files associated with active in-review applications.

#### `php artisan storage:reconcile-promotions`
- **Class**: `App\Console\Commands\ReconcileDocumentPromotions`
- **Parameters**: `--limit=100`, `--force`
- **Function**: Scans for approved documents whose storage status is not yet promoted, copies the underlying objects from temporary to permanent storage, and updates the database records.

#### `php artisan auth:prune-unverified`
- **Class**: `App\Console\Commands\PruneUnverifiedAccounts`
- **Parameters**: `--hours=48`, `--dry-run`
- **Function**: Safely purges abandoned unverified registration attempts older than 48 hours that lack uploaded documents or submitted applications, keeping the `users` table clean.

#### `php artisan app:clean-user-data`
- **Class**: `App\Console\Commands\CleanUserData`
- **Function**: Developer and testing maintenance utility to reset test applicant data and unlinked staging documents without affecting production admin accounts.

---

## 13. Deployment, Configuration & Handover Guide

### 13.1 Server Prerequisites
- **Web Server**: Nginx or Apache with URL rewriting enabled.
- **PHP**: PHP 8.3 or higher with extensions: `BCMath`, `Ctype`, `cURL`, `DOM`, `Fileinfo`, `JSON`, `Mbstring`, `OpenSSL`, `PCRE`, `PDO`, `PDO_PGSQL`, `Tokenizer`, `XML`.
- **Database**: PostgreSQL 15+ (Hosted on Supabase or self-hosted).
- **Node.js**: Node.js 18.x or 20.x LTS with NPM.
- **Composer**: Composer 2.x for PHP dependency management.

---

### 13.2 Environment Configuration Catalog

#### Backend `.env` Architecture
```env
APP_NAME="Solo Parent Portal"
APP_ENV=production
APP_KEY=base64:...
APP_DEBUG=false
APP_URL=https://soloparent.butuan.gov.ph
FRONTEND_URL=https://soloparent.butuan.gov.ph

# Database (PostgreSQL / Supabase)
DB_CONNECTION=pgsql
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres.your_project_id
DB_PASSWORD=your_secure_db_password

# Supabase Storage Integration
SUPABASE_URL=https://your_project_id.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
AWS_BUCKET=solo-parent-documents
SUPABASE_TEMP_BUCKET=solo-parent-temp
SUPABASE_SSL_VERIFY=true

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://soloparent.butuan.gov.ph/api/google/callback

# Mail Delivery (SMTP / Resend / SES)
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="cswdd@butuan.gov.ph"
MAIL_FROM_NAME="CSWDD Butuan City"
```

#### Frontend `.env` Architecture
```env
# Backend API Base URL
VITE_BACKEND_URL=https://soloparent.butuan.gov.ph/api

# Google OAuth Client ID for Button Component
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

---

### 13.3 Deployment Runbook

#### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install production PHP dependencies
composer install --no-dev --optimize-autoloader

# Generate application encryption key
php artisan key:generate

# Run database schema migrations
php artisan migrate --force

# Seed categories and initial super admin
php artisan db:seed --class=CategorySeeder --force
php artisan db:seed --class=SuperAdminSeeder --force

# Optimize Laravel configuration and route caching
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

#### 2. Frontend Build
```bash
# Navigate to frontend directory
cd ../frontend

# Install node dependencies
npm install

# Build production bundle with Vite
npm run build
```
*The compiled assets will be placed in `frontend/dist`, ready for serving via Nginx or copying to public web roots.*

#### 3. Cron Task Configuration
Configure the system crontab (`crontab -e`) to trigger Laravel's scheduler once every minute:
```cron
* * * * * cd /path/to/Solo\ Parent\ Portal\ System/backend && php artisan schedule:run >> /dev/null 2>&1
```

---

## Technical Audit Conclusion

The **Solo Parent Portal System** provides a secure, fully auditable, and resilient full-stack architecture for the City of Butuan. By combining **React 19**, **Laravel 13**, **PostgreSQL**, **Supabase Object Storage**, and **coordinate-calibrated FPDI templating**, the system eliminates paper processing friction while enforcing statutory compliance under **RA 11861** and data protection under **RA 10173**.
