/**
 * useCreditWarnings — protects people on FREE credits from burning the
 * credits they need to download their CV. Mount once per page (CV Builder,
 * Cover Letters).
 *
 * Counts AI actions (deduct type 'letter_usage') for the browser session and
 * shows exactly TWO toasts per session — never repeatedly:
 *
 *   1. After the 4th AI action — "Heads up": what they've spent so far, what
 *      a download costs, and how many more AI actions they can afford.
 *   2. When their balance reaches the download cost — "Stop and check": the
 *      next AI action would leave them unable to download. Not hardcoded to
 *      "exactly 90": it fires on the first action after which
 *      balance − letterCost < cvCost, so it works for any admin-set costs.
 *      If this coincides with the 4th action, only this stronger one shows.
 *
 * Neither fires for users who have ever purchased (their credits are paid),
 * for admins, for downloads, or once the balance is already below a download
 * (they're blocked; a warning would be pointless).
 *
 * All numbers come from usePricing (admin-controlled credit_costs).
 */

export const CREDITS_CHANGED_EVENT = 'crosssa:credits-changed';
const KEY_HEADS_UP = 'crosssa_credit_warn_headsup';
const KEY_STOP     = 'crosssa_credit_warn_stop';
const KEY_COUNT    = 'crosssa_ai_action_count';
const KEY_SPENT    = 'crosssa_ai_credits_spent';
const HEADS_UP_AFTER_ACTIONS = 4;

function readNum(key: string) {
  try { return Number(sessionStorage.getItem(key)) || 0; } catch { return 0; }
}
function writeNum(key: string, n: number) {
  try { sessionStorage.setItem(key, String(n)); } catch { /* ignore */ }
}

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

      // Count every AI action this session, warned about or not.
      const count = readNum(KEY_COUNT) + 1;
      writeNum(KEY_COUNT, count);
      const spent = readNum(KEY_SPENT) + (letterCost > 0 ? letterCost : 0);
      writeNum(KEY_SPENT, spent);

      if (cvCost <= 0 || balance < cvCost) return;    // already blocked / free download

      const nextActionBreaksDownload = letterCost > 0 && balance - letterCost < cvCost;

      if (nextActionBreaksDownload) {
        if (alreadyShown(KEY_STOP)) return;
        markShown(KEY_STOP);
        markShown(KEY_HEADS_UP); // the softer one is moot now
        toast.warning('Stop and check', {
          description: `You have ${balance} credits — just enough to download your CV (${cvCost}). Another AI action will leave you unable to download it.`,
          duration: 12000,
        });
        return;
      }

      if (count === HEADS_UP_AFTER_ACTIONS && !alreadyShown(KEY_HEADS_UP)) {
        markShown(KEY_HEADS_UP);
        const spare = letterCost > 0 ? Math.floor((balance - cvCost) / letterCost) : 0;
        toast.warning('Heads up: save credits for your download', {
          description: `You've used ${spent} credits on AI actions. Downloading your CV costs ${cvCost}. You have ${balance} left — enough for ${spare} more AI action${spare === 1 ? '' : 's'} before you'd risk not being able to download.`,
          duration: 10000,
        });
      }
    };

    window.addEventListener(CREDITS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, onChange);
  }, []);
}
