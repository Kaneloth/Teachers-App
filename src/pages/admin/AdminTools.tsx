import { useState, useEffect } from 'react';
import { Zap, Loader2, MapPin, ShieldAlert } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
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

  const [maintenanceOn,      setMaintenanceOn]      = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceUpdatedAt, setMaintenanceUpdatedAt] = useState<string | null>(null);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);

  const callMaintenance = async (body: Record<string, unknown>) => {
    const res = await fetch('/.netlify/functions/admin-maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  useEffect(() => {
    if (!session?.access_token) return;
    callMaintenance({ action: 'get' })
      .then(data => {
        setMaintenanceOn(!!data.enabled);
        setMaintenanceUpdatedAt(data.updated_at ?? null);
      })
      .catch((e: any) => toast.error(e.message || 'Failed to load maintenance mode status'))
      .finally(() => setMaintenanceLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const toggleMaintenance = async (next: boolean) => {
    // Turning maintenance mode ON takes the live site down for every
    // visitor except whoever holds the bypass cookie — worth a confirm.
    // Turning it back OFF is never destructive, so no confirm needed there.
    if (next && !window.confirm(
      'Turn maintenance mode ON? This immediately shows the maintenance page to every visitor site-wide (except anyone with the bypass cookie set via maintenance-access.html). Payment webhooks keep working regardless.'
    )) return;

    setTogglingMaintenance(true);
    try {
      const data = await callMaintenance({ action: 'set', enabled: next });
      setMaintenanceOn(!!data.enabled);
      setMaintenanceUpdatedAt(new Date().toISOString());
      toast.success(next ? 'Maintenance mode is now ON — site-wide, within ~15 seconds.' : 'Maintenance mode is now OFF — site back to normal within ~15 seconds.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update maintenance mode');
    } finally {
      setTogglingMaintenance(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
        const textedPart = data.pairs
          ? ` ${data.texted ?? 0} SMS backup notification(s) sent.`
          : '';
        setScanResult(`✓ Scan complete — ${data.pairs ?? 0} new pairs found, ${data.notified ?? 0} notifications sent.${textedPart}${deactivatedPart}`);
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

      {/* Maintenance mode — highest-impact toggle on this page, so it goes first */}
      <div className={`rounded-2xl border p-4 space-y-3 ${maintenanceOn ? 'bg-destructive/5 border-destructive/30' : 'bg-card border-border'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${maintenanceOn ? 'bg-destructive/10' : 'bg-primary/10'}`}>
              <ShieldAlert className={`w-4.5 h-4.5 ${maintenanceOn ? 'text-destructive' : 'text-primary'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {maintenanceOn
                  ? 'Site-wide — every visitor sees the maintenance page right now, except anyone with the bypass cookie.'
                  : 'Site is live and accessible to everyone as normal.'}
              </p>
              {maintenanceUpdatedAt && (
                <p className="text-[11px] text-muted-foreground mt-1">Last changed {fmtDate(maintenanceUpdatedAt)}</p>
              )}
            </div>
          </div>
          {maintenanceLoading
            ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0 mt-1" />
            : (
              <Switch
                checked={maintenanceOn}
                disabled={togglingMaintenance}
                onCheckedChange={toggleMaintenance}
                className="shrink-0"
              />
            )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Takes effect site-wide within ~15 seconds — no redeploy needed. Payment webhooks (PayFast) and scheduled
          jobs keep running regardless of this setting. To view the real site while maintenance mode is on, visit{' '}
          <code className="bg-muted px-1 py-0.5 rounded">/maintenance-access.html?key=...</code> with your secret key.
        </p>
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
