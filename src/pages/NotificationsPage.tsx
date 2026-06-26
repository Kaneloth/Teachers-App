import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Bell, UserCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setNotifications(data || []);
    setLoading(false);
    // Mark all as read
    await supabase.from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => navigate(-1)}
          className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Notifications</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-8">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Bell className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">No notifications yet</p>
          <p className="text-sm text-muted-foreground">
            You'll be notified when you have a new transfer match.
          </p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {notifications.map(n => {
            const matchedUserId = n.data?.matched_user_id;
            const educatorId    = n.data?.matched_educator_id;
            const score         = n.data?.score;
            return (
              <div key={n.id}
                className={`rounded-2xl border px-4 py-3.5 space-y-1 transition-colors ${
                  n.read ? 'bg-card border-border' : 'bg-primary/5 border-primary/20'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  </div>
                  {score != null && (
                    <span className="shrink-0 text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {score}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pl-6">{n.body}</p>
                <div className="flex items-center justify-between pl-6 pt-0.5">
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                  {educatorId && (
                    <Link to={`/educator/${educatorId}`}
                      className="text-[11px] font-semibold text-primary hover:underline">
                      View profile →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
