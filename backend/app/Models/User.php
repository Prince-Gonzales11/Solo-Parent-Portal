<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'email',
        'phone_number',
        'password_hash',
        'full_name',
        'role',
        'auth_provider',
        'picture',
        'is_active',
        'google_id',
        'email_verified_at',
        'dpa_consent',
        'dpa_consented_at',
        'dpa_consent_ip',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'dpa_consent' => 'boolean',
        'dpa_consented_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    /**
     * Get the password for the user.
     * Overriding default since we use 'password_hash'.
     */
    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    /**
     * Accessor for 'name' to alias 'full_name'.
     */
    public function getNameAttribute(): string
    {
        return $this->full_name ?? '';
    }

    public function setNameAttribute($value): void
    {
        $this->attributes['full_name'] = $value;
    }
    
    public function profile()
    {
        return $this->hasOne(ApplicantProfile::class);
    }
    
    public function applications()
    {
        return $this->hasMany(Application::class);
    }
    
    public function documents()
    {
        return $this->hasMany(Document::class);
    }
    
    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function emailVerifications()
    {
        return $this->hasMany(EmailVerification::class);
    }
}
