/**
 * useCreditWarnings — protects people on FREE credits from burning the
 * credits they need to download their CV, by firing a warning toast after AI
 * actions. Mount once per page (CV Builder, Cover Letters).
 *
 * Fires only when ALL of these hold:
 *   • the user has never purchased (their credits are free grants:
 *     signup + referral) — paying users aren't nagged
 *   • the deduction was an AI action ('letter_usage'), not the download
 *   • the balance after it is still ≥ a CV download (cvCost) — below that
 *     the user is already blocked, so a warning would be pointless
 *
 * Two warnings, each at most once per browser session:
 *   1. "Heads up" — balance still comfortably above a download, tells them
 *      how many AI actions they can afford before they'd lose the download.
 *   2. "Stop and check" — the NEXT AI action would drop them below a
 *      download. Not hardcoded to "exactly 90": it fires whenever
 *      balance − letterCost < cvCost, so it works for any admin-set costs.
 *
 * All numbers come from usePricing (admin-controlled credit_costs).
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { usePricing } from './usePricing';

export const CREDITS_CHANGED_EVENT = 'crosssa:credits-changed';
const KEY_HEADS_UP = 'crosssa_credit_warn_headsup';
const KEY_STOP     = 'crosssa_credit_warn_stop';

function alreadyShown(key: string) {
  try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
}
function markShown(key: string) {
  try { sessionStorage.setItem(key, '1'); } catch { /* private mode etc. */ }
}

export function useCreditWarnings({ hasPurchased }: { hasPurchased: boolean }) {
  const { cvCost, letterCost } = usePricing();
  // Latest values in a ref so the listener is registered once, not on every change.
  const ctx = useRef({ hasPurchased, cvCost, letterCost });
  ctx.current = { hasPurchased, cvCost, letterCost };

  useEffect(() => {
    const onChange = (e: Event) => {
      const { balance, type } = (e as CustomEvent<{ balance: number; type: string }>).detail || ({} as any);
      const { hasPurchased, cvCost, letterCost } = ctx.current;

      if (hasPurchased) return;                       // paid users: never warn
      if (type !== 'letter_usage') return;            // only AI actions
      if (!Number.isFinite(balance) || balance >= 999999) return; // admin
      if (cvCost <= 0 || balance < cvCost) return;    // already blocked / free download

      const nextActionBreaksDownload = letterCost > 0 && balance - letterCost < cvCost;

      if (nextActionBreaksDownload) {
        if (alreadyShown(KEY_STOP)) return;
        markShown(KEY_STOP);
        markShown(KEY_HEADS_UP); // no point showing the softer one afterwards
        toast.warning('Stop and check', {
          description: `You have ${balance} credits — just enough to download your CV (${cvCost}). Another AI action will leave you unable to download it.`,
          duration: 12000,
        });
        return;
      }

      if (alreadyShown(KEY_HEADS_UP)) return;
      markShown(KEY_HEADS_UP);
      const spare = letterCost > 0 ? Math.floor((balance - cvCost) / letterCost) : 0;
      toast.warning('Heads up: save credits for your download', {
        description: `Downloading your CV costs ${cvCost} credits. You have ${balance} left — enough for ${spare} more AI action${spare === 1 ? '' : 's'} before you'd risk not being able to download.`,
        duration: 10000,
      });
    };

    window.addEventListener(CREDITS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, onChange);
  }, []);
}
