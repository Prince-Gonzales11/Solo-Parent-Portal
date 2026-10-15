<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ApplicationStatusHistory extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'application_status_history';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    // Always set created_at on insert
    protected static function booted(): void
    {
        static::creating(function ($model) {
            if (empty($model->created_at)) {
                $model->created_at = now();
            }
        });
    }

    protected $fillable = [
        'application_id', 'from_status', 'to_status', 'note',
        'changed_by', 'changed_by_name', 'created_at'
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }
}
