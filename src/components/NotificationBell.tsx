import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, GraduationCap, MapPin, ArrowRight, CheckCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: {
    matched_educator_id?: string;
    matched_user_id?: string;
    score?: number;
    is_town_swap?: boolean;
  };
  read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen]         = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifications(data || []);
    setUnread((data || []).filter(n => !n.read).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Real-time subscription — new notification pops the bell
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        setUnread(n => n + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const handleViewMatch = async (n: Notification) => {
    await markRead(n.id);
    setOpen(false);
    if (n.data.matched_educator_id) {
      navigate(`/educator/${n.data.matched_educator_id}`);
    }
  };

  const handleMessage = async (n: Notification) => {
    await markRead(n.id);
    setOpen(false);
    if (n.data.matched_user_id) {
      navigate(`/chat/${n.data.matched_user_id}`);
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) loadNotifications(); }}
        className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 shadow-sm">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-[340px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">Notifications</span>
                {unread > 0 && (
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.25} />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground mt-1">We'll let you know when a transfer match is found</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${!n.read ? 'bg-primary/15' : 'bg-muted'}`}>
                          <GraduationCap className={`w-4 h-4 ${!n.read ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                          {/* Score badge */}
                          {n.data.score != null && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              <MapPin className="w-2.5 h-2.5" />
                              {n.data.is_town_swap ? 'Town-swap match' : `${n.data.score}% match`}
                            </div>
                          )}
                          {/* Actions */}
                          {n.type === 'match_found' && n.data.matched_educator_id && (
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => handleViewMatch(n)}
                                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                              >
                                View profile <ArrowRight className="w-3 h-3" />
                              </button>
                              <span className="text-muted-foreground">·</span>
                              <button
                                onClick={() => handleMessage(n)}
                                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Send message
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        {/* Unread dot */}
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border">
                <Link
                  to="/notifications"
                  onClick={() => setOpen(false)}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  View all notifications
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
