import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, Ban, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function AdminSettings() {
  const qc = useQueryClient();
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: educators = [], isLoading } = useQuery({
    queryKey: ['admin-educators'],
    queryFn: async () => {
      const { data } = await supabase.from('educators').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, subscription_plan, subscription_end, account_status, status_reason, role').limit(500);
      return data || [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ userId, status, reason }: { userId: string; status: string; reason?: string }) => {
      const { error } = await supabase.from('profiles').update({
        account_status: status,
        status_reason: reason || null,
      }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-profiles'] }); toast.success('Status updated'); },
    onError: (err: any) => toast.error(err.message),
  });

  const setSubscription = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const end = plan === 'pro'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const { error } = await supabase.from('profiles').update({
        subscription_plan: plan,
        subscription_end: end,
        subscription_start: plan === 'pro' ? new Date().toISOString() : null,
      }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-profiles'] }); toast.success('Subscription updated'); },
    onError: (err: any) => toast.error(err.message),
  });

  const profileMap = new Map((profiles as any[]).map((p: any) => [p.id, p]));

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Admin Panel</p>
          <p className="text-xs text-amber-700">Manage educator accounts and subscriptions.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{educators.length} educators registered</p>
      </div>

      <div className="space-y-3">
        {isLoading && <div className="flex justify-center pt-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
        {(educators as any[]).map((educator: any) => {
          const profile = profileMap.get(educator.user_id);
          const isExpanded = expandedId === educator.id;
          const status = profile?.account_status || 'active';

          return (
            <div key={educator.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <button
                className="flex items-center justify-between px-4 py-3 w-full text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : educator.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{educator.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{educator.full_name}</p>
                    <p className="text-xs text-muted-foreground">{educator.current_province} · {formatDistanceToNow(new Date(educator.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === 'active' ? 'bg-green-100 text-green-700' : status === 'suspended' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {status}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Subscription</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant={profile?.subscription_plan === 'pro' ? 'default' : 'outline'} className="flex-1 rounded-lg h-9 text-xs"
                        onClick={() => setSubscription.mutate({ userId: educator.user_id, plan: 'pro' })}>
                        Pro
                      </Button>
                      <Button size="sm" variant={!profile?.subscription_plan || profile?.subscription_plan === 'free' ? 'default' : 'outline'} className="flex-1 rounded-lg h-9 text-xs"
                        onClick={() => setSubscription.mutate({ userId: educator.user_id, plan: 'free' })}>
                        Free
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Account Status</p>
                    <Input
                      placeholder="Reason (optional)"
                      value={reasonMap[educator.user_id] || ''}
                      onChange={e => setReasonMap(m => ({ ...m, [educator.user_id]: e.target.value }))}
                      className="h-9 text-xs"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 rounded-lg h-9 text-xs text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => setStatus.mutate({ userId: educator.user_id, status: 'active', reason: reasonMap[educator.user_id] })}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Active
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 rounded-lg h-9 text-xs text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                        onClick={() => setStatus.mutate({ userId: educator.user_id, status: 'suspended', reason: reasonMap[educator.user_id] })}>
                        Suspend
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 rounded-lg h-9 text-xs text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => setStatus.mutate({ userId: educator.user_id, status: 'banned', reason: reasonMap[educator.user_id] })}>
                        <Ban className="w-3.5 h-3.5 mr-1" />Ban
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
