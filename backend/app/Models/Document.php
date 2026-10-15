<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Document extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'application_documents';

    protected $fillable = [
        'user_id', 'application_id', 'requirement_id',
        'original_filename', 'storage_path', 'mime_type', 'file_size',
        'review_status', 'review_note', 'reviewed_by', 'reviewed_at',
        'temporary_storage_path', 'permanent_storage_path',
        'storage_status', 'promoted_at', 'promotion_error', 'promotion_attempts'
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'promoted_at' => 'datetime',
    ];

    /**
     * Accessor: resolve the active storage path based on status
     */
    public function getActiveStoragePathAttribute(): ?string
    {
        if ($this->storage_status === 'promoted' && $this->permanent_storage_path) {
            return $this->permanent_storage_path;
        }
        return $this->temporary_storage_path ?? $this->storage_path;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function requirement()
    {
        return $this->belongsTo(DocumentaryRequirement::class, 'requirement_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
