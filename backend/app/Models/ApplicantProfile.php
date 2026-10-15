<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ApplicantProfile extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'first_name', 'middle_name', 'last_name', 'suffix', 'sex', 'birth_date',
        'contact_number', 'telephone',
        'barangay', 'barangay_id', 'house_no', 'street', 'city_municipality', 'province', 'region', 'zip_code',
        'is_profile_complete'
    ];

    protected $casts = [
        'is_profile_complete' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function barangayRecord()
    {
        return $this->belongsTo(Barangay::class, 'barangay_id');
    }

    public function barangay()
    {
        return $this->belongsTo(Barangay::class, 'barangay_id');
    }
}
