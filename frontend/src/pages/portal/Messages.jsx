import React, { useState, useEffect, useRef } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MessageSquare, Send, RefreshCw, User, ShieldCheck,
  Clock, CheckCheck, Paperclip, ChevronDown, Check,
  CornerDownLeft
} from 'lucide-react';
import { format } from 'date-fns';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/messages');
      const msgList = res.data?.messages || [];
      const appList = res.data?.applications || [];
      setMessages(msgList);
      setApplications(appList);

      if (appList.length > 0 && !selectedAppId) {
        // Default to most recent application
        setSelectedAppId(appList[0].id);
      }
    } catch (err) {
      if (!silent) toastError(err, 'Failed to load messages.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 8000); // Poll every 8 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim()) return;

    const text = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      const res = await api.post('/messages', {
        message: text,
        application_id: selectedAppId || null,
      });
      setMessages(prev => [...prev, res.data]);
      scrollToBottom();
    } catch (err) {
      toastError(err, 'Failed to send message.');
      setInputMessage(text); // restore if failed
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectedApp = applications.find(a => a.id === selectedAppId);

  const getServiceLabel = (type) => {
    if (type === 'renewal') return 'Renewal of SPIC';
    if (type === 'loss_spic') return 'Loss of SPIC';
    return 'New Solo Parent ID';
  };

  return (
    <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-5xl space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
      {/* ── Page Header ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
            <MessageSquare className="h-3.5 w-3.5" />
            CSWDD Helpdesk & Direct Inquiries
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground font-display">
            Messages
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Direct two-way official communication with the CSWDD Butuan City Solo Parent Division.
          </p>
        </div>

        {applications.length > 0 && (
          <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-2xl border border-border/70 text-xs w-full sm:w-auto">
            <span className="font-semibold text-muted-foreground pl-1 shrink-0">Attach to:</span>
            <select
              value={selectedAppId}
              onChange={e => setSelectedAppId(e.target.value)}
              className="bg-background text-foreground font-semibold rounded-xl px-2.5 py-1.5 border border-border/80 outline-none text-xs flex-1 sm:flex-initial min-h-[36px]"
            >
              {applications.map(app => (
                <option key={app.id} value={app.id}>
                  {app.reference_no} ({getServiceLabel(app.application_type)})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Main Chat Interface ───────────────────────── */}
      <Card className="rounded-3xl border-2 border-border/80 shadow-md overflow-hidden flex flex-col h-[calc(100dvh-200px)] sm:h-[650px] min-h-[420px] bg-background">
        {/* Chat Header Bar */}
        <div className="p-4 sm:p-5 bg-card border-b border-border/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/images/cswdd.jpg"
                alt="CSWDD"
                className="h-10 w-10 rounded-2xl object-cover border border-border shadow-xs bg-white"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-foreground font-display">
                  CSWDD Office — Solo Parent Division
                </h3>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary bg-primary/10 border-primary/20">
                  Official
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                City Social Welfare and Development Department • Active Channel
              </p>
            </div>
          </div>

          {selectedApp && (
            <div className="hidden sm:flex flex-col items-end text-xs">
              <span className="font-bold text-foreground font-mono">{selectedApp.reference_no}</span>
              <span className="text-[11px] text-muted-foreground">{getServiceLabel(selectedApp.application_type)}</span>
            </div>
          )}
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-muted/10">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Loading message history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="h-14 w-14 rounded-3xl bg-primary/10 text-primary flex items-center justify-center">
                <MessageSquare className="h-7 w-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="font-bold text-base text-foreground font-display">
                  No Messages Yet
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Have a question regarding your Solo Parent ID requirements, review status, or pickup schedules? Send a message below.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_type === 'applicant';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
                    {!isMe && (
                      <img
                        src="/images/cswdd.jpg"
                        alt="CSWDD"
                        className="h-7 w-7 rounded-xl object-cover shrink-0 border border-border shadow-2xs mb-1 bg-white"
                      />
                    )}

                    <div
                      className={`p-4 rounded-3xl text-sm leading-relaxed shadow-xs ${
                        isMe
                          ? 'bg-primary text-primary-foreground rounded-br-xs'
                          : 'bg-card border border-border/80 text-foreground rounded-bl-xs'
                      }`}
                    >
                      {/* Attached application badge if present */}
                      {msg.application && (
                        <div className={`mb-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
                          isMe
                            ? 'bg-white/15 text-white'
                            : 'bg-muted text-muted-foreground border border-border/60'
                        }`}>
                          <span>App: {msg.application.reference_no}</span>
                          {msg.application.application_type && (
                            <span>• {getServiceLabel(msg.application.application_type)}</span>
                          )}
                        </div>
                      )}

                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>

                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isMe ? 'text-primary-foreground/75' : 'text-muted-foreground'
                      }`}>
                        <span>
                          {msg.created_at ? format(new Date(msg.created_at), 'hh:mm a') : ''}
                        </span>
                        {isMe && (
                          <CheckCheck className={`h-3 w-3 ${msg.is_read ? 'text-emerald-300' : 'text-primary-foreground/50'}`} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-card border-t border-border/70 flex items-end gap-2.5 shrink-0">
          <div className="flex-1 min-w-0">
            <Textarea
              rows={2}
              placeholder="Type your message to CSWDD Office... (Press Enter to send)"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="resize-none rounded-2xl text-sm bg-background border-border/80 focus-visible:ring-1"
            />
          </div>

          <Button
            type="submit"
            disabled={sending || !inputMessage.trim()}
            className="rounded-2xl h-12 px-5 font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 gap-1.5 cursor-pointer"
          >
            {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </Card>
    </div>
  );
}
