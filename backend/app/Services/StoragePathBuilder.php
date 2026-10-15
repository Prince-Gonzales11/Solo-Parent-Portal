<?php

namespace App\Services;

use App\Models\ApplicantProfile;
use Illuminate\Support\Str;

class StoragePathBuilder
{
    /**
     * Build the path for a document in the temporary bucket.
     * 
     * Pattern: Applicants/{Folder Name}/{App Type}/{Ref No}/Requirements/{Requirement Name}/{Filename}
     */
    public static function buildTempPath(string $userId, string $appType, string $refNo, string $requirementName, string $storedFilename): string
    {
        $applicantFolder = self::buildApplicantFolder($userId);
        $typeFolder = self::appTypeFolder($appType);
        $reqFolder = self::sanitize($requirementName);
        return "Applicants/{$applicantFolder}/{$typeFolder}/{$refNo}/Requirements/{$reqFolder}/{$storedFilename}";
    }

    /**
     * Build the path for a document in the permanent bucket.
     * 
     * Pattern: Applicants/{Folder Name}/{App Type}/{Ref No}/Requirements/{Requirement Name}/{Filename}
     */
    public static function buildPermanentPath(string $userId, string $appType, string $refNo, string $requirementName, string $storedFilename): string
    {
        // For our implementation, temp and perm paths have the exact same structure, just in different buckets
        return self::buildTempPath($userId, $appType, $refNo, $requirementName, $storedFilename);
    }

    /**
     * Build the applicant's base folder name: "LastName., FirstName, MI."
     */
    public static function buildApplicantFolder(string $userId): string
    {
        $profile = ApplicantProfile::where('user_id', $userId)->first();

        if ($profile && $profile->last_name && $profile->first_name) {
            $lastName  = trim($profile->last_name);
            $firstName = trim($profile->first_name);
            $middlePart = '';

            if ($profile->middle_name) {
                $middleInitial = strtoupper(mb_substr(trim($profile->middle_name), 0, 1));
                $middlePart = ", {$middleInitial}";
            }

            $folderName = "{$lastName}., {$firstName}{$middlePart}";
            // Sanitize
            $folderName = preg_replace('/[\\\\\\/:*?"<>|]/', '', $folderName);
            return $folderName;
        }

        return $userId; // Fallback
    }

    /**
     * Map application type to a human readable folder name
     */
    public static function appTypeFolder(string $type): string
    {
        return match($type) {
            'new', 'new_id' => 'New ID',
            'renewal'       => 'Renewal',
            'loss', 'loss_spic' => 'Loss of SPIC',
            default         => 'Other',
        };
    }

    /**
     * Sanitize a string to be safe for S3 object keys
     */
    private static function sanitize(string $name): string
    {
        $name = preg_replace('/[\\\\\\/:*?"<>|]/', '', $name);
        return trim($name);
    }
}
