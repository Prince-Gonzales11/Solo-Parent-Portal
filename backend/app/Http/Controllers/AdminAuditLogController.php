<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AdminAuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::orderBy('created_at', 'desc');

        $likeOp = \Illuminate\Support\Facades\DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        if ($request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s, $likeOp) {
                $q->where('actor_email', $likeOp, "%{$s}%")
                  ->orWhere('action', $likeOp, "%{$s}%")
                  ->orWhere('entity_id', $likeOp, "%{$s}%");
            });
        }

        if ($request->action) {
            $query->where('action', $request->action);
        }

        if ($request->date_from) {
            $query->where('created_at', '>=', $request->date_from . ' 00:00:00');
        }

        if ($request->date_to) {
            $query->where('created_at', '<=', $request->date_to . ' 23:59:59');
        }

        $logs = $query->paginate(50);

        return response()->json($logs);
    }
}
