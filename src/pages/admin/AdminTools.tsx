import { useState } from 'react';
import { Zap, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

interface BackfillResult {
  id: string;
  full_name: string;
  town: string;
  status: 'geocoded' | 'skipped' | 'failed';
  reason?: string;
  source?: string;
}

export default function AdminTools() {
  const { session } = useAuth();
  const [scanning,    setScanning]    = useState(false);
  const [scanResult,  setScanResult]  = useState<string | null>(null);

  const [backfilling,      setBackfilling]      = useState(false);
  const [backfillSummary,  setBackfillSummary]  = useState<string | null>(null);
  const [backfillResults,  setBackfillResults]  = useState<BackfillResult[]>([]);

  const runMatchScan = async () => {
    if (!session?.access_token) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res  = await fetch('/.netlify/functions/match-scan', {
        method:  'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const deactivatedPart = data.deactivated
          ? ` ${data.deactivated} educator(s) auto-paused (both sides unlocked messaging).`
          : '';
        setScanResult(`✓ Scan complete — ${data.pairs ?? 0} new pairs found, ${data.notified ?? 0} notifications sent.${deactivatedPart}`);
      } else {
        setScanResult(`✗ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setScanResult(`✗ ${e.message}`);
    } finally {
      setScanning(false);
    }
  };

  const runBackfill = async () => {
    if (!session?.access_token) return;
    setBackfilling(true);
    setBackfillSummary(null);
    setBackfillResults([]);
    try {
      const res  = await fetch('/.netlify/functions/backfill-town-coords', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ limit: 30 }),
      });
      const data = await res.json();
      if (res.ok) {
        setBackfillSummary(
          `✓ Processed ${data.processed} — ${data.geocoded} geocoded, ${data.skipped} skipped, ` +
          `${data.failed} failed. ${data.remaining} still remaining` +
          (data.remaining > 0 ? ' — run again to continue.' : '.')
        );
        setBackfillResults(data.results ?? []);
      } else {
        setBackfillSummary(`✗ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setBackfillSummary(`✗ ${e.message}`);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Tools</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Admin utilities</p>
      </div>

      {/* Match scan */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Match Notification Scan</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scans all actively-looking educators for new matches and sends notifications.
            Only fires for pairs not previously notified. Runs automatically every day —
            use the button below to trigger an extra scan on demand.
          </p>
        </div>
        <button
          onClick={runMatchScan}
          disabled={scanning}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {scanning
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
            : <><Zap className="w-4 h-4" /> Run Match Scan</>}
        </button>
        {scanResult && (
          <p className={`text-xs rounded-xl px-3 py-2 ${scanResult.startsWith('✓')
            ? 'bg-primary/10 text-primary'
            : 'bg-destructive/10 text-destructive'}`}>
            {scanResult}
          </p>
        )}
      </div>

      {/* Backfill town coordinates */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Backfill Town Coordinates</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            One-off maintenance: geocodes accounts created before onboarding captured
            town coordinates automatically. Processes up to 30 at a time — safe to run
            repeatedly until "remaining" reaches 0.
          </p>
        </div>
        <button
          onClick={runBackfill}
          disabled={backfilling}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {backfilling
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Backfilling…</>
            : <><MapPin className="w-4 h-4" /> Run Backfill</>}
        </button>
        {backfillSummary && (
          <p className={`text-xs rounded-xl px-3 py-2 ${backfillSummary.startsWith('✓')
            ? 'bg-primary/10 text-primary'
            : 'bg-destructive/10 text-destructive'}`}>
            {backfillSummary}
          </p>
        )}
        {backfillResults.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {backfillResults.map(r => (
              <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{r.full_name}</p>
                  <p className="text-muted-foreground truncate">
                    {r.town}{r.reason ? ` — ${r.reason}` : ''}{r.source ? ` (via ${r.source})` : ''}
                  </p>
                </div>
                <span className={`shrink-0 font-semibold px-2 py-0.5 rounded-full ${
                  r.status === 'geocoded' ? 'bg-primary/10 text-primary'
                  : r.status === 'skipped' ? 'bg-amber-100 text-amber-700'
                  : 'bg-destructive/10 text-destructive'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
