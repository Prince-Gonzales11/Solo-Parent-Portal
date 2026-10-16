<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI', 'http://localhost:8000/google/callback'),
    ],

    'supabase' => [
        'driver' => env('SUPABASE_STORAGE_DRIVER', 'supabase'),
        'url' => env('SUPABASE_URL'),
        'service_key' => env('SUPABASE_SERVICE_KEY'),
        'bucket' => env('AWS_BUCKET', 'solo-parent-portal-documents'),
        'temp_bucket' => env('SUPABASE_TEMP_BUCKET', 'solo-parent-temp'),
        'ssl_verify' => env('SUPABASE_SSL_VERIFY', true),
        'ca_bundle' => env('SUPABASE_CA_BUNDLE', storage_path('certificates/ca-bundle.crt')),
    ],

];
