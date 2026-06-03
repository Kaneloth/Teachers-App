import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Check, CheckCheck, Copy, Trash, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface PartnerInfo {
  full_name: string;
  current_province?: string;
}

function formatDateSeparator(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'd MMM yyyy');
}

/* ── localStorage helpers for "Delete for me" ──────────────────────────────
   Stores hidden message IDs per user so they don't reappear when the user
   navigates away and comes back. No database schema change required.
   ───────────────────────────────────────────────────────────────────────── */
const hiddenKey = (userId: string) => `educross_hidden_msgs_${userId}`;

function getHidden(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(hiddenKey(userId)) || '[]'));
  } catch {
    return new Set();
  }
}

function addHidden(userId: string, msgId: string) {
  const hidden = getHidden(userId);
  hidden.add(msgId);
  localStorage.setItem(hiddenKey(userId), JSON.stringify([...hidden]));
}

function removeHidden(userId: string, msgId: string) {
  const hidden = getHidden(userId);
  hidden.delete(msgId);
  localStorage.setItem(hiddenKey(userId), JSON.stringify([...hidden]));
}

export default function ChatRoom() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── Close menu on outside click/touch ─────────────────────── */
  useEffect(() => {
    const handle = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSelectedMsg(null);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, []);

  /* ── Long-press helpers ─────────────────────────────────────── */
  const startLongPress = (msg: Message) => {
    longPressTriggered.current = false;
    longPressRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      setSelectedMsg(msg);
    }, 400);
  };

  const cancelLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const handleBubbleClick = (msg: Message) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    setSelectedMsg(prev => (prev?.id === msg.id ? null : msg));
  };

  /* ── Message actions ────────────────────────────────────────── */
  const handleCopy = (msg: Message) => {
    navigator.clipboard.writeText(msg.content);
    toast.success('Copied to clipboard');
    setSelectedMsg(null);
  };

  const handleDeleteForMe = (msg: Message) => {
    if (user) addHidden(user.id, msg.id);
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    setSelectedMsg(null);
  };

  const handleDeleteForEveryone = async (msg: Message) => {
    const { error } = await supabase.from('messages').delete().eq('id', msg.id);
    if (error) {
      toast.error('Could not delete message');
    } else {
      if (user) removeHidden(user.id, msg.id);
      setMessages(prev => prev.filter(m => m.id !== msg.id));
    }
    setSelectedMsg(null);
  };

  /* ── Load partner info ──────────────────────────────────────── */
  useEffect(() => {
    if (!partnerId) return;
    supabase
      .from('educators')
      .select('full_name, current_province')
      .eq('user_id', partnerId)
      .single()
      .then(({ data }) => { if (data) setPartner(data); });
  }, [partnerId]);

  /* ── Load messages + realtime ───────────────────────────────── */
  useEffect(() => {
    if (!user || !partnerId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),` +
          `and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      // Filter out messages the user has hidden ("Delete for me")
      const hidden = getHidden(user.id);
      setMessages((data || []).filter(m => !hidden.has(m.id)));

      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', partnerId)
        .eq('read', false);
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-${user.id}-${partnerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        payload => {
          const msg = payload.new as Message;
          if (msg.sender_id === partnerId) {
            // Don't surface a message the user has already hidden
            const hidden = getHidden(user.id);
            if (!hidden.has(msg.id)) {
              setMessages(prev => [...prev, msg]);
            }
            supabase.from('messages').update({ read: true }).eq('id', msg.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        payload => {
          const deleted = payload.old as { id: string };
          if (deleted?.id) {
            setMessages(prev => prev.filter(m => m.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId]);

  /* ── Auto-scroll ────────────────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Send ───────────────────────────────────────────────────── */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || !partnerId) return;
    setSending(true);
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: partnerId,
      content: text.trim(),
      created_at: new Date().toISOString(),
      read: false,
    };
    setMessages(prev => [...prev, optimistic]);
    setText('');
    const { data } = await supabase
      .from('messages')
      .insert([{ sender_id: user.id, receiver_id: partnerId, content: optimistic.content }])
      .select()
      .single();
    if (data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data as Message : m));
    }
    setSending(false);
  };

  const partnerInitials = partner?.full_name
    ? partner.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="flex flex-col h-[calc(100vh-56px-64px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">{partnerInitials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground leading-tight">{partner?.full_name || 'Educator'}</p>
          {partner?.current_province && (
            <p className="text-xs text-muted-foreground leading-tight">{partner.current_province}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-background">
        {messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="bg-card border border-border rounded-xl px-4 py-3 text-center max-w-xs shadow-sm">
              <p className="text-sm text-muted-foreground">Start the conversation!</p>
              <p className="text-xs text-muted-foreground mt-1">Introduce yourself and discuss a potential transfer.</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          const msgDate = new Date(msg.created_at);
          const prevDate = i > 0 ? new Date(messages[i - 1].created_at) : null;
          const showDateSep = !prevDate || !isSameDay(msgDate, prevDate);
          const isSelected = selectedMsg?.id === msg.id;

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex justify-center my-3">
                  <span className="bg-muted text-muted-foreground text-[11px] px-3 py-1 rounded-full">
                    {formatDateSeparator(msgDate)}
                  </span>
                </div>
              )}

              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 relative`}>
                {/* Context menu — floats below the bubble */}
                {isSelected && (
                  <div
                    ref={menuRef}
                    className={`absolute z-50 top-full mt-1 ${isMe ? 'right-0' : 'left-0'} bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[180px]`}
                  >
                    <button
                      onClick={() => handleCopy(msg)}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Copy className="w-4 h-4 text-muted-foreground" />
                      Copy
                    </button>
                    <button
                      onClick={() => handleDeleteForMe(msg)}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Trash className="w-4 h-4 text-muted-foreground" />
                      Delete for me
                    </button>
                    {isMe && (
                      <button
                        onClick={() => handleDeleteForEveryone(msg)}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete for everyone
                      </button>
                    )}
                  </div>
                )}

                {/* Bubble */}
                <div
                  onMouseDown={() => startLongPress(msg)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => startLongPress(msg)}
                  onTouchEnd={cancelLongPress}
                  onClick={() => handleBubbleClick(msg)}
                  className={`relative max-w-[72%] rounded-2xl px-3.5 py-2 text-sm cursor-pointer select-none transition-opacity ${
                    isMe
                      ? 'bg-primary text-white rounded-br-[4px]'
                      : 'bg-card border border-border text-foreground rounded-bl-[4px]'
                  } ${isSelected ? 'opacity-75' : ''}`}
                >
                  <p className="leading-snug break-words">{msg.content}</p>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <span className={`text-[10px] ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {format(msgDate, 'HH:mm')}
                    </span>
                    {isMe && (
                      msg.read
                        ? <CheckCheck className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                        : msg.id.startsWith('temp-')
                          ? <Check className="w-3.5 h-3.5 text-white/60 shrink-0" />
                          : <CheckCheck className="w-3.5 h-3.5 text-white/60 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-4 py-3 border-t border-border bg-background"
      >
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          className="rounded-full flex-1 bg-muted/40 border-border"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !text.trim()}
          className="rounded-full shrink-0 w-10 h-10"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
