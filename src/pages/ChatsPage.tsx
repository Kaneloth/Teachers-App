import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MessageCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

export default function ChatsPage() {
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null));
  }, []);

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', currentUserId],
    enabled: !!currentUserId,
    queryFn: async () => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (!msgs?.length) return [];

      const convMap = new Map<string, typeof msgs[0]>();
      for (const msg of msgs) {
        const otherId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
        const convId = [currentUserId, otherId].sort().join('_');
        if (!convMap.has(convId)) {
          convMap.set(convId, { ...msg, other_user_id: otherId, conversation_id: convId });
        }
      }

      const convs = Array.from(convMap.values());
      const userIds = convs.map((c: any) => c.other_user_id);

      const { data: educators } = await supabase
        .from('educators')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const educatorMap = new Map((educators || []).map(e => [e.user_id, e]));

      const unreadCounts = await Promise.all(
        convs.map(async (c: any) => {
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('receiver_id', currentUserId)
            .eq('sender_id', c.other_user_id)
            .eq('is_read', false);
          return { convId: c.conversation_id, count: count || 0 };
        })
      );
      const unreadMap = new Map(unreadCounts.map(u => [u.convId, u.count]));

      return convs.map((c: any) => ({
        ...c,
        educator: educatorMap.get(c.other_user_id) || null,
        unread: unreadMap.get(c.conversation_id) || 0,
      }));
    },
    refetchInterval: 10000,
  });

  const filtered = conversations.filter((c: any) =>
    !search || c.educator?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-5">
        <MessageCircle className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Messages</h1>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl bg-card" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No conversations yet.</p>
            <p className="text-xs mt-1">Find an educator and start chatting!</p>
          </div>
        ) : (
          filtered.map((c: any) => (
            <Link
              key={c.conversation_id}
              to={`/chat/${c.conversation_id}`}
              className="flex items-center gap-3 bg-card rounded-xl border border-border p-3 hover:shadow-sm transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden relative">
                {c.educator?.avatar_url
                  ? <img src={c.educator.avatar_url} alt={c.educator.full_name} className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-primary">{c.educator?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}</span>
                }
                {c.unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {c.unread > 9 ? '9+' : c.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`text-sm truncate ${c.unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                    {c.educator?.full_name || 'Unknown'}
                  </p>
                  <p className="text-[11px] text-muted-foreground shrink-0 ml-2">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </p>
                </div>
                <p className={`text-xs truncate ${c.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {c.sender_id === currentUserId ? 'You: ' : ''}{c.content || '…'}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
