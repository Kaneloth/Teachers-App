import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, RefreshCw, CheckCheck, Trash2, ArrowLeft, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { format, isThisYear, isToday } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { blockUser, isBlocked } from '@/lib/blockUtils';

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
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Delete‑chat & block states
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [blockingPartner, setBlockingPartner] = useState<string | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userEventsChannelRef = useRef<any>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handle = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSelectedThread(null);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, []);

  const startLongPress = (partnerId: string) => {
    longPressTriggered.current = false;
    longPressRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      setSelectedThread(partnerId);
    }, 400);
  };

  const cancelLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const handleRowClick = (partnerId: string) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectedThread) {
      setSelectedThread(null);
      return;
    }
    navigate(`/chat/${partnerId}`);
  };

  // Fetch threads, excluding blocked users
  const fetchThreads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Get all messages
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!messages) {
        setThreads([]);
        setLoading(false);
        return;
      }

      // 2. Get blocks (both directions)
      const { data: blocksGiven } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id);
      const blockedByMe = new Set(blocksGiven?.map(b => b.blocked_id) || []);

      const { data: blocksReceived } = await supabase
        .from('user_blocks')
        .select('blocker_id')
        .eq('blocked_id', user.id);
      const blockedByThem = new Set(blocksReceived?.map(b => b.blocker_id) || []);

      // 3. Build threads, skipping any partner that is blocked in either direction
      const seenPartners = new Set<string>();
      const threadMap: Thread[] = [];

      // Count unread per partner first (messages sent TO me that are unread)
      const unreadCount = new Map<string, number>();
      for (const msg of messages) {
        if (msg.receiver_id === user.id && !msg.read) {
          const pid = msg.sender_id;
          unreadCount.set(pid, (unreadCount.get(pid) || 0) + 1);
        }
      }

      for (const msg of messages) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (blockedByMe.has(partnerId) || blockedByThem.has(partnerId)) continue;
        if (!seenPartners.has(partnerId)) {
          seenPartners.add(partnerId);
          threadMap.push({
            partnerId,
            partnerName: partnerId,
            lastMessage: msg.content,
            lastTime: msg.created_at,
            unread: unreadCount.get(partnerId) || 0,
            isMine: msg.sender_id === user.id,
          });
        }
      }

      // 4. Fetch display names
      const partnerIds = [...seenPartners];
      if (partnerIds.length) {
        const { data: profiles } = await supabase
          .from('educators')
          .select('user_id, full_name')
          .in('user_id', partnerIds);
        const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        threadMap.forEach(t => {
          if (nameMap.has(t.partnerId)) t.partnerName = nameMap.get(t.partnerId)!;
        });
      }

      setThreads(threadMap);
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Real-time listener: refresh threads on any message INSERT or DELETE
  // Uses postgres_changes so it works for ALL partners regardless of channel name.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chatspage-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        async () => { await fetchThreads(); }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        async () => { await fetchThreads(); }
      )
      .subscribe();
    userEventsChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchThreads]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchThreads();
    setRefreshing(false);
  };

  const handleDeleteChat = async (partnerId: string) => {
    if (!user) return;
    await supabase
      .from('messages')
      .delete()
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),` +
        `and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
      );
    setThreads(prev => prev.filter(t => t.partnerId !== partnerId));
    setSelectedThread(null);
    setConfirmDelete(null);
  };

  const handleBlock = async (partnerId: string) => {
    setBlockingPartner(partnerId);
    const success = await blockUser(partnerId);
    if (success) {
      toast.success('User blocked. Conversation removed.');
      setThreads(prev => prev.filter(t => t.partnerId !== partnerId));
      setSelectedThread(null);
    } else {
      toast.error('Failed to block user. Please try again.');
    }
    setBlockingPartner(null);
  };

  const deletingPartner = confirmDelete ? threads.find(t => t.partnerId === confirmDelete) : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 px-4 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground flex-1">Messages</h1>
        <button onClick={handleRefresh} className="p-1 rounded-full hover:bg-muted transition-colors">
          <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </button>
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
          {threads.map(t => {
            const isSelected = selectedThread === t.partnerId;
            const initials = t.partnerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

            return (
              <div key={t.partnerId} className="relative">
                <div
                  onMouseDown={() => startLongPress(t.partnerId)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => startLongPress(t.partnerId)}
                  onTouchEnd={cancelLongPress}
                  onClick={() => handleRowClick(t.partnerId)}
                  className={`flex items-center gap-3 bg-card rounded-2xl border px-4 py-3.5 cursor-pointer select-none transition-all hover:shadow-sm ${
                    isSelected
                      ? 'border-primary/40 bg-primary/5'
                      : t.unread > 0
                      ? 'border-primary/30 bg-primary/[0.02]'
                      : 'border-border'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className={`text-sm truncate ${t.unread > 0 ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>
                        {t.partnerName}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-muted-foreground">
                          {formatThreadTime(t.lastTime)}
                        </span>
                        {t.unread > 0 && (
                          <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1">
                            {t.unread > 99 ? '99+' : t.unread}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.isMine && <CheckCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <p className={`text-xs truncate ${t.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {t.lastMessage}
                      </p>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div
                    ref={menuRef}
                    className="absolute z-50 top-full mt-1 right-4 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]"
                  >
                    <button
                      onClick={() => {
                        setSelectedThread(null);
                        setConfirmDelete(t.partnerId);
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete chat
                    </button>
                    <button
                      onClick={() => handleBlock(t.partnerId)}
                      disabled={blockingPartner === t.partnerId}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <UserX className="w-4 h-4" />
                      {blockingPartner === t.partnerId ? 'Blocking...' : 'Block user'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={open => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your entire conversation with{' '}
              <strong>{deletingPartner?.partnerName ?? 'this educator'}</strong> for both of you.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDeleteChat(confirmDelete)}
            >
              Delete for everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}