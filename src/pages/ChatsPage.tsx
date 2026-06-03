import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, RefreshCw, CheckCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { format, isThisYear, isToday } from 'date-fns';
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

  /* ── Delete-chat state ──────────────────────────────────────── */
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── Close context menu on outside click ───────────────────── */
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

  /* ── Long-press helpers ─────────────────────────────────────── */
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

  /* ── Core fetch function ────────────────────────────────────── */
  const fetchThreads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!messages) {
      setLoading(false);
      return;
    }

    const seenPartners = new Set<string>();
    const threadMap: Thread[] = [];

    for (const msg of messages) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!seenPartners.has(partnerId)) {
        seenPartners.add(partnerId);
        threadMap.push({
          partnerId,
          partnerName: partnerId,
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
      threadMap.forEach(t => {
        if (nameMap.has(t.partnerId)) t.partnerName = nameMap.get(t.partnerId)!;
      });
    }

    setThreads(threadMap);
    setLoading(false);
  }, [user]);

  // ── 1. Initial fetch ──────────────────────────────────────────
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // ── 2. Polling: refresh every 2 seconds while page is visible ─
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchThreads();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [user, fetchThreads]);

  // ── 3. Refresh when the page becomes visible again ────────────
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchThreads();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fetchThreads]);

  // ── 4. Refresh when the window gains focus (e.g., after closing a modal) ──
  useEffect(() => {
    const onFocus = () => fetchThreads();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchThreads]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchThreads();
    setRefreshing(false);
  };

  /* ── Delete chat ────────────────────────────────────────────── */
  const handleDeleteChat = async (partnerId: string) => {
    if (!user) return;
    await supabase
      .from('messages')
      .delete()
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),` +
        `and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
      );
    // Optimistically remove from state (polling will confirm)
    setThreads(prev => prev.filter(t => t.partnerId !== partnerId));
    setSelectedThread(null);
    setConfirmDelete(null);
  };

  const deletingPartner = confirmDelete ? threads.find(t => t.partnerId === confirmDelete) : null;

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
          {threads.map(t => {
            const isSelected = selectedThread === t.partnerId;
            const initials = t.partnerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

            return (
              <div key={t.partnerId} className="relative">
                {/* Thread row */}
                <div
                  onMouseDown={() => startLongPress(t.partnerId)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => startLongPress(t.partnerId)}
                  onTouchEnd={cancelLongPress}
                  onClick={() => handleRowClick(t.partnerId)}
                  className={`flex items-center gap-3 bg-card rounded-2xl border px-4 py-3.5 cursor-pointer select-none transition-all hover:shadow-sm ${
                    isSelected ? 'border-primary/40 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{initials}</span>
                  </div>
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
                </div>

                {/* Context menu on long-press */}
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete dialog */}
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