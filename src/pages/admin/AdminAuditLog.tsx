import { useState, useEffect, useCallback } from 'react';
import { ScrollText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface AuditLogEntry {
  id: string;
  admin_email: string;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  credit_adjustment: 'Credit Adjustment',
  user_update:       'User Update',
};

export default function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('admin_audit_log')
      .select('id, admin_email, action, target_user_id, target_email, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (actionFilter !== 'all') query = query.eq('action', actionFilter);

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load audit log: ' + error.message);
    } else {
      setEntries((data as AuditLogEntry[]) ?? []);
    }
    setLoading(false);
  }, [actionFilter]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const renderDetails = (entry: AuditLogEntry) => {
    const d = entry.details || {};
    if (entry.action === 'credit_adjustment') {
      const amount = d.amount as number | undefined;
      return (
        <p className="text-xs text-muted-foreground">
          {typeof amount === 'number' && (
            <span className={amount > 0 ? 'text-primary font-semibold' : 'text-destructive font-semibold'}>
              {amount > 0 ? '+' : ''}{amount} credits
            </span>
          )}
          {d.description ? ` · ${d.description}` : ''}
          {typeof d.new_balance === 'number' ? ` · new balance ${d.new_balance}` : ''}
        </p>
      );
    }
    if (entry.action === 'user_update') {
      const parts = Object.entries(d).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
      return <p className="text-xs text-muted-foreground">{parts.join(' · ') || '—'}</p>;
    }
    return <p className="text-xs text-muted-foreground">{JSON.stringify(d)}</p>;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Recent admin actions — credit adjustments, user updates</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'credit_adjustment', 'user_update'] as const).map(a => (
          <button key={a} onClick={() => setActionFilter(a)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${actionFilter === a ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
            {a === 'all' ? 'All Actions' : ACTION_LABELS[a]}
          </button>
        ))}
      </div>

      {!loading && (
        <p className="text-xs text-muted-foreground px-1">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <ScrollText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No admin actions yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Credit adjustments and user updates will appear here as they happen.
          </p>
        </div>
      ) : (
        <div className="space-y-0 rounded-2xl border border-border overflow-hidden bg-card">
          {entries.map((entry, i) => (
            <div key={entry.id}>
              {i > 0 && <div className="border-t border-border mx-4" />}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </span>
                    {entry.target_email && (
                      <span className="text-xs text-muted-foreground truncate">→ {entry.target_email}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(entry.created_at)}</span>
                </div>
                {renderDetails(entry)}
                <p className="text-[10px] text-muted-foreground mt-1">by {entry.admin_email}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
