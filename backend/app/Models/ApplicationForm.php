<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ApplicationForm extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'application_id', 'philsys_card_number', 'place_of_birth', 'civil_status', 
        'religion', 'nationality', 'educational_attainment', 'occupation', 
        'employment_status', 'employer_name', 'company_agency', 'monthly_income',
        'is_indigent', 'is_4ps_beneficiary', 'household_id_4ps', 'is_indigenous', 
        'indigenous_affiliation', 'is_lgbtqia', 'is_pwd',
        'solo_parent_since', 'classification_details', 'needs_problems',
        'emergency_contact_name', 'emergency_contact_relationship', 
        'emergency_contact_address', 'emergency_contact_number',
        'signature_data'
    ];

    protected $casts = [
        'is_indigent' => 'boolean',
        'is_4ps_beneficiary' => 'boolean',
        'is_indigenous' => 'boolean',
        'is_lgbtqia' => 'boolean',
        'is_pwd' => 'boolean',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }
}
