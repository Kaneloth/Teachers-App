import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Check, Undo2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';
import { usePricing, PurchaseModal } from '@/components/credits/CreditBalance';
import InsufficientCreditsModal from '@/components/credits/InsufficientCreditsModal';

const COOLDOWN_MS = 3000;   // minimum gap between AI commands (anti rapid-fire)
const MAX_INSTRUCTION = 200; // must match REFINE_MAX_INSTRUCTION in enhance-cv.mjs
const MAX_TEXT = 6000;       // must match REFINE_MAX_TEXT in enhance-cv.mjs

interface Props {
  /** Which prompt/rules the backend should use. */
  section: 'summary' | 'experience' | 'cover_letter' | 'job_title';
  /** One-tap instructions shown as chips. */
  chips: string[];
  /** The field's current text (for experience: bullets joined with \n). */
  text: string;
  /** Called with the rewritten text (and again with the old text on Undo). */
  onApply: (newText: string) => void;
  onAiUsed?: (creditsSpent: number) => void;
  role?: string;
  school?: string;
  isEducator?: boolean;
  jobTitle?: string;
  /** Extra background for the model (e.g. the job's bullet points when rewriting its title). */
  context?: string;
  defaultOpen?: boolean;
}

/**
 * "Prompt-to-edit" bar: the person taps a chip or types an instruction
 * ("make it longer", "focus on customer service") and the AI rewrites the
 * field. Every run costs one AI action (`letter_usage`, the same admin-set
 * price as the other CV AI buttons), is never refunded on Undo, and is
 * rate-limited client-side to one run per COOLDOWN_MS.
 */
export default function AIPromptBar({
  section, chips, text, onApply, onAiUsed, role, school, isEducator, jobTitle, context, defaultOpen = false,
}: Props) {
  const { user } = useAuth();
  const isAdmin = !!(user?.user_metadata?.is_admin);
  const { deduct, insufficientCredits, dismissInsufficientCredits } = useCredits();
  const pricing = usePricing();

  const [open,        setOpen]        = useState(defaultOpen);
  const [instruction, setInstruction] = useState('');
  const [busy,        setBusy]        = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // After a run we remember what the text was before (for Undo) and what the
  // AI wrote (so we can tell when the person edits it by hand afterwards).
  const [previous, setPrevious] = useState<string | null>(null);
  const [applied,  setApplied]  = useState<string | null>(null);
  const lastRunAt = useRef(0);

  // If the person edits the field after an AI run, Keep/Undo no longer apply:
  // Undo would silently throw away their manual edits.
  useEffect(() => {
    if (applied !== null && text !== applied) { setPrevious(null); setApplied(null); }
  }, [text, applied]);

  const hasText = text.trim().length > 0;

  const run = async (rawInstruction: string) => {
    const instr = rawInstruction.trim().slice(0, MAX_INSTRUCTION);
    if (busy) return;
    if (!hasText) { toast.error(section === 'job_title' ? 'Type your job title (or what you did) first, then ask the AI to adjust it.' : 'Write something here first (or use Generate with AI), then ask the AI to adjust it.'); return; }
    if (!instr) { toast.error('Type what you want changed, or tap one of the suggestions.'); return; }
    if (text.length > MAX_TEXT) { toast.error('This text is too long to update in one go — shorten it first.'); return; }

    const wait = COOLDOWN_MS - (Date.now() - lastRunAt.current);
    if (wait > 0) { toast.info(`Give it a second — you can ask again in ${Math.ceil(wait / 1000)}s.`); return; }
    lastRunAt.current = Date.now();

    if (!isAdmin) {
      const ok = await deduct('letter_usage', `cvbuild_refine_${section}_${Date.now()}`);
      if (!ok) { lastRunAt.current = 0; return; } // balance modal is shown by useCredits
    }

    setBusy(true);
    const MAX_ATTEMPTS = 3;
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 3000));
          const res = await fetch('/.netlify/functions/enhance-cv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'refine_text',
              section,
              text,
              instruction: instr,
              role, school, isEducator, jobTitle, context,
            }),
          });
          const result = await res.json();
          const msg = String(result.error || '').toLowerCase();
          const transient = res.status === 429 || res.status === 503 || msg.includes('rate') || msg.includes('busy') || msg.includes('limit');
          if (transient && attempt < MAX_ATTEMPTS - 1) continue;
          if (!res.ok || !result.success || !result.text) throw new Error(result.error || 'AI failed');

          setPrevious(text);
          setApplied(result.text);
          onApply(result.text);
          setInstruction('');
          onAiUsed?.(pricing.letterCost);
          return;
        } catch (err: any) {
          const msg = String(err?.message || '').toLowerCase();
          const transient = msg.includes('rate') || msg.includes('busy') || msg.includes('limit');
          if (transient && attempt < MAX_ATTEMPTS - 1) continue;
          toast.error(err?.message && !msg.includes('ai failed') && !msg.includes('fetch')
            ? err.message
            : 'Could not update this section — please try again in a moment.');
          return;
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const keep = () => { setPrevious(null); setApplied(null); toast.success('Kept.'); };
  const undo = () => {
    if (previous === null) return;
    onApply(previous);
    setPrevious(null);
    setApplied(null);
    toast.success('Reverted to your previous text.');
  };

  return (
    <>
      <div className="rounded-xl border border-primary/20 bg-primary/5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" /> Ask AI to adjust this section…
          </span>
          <ChevronDown className={`w-4 h-4 text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="px-3 pb-3 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {chips.map(c => (
                <button
                  key={c}
                  type="button"
                  disabled={busy}
                  onClick={() => run(c)}
                  className="text-xs rounded-full border border-primary/30 bg-card text-foreground hover:border-primary hover:text-primary px-2.5 py-1 transition-colors disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={instruction}
                maxLength={MAX_INSTRUCTION}
                disabled={busy}
                onChange={e => setInstruction(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run(instruction); } }}
                placeholder="Type your own instruction…"
                className="flex-1 min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
              />
              <button
                type="button"
                disabled={busy || !instruction.trim()}
                onClick={() => run(instruction)}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rewriting…</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Update with AI</>}
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {isAdmin ? 'Admin: no credits charged.' : `Each update uses ${pricing.letterCost} credits — Undo does not refund them.`}
            </p>

            {previous !== null && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-card border border-border px-3 py-2">
                <span className="text-xs text-foreground">Updated. Happy with it?</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={undo}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors">
                    <Undo2 className="w-3.5 h-3.5" /> Undo
                  </button>
                  <button type="button" onClick={keep}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                    <Check className="w-3.5 h-3.5" /> Keep this
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {insufficientCredits && (
        <InsufficientCreditsModal
          needed={insufficientCredits.needed}
          have={insufficientCredits.have}
          message={insufficientCredits.message}
          onDismiss={dismissInsufficientCredits}
          onTopUp={() => { dismissInsufficientCredits(); setShowPurchaseModal(true); }}
        />
      )}
      {showPurchaseModal && (
        <PurchaseModal onClose={() => setShowPurchaseModal(false)} pricing={pricing} />
      )}
    </>
  );
}
