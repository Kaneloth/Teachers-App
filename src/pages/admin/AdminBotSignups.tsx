import { useEffect, useState } from 'react';
import { Bot, Loader2, RefreshCw, ChevronLeft, ChevronRight, Shield, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

interface BotRow {
  id: string;
  email: string | null;
  reason: 'honeypot_filled' | 'submitted_too_fast' | string;
  ip: string | null;
  user_agent: string | null;
  elapsed_ms: number | null;
  created_at: string;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const REASON_LABEL: Record<string, string> = {
  honeypot_filled:    'Honeypot field filled',
  submitted_too_fast: 'Submitted too fast',
};

export default function AdminBotSignups() {
  const { session } = useAuth();

  const [rows, setRows] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [count24h, setCount24h] = useState(0);
  const [count7d, setCount7d] = useState(0);
  const [reasonFilter, setReasonFilter] = useState<'all' | 'honeypot_filled' | 'submitted_too_fast'>('all');

  const perPage = 50;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/admin-list-bot-signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          page, perPage,
          reason: reasonFilter === 'all' ? undefined : reasonFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRows(data.rows);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setCount24h(data.count_24h);
      setCount7d(data.count_7d);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load bot signup attempts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.access_token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, page, reasonFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" /> Bot Sign-ups
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Caught by the honeypot before an account was ever created — no credits, email, or signups actually happened for these.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl border border-border p-3.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Shield className="w-3.5 h-3.5" /><span className="text-[11px] font-medium uppercase tracking-wide">All time</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{total}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-3.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Clock className="w-3.5 h-3.5" /><span className="text-[11px] font-medium uppercase tracking-wide">Last 24h</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{count24h}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-3.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Calendar className="w-3.5 h-3.5" /><span className="text-[11px] font-medium uppercase tracking-wide">Last 7 days</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{count7d}</p>
        </div>
      </div>

      {/* Reason filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['all', 'All'],
          ['honeypot_filled', 'Honeypot filled'],
          ['submitted_too_fast', 'Submitted too fast'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => { setReasonFilter(value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              reasonFilter === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          No bot sign-up attempts caught yet{reasonFilter !== 'all' ? ' for this filter' : ''}.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="bg-card rounded-2xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.email || '(no email entered)'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.ip || 'IP unknown'}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  r.reason === 'honeypot_filled'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  {REASON_LABEL[r.reason] || r.reason}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
                <span className="truncate">{r.user_agent || 'User agent unknown'}</span>
                {r.elapsed_ms != null && <span className="shrink-0">{(r.elapsed_ms / 1000).toFixed(1)}s to submit</span>}
              </div>
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                <Calendar className="w-3 h-3" /> {fmtDate(r.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg gap-1">
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} total</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg gap-1">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
