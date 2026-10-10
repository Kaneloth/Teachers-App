/**
 * CVSummaryPrompt — shown ONCE right after a CV is imported (upload / photos /
 * free text) when the imported CV has no Professional Summary.
 *
 * Flow:  intro → [Generate My Summary] → review (Accept / Edit / Regenerate)
 *            └→ [I'll do it later]  (closes; the editor shows the amber
 *                                    empty state until a summary exists)
 *
 * Rendered by CVBuilderPage, which owns the credits instance — so a failed
 * deduction surfaces through that page's InsufficientCreditsModal (z-50,
 * above this overlay at z-40). No credit amounts are shown on any button.
 * Copy is deliberately universal: no mention of matric, learners or any
 * particular kind of user.
 */

import { useState } from 'react';
import { CheckCircle2, Sparkles, Loader2, Pencil, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Props {
  /** Full CV as imported — sent to the AI as context. */
  cvData: any;
  jobDescription?: string;
  /** From useCredits(); returns false (and surfaces the top-up modal) if the user can't afford it. */
  deduct: (type: 'letter_usage', refId?: string) => Promise<boolean>;
  onAiUsed?: (credits: number) => void;
  aiCost: number;
  /** Called with the final text when the user accepts (or saves an edit). */
  onAccept: (summary: string) => void;
  /** User chose "I'll do it later". */
  onSkip: () => void;
}

type Stage = 'intro' | 'generating' | 'review' | 'editing';

export default function CVSummaryPrompt({ cvData, jobDescription, deduct, onAiUsed, aiCost, onAccept, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>('intro');
  const [summary, setSummary] = useState('');

  // One generation attempt = one AI action = one deduction (so Regenerate
  // costs again, same as any other AI action in the builder).
  const generate = async () => {
    const ok = await deduct('letter_usage', `cvbuild_summary_${Date.now()}`);
    if (!ok) return; // top-up modal is shown by the page

    const previous: Stage = stage === 'intro' ? 'intro' : 'review';
    setStage('generating');
    const MAX_ATTEMPTS = 3;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 3000));
        const res = await fetch('/.netlify/functions/enhance-cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_summary',
            cvData: {
              personal:   cvData.personal,
              education:  cvData.education  ?? [],
              experience: cvData.experience ?? [],
              skills:     cvData.skills     ?? { subjects: [], soft_skills: [], languages: [] },
            },
            userBlurb: '',
            jobDescription: jobDescription || '',
          }),
        });
        const result = await res.json();
        const retryable = res.status === 429 || res.status === 503 ||
          /rate|busy|limit/i.test(result.error || '');
        if (retryable && attempt < MAX_ATTEMPTS - 1) continue;
        if (!res.ok || !result.success || !result.summary) throw new Error(result.error || 'AI failed');
        setSummary(result.summary);
        onAiUsed?.(aiCost);
        setStage('review');
        return;
      } catch (err: any) {
        if (/rate|busy|limit/i.test(err?.message || '') && attempt < MAX_ATTEMPTS - 1) continue;
        break;
      }
    }
    toast.error('Could not generate a summary — please try again in a moment.');
    setStage(previous);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl p-6 text-center space-y-4 max-h-[90vh] overflow-y-auto">

        {(stage === 'intro' || stage === 'generating') && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">CV uploaded successfully!</h2>
              <p className="text-sm text-muted-foreground">We've imported your details.</p>
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="text-sm text-foreground">Before you continue, let's complete the most important section:</p>
              <p className="flex items-center justify-center gap-1.5 text-sm font-bold tracking-wide text-primary">
                <Sparkles className="w-4 h-4" /> PROFESSIONAL SUMMARY
              </p>
              <p className="text-sm text-muted-foreground">
                It's the first thing employers read — and it's often the most overlooked.
              </p>
            </div>
            <Button
              onClick={generate}
              disabled={stage === 'generating'}
              className="w-full h-12 rounded-xl text-sm font-semibold gap-2 bg-[#FF6B35] hover:bg-[#e55a2b] text-white"
            >
              {stage === 'generating'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing your summary…</>
                : <><Sparkles className="w-4 h-4" /> Generate My Summary</>}
            </Button>
            <button
              type="button"
              onClick={onSkip}
              disabled={stage === 'generating'}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
            >
              I'll do it later
            </button>
          </>
        )}

        {(stage === 'review' || stage === 'editing') && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Your professional summary</h2>
              <p className="text-sm text-muted-foreground">
                {stage === 'review' ? 'Happy with this? You can accept it, tweak it, or ask for another version.' : 'Make it your own, then save.'}
              </p>
            </div>

            {stage === 'review' ? (
              <p className="text-sm text-foreground text-left leading-relaxed bg-muted rounded-xl p-3 whitespace-pre-wrap">{summary}</p>
            ) : (
              <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={7} className="rounded-xl text-sm text-left" />
            )}

            {stage === 'review' ? (
              <div className="space-y-2">
                <Button onClick={() => onAccept(summary)} className="w-full h-11 rounded-xl gap-2 font-semibold">
                  <Check className="w-4 h-4" /> Accept
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStage('editing')} className="flex-1 rounded-xl gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button variant="outline" onClick={generate} className="flex-1 rounded-xl gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStage('review')} className="flex-1 rounded-xl">Cancel</Button>
                <Button
                  onClick={() => (summary.trim() ? onAccept(summary.trim()) : toast.error('Your summary can\'t be empty.'))}
                  className="flex-1 rounded-xl gap-1.5"
                >
                  <Check className="w-4 h-4" /> Save
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
