<?php

namespace App\Http\Controllers;

use App\Models\Barangay;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AdminBarangayController extends Controller
{
    public function index(Request $request)
    {
        $query = Barangay::withCount('profiles');

        $likeOp = \Illuminate\Support\Facades\DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        if ($request->search) {
            $query->where('name', $likeOp, '%' . $request->search . '%');
        }

        if ($request->has('active') && $request->active !== 'all') {
            $query->where('is_active', $request->active === 'true');
        }

        $barangays = $query->orderBy('name')->get();

        return response()->json($barangays);
    }

    /**
     * Get applicants for a specific barangay.
     */
    public function applicants($id, Request $request)
    {
        $barangay = Barangay::findOrFail($id);

        $query = \App\Models\ApplicantProfile::where('barangay_id', $barangay->id)
            ->with(['user', 'user.applications' => function($aq) {
                $aq->latest()->select('id', 'user_id', 'status', 'reference_no', 'solo_parent_category', 'submitted_at');
            }]);

        if ($request->search) {
            $s = $request->search;
            $likeOp = \Illuminate\Support\Facades\DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where(function ($q) use ($s, $likeOp) {
                $q->where('first_name', $likeOp, "%{$s}%")
                  ->orWhere('last_name', $likeOp, "%{$s}%")
                  ->orWhereHas('user', function($uq) use ($s, $likeOp) {
                      $uq->where('email', $likeOp, "%{$s}%");
                  });
            });
        }

        $profiles = $query->orderBy('last_name')->paginate(30);

        // Append latest_application_id helper
        $profiles->getCollection()->transform(function($p) {
            $latestApp = $p->user?->applications?->first();
            $p->latest_application_id = $latestApp?->id;
            $p->latest_application_ref = $latestApp?->reference_no;
            $p->latest_application_status = $latestApp?->status;
            return $p;
        });

        return response()->json($profiles);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:160|unique:barangays,name',
        ]);

        $barangay = Barangay::create([
            'name'      => trim($request->name),
            'is_active' => true,
        ]);

        AuditLog::record($request, 'barangay.created', 'Barangay', $barangay->id, [
            'name' => $barangay->name,
        ]);

        return response()->json($barangay, 201);
    }

    public function update($id, Request $request)
    {
        $barangay = Barangay::findOrFail($id);

        $request->validate([
            'name'      => 'sometimes|string|max:160|unique:barangays,name,' . $id,
            'is_active' => 'sometimes|boolean',
        ]);

        $old = $barangay->only(['name', 'is_active']);

        $barangay->update($request->only(['name', 'is_active']));

        AuditLog::record($request, 'barangay.updated', 'Barangay', $barangay->id, [
            'before' => $old,
            'after'  => $barangay->fresh()->only(['name', 'is_active']),
        ]);

        return response()->json($barangay->fresh());
    }

    public function destroy($id, Request $request)
    {
        $barangay = Barangay::findOrFail($id);

        AuditLog::record($request, 'barangay.deleted', 'Barangay', $barangay->id, [
            'name' => $barangay->name,
        ]);

        $barangay->delete();

        return response()->json(['message' => 'Barangay deleted.']);
    }
}
