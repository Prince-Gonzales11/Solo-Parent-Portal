<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class AuditLog extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'admin_id', 'action', 'entity_type',
        'entity_id', 'previous_state', 'new_state', 'reason', 'ip_address'
    ];

    protected $casts = [
        'previous_state' => 'array',
        'new_state' => 'array',
    ];

    /**
     * Convenience helper to record an audit log entry from a controller.
     */
    public static function record(
        \Illuminate\Http\Request $request,
        string $action,
        ?string $entityType = null,
        ?string $entityId = null,
        array $newState = [],
        array $previousState = []
    ): self {
        $user = $request->user();

        return self::create([
            'admin_id'       => $user?->id, // Store the acting user
            'action'         => $action,
            'entity_type'    => $entityType,
            'entity_id'      => $entityId,
            'previous_state' => empty($previousState) ? null : $previousState,
            'new_state'      => empty($newState) ? null : $newState,
            'ip_address'     => $request->ip(),
        ]);
    }
}
