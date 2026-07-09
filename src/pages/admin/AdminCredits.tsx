import { useState } from 'react';
import { Search, Coins, Plus, Minus, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

interface LedgerEntry {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  ref_id: string | null;
  created_at: string;
}

export default function AdminCredits() {
  const { session } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userCode, setUserCode] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const search = async () => {
    const q = searchInput.trim();
    if (!q) { toast.error('Enter an email address or CR- code'); return; }
    setLoading(true);
    try {
      // A CR- code (e.g. "CR-1234ABC") doesn't contain "@"; an email
      // always does — use that to decide which field to search by.
      const isEmail = q.includes('@');
      const res = await fetch('/.netlify/functions/admin-adjust-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(
          isEmail ? { action: 'view', target_email: q } : { action: 'view', target_user_code: q }
        ),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'User not found');
      setUserId(result.user_id);
      setUserEmail(result.email ?? q);
      setUserCode(result.user_code ?? null);
      setBalance(result.balance);
      setLedger(result.ledger ?? []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load credits');
      setUserId(null);
      setUserEmail('');
      setUserCode(null);
      setBalance(null);
      setLedger([]);
    } finally {
      setLoading(false);
    }
  };

  const adjust = async (sign: 1 | -1) => {
    const amt = parseInt(adjustAmount, 10);
    if (!userId) return;
    if (!amt || amt <= 0) { toast.error('Enter a positive number of credits'); return; }

    setAdjusting(true);
    try {
      const res = await fetch('/.netlify/functions/admin-adjust-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: 'adjust',
          target_user_id: userId,
          amount: amt * sign,
          description: adjustReason || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Adjustment failed');

      toast.success(`${sign > 0 ? 'Added' : 'Removed'} ${amt} credits`);
      setBalance(result.new_balance);
      setAdjustAmount('');
      setAdjustReason('');
      await search(); // refresh ledger
    } catch (e: any) {
      toast.error(e.message || 'Adjustment failed');
    } finally {
      setAdjusting(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Credits & Payments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Look up a user's balance, adjust credits, view transaction history</p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(); }}
            placeholder="user@example.com or CR- code"
            className="pl-9 rounded-2xl h-11"
          />
        </div>
        <Button onClick={search} disabled={loading} className="rounded-2xl h-11 px-4">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look up'}
        </Button>
      </div>

      {balance !== null && (
        <>
          {/* Balance card */}
          <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Coins className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Current Balance</p>
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">{userEmail}</p>
                {userCode && <p className="text-xs font-mono font-semibold text-primary">{userCode}</p>}
              </div>
            </div>
            <p className="text-2xl font-bold text-primary">{balance}</p>
          </div>

          {/* Adjust form */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <Label className="text-sm font-semibold">Manual Adjustment</Label>
            <div className="flex gap-2">
              <Input
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="Amount"
                inputMode="numeric"
                className="rounded-xl w-28"
              />
              <Input
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                placeholder="Reason (optional)"
                className="rounded-xl flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => adjust(-1)} disabled={adjusting} className="flex-1 rounded-xl gap-1.5">
                <Minus className="w-4 h-4" /> Remove
              </Button>
              <Button onClick={() => adjust(1)} disabled={adjusting} className="flex-1 rounded-xl gap-1.5">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>

          {/* Ledger history */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Transaction History
            </p>
            {ledger.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No transactions yet</p>
            ) : (
              <div className="space-y-0 rounded-2xl border border-border overflow-hidden bg-card">
                {ledger.map((entry, i) => (
                  <div key={entry.id}>
                    {i > 0 && <div className="border-t border-border mx-4" />}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground capitalize">{entry.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.description || '—'}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(entry.created_at)}</p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ml-3 ${entry.amount > 0 ? 'text-primary' : 'text-destructive'}`}>
                        {entry.amount > 0 ? '+' : ''}{entry.amount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
