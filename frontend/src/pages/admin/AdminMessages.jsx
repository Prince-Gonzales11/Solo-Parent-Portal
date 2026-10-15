import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  MessageSquare, Send, RefreshCw, Eye, User, Search,
  CheckCircle, ArrowLeft, Clock, ShieldCheck, FileText, CornerDownRight
} from 'lucide-react';

export default function AdminMessages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [activeApplication, setActiveApplication] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const selectedUserId = searchParams.get('user_id');
  const selectedAppId = searchParams.get('application_id');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch conversations list
  const fetchConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingList(true);
    try {
      const res = await api.get('/messages');
      const list = res.data?.conversations || [];
      setConversations(list);

      // Auto-select first conversation if none selected and not on mobile
      if (!selectedUserId && list.length > 0 && window.innerWidth >= 768) {
        setSearchParams({ user_id: list[0].applicant_id });
      }
    } catch (err) {
      if (!quiet) toastError(err, 'Failed to load conversations.');
    } finally {
      if (!quiet) setLoadingList(false);
    }
  }, [selectedUserId, setSearchParams]);

  // 2. Fetch thread messages
  const fetchThread = useCallback(async (quiet = false) => {
    if (!selectedUserId && !selectedAppId) {
      setMessages([]);
      setActiveUser(null);
      setActiveApplication(null);
      return;
    }

    if (!quiet) setLoadingThread(true);
    try {
      const params = {};
      if (selectedUserId) params.user_id = selectedUserId;
      if (selectedAppId) params.application_id = selectedAppId;

      const res = await api.get('/messages', { params });
      setMessages(res.data?.messages || []);
      setActiveUser(res.data?.target_user || null);
      setActiveApplication(res.data?.application || null);
    } catch (err) {
      if (!quiet) toastError(err, 'Failed to load conversation messages.');
    } finally {
      if (!quiet) setLoadingThread(false);
    }
  }, [selectedUserId, selectedAppId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // Periodic polling for realtime messaging feel
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
      if (selectedUserId || selectedAppId) {
        fetchThread(true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchThread, selectedUserId, selectedAppId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSelectConversation = (conv) => {
    setSearchParams({ user_id: conv.applicant_id });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUserId) return;

    setSending(true);
    try {
      await api.post('/messages', {
        message: newMessage.trim(),
        recipient_id: selectedUserId,
        application_id: activeApplication?.id || null,
      });

      setNewMessage('');
      await fetchThread(true);
      await fetchConversations(true);
      scrollToBottom();
    } catch (err) {
      toastError(err, 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.applicant_name?.toLowerCase().includes(q) ||
      c.applicant_email?.toLowerCase().includes(q) ||
      c.application?.reference_no?.toLowerCase().includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4.25rem)] bg-gradient-to-b from-surface-muted to-background w-full max-w-full overflow-x-hidden min-w-0">
      {/* Page Header */}
      <div className="px-6 py-4 border-b border-border/70 bg-card/60 backdrop-blur-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <MessageSquare className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground font-display">
              CSWDD Official Messaging
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Direct, official inquiries and assistance between CSWDD staff and Solo Parent applicants.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { fetchConversations(); fetchThread(); }}
          className="rounded-xl"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Main Messenger Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Conversations List */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-border/70 bg-card flex flex-col ${selectedUserId ? 'hidden md:flex' : 'flex'}`}>
          {/* Search Bar */}
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search applicant or ref no..."
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Conversations Scroll */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {loadingList ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                Loading conversations…
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30 text-primary" />
                <p className="font-semibold text-foreground">No conversations found</p>
                <p className="mt-0.5">Messages sent by applicants will appear here.</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isSelected = conv.applicant_id === selectedUserId;
                const initials = (conv.applicant_name || 'A')
                  .split(' ')
                  .map(n => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <button
                    key={conv.applicant_id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 hover:bg-muted/40 ${
                      isSelected ? 'bg-primary/10 border-l-4 border-primary' : ''
                    }`}
                  >
                    <Avatar className="h-10 w-10 shrink-0 border border-border">
                      <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-bold text-foreground truncate">
                          {conv.applicant_name}
                        </p>
                        {conv.last_message_at && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {format(new Date(conv.last_message_at), 'MMM d, h:mm a')}
                          </span>
                        )}
                      </div>

                      {conv.application && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-[10px] bg-muted/80 text-foreground px-1.5 py-0.5 rounded font-semibold">
                            {conv.application.reference_no}
                          </span>
                          <span className="text-[10px] text-primary capitalize font-medium">
                            {conv.application.application_type === 'renewal' ? 'Renewal' : conv.application.application_type === 'loss_spic' ? 'Loss SPIC' : 'New ID'}
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground truncate">
                        {conv.last_message || 'No messages yet.'}
                      </p>

                      {conv.unread_count > 0 && (
                        <div className="mt-1.5">
                          <Badge className="bg-primary text-white text-[10px] h-4 px-1.5 font-bold">
                            {conv.unread_count} new
                          </Badge>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Active Conversation Thread */}
        <div className={`flex-1 flex flex-col bg-background ${!selectedUserId ? 'hidden md:flex' : 'flex'}`}>
          {!selectedUserId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-lg text-foreground font-display">No Conversation Selected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Select an applicant from the list on the left to review their correspondence and reply directly.
              </p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="px-5 py-3.5 border-b border-border/70 bg-card flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-8 w-8"
                    onClick={() => setSearchParams({})}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                      {(activeUser?.full_name || 'Applicant').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      {activeUser?.full_name || 'Applicant'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {activeUser?.email}
                    </p>
                  </div>
                </div>

                {activeApplication && (
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex flex-col text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Linked Application</span>
                      <span className="font-mono text-xs font-bold text-foreground">{activeApplication.reference_no}</span>
                    </div>
                    <Button asChild size="sm" variant="outline" className="rounded-xl h-8 text-xs font-semibold gap-1.5">
                      <Link to={`/admin/applications/${activeApplication.id}`}>
                        <Eye className="h-3.5 w-3.5" /> View Application
                      </Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* Thread Messages */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-muted/10">
                {loadingThread ? (
                  <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2 text-primary" />
                    Loading conversation thread…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30 text-primary" />
                    <p className="font-bold text-sm text-foreground">Start of conversation</p>
                    <p className="text-xs mt-1">Send a message to contact this applicant.</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isAdmin = msg.sender_type === 'admin';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-semibold text-foreground">
                            {isAdmin ? 'CSWDD Office' : (msg.sender?.full_name || 'Applicant')}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            • {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>

                        <div
                          className={`max-w-lg rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-2xs whitespace-pre-wrap leading-relaxed ${
                            isAdmin
                              ? 'bg-primary text-primary-foreground rounded-tr-xs'
                              : 'bg-card border border-border text-foreground rounded-tl-xs'
                          }`}
                        >
                          {msg.message}
                        </div>

                        {msg.application && (
                          <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-muted-foreground">
                            <CornerDownRight className="h-2.5 w-2.5" />
                            <span>Ref: {msg.application.reference_no}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-3.5 border-t border-border/70 bg-card flex gap-2">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type official reply or guidance to applicant..."
                  className="rounded-xl flex-1 text-xs sm:text-sm"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="rounded-xl shrink-0 font-semibold px-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {sending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5" /> Send Reply
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
