import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, RefreshCw, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { format, isThisYear, isToday } from 'date-fns';

interface Thread {
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  isMine: boolean;
}

function formatThreadTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isThisYear(d)) return format(d, 'd MMM');
  return format(d, 'd MMM yyyy');
}

export default function ChatsPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchThreads = async () => {
    if (!user) return;
    setLoading(true);
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!messages) { setLoading(false); return; }

    const seenPartners = new Set<string>();
    const threadMap: Thread[] = [];

    for (const msg of messages) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!seenPartners.has(partnerId)) {
        seenPartners.add(partnerId);
        threadMap.push({
          partnerId,
          partnerName: msg.sender_id === user.id ? (msg.receiver_name || partnerId) : (msg.sender_name || partnerId),
          lastMessage: msg.content,
          lastTime: msg.created_at,
          unread: 0,
          isMine: msg.sender_id === user.id,
        });
      }
    }

    const partnerIds = [...seenPartners];
    if (partnerIds.length) {
      const { data: profiles } = await supabase
        .from('educators')
        .select('user_id, full_name')
        .in('user_id', partnerIds);
      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      threadMap.forEach(t => { if (nameMap.has(t.partnerId)) t.partnerName = nameMap.get(t.partnerId)!; });
    }

    setThreads(threadMap);
    setLoading(false);
  };

  useEffect(() => { fetchThreads(); }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchThreads();
    setRefreshing(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-4">
        <button onClick={handleRefresh} className="p-1 rounded-full hover:bg-muted transition-colors">
          <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Messages</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-16 px-8 text-muted-foreground">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No conversations yet</p>
          <p className="text-sm mt-1">Find an educator and start messaging!</p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {threads.map(t => (
            <Link
              key={t.partnerId}
              to={`/chat/${t.partnerId}`}
              className="flex items-center gap-3 bg-card rounded-2xl border border-border px-4 py-3.5 hover:shadow-sm transition-all"
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {t.partnerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="font-semibold text-sm text-foreground truncate">{t.partnerName}</p>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatThreadTime(t.lastTime)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {t.isMine && <CheckCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                  <p className="text-xs text-muted-foreground truncate">{t.lastMessage}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
