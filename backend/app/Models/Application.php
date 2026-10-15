<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Application extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'user_id', 'reference_no', 'application_type', 'category_id',
        'status', 'status_reason',
        'id_card_number', 'case_number', 'beneficiary_code',
        'date_issued',
        'previous_application_id', 'previous_id_card_number', 'renewal_reminder_sent',
        'existing_spic_issue_date', 'existing_spic_expiry_date', 'loss_circumstance',
        'applicant_verified_at',
        'is_form_complete', 'are_documents_complete',
        'submitted_at', 'decided_at', 'released_at', 'reviewed_by'
    ];

    protected $casts = [
        'renewal_reminder_sent' => 'boolean',
        'is_form_complete' => 'boolean',
        'are_documents_complete' => 'boolean',
        'date_issued' => 'date',
        'existing_spic_issue_date' => 'date',
        'existing_spic_expiry_date' => 'date',
        'applicant_verified_at' => 'datetime',
        'submitted_at' => 'datetime',
        'decided_at' => 'datetime',
        'released_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function form()
    {
        return $this->hasOne(ApplicationForm::class);
    }

    public function familyMembers()
    {
        return $this->hasMany(ApplicationFamilyMember::class);
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    public function statusHistory()
    {
        return $this->hasMany(ApplicationStatusHistory::class);
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }
}
