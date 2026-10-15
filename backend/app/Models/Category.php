<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Category extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $table = 'solo_parent_categories';

    protected $fillable = [
        'code', 'name', 'description', 'display_order', 'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function requirements()
    {
        return $this->hasMany(DocumentaryRequirement::class, 'category_id');
    }

    public function applications()
    {
        return $this->hasMany(Application::class, 'category_id');
    }
}
