import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

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

export default function ChatRoom() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!partnerId) return;
    supabase
      .from('educators')
      .select('full_name, current_province')
      .eq('user_id', partnerId)
      .single()
      .then(({ data }) => { if (data) setPartner(data); });
  }, [partnerId]);

  useEffect(() => {
    if (!user || !partnerId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      setMessages(data || []);

      // Mark all received messages in this thread as read
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, payload => {
        const msg = payload.new as Message;
        if (msg.sender_id === partnerId) {
          setMessages(prev => [...prev, msg]);
          // Mark it read immediately since the chat is open
          supabase.from('messages').update({ read: true }).eq('id', msg.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">{partnerInitials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground leading-tight">
            {partner?.full_name || 'Educator'}
          </p>
          {partner?.current_province && (
            <p className="text-xs text-muted-foreground leading-tight">{partner.current_province}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-background">
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          const msgDate = new Date(msg.created_at);
          const prevDate = i > 0 ? new Date(messages[i - 1].created_at) : null;
          const showDateSep = !prevDate || !isSameDay(msgDate, prevDate);

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDateSep && (
                <div className="flex justify-center my-3">
                  <span className="bg-muted text-muted-foreground text-[11px] px-3 py-1 rounded-full">
                    {formatDateSeparator(msgDate)}
                  </span>
                </div>
              )}

              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                <div
                  className={`max-w-[72%] rounded-2xl px-3.5 py-2 text-sm ${
                    isMe
                      ? 'bg-primary text-white rounded-br-[4px]'
                      : 'bg-card border border-border text-foreground rounded-bl-[4px]'
                  }`}
                >
                  <p className="leading-snug">{msg.content}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {format(msgDate, 'HH:mm')}
                    </span>
                    {isMe && <CheckCheck className="w-3 h-3 text-white/70" />}
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
