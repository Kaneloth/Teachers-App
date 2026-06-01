import { useState, useMemo, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, RefreshCw, ArrowLeft, Check, CheckCheck, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import { useSubscription } from '@/hooks/useSubscription';
import SubscriptionGate from '@/components/SubscriptionGate';

// Tick component: single grey = sent, double grey = delivered, double blue = read
function MessageTicks({ msg }) {
  if (!msg) return null;
  if (msg.is_read) return <CheckCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  if (msg.is_delivered) return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  return <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

export default function ChatsPage() {
  const navigate = useNavigate();
  const { isSubscribed, tier, tierConfig, isLoading: subLoading } = useSubscription();

  const [messages, setMessages] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [educators, setEducators] = useState([]);
  const uidRef = useRef(null);
  const isMounted = useRef(true);

  const fetchMessages = async () => {
    const uid = uidRef.current;
    if (!uid) return;
    const [sent, received] = await Promise.all([
      base44.entities.Message.filter({ sender_id: uid }, '-created_date', 300),
      base44.entities.Message.filter({ receiver_id: uid }, '-created_date', 300),
    ]);
    const all = [...sent, ...received];
    const unique = Array.from(new Map(all.map(m => [m.id, m])).values());
    if (isMounted.current) {
      setMessages(unique.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    }
  };

  useEffect(() => {
    isMounted.current = true;

    const loadAll = async () => {
      const user = await base44.auth.me();
      uidRef.current = user.id;
      if (!isMounted.current) return;
      setCurrentUserId(user.id);

      const [sent, received, eduList] = await Promise.all([
        base44.entities.Message.filter({ sender_id: user.id }, '-created_date', 300),
        base44.entities.Message.filter({ receiver_id: user.id }, '-created_date', 300),
        base44.entities.Educator.list('-created_date', 200),
      ]);

      if (isMounted.current) {
        const all = [...sent, ...received];
        const unique = Array.from(new Map(all.map(m => [m.id, m])).values());
        setMessages(unique.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        setEducators(eduList);
      }
    };

    loadAll();

    const unsub = base44.entities.Message.subscribe(() => fetchMessages());

    return () => {
      isMounted.current = false;
      unsub();
    };
  }, []);

  // Group by conversation
  const conversations = useMemo(() => {
    const map = {};
    messages.forEach(msg => {
      if (!map[msg.conversation_id]) {
        map[msg.conversation_id] = { messages: [], lastMessage: msg };
      }
      map[msg.conversation_id].messages.push(msg);
      if (new Date(msg.created_date) > new Date(map[msg.conversation_id].lastMessage.created_date)) {
        map[msg.conversation_id].lastMessage = msg;
      }
    });

    return Object.entries(map)
      .map(([convId, data]) => {
        const lastMsg = data.lastMessage;
        // Determine the other user's ID by looking at ALL messages and finding
        // an ID that is never equal to currentUserId in both sender and receiver
        const allIds = new Set();
        data.messages.forEach(m => {
          allIds.add(m.sender_id);
          allIds.add(m.receiver_id);
        });
        allIds.delete(currentUserId);
        const otherUserId = [...allIds][0] || null;
        const otherEducatorId = otherUserId;
        const unreadCount = data.messages.filter(m => m.receiver_id === currentUserId && !m.is_read).length;
        const isMine = lastMsg.sender_id === currentUserId;
        return { id: convId, lastMessage: lastMsg, otherEducatorId, unreadCount, isMine };
      })
      .sort((a, b) => new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date));
  }, [messages, currentUserId]);

  const educatorMap = useMemo(() => {
    const m = {};
    educators.forEach(e => { m[e.created_by_id] = e; m[e.id] = e; });
    return m;
  }, [educators]);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'dd MMM');
  };

  // Free tier: can view up to 2 chats — handled inline. No hard gate needed here.

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <RefreshCw className="w-5 h-5 text-primary" strokeWidth={2.5} />
        <h1 className="text-xl font-bold text-foreground">Messages</h1>
      </div>

      {/* Free tier chat limit notice */}
      {!subLoading && tier === 'free' && conversations.length >= 2 && (
        <div className="mb-4 bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 flex items-start gap-3">
          <Lock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Free Tier — 2 chat limit reached</p>
            <p className="text-xs text-muted-foreground mt-0.5">You can read existing chats, but cannot start new conversations. Upgrade for unlimited messaging.</p>
            <button
              onClick={() => navigate('/settings', { state: { tab: 'subscription' } })}
              className="text-xs text-primary font-medium mt-1 hover:underline"
            >
              View plans →
            </button>
          </div>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">No conversations yet</p>
          <p className="text-sm mt-1">Start by messaging an educator from the search page.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv, i) => {
            const other = educatorMap[conv.otherEducatorId];
            const name = other?.full_name || 'Educator';
            const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);

            return (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/chat/${conv.id}?with=${other?.id || conv.otherEducatorId}`}
                  className="flex items-center gap-3 bg-card rounded-xl border border-border p-3 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {other?.avatar_url
                      ? <img src={other.avatar_url} alt={name} className="w-full h-full object-cover" />
                      : <span className="text-sm font-bold text-primary">{initials}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`font-medium text-sm truncate ${conv.unreadCount > 0 ? 'text-foreground font-semibold' : 'text-foreground'}`}>{name}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {formatTime(conv.lastMessage.created_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {conv.isMine && <MessageTicks msg={conv.lastMessage} />}
                      <p className={`text-xs truncate flex-1 ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {conv.lastMessage.content}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}