<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\PublicController;
use App\Http\Controllers\PortalController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\AdminCategoryController;
use App\Http\Controllers\AdminBarangayController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AdminAnalyticsController;
use App\Http\Controllers\AdminAuditLogController;
use App\Http\Controllers\AdminResourceController;
use App\Http\Controllers\GoogleAuthController;

// -------------------------------------------------------------------------
// Public routes (no authentication required) — Rate limited for brute-force protection
// -------------------------------------------------------------------------
Route::get('/auth/captcha',         [AuthController::class, 'getCaptcha'])->middleware('throttle:60,1');
Route::post('/auth/register/start', [AuthController::class, 'registerStart'])->middleware('throttle:15,1');
Route::post('/auth/register',       [AuthController::class, 'registerComplete'])->middleware('throttle:15,1');
Route::post('/auth/login',         [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/auth/email/verify',  [AuthController::class, 'verifyEmail'])->middleware('throttle:10,1');
Route::post('/auth/email/resend',  [AuthController::class, 'resendVerificationCode'])->middleware('throttle:3,1');

// Forgot password (code-based reset)
Route::post('/auth/forgot-password',    [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/auth/reset-password',     [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
Route::post('/auth/reset-code/resend',  [AuthController::class, 'resendResetCode'])->middleware('throttle:3,1');

// Google OAuth — redirect URL & secure one-time ticket exchange
Route::get('/google/redirect',     [GoogleAuthController::class, 'redirectUrl']);
Route::post('/google/exchange',    [GoogleAuthController::class, 'exchangeCode'])->middleware('throttle:15,1');

Route::prefix('public')->group(function () {
    Route::get('/landing-data',  [PublicController::class, 'landingData']);
    Route::get('/categories',    [PublicController::class, 'categories']);
    Route::get('/stats',         [PublicController::class, 'stats']);
    Route::get('/faqs',          [PublicController::class, 'faqs']);
    Route::get('/benefits',      [PublicController::class, 'benefits']);
    Route::get('/resources',     [PublicController::class, 'resources']);
    Route::get('/announcements', [PublicController::class, 'announcements']);
    Route::get('/eligibility',   [PublicController::class, 'eligibility']);
    Route::get('/barangays',     [AdminBarangayController::class, 'index']); // Public list for dropdowns
});

// -------------------------------------------------------------------------
// Authenticated routes
// -------------------------------------------------------------------------
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get('/auth/me',      [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // ---- Portal Bootstrap Summary ----
    Route::get('/portal/dashboard-summary', [PortalController::class, 'dashboardSummary']);

    // ---- Profile & Account Settings ----
    Route::get('/profile',                [ProfileController::class, 'getProfile']);
    Route::put('/profile',                [ProfileController::class, 'upsertProfile']);
    Route::get('/profile/completion',     [ProfileController::class, 'completionStatus']);
    Route::get('/profile/initial-status', [ProfileController::class, 'initialProfileStatus']);
    Route::post('/profile/avatar',        [ProfileController::class, 'uploadAvatar']);
    Route::delete('/profile/avatar',      [ProfileController::class, 'deleteAvatar']);
    Route::put('/profile/password',       [ProfileController::class, 'changePassword']);
    Route::delete('/account',             [ProfileController::class, 'deleteAccount']);

    // ---- Notifications ----
    Route::get('/notifications',              [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/read-all',    [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read',   [NotificationController::class, 'markRead']);

    // ---- Messages ----
    Route::get('/messages',                   [MessageController::class, 'index']);
    Route::post('/messages',                  [MessageController::class, 'store']);
    Route::post('/messages/{id}/read',        [MessageController::class, 'markRead']);
    Route::get('/messages/unread-count',      [MessageController::class, 'unreadCount']);

    // ---- Applications (Applicant) ----
    Route::get('/applications',                         [ApplicationController::class, 'getUserApplications']);
    Route::get('/applications/me',                      [ApplicationController::class, 'getMyApp']);
    Route::get('/applications/submission-check',        [ApplicationController::class, 'submissionCheck']);
    Route::get('/applications/review',                  [ApplicationController::class, 'getReviewApplication']);
    Route::post('/applications',                        [ApplicationController::class, 'submitApplication']);
    Route::post('/applications/renew',                  [ApplicationController::class, 'renewApplication']);
    Route::post('/applications/loss-spic',              [ApplicationController::class, 'lossApplication']);
    Route::delete('/applications/draft',                [ApplicationController::class, 'cancelDraft']);
    Route::post('/applications/{id}/cancel',            [ApplicationController::class, 'cancelApplication']);
    Route::delete('/applications/{id}/cancel',          [ApplicationController::class, 'cancelApplication']);
    Route::post('/applications/{id}/verify-submitted',  [ApplicationController::class, 'verifySubmittedInformation']);
    Route::post('/applications/{id}/submit-requirements', [ApplicationController::class, 'submitRequirements']);
    Route::post('/applications/{id}/submit',            [ApplicationController::class, 'commitApplication']);
    Route::post('/applications/{id}/reapply',           [ApplicationController::class, 'reapplyApplication']);
    Route::get('/applications/{id}',                    [ApplicationController::class, 'getApplicationDetails']);

    // ---- Documents ----
    Route::get('/documents',                 [DocumentController::class, 'myDocuments']);
    Route::get('/documents/my',              [DocumentController::class, 'myDocuments']);
    Route::post('/documents/upload',         [DocumentController::class, 'upload']);
    Route::post('/documents',                [DocumentController::class, 'upload']);
    Route::post('/documents/{id}/replace',   [DocumentController::class, 'replace']);
    Route::get('/documents/{id}/view',       [DocumentController::class, 'view']);
    Route::get('/documents/{id}/url',        [DocumentController::class, 'view']); // Alias for frontend compatibility
    Route::get('/documents/{id}/preview',    [DocumentController::class, 'streamFile']); // Direct streaming preview
    Route::delete('/documents/{id}',         [DocumentController::class, 'delete']);

    // ---- PDF Generation (Applicant) ----
    Route::get('/applications/{id}/form.pdf', [PdfController::class, 'generateApplicationForm']);

    // =========================================================================
    // Admin-only routes
    // =========================================================================
    Route::prefix('admin')->middleware('admin')->group(function () {

        // ---- Messages (Admin) ----
        Route::get('/messages',                             [MessageController::class, 'index']);
        Route::post('/messages',                            [MessageController::class, 'store']);

        // ---- Application management ----
        Route::get('/applications',                         [ApplicationController::class, 'adminIndex']);
        Route::get('/applications/{id}',                    [ApplicationController::class, 'adminGetApplication']);
        Route::patch('/applications/{id}/status',           [ApplicationController::class, 'adminUpdateStatus']);
        Route::post('/applications/{id}/disqualify',        [ApplicationController::class, 'adminDisqualify']);
        Route::patch('/applications/{id}/official-fields',  [ApplicationController::class, 'adminSaveOfficialFields']);

        // ---- Document review ----
        Route::get('/applications/{appId}/documents',            [DocumentController::class, 'adminApplicationDocuments']);
        Route::get('/documents/{id}/view',                       [DocumentController::class, 'adminView']);
        Route::get('/documents/{id}/preview',                    [DocumentController::class, 'adminStreamFile']);
        Route::post('/documents/{id}/review',                    [DocumentController::class, 'adminReview']);
        Route::post('/applications/{appId}/documents/approve-all',[DocumentController::class, 'adminApproveAllDocuments']);

        // ---- Category CRUD ----
        Route::get('/categories',        [AdminCategoryController::class, 'index']);
        Route::post('/categories',       [AdminCategoryController::class, 'store']);
        Route::get('/categories/{id}',   [AdminCategoryController::class, 'show']);
        Route::put('/categories/{id}',   [AdminCategoryController::class, 'update']);
        Route::delete('/categories/{id}',[AdminCategoryController::class, 'destroy']);

        // ---- Barangay management ----
        Route::get('/barangays',                  [AdminBarangayController::class, 'index']);
        Route::post('/barangays',                 [AdminBarangayController::class, 'store']);
        Route::get('/barangays/{id}/applicants',  [AdminBarangayController::class, 'applicants']);
        Route::put('/barangays/{id}',             [AdminBarangayController::class, 'update']);
        Route::delete('/barangays/{id}',          [AdminBarangayController::class, 'destroy']);

        // ---- User management ----
        Route::get('/users',                    [AdminUserController::class, 'index']);
        Route::get('/users/{id}',               [AdminUserController::class, 'show']);
        Route::post('/users',                   [AdminUserController::class, 'store']);
        Route::put('/users/{id}/role',          [AdminUserController::class, 'updateRole']);
        Route::put('/users/{id}/status',        [AdminUserController::class, 'updateStatus']);
        Route::post('/users/{id}/reset-password',[AdminUserController::class, 'resetPassword']);

        // ---- Analytics ----
        Route::get('/analytics/overview',     [AdminAnalyticsController::class, 'overview']);
        Route::get('/analytics/demographics', [AdminAnalyticsController::class, 'demographics']);
        Route::get('/analytics/trends',       [AdminAnalyticsController::class, 'trends']);

        // ---- Audit Logs ----
        Route::get('/audit-logs', [AdminAuditLogController::class, 'index']);

        // ---- Announcements ----
        Route::get('/announcements',        [\App\Http\Controllers\AnnouncementController::class, 'index']);
        Route::post('/announcements',       [\App\Http\Controllers\AnnouncementController::class, 'store']);
        Route::put('/announcements/{id}',   [\App\Http\Controllers\AnnouncementController::class, 'update']);
        Route::delete('/announcements/{id}',[\App\Http\Controllers\AnnouncementController::class, 'destroy']);

        // ---- Resources CRUD ----
        Route::get('/resources',        [AdminResourceController::class, 'index']);
        Route::post('/resources',       [AdminResourceController::class, 'store']);
        Route::put('/resources/{id}',   [AdminResourceController::class, 'update']);
        Route::delete('/resources/{id}',[AdminResourceController::class, 'destroy']);

        // ---- Reports & exports ----
        Route::get('/reports/statistics.pdf', [PdfController::class, 'generateStatistics']);
        Route::get('/reports/export.csv',     [PdfController::class, 'exportCsv']);

        // ---- ID Card generation ----
        Route::get('/applications/{id}/id-card.pdf', [PdfController::class, 'generateIdCard']);

        // ---- Maintenance ----
        Route::post('/maintenance/renewal-reminders', [\App\Http\Controllers\ApplicationController::class, 'triggerRenewalReminders']);
    });
});

