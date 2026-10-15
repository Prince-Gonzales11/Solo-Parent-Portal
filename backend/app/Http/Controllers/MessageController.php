<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Application;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MessageController extends Controller
{
    /**
     * List messages.
     * - For applicants: returns their thread with CSWDD Office.
     * - For admins: returns conversations list or specific conversation thread.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $isAdmin = in_array($user->role, ['admin', 'super_admin']);

        if (!$isAdmin) {
            // Applicant view
            $messages = Message::where(function ($q) use ($user) {
                $q->where('sender_id', $user->id)
                  ->orWhere('recipient_id', $user->id);
            })
            ->with(['application:id,reference_no,application_type,status', 'sender:id,full_name,role'])
            ->orderBy('created_at', 'asc')
            ->get();

            // Mark admin messages to this user as read
            Message::where('recipient_id', $user->id)
                ->where('is_read', false)
                ->update(['is_read' => true, 'read_at' => now()]);

            // User's applications for contextual referencing
            $applications = Application::where('user_id', $user->id)
                ->select('id', 'reference_no', 'application_type', 'status', 'created_at')
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'messages'     => $messages,
                'applications' => $applications,
            ]);
        }

        // Admin view: specific conversation thread or overview
        $targetUserId = $request->query('user_id');
        $applicationId = $request->query('application_id');

        if ($targetUserId || $applicationId) {
            $query = Message::with(['application:id,reference_no,application_type,status', 'sender:id,full_name,role']);

            if ($targetUserId) {
                $query->where(function ($q) use ($targetUserId) {
                    $q->where('sender_id', $targetUserId)
                      ->orWhere('recipient_id', $targetUserId);
                });
            }

            if ($applicationId) {
                $query->where('application_id', $applicationId);
            }

            $messages = $query->orderBy('created_at', 'asc')->get();

            // Mark applicant messages as read
            if ($targetUserId) {
                Message::where('sender_id', $targetUserId)
                    ->where('is_read', false)
                    ->update(['is_read' => true, 'read_at' => now()]);
            }

            $targetUser = $targetUserId ? User::find($targetUserId) : null;
            $app = $applicationId ? Application::find($applicationId) : null;

            return response()->json([
                'messages'    => $messages,
                'target_user' => $targetUser,
                'application' => $app,
            ]);
        }

        // Admin conversations list
        $conversations = Message::selectRaw('
                CASE WHEN sender_type = \'applicant\' THEN sender_id ELSE recipient_id END as applicant_id,
                MAX(created_at) as last_message_at,
                COUNT(CASE WHEN is_read = false AND sender_type = \'applicant\' THEN 1 END) as unread_count
            ')
            ->groupBy('applicant_id')
            ->orderBy('last_message_at', 'desc')
            ->get();

        $result = [];
        foreach ($conversations as $conv) {
            if (!$conv->applicant_id) continue;
            $applicant = User::find($conv->applicant_id);
            if (!$applicant) continue;

            $lastMsg = Message::where(function ($q) use ($conv) {
                $q->where('sender_id', $conv->applicant_id)
                  ->orWhere('recipient_id', $conv->applicant_id);
            })->with('application:id,reference_no,application_type,status')->latest()->first();

            $result[] = [
                'applicant_id'    => $conv->applicant_id,
                'applicant_name'  => $applicant->full_name,
                'applicant_email' => $applicant->email,
                'unread_count'    => (int) $conv->unread_count,
                'last_message'    => $lastMsg ? $lastMsg->message : '',
                'last_message_at' => $conv->last_message_at,
                'application'     => $lastMsg?->application,
            ];
        }

        return response()->json([
            'conversations' => $result,
        ]);
    }

    /**
     * Send a new message.
     */
    public function store(Request $request)
    {
        $request->validate([
            'message'        => 'required|string|max:5000',
            'application_id' => 'nullable|uuid',
            'recipient_id'   => 'nullable|uuid',
        ]);

        $user = $request->user();
        $isAdmin = in_array($user->role, ['admin', 'super_admin']);

        $applicationId = $request->application_id;
        $recipientId   = $request->recipient_id;

        if (!$isAdmin) {
            // Applicant sending to CSWDD Office
            if (!$applicationId) {
                $activeApp = Application::where('user_id', $user->id)
                    ->whereNotIn('status', ['cancelled', 'expired', 'completed', 'released'])
                    ->latest()
                    ->first();
                $applicationId = $activeApp?->id;
            }

            // Find an admin user for notification
            $adminUser = User::whereIn('role', ['super_admin', 'admin'])->first();
            $recipientId = $adminUser?->id;

            $message = Message::create([
                'application_id' => $applicationId,
                'sender_id'      => $user->id,
                'recipient_id'   => $recipientId,
                'sender_type'    => 'applicant',
                'message'        => $request->message,
                'is_read'        => false,
            ]);

            // Notify admins
            if ($recipientId) {
                Notification::create([
                    'user_id' => $recipientId,
                    'type'    => 'new_message',
                    'title'   => 'New Message from ' . $user->full_name,
                    'message' => Str::limit($request->message, 120),
                    'link'    => '/admin/messages?user_id=' . $user->id,
                ]);
            }
        } else {
            // Admin sending to Applicant
            if (!$recipientId && $applicationId) {
                $app = Application::find($applicationId);
                $recipientId = $app?->user_id;
            }

            if (!$recipientId) {
                return response()->json(['detail' => 'Recipient applicant is required.'], 422);
            }

            $message = Message::create([
                'application_id' => $applicationId,
                'sender_id'      => $user->id,
                'recipient_id'   => $recipientId,
                'sender_type'    => 'admin',
                'message'        => $request->message,
                'is_read'        => false,
            ]);

            // Notify applicant
            $app = $applicationId ? Application::find($applicationId) : null;
            $appContext = $app ? " (App: {$app->reference_no})" : '';

            Notification::create([
                'user_id' => $recipientId,
                'type'    => 'new_message',
                'title'   => 'New Message from CSWDD Office',
                'message' => 'CSWDD Office' . $appContext . ': ' . Str::limit($request->message, 120),
                'link'    => '/portal/messages',
            ]);
        }

        return response()->json($message->load(['application', 'sender']), 201);
    }

    /**
     * Mark a message as read.
     */
    public function markRead($id, Request $request)
    {
        $message = Message::findOrFail($id);
        $user = $request->user();

        if ($message->recipient_id === $user->id || in_array($user->role, ['admin', 'super_admin'])) {
            $message->update(['is_read' => true, 'read_at' => now()]);
        }

        return response()->json(['message' => 'Marked as read.']);
    }

    /**
     * Unread messages count for badge display.
     */
    public function unreadCount(Request $request)
    {
        $user = $request->user();
        $isAdmin = in_array($user->role, ['admin', 'super_admin']);

        if ($isAdmin) {
            $count = Message::where('sender_type', 'applicant')
                ->where('is_read', false)
                ->count();
        } else {
            $count = Message::where('recipient_id', $user->id)
                ->where('is_read', false)
                ->count();
        }

        return response()->json(['count' => $count]);
    }
}
