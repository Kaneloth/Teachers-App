import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function AdminTools() {
  const { session } = useAuth();
  const [scanning,    setScanning]    = useState(false);
  const [scanResult,  setScanResult]  = useState<string | null>(null);

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
        setScanResult(`✓ Scan complete — ${data.pairs ?? 0} new pairs found, ${data.notified ?? 0} notifications sent.`);
      } else {
        setScanResult(`✗ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setScanResult(`✗ ${e.message}`);
    } finally {
      setScanning(false);
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
    </div>
  );
}
