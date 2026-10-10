/**
 * CreditChip — the always-visible credit counter in the top-right of the CV
 * Builder and Cover Letters pages (and inside <CreditBalance />).
 *
 *  • Bigger and bolder than the old chip, so it's actually noticed.
 *  • Flashes amber for ~2s with a "−N" badge every time the balance drops.
 *  • Persistent colour states, so the number means something at a glance:
 *      normal  → balance covers a CV download
 *      amber   → balance < one CV download (cvCost) — can't download yet
 *      red     → balance < one AI action (letterCost) — can't do anything
 *    Both thresholds come from the admin-controlled credit_costs table, not
 *    hardcoded numbers.
 */

import { useEffect, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import { usePricing } from '@/hooks/usePricing';

interface Props {
  balance: number;
  loading?: boolean;
  onClick?: () => void;
}

export default function CreditChip({ balance, loading = false, onClick }: Props) {
  const { cvCost, letterCost } = usePricing();
  const prev = useRef<number | null>(null);
  const [flashDelta, setFlashDelta] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    const before = prev.current;
    prev.current = balance;
    // Only flash on a real drop between two loaded values (not on first
    // load, and not on a top-up or refund).
    if (before !== null && balance < before) {
      setFlashDelta(before - balance);
      const t = setTimeout(() => setFlashDelta(null), 2000);
      return () => clearTimeout(t);
    }
  }, [balance, loading]);

  const flashing = flashDelta !== null;
  const isAdminUnlimited = balance >= 999999;
  const level =
    isAdminUnlimited || loading ? 'ok' :
    balance < letterCost        ? 'critical' :
    balance < cvCost            ? 'low' :
                                  'ok';

  const colour =
    flashing         ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400 scale-110' :
    level === 'critical' ? 'bg-red-100 text-red-700 ring-1 ring-red-300' :
    level === 'low'      ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' :
                           'bg-primary/10 text-primary';

  const Tag: any = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      aria-live="polite"
      className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-base font-bold transition-all duration-300 ${colour} ${flashing ? 'animate-pulse' : ''} ${onClick ? 'hover:brightness-95' : ''}`}
    >
      <Coins className="w-4 h-4" />
      {loading ? '…' : isAdminUnlimited ? '∞' : balance}
      <span className="font-normal text-xs opacity-70">credits</span>
      {flashing && (
        <span className="absolute -top-2 -right-1 text-[11px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 shadow">
          −{flashDelta}
        </span>
      )}
    </Tag>
  );
}
