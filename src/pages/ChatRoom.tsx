import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

function formatMsgDate(ts: string) {
  const d = new Date(ts);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM, HH:mm');
}

function groupByDate(messages: any[]) {
  const groups: { date: string; messages: any[] }[] = [];
  let lastDate = '';
  for (const m of messages) {
    const d = new Date(m.created_at);
    let label = '';
    if (isToday(d)) label = 'Today';
    else if (isYesterday(d)) label = 'Yesterday';
    else label = format(d, 'd MMMM yyyy');
    if (label !== lastDate) {
      groups.push({ date: label, messages: [] });
      lastDate = label;
    }
    groups[groups.length - 1].messages.push(m);
  }
  return groups;
}

export default function ChatRoom() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const otherUserId = conversationId?.split('_').find(id => id !== currentUserId) || '';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null));
  }, []);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    enabled: !!currentUserId && !!conversationId,
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('receiver_id', currentUserId)
        .eq('sender_id', otherUserId)
        .eq('is_read', false);

      return data || [];
    },
    refetchInterval: 5000,
  });

  const { data: otherEducator } = useQuery({
    queryKey: ['educator-profile', otherUserId],
    enabled: !!otherUserId,
    queryFn: async () => {
      const { data } = await supabase.from('educators').select('*').eq('user_id', otherUserId).single();
      return data;
    },
  });

  useEffect(() => {
    if (!currentUserId || !conversationId) return;
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentUserId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['messages', conversationId] });
        qc.invalidateQueries({ queryKey: ['conversations', currentUserId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, conversationId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('messages').insert({
        sender_id: currentUserId,
        receiver_id: otherUserId,
        content: text,
        is_read: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations', currentUserId] });
    },
  });

  const handleSend = useCallback(async () => {
    const text = content.trim();
    if (!text) return;
    setContent('');
    sendMutation.mutate(text);
  }, [content, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const grouped = groupByDate(messages as any[]);

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
          {otherEducator?.avatar_url
            ? <img src={otherEducator.avatar_url} alt={otherEducator.full_name} className="w-full h-full object-cover" />
            : <span className="text-xs font-bold text-primary">{otherEducator?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}</span>
          }
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{otherEducator?.full_name || 'Educator'}</p>
          <p className="text-xs text-muted-foreground">{otherEducator?.current_province}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center pt-8"><Loader2 className="w-6 h-6 text-muted-foreground animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Start a conversation with {otherEducator?.full_name || 'this educator'}!
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-[10px] text-muted-foreground font-medium px-2">{group.date}</span>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="space-y-1.5">
                {group.messages.map((msg: any) => {
                  const isOwn = msg.sender_id === currentUserId;
                  return (
                    <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[78%] rounded-2xl px-4 py-2.5 text-sm', isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border text-foreground rounded-bl-sm')}>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <p className={cn('text-[10px] mt-1 text-right', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                          {formatMsgDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0 bg-background">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type a message…"
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-xl h-11"
            disabled={sendMutation.isPending}
          />
          <Button size="icon" onClick={handleSend} disabled={!content.trim() || sendMutation.isPending} className="rounded-xl h-11 w-11 shrink-0">
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
