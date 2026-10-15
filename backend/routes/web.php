<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GoogleAuthController;

Route::get('/', function () {
    return view('welcome');
});

// Google OAuth callback (web route because Google redirects the browser here)
Route::get('/google/callback', [GoogleAuthController::class, 'callback']);
