import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const SOURCE_LABELS: Record<string, string> = {
  friend:       'Friend / colleague',
  school_event: 'School / workshop / event',
  facebook:     'Facebook',
  whatsapp:     'WhatsApp',
  tiktok:       'TikTok',
  instagram:    'Instagram',
  google:       'Google search',
  other:        'Other',
  skipped:      'Skipped',
};

interface Result {
  total: number;
  answered: number;
  skipped: number;
  by_source: { source: string; count: number }[];
  by_day: ({ day: string } & Record<string, number | string>)[];
  others: { text: string; created_at: string }[];
}

// Local (South African) calendar day as YYYY-MM-DD, n days back from today.
const dayString = (daysAgo = 0) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const PRESETS: { label: string; from: () => string; to: () => string }[] = [
  { label: 'Today',        from: () => dayString(0),  to: () => dayString(0) },
  { label: 'Last 7 days',  from: () => dayString(6),  to: () => dayString(0) },
  { label: 'Last 30 days', from: () => dayString(29), to: () => dayString(0) },
  { label: 'All time',     from: () => '',            to: () => '' },
];

export default function AdminAcquisition() {
  const [from, setFrom] = useState(dayString(29));
  const [to,   setTo]   = useState(dayString(0));
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/.netlify/functions/admin-acquisition-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ from: from || undefined, to: to || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load');
      setData(json);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load acquisition data');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const answeredSources = (data?.by_source ?? []).filter(s => s.source !== 'skipped');
  const maxCount = Math.max(1, ...answeredSources.map(s => s.count));
  const answerRate = data && data.total > 0 ? Math.round((data.answered / data.total) * 100) : 0;
  const dayColumns = answeredSources.map(s => s.source);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" /> Sign-up Sources
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Where new users say they heard about Crosssa. Run a campaign or workshop, then filter to that day.
        </p>
      </div>

      {/* Date filter */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setFrom(p.from()); setTo(p.to()); }}
              className={`text-xs font-medium rounded-full border px-3 py-1.5 transition-colors ${
                from === p.from() && to === p.to()
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="rounded-xl" />
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Responses" value={data.total} />
            <Stat label="Answered" value={data.answered} sub={`${answerRate}% of responses`} />
            <Stat label="Skipped" value={data.skipped} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Top sources</h2>
            {answeredSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No answers in this period yet.</p>
            ) : answeredSources.map(s => (
              <div key={s.source} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{SOURCE_LABELS[s.source] ?? s.source}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {s.count} · {data.answered ? Math.round((s.count / data.answered) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {data.by_day.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">By day</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Day</th>
                      {dayColumns.map(c => <th key={c} className="py-1.5 px-2 font-medium text-right whitespace-nowrap">{SOURCE_LABELS[c] ?? c}</th>)}
                      <th className="py-1.5 pl-2 font-medium text-right">Skipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_day.map(d => (
                      <tr key={d.day} className="border-t border-border">
                        <td className="py-1.5 pr-3 text-foreground whitespace-nowrap">{d.day}</td>
                        {dayColumns.map(c => <td key={c} className="py-1.5 px-2 text-right tabular-nums text-foreground">{(d[c] as number) || '–'}</td>)}
                        <td className="py-1.5 pl-2 text-right tabular-nums text-muted-foreground">{(d.skipped as number) || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.others.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-1.5">
              <h2 className="text-sm font-semibold text-foreground">"Other" answers</h2>
              {data.others.map((o, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  <span className="text-foreground">{o.text}</span> · {new Date(o.created_at).toLocaleDateString('en-ZA')}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
