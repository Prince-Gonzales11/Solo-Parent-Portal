<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ApplicationFamilyMember extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'application_id', 'member_type', 'name', 'relationship', 
        'age', 'civil_status', 'educational_attainment', 
        'date_of_birth', 'monthly_income'
    ];

    protected $casts = [
        'date_of_birth' => 'date'
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }
}
