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

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.supabase.url', env('SUPABASE_URL')), '/');
        $this->serviceKey = config('services.supabase.service_key', env('SUPABASE_SERVICE_KEY'));
        $this->defaultBucket = config('services.supabase.bucket', env('AWS_BUCKET', 'solo-parent-documents'));
        $this->tempBucket = config('services.supabase.temp_bucket', env('SUPABASE_TEMP_BUCKET', 'solo-parent-temp'));
        
        $sslVerify = config('services.supabase.ssl_verify', app()->environment('production'));
        $caBundle = config('services.supabase.ca_bundle', storage_path('certificates/ca-bundle.crt'));
        if ($sslVerify && file_exists($caBundle)) {
            $this->verifySsl = $caBundle;
        } else {
            $this->verifySsl = (bool) $sslVerify;
        }
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
        $encodedBucket = rawurlencode($bucket);
        $encodedPath = implode('/', array_map('rawurlencode', explode('/', $path)));
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
            $body = $response->body();
            Log::error('Supabase Storage upload failed', [
                'status' => $response->status(),
                'body'   => $body,
                'path'   => $path,
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
        $encodedBucket = rawurlencode($bucket);
        // Pass path directly without rawurlencoding commas/symbols which break Supabase signature verification
        $cleanPath = ltrim($path, '/');
        $url = "{$this->baseUrl}/storage/v1/object/sign/{$encodedBucket}/{$cleanPath}";

        $response = Http::withOptions(['verify' => $this->verifySsl])
            ->withHeaders([
                'Authorization' => "Bearer {$this->serviceKey}",
                'Content-Type'  => 'application/json',
            ])
            ->post($url, ['expiresIn' => $expiresIn]);

        if (!$response->successful()) {
            Log::error('Supabase Storage signed URL failed', [
                'status' => $response->status(),
                'body'   => $response->body(),
                'path'   => $path,
            ]);
            throw new \RuntimeException("Failed to generate signed URL");
        }

        $signedPath = $response->json('signedURL') ?? $response->json('signedUrl');
        if (!$signedPath) {
            throw new \RuntimeException("No signed URL in response");
        }

        // Supabase returns signed URL with literal spaces: "/object/sign/.../New Documents/..."
        // Encode spaces to %20 so that browser GET requests match the token signature.
        $safeSignedPath = str_replace(' ', '%20', $signedPath);

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
        $encodedBucket = rawurlencode($bucket);
        $cleanPath = ltrim($path, '/');
        $url = "{$this->baseUrl}/storage/v1/object/{$encodedBucket}/" . str_replace(' ', '%20', $cleanPath);

        $response = Http::withOptions(['verify' => $this->verifySsl])
            ->withHeaders([
                'Authorization' => "Bearer {$this->serviceKey}",
            ])
            ->get($url);

        if (!$response->successful()) {
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
        $url = "{$this->baseUrl}/storage/v1/object/move";

        $response = Http::withOptions(['verify' => $this->verifySsl])
            ->withHeaders([
                'Authorization' => "Bearer {$this->serviceKey}",
                'Content-Type'  => 'application/json',
            ])
            ->post($url, [
                'bucketId'       => $bucket,
                'sourceKey'      => $fromPath,
                'destinationKey' => $toPath,
            ]);

        if (!$response->successful()) {
            Log::error('Supabase Storage move failed', [
                'status' => $response->status(),
                'body'   => $response->body(),
                'from'   => $fromPath,
                'to'     => $toPath,
            ]);
            throw new \RuntimeException("Failed to move file in storage: {$response->body()}");
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
        $encodedBucket = rawurlencode($bucket);
        $url = "{$this->baseUrl}/storage/v1/object/{$encodedBucket}";

        $response = Http::withOptions(['verify' => $this->verifySsl])
            ->withHeaders([
                'Authorization' => "Bearer {$this->serviceKey}",
                'Content-Type'  => 'application/json',
            ])
            ->delete($url, ['prefixes' => [$path]]);

        if (!$response->successful()) {
            Log::warning('Supabase Storage delete failed', [
                'status' => $response->status(),
                'body'   => $response->body(),
                'path'   => $path,
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
            
            // 3. Verify permanent upload by generating signed URL or reading metadata (we assume upload throws on failure)
            
            // 4. Delete from temporary bucket
            $this->deleteTemporary($tempPath);
            
            return $permanentPath;
        } catch (\Exception $e) {
            Log::error('Failed to promote document to permanent storage', [
                'temp_path' => $tempPath,
                'permanent_path' => $permanentPath,
                'error' => $e->getMessage()
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
                'source_path' => $sourcePath,
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
        $sanitized = preg_replace('/Bearer\s+[A-Za-z0-9\-\._~+\/]+=*/i', 'Bearer [REDACTED]', $rawError);
        // Redact apikey or service keys or signatures in query strings
        $sanitized = preg_replace('/(apikey|service_key|api_key|token|signature|secret|password)=([^&\s]+)/i', '$1=[REDACTED]', $sanitized);
        // Redact Authorization headers
        $sanitized = preg_replace('/Authorization:\s*[^\r\n]+/i', 'Authorization: [REDACTED]', $sanitized);
        // Redact URLs with query parameters that may contain signed tokens
        $sanitized = preg_replace('/(\/object\/sign\/[^\s\?]+)\?[^\s]+/i', '$1?[REDACTED_PARAMS]', $sanitized);
        
        return substr(trim($sanitized), 0, 500);
    }
}

