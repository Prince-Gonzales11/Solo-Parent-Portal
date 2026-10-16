<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SupabaseStorageService
{
    protected string $baseUrl;
    protected string $serviceKey;
    protected string $defaultBucket;
    protected string $tempBucket;
    /** @var bool|string */
    protected $verifySsl;
    protected string $driver;
    protected string $localStoragePath;

    public function __construct()
    {
        $this->driver = config('services.supabase.driver', env('SUPABASE_STORAGE_DRIVER', 'supabase'));

        // Pre-commit safety gate: Production environments must strictly reject local/mock drivers
        if (app()->environment('production') && in_array($this->driver, ['local', 'mock'], true)) {
            throw new \DomainException("Local/mock Supabase storage driver is strictly prohibited in production environments.");
        }

        $this->localStoragePath = storage_path('app/mock_supabase');
        $this->baseUrl = rtrim((string) config('services.supabase.url', env('SUPABASE_URL', '')), '/');
        $this->serviceKey = (string) config('services.supabase.service_key', env('SUPABASE_SERVICE_KEY', ''));
        $this->defaultBucket = config('services.supabase.bucket', env('AWS_BUCKET', 'solo-parent-portal-documents'));
        $this->tempBucket = config('services.supabase.temp_bucket', env('SUPABASE_TEMP_BUCKET', 'solo-parent-temp'));
        
        $sslVerify = config('services.supabase.ssl_verify', true);
        $configuredCaBundle = config('services.supabase.ca_bundle', env('SUPABASE_CA_BUNDLE'));
        $defaultCaBundle = storage_path('certificates/ca-bundle.crt');
        $caBundle = $configuredCaBundle ?: (file_exists($defaultCaBundle) ? $defaultCaBundle : null);

        // Security requirement: Production and staging cloud requests must fail closed if certificate validation cannot be performed
        if (!$this->isLocalDriver()) {
            if (app()->environment('production', 'staging') && $sslVerify === false) {
                throw new \DomainException("Disabling TLS/SSL certificate verification is strictly prohibited in production and staging environments.");
            }

            if ($sslVerify && $configuredCaBundle && !file_exists($configuredCaBundle)) {
                throw new \DomainException("Configured Supabase CA certificate bundle does not exist: {$configuredCaBundle}");
            }
        }

        if ($sslVerify && $caBundle && file_exists($caBundle)) {
            $this->verifySsl = $caBundle;
        } else {
            $this->verifySsl = (bool) $sslVerify;
        }
    }

    public function isLocalDriver(): bool
    {
        return $this->driver === 'local' || $this->driver === 'mock';
    }

    /**
     * @return bool|string
     */
    public function getVerifySsl()
    {
        return $this->verifySsl;
    }

    public function getDriver(): string
    {
        return $this->driver;
    }

    public function getLocalStoragePath(): string
    {
        return $this->localStoragePath;
    }

    public function getDefaultBucket(): string
    {
        return $this->defaultBucket;
    }

    public function getTempBucket(): string
    {
        return $this->tempBucket;
    }

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    public function getServiceKey(): string
    {
        return $this->serviceKey;
    }

    /**
     * Resolve and validate a local mock storage path, strictly preventing directory traversal.
     *
     * @param string $bucket
     * @param string $path
     * @return string Absolute file path within localStoragePath
     * @throws \InvalidArgumentException
     */
    protected function resolveLocalPath(string $bucket, string $path): string
    {
        // 1. Bucket validation: reject empty, reject . and .., reject any characters not strictly alphanumeric, underscore, or hyphen
        $bucketTrimmed = trim($bucket);
        if ($bucketTrimmed === '' || $bucketTrimmed === '.' || $bucketTrimmed === '..' || !preg_match('/^[a-zA-Z0-9_\-]+$/', $bucketTrimmed)) {
            throw new \InvalidArgumentException("Invalid or unsafe storage bucket name: {$bucket}");
        }

        // 2. Storage path validation: reject empty, null bytes, absolute paths, and Windows drive letters
        if (str_contains($path, "\0")) {
            throw new \InvalidArgumentException("Null byte detected in storage path.");
        }

        $normalized = str_replace('\\', '/', $path);
        if (preg_match('/^[a-zA-Z]:/', $path) || str_starts_with($normalized, '/') || str_starts_with($path, '\\')) {
            throw new \InvalidArgumentException("Absolute paths are not permitted in storage operations: {$path}");
        }

        $cleanPath = trim($normalized, '/');
        if ($cleanPath === '') {
            throw new \InvalidArgumentException("Storage path cannot be empty.");
        }

        // 3. Segment traversal checks: reject empty segments, '.', '..'
        $segments = explode('/', $cleanPath);
        foreach ($segments as $segment) {
            $trimmedSegment = trim($segment);
            if ($trimmedSegment === '' || $trimmedSegment === '.' || $trimmedSegment === '..') {
                throw new \InvalidArgumentException("Directory traversal or empty segment detected in storage path: {$path}");
            }
        }

        // 4. Ensure designated local mock storage root directory exists
        if (!is_dir($this->localStoragePath)) {
            mkdir($this->localStoragePath, 0750, true);
        }

        $canonicalBase = realpath($this->localStoragePath);
        if ($canonicalBase === false) {
            $canonicalBase = rtrim(str_replace('\\', '/', $this->localStoragePath), '/');
        }

        // Build target full path
        $targetBucketDir = $canonicalBase . DIRECTORY_SEPARATOR . $bucketTrimmed;
        $targetFullPath = $targetBucketDir . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $segments);

        // 5. Canonical symlink / junction breakout check
        if (file_exists($targetFullPath)) {
            $realTarget = realpath($targetFullPath);
            if ($realTarget === false || (!str_starts_with($realTarget, $canonicalBase . DIRECTORY_SEPARATOR) && $realTarget !== $canonicalBase)) {
                throw new \InvalidArgumentException("Storage path escapes designated mock-storage root via symlink: {$path}");
            }
        } else {
            $parent = dirname($targetFullPath);
            while (!file_exists($parent) && $parent !== dirname($parent)) {
                $parent = dirname($parent);
            }
            if (file_exists($parent)) {
                $realParent = realpath($parent);
                if ($realParent === false || (!str_starts_with($realParent, $canonicalBase . DIRECTORY_SEPARATOR) && $realParent !== $canonicalBase)) {
                    throw new \InvalidArgumentException("Storage parent path escapes designated mock-storage root via symlink: {$path}");
                }
            }
        }

        return $targetFullPath;
    }

    /**
     * Ensure Supabase credentials exist before initiating live HTTP calls.
     *
     * @throws \RuntimeException
     */
    protected function ensureLiveConfigured(): void
    {
        if (empty($this->baseUrl) || empty($this->serviceKey)) {
            throw new \RuntimeException("Supabase storage is unconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_KEY.");
        }
    }

    /**
     * Safely encode an object path for use in Supabase Storage REST URLs.
     * Validates against directory traversal and null bytes.
     * Encodes each path segment individually via rawurlencode to preserve directory
     * slashes while safely escaping spaces, commas, parentheses, accented, and multibyte characters.
     *
     * @param string $path
     * @return string
     * @throws \InvalidArgumentException
     */
    public static function encodeStoragePath(string $path): string
    {
        if (str_contains($path, "\0")) {
            throw new \InvalidArgumentException("Null byte detected in storage path.");
        }

        $normalized = str_replace('\\', '/', $path);
        if (preg_match('/^[a-zA-Z]:/', $path) || str_starts_with($normalized, '/') || str_starts_with($path, '\\')) {
            throw new \InvalidArgumentException("Absolute paths are not permitted in storage operations: {$path}");
        }

        $cleanPath = trim($normalized, '/');
        if ($cleanPath === '') {
            throw new \InvalidArgumentException("Storage path cannot be empty.");
        }

        $segments = explode('/', $cleanPath);
        $encodedSegments = [];
        foreach ($segments as $segment) {
            $trimmed = trim($segment);
            if ($trimmed === '' || $trimmed === '.' || $trimmed === '..') {
                throw new \InvalidArgumentException("Directory traversal or empty segment detected in storage path: {$path}");
            }
            $encodedSegments[] = rawurlencode($trimmed);
        }

        return implode('/', $encodedSegments);
    }

    /**
     * Upload a file to Supabase Storage.
     *
     * @param string $path      Object path within the bucket (e.g. "applications/uuid/file.pdf")
     * @param string $contents  Raw file contents
     * @param string $mimeType  MIME type of the file
     * @param string|null $bucket  Bucket name (defaults to configured bucket)
     * @return array  ['path' => ..., 'bucket' => ...]
     * @throws \RuntimeException
     */
    public function upload(string $path, string $contents, string $mimeType, ?string $bucket = null): array
    {
        $bucket = $bucket ?? $this->defaultBucket;

        if ($this->driver === 'local' || $this->driver === 'mock') {
            $fullPath = $this->resolveLocalPath($bucket, $path);
            $dir = dirname($fullPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0750, true);
            }
            file_put_contents($fullPath, $contents);
            @chmod($fullPath, 0600);
            return [
                'path'   => $path,
                'bucket' => $bucket,
            ];
        }

        $this->ensureLiveConfigured();

        $encodedBucket = rawurlencode($bucket);
        $encodedPath = self::encodeStoragePath($path);
        $url = "{$this->baseUrl}/storage/v1/object/{$encodedBucket}/{$encodedPath}";

        $response = Http::withOptions(['verify' => $this->verifySsl])
            ->withHeaders([
                'Authorization' => "Bearer {$this->serviceKey}",
                'Content-Type'  => $mimeType,
                'x-upsert'     => 'true', // overwrite if exists
            ])
            ->withBody($contents, $mimeType)
            ->post($url);

        if (!$response->successful()) {
            $body = self::sanitizeResponseBody($response->body());
            Log::error('Supabase Storage upload failed', [
                'status' => $response->status(),
                'body'   => $body,
                'path'   => self::sanitizeLogPath($path),
                'bucket' => $bucket,
            ]);
            throw new \RuntimeException("Failed to upload file to storage: {$body}");
        }

        return [
            'path'   => $path,
            'bucket' => $bucket,
        ];
    }

    /**
     * Generate a temporary signed URL for private file access.
     *
     * @param string $path       Object path
     * @param int    $expiresIn  Seconds until expiry (default 15 min)
     * @param string|null $bucket
     * @return string  The signed URL
     * @throws \RuntimeException
     */
    public function getSignedUrl(string $path, int $expiresIn = 900, ?string $bucket = null): string
    {
        $bucket = $bucket ?? $this->defaultBucket;

        if ($this->driver === 'local' || $this->driver === 'mock') {
            $this->resolveLocalPath($bucket, $path);
            $doc = \App\Models\Document::where('permanent_storage_path', $path)
                ->orWhere('storage_path', $path)
                ->orWhere('temporary_storage_path', $path)
                ->first();
            if ($doc) {
                return url("/api/documents/{$doc->id}/preview");
            }
            $cleanPath = ltrim(str_replace('\\', '/', $path), '/');
            return url("/api/documents/preview?bucket=" . rawurlencode($bucket) . "&path=" . rawurlencode($cleanPath));
        }

        $this->ensureLiveConfigured();

        $encodedBucket = rawurlencode($bucket);
        $encodedPath = self::encodeStoragePath($path);
        $url = "{$this->baseUrl}/storage/v1/object/sign/{$encodedBucket}/{$encodedPath}";

        $response = Http::withOptions(['verify' => $this->verifySsl])
            ->withHeaders([
                'Authorization' => "Bearer {$this->serviceKey}",
                'Content-Type'  => 'application/json',
            ])
            ->post($url, ['expiresIn' => $expiresIn]);

        if (!$response->successful()) {
            Log::error('Supabase Storage signed URL failed', [
                'status' => $response->status(),
                'body'   => self::sanitizeResponseBody($response->body()),
                'path'   => self::sanitizeLogPath($path),
            ]);
            throw new \RuntimeException("Failed to generate signed URL");
        }

        $signedPath = $response->json('signedURL') ?? $response->json('signedUrl');
        if (!$signedPath) {
            throw new \RuntimeException("No signed URL in response");
        }

        // Supabase returns signed URL with literal spaces: "/object/sign/.../New Documents/..."
        // Encode spaces to %20 so that browser GET requests match the token signature.
        $parts = explode('?', $signedPath, 2);
        $pathPart = $parts[0];
        $queryPart = isset($parts[1]) ? '?' . $parts[1] : '';
        $safeSignedPath = str_replace(' ', '%20', $pathPart) . $queryPart;

        return $this->baseUrl . '/storage/v1' . $safeSignedPath;
    }

    /**
     * Download file contents from storage.
     *
     * @param string $path
     * @param string|null $bucket
     * @return string  Raw file contents
     * @throws \RuntimeException
     */
    public function download(string $path, ?string $bucket = null): string
    {
        $bucket = $bucket ?? $this->defaultBucket;

        if ($this->driver === 'local' || $this->driver === 'mock') {
            $fullPath = $this->resolveLocalPath($bucket, $path);
            if (!file_exists($fullPath)) {
                throw new \RuntimeException("Local mock file not found: {$path}");
            }
            return (string) file_get_contents($fullPath);
        }

        $this->ensureLiveConfigured();

        $encodedBucket = rawurlencode($bucket);
        $encodedPath = self::encodeStoragePath($path);
        $url = "{$this->baseUrl}/storage/v1/object/{$encodedBucket}/{$encodedPath}";

        $response = Http::withOptions(['verify' => $this->verifySsl])
            ->withHeaders([
                'Authorization' => "Bearer {$this->serviceKey}",
            ])
            ->get($url);

        if (!$response->successful()) {
            Log::error('Supabase Storage download failed', [
                'status' => $response->status(),
                'path'   => self::sanitizeLogPath($path),
            ]);
            throw new \RuntimeException("Failed to download file from storage: " . $response->status());
        }

        return $response->body();
    }

    /**
     * Move a file within the same bucket.
     *
     * @param string $fromPath  Current object path
     * @param string $toPath    Destination object path
     * @param string|null $bucket  Bucket name (defaults to configured bucket)
     * @return bool
     * @throws \RuntimeException
     */
    public function move(string $fromPath, string $toPath, ?string $bucket = null): bool
    {
        $bucket = $bucket ?? $this->defaultBucket;

        if ($this->driver === 'local' || $this->driver === 'mock') {
            $fromFullPath = $this->resolveLocalPath($bucket, $fromPath);
            $toFullPath = $this->resolveLocalPath($bucket, $toPath);
            if (!file_exists($fromFullPath)) {
                throw new \RuntimeException("Local mock source file not found: {$fromPath}");
            }
            $targetDir = dirname($toFullPath);
            if (!is_dir($targetDir)) {
                mkdir($targetDir, 0750, true);
            }
            return rename($fromFullPath, $toFullPath);
        }

        $this->ensureLiveConfigured();

        $cleanFrom = trim(str_replace('\\', '/', $fromPath), '/');
        $cleanTo = trim(str_replace('\\', '/', $toPath), '/');
        if (str_contains($cleanFrom, "\0") || str_contains($cleanFrom, '..') || str_contains($cleanTo, "\0") || str_contains($cleanTo, '..')) {
            throw new \InvalidArgumentException("Directory traversal or null byte detected in storage move operation.");
        }

        $url = "{$this->baseUrl}/storage/v1/object/move";

        $response = Http::withOptions(['verify' => $this->verifySsl])
            ->withHeaders([
                'Authorization' => "Bearer {$this->serviceKey}",
                'Content-Type'  => 'application/json',
            ])
            ->post($url, [
                'bucketId'       => $bucket,
                'sourceKey'      => $cleanFrom,
                'destinationKey' => $cleanTo,
            ]);

        if (!$response->successful()) {
            $body = self::sanitizeResponseBody($response->body());
            Log::error('Supabase Storage move failed', [
                'status' => $response->status(),
                'body'   => $body,
                'from'   => self::sanitizeLogPath($fromPath),
                'to'     => self::sanitizeLogPath($toPath),
            ]);
            throw new \RuntimeException("Failed to move file in storage: {$body}");
        }

        return true;
    }

    /**
     * Delete a file from storage.
     *
     * @param string $path
     * @param string|null $bucket
     * @return bool
     */
    public function delete(string $path, ?string $bucket = null): bool
    {
        $bucket = $bucket ?? $this->defaultBucket;

        if ($this->driver === 'local' || $this->driver === 'mock') {
            $fullPath = $this->resolveLocalPath($bucket, $path);
            if (file_exists($fullPath)) {
                @unlink($fullPath);
            }
            return true;
        }

        $this->ensureLiveConfigured();

        $cleanPath = trim(str_replace('\\', '/', $path), '/');
        if (str_contains($cleanPath, "\0") || str_contains($cleanPath, '..')) {
            throw new \InvalidArgumentException("Directory traversal or null byte detected in storage delete operation.");
        }

        $encodedBucket = rawurlencode($bucket);
        $url = "{$this->baseUrl}/storage/v1/object/{$encodedBucket}";

        $response = Http::withOptions(['verify' => $this->verifySsl])
            ->withHeaders([
                'Authorization' => "Bearer {$this->serviceKey}",
                'Content-Type'  => 'application/json',
            ])
            ->delete($url, ['prefixes' => [$cleanPath]]);

        if (!$response->successful()) {
            Log::warning('Supabase Storage delete failed', [
                'status' => $response->status(),
                'body'   => self::sanitizeResponseBody($response->body()),
                'path'   => self::sanitizeLogPath($path),
            ]);
            return false;
        }

        return true;
    }

    /**
     * Upload a file to the temporary bucket.
     *
     * @param string $path
     * @param string $contents
     * @param string $mimeType
     * @return array
     */
    public function uploadTemporary(string $path, string $contents, string $mimeType): array
    {
        return $this->upload($path, $contents, $mimeType, $this->tempBucket);
    }

    /**
     * Generate a signed URL for a file in the temporary bucket.
     *
     * @param string $path
     * @param int $expiresIn
     * @return string
     */
    public function getTemporarySignedUrl(string $path, int $expiresIn = 900): string
    {
        return $this->getSignedUrl($path, $expiresIn, $this->tempBucket);
    }

    /**
     * Download a file from the temporary bucket.
     *
     * @param string $path
     * @return string
     */
    public function downloadTemporary(string $path): string
    {
        return $this->download($path, $this->tempBucket);
    }

    /**
     * Delete a file from the temporary bucket.
     *
     * @param string $path
     * @return bool
     */
    public function deleteTemporary(string $path): bool
    {
        return $this->delete($path, $this->tempBucket);
    }

    /**
     * Promote a file from the temporary bucket to the permanent bucket.
     * This will download the file from the temp bucket, upload it to the
     * permanent bucket, and then delete the file from the temp bucket.
     *
     * @param string $tempPath
     * @param string $permanentPath
     * @param string|null $mimeType (optional) if not provided, it will be guessed or defaulted to application/octet-stream
     * @return string The permanent path
     * @throws \Exception
     */
    public function promoteToPermanent(string $tempPath, string $permanentPath, string $mimeType = 'application/octet-stream'): string
    {
        try {
            // 1. Download from temporary bucket
            $contents = $this->downloadTemporary($tempPath);
            
            // 2. Upload to permanent bucket
            $this->upload($permanentPath, $contents, $mimeType);
            
            // 3. Delete from temporary bucket
            $deleted = $this->deleteTemporary($tempPath);
            if (!$deleted) {
                Log::warning('Temporary file deletion failed during promotion; temp object will be pruned by storage:clean-temp', [
                    'temp_path'      => self::sanitizeLogPath($tempPath),
                    'permanent_path' => self::sanitizeLogPath($permanentPath),
                ]);
            }
            
            return $permanentPath;
        } catch (\Exception $e) {
            $sanitizedError = self::sanitizePromotionError($e->getMessage());
            Log::error('Failed to promote document to permanent storage', [
                'temp_path'      => self::sanitizeLogPath($tempPath),
                'permanent_path' => self::sanitizeLogPath($permanentPath),
                'error'          => $sanitizedError,
            ]);
            throw $e;
        }
    }

    /**
     * Promote a Document model record from temporary bucket to permanent bucket,
     * updating the document record status, paths, attempts, and error tracking.
     *
     * @param \App\Models\Document $doc
     * @return bool True if successfully promoted or already promoted, false otherwise.
     */
    public function promoteDocumentRecord(\App\Models\Document $doc): bool
    {
        if ($doc->storage_status === 'promoted' && $doc->permanent_storage_path) {
            return true;
        }

        $sourcePath = $doc->temporary_storage_path ?: $doc->storage_path;
        if (!$sourcePath) {
            $doc->update([
                'storage_status'     => 'promotion_failed',
                'promotion_error'    => 'No source storage path available for promotion.',
                'promotion_attempts' => ($doc->promotion_attempts ?? 0) + 1,
            ]);
            return false;
        }

        $doc->loadMissing(['application', 'requirement']);
        $appType = $doc->application->application_type ?? 'new_id';
        $refNo = $doc->application->reference_no ?? 'UNKNOWN';
        $reqName = $doc->requirement->name ?? 'Document';
        $filename = basename($sourcePath);

        $permanentPath = \App\Services\StoragePathBuilder::buildPermanentPath(
            $doc->user_id,
            $appType,
            $refNo,
            $reqName,
            $filename
        );

        try {
            $this->promoteToPermanent($sourcePath, $permanentPath, $doc->mime_type ?: 'application/octet-stream');

            $doc->update([
                'permanent_storage_path' => $permanentPath,
                'storage_status'         => 'promoted',
                'promoted_at'            => now(),
                'promotion_error'        => null,
            ]);

            return true;
        } catch (\Throwable $e) {
            $sanitizedError = self::sanitizePromotionError($e->getMessage());

            Log::warning("Promotion failed for document {$doc->id}", [
                'doc_id'      => $doc->id,
                'source_path' => self::sanitizeLogPath($sourcePath),
                'error'       => $sanitizedError
            ]);

            $doc->update([
                'storage_status'     => 'promotion_failed',
                'promotion_error'    => $sanitizedError,
                'promotion_attempts' => ($doc->promotion_attempts ?? 0) + 1,
            ]);

            return false;
        }
    }

    /**
     * Sanitize error message to prevent leaking Supabase keys, bearer tokens, signed URLs, or secrets.
     */
    public static function sanitizePromotionError(string $rawError): string
    {
        // Redact Bearer / JWT tokens
        $sanitized = preg_replace('#Bearer\s+[A-Za-z0-9\-\._~+/]+=*#i', 'Bearer [REDACTED]', $rawError);
        // Redact apikey or service keys or signatures in query strings or config
        $sanitized = preg_replace('#(apikey|service_key|api_key|token|signature|secret|password)=([^&\s]+)#i', '$1=[REDACTED]', $sanitized);
        // Redact Authorization headers
        $sanitized = preg_replace('#Authorization:\s*[^\r\n]+#i', 'Authorization: [REDACTED]', $sanitized);
        // Redact URLs with query parameters that may contain signed tokens
        $sanitized = preg_replace('#(/object/sign/[^\s?]+)\?[^\s]+#i', '$1?[REDACTED_PARAMS]', $sanitized);
        // Redact standalone JWTs (three base64url segments separated by dots)
        $sanitized = preg_replace('#eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*#', '[REDACTED_JWT]', $sanitized);

        return substr(trim($sanitized), 0, 500);
    }

    /**
     * Sanitize response bodies returned by Supabase Storage or CDN proxies.
     */
    public static function sanitizeResponseBody(?string $body): string
    {
        if ($body === null || $body === '') {
            return '';
        }
        return self::sanitizePromotionError($body);
    }

    /**
     * Sanitize object paths in logs to avoid unnecessary PII exposure while preserving diagnostics.
     */
    public static function sanitizeLogPath(string $path): string
    {
        $normalized = str_replace('\\', '/', $path);
        // Mask applicant folder name: Applicants/LastName., FirstName, MI/ -> Applicants/[APPLICANT_FOLDER]/
        $sanitized = preg_replace('#^Applicants/[^/]+/#i', 'Applicants/[APPLICANT_FOLDER]/', $normalized);
        return self::sanitizePromotionError($sanitized);
    }
}

