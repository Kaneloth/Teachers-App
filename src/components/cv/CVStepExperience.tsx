import { useState } from 'react';
import { Input } from '@/components/ui/input';
import AutoGrowTextarea from '@/components/AutoGrowTextarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X, Sparkles, Lightbulb, Loader2, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';
import { usePricing, PurchaseModal } from '@/components/credits/CreditBalance';
import InsufficientCreditsModal from '@/components/credits/InsufficientCreditsModal';

interface ExpEntry { school: string; role: string; from: string; to: string; description: string }
interface Props {
  data: ExpEntry[];
  onChange: (d: ExpEntry[]) => void;
  onAiUsed?: (creditsSpent: number) => void;
  isEducator?: boolean;
}

interface Suggestion { bulletIndex: number; original: string; suggested: string }

export default function CVStepExperience({ data, onChange, onAiUsed, isEducator = true }: Props) {
  const { user } = useAuth();
  const isAdmin = !!(user?.user_metadata?.is_admin);
  const { balance, loading: creditsLoading, deduct, insufficientCredits, dismissInsufficientCredits } = useCredits();
  const pricing = usePricing();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const [improving,   setImproving]   = useState<Record<number, boolean>>({});
  const [suggestions, setSuggestions] = useState<Record<number, Suggestion[] | undefined>>({});

  // ── AI: suggest brand-new points (not rewordings) ────────────────────────
  // Separate from `improving`/`suggestions` above, which only ever rewrite
  // bullets the person already wrote. This proposes entirely new candidate
  // bullets — for users who genuinely did more in a role than they managed
  // to write down (often an English-fluency gap, not a lack of experience).
  const [suggestingPoints, setSuggestingPoints] = useState<Record<number, boolean>>({});
  const [pointSuggestions, setPointSuggestions] = useState<Record<number, string[] | undefined>>({});

  const add    = () => onChange([...data, { school: '', role: '', from: '', to: '', description: '' }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const set    = (i: number, field: keyof ExpEntry, value: string) => {
    const updated = [...data];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  const getBullets  = (desc: string) => { const l = desc.split('\n').map(s => s.trimStart()); return l.length > 0 ? l : ['']; };
  const setBullets  = (i: number, bullets: string[]) => set(i, 'description', bullets.join('\n'));
  const addBullet   = (i: number, b: string[]) => setBullets(i, [...b, '']);
  const remBullet   = (i: number, b: string[], bi: number) => {
    const u = b.filter((_, x) => x !== bi);
    setBullets(i, u.length > 0 ? u : ['']);
    // Editing bullets manually while suggestions are pending would leave
    // stale suggestions pointing at bullet indices that no longer match —
    // simplest safe behaviour is to just clear them for this entry.
    setSuggestions(prev => ({ ...prev, [i]: undefined }));
  };
  const editBullet  = (i: number, b: string[], bi: number, val: string) => {
    const u = [...b]; u[bi] = val; setBullets(i, u);
    setSuggestions(prev => ({ ...prev, [i]: undefined }));
  };

  // ── AI: improve wording of this entry's bullets ─────────────────────────
  const improveEntry = async (i: number) => {
    const bullets = getBullets(data[i].description);
    const pairs = bullets.map((b, bi) => ({ bi, b })).filter(p => p.b.trim());
    if (!pairs.length) { toast.error('Add at least one responsibility first.'); return; }

    if (!isAdmin) {
      const ok = await deduct('letter_usage', `cvbuild_improve_exp_${i}_${Date.now()}`);
      if (!ok) return;
    }

    setImproving(prev => ({ ...prev, [i]: true }));
    try {
      const res = await fetch('/.netlify/functions/enhance-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'improve_experience_bullets',
          bullets: pairs.map(p => p.b),
          role: data[i].role,
          school: data[i].school,
          cvType: isEducator ? 'educator' : 'general',
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'AI failed');

      const changed: Suggestion[] = pairs
        .map((p, idx) => ({ bulletIndex: p.bi, original: p.b, suggested: (result.suggestions?.[idx] ?? p.b) as string }))
        .filter(s => s.suggested.trim() !== s.original.trim());

      if (!changed.length) {
        toast.success('Your wording already looks good — no changes suggested!');
      } else {
        setSuggestions(prev => ({ ...prev, [i]: changed }));
      }
      onAiUsed?.(pricing.letterCost);
    } catch (err: any) {
      toast.error(err?.message?.includes('credit') ? err.message : 'Could not generate suggestions — please try again.');
    } finally {
      setImproving(prev => ({ ...prev, [i]: false }));
    }
  };

  const acceptSuggestion = (i: number, s: Suggestion) => {
    const bullets = getBullets(data[i].description);
    const updated = [...bullets];
    updated[s.bulletIndex] = s.suggested;
    setBullets(i, updated);
    setSuggestions(prev => ({ ...prev, [i]: prev[i]?.filter(x => x.bulletIndex !== s.bulletIndex) }));
  };
  const declineSuggestion = (i: number, s: Suggestion) => {
    setSuggestions(prev => ({ ...prev, [i]: prev[i]?.filter(x => x.bulletIndex !== s.bulletIndex) }));
  };
  const acceptAll = (i: number) => {
    const list = suggestions[i] || [];
    const bullets = getBullets(data[i].description);
    const updated = [...bullets];
    list.forEach(s => { updated[s.bulletIndex] = s.suggested; });
    setBullets(i, updated);
    setSuggestions(prev => ({ ...prev, [i]: undefined }));
  };
  const declineAll = (i: number) => setSuggestions(prev => ({ ...prev, [i]: undefined }));

  const aiDisabled = (i: number) => improving[i] || (!isAdmin && !creditsLoading && balance < pricing.letterCost);

  // ── AI: suggest additional points the person may have left out ──────────
  // Unlike improveEntry above, this asks for genuinely NEW bullets — common,
  // role-typical duties the person may have had but didn't think to write
  // down (a frequent gap for users who aren't fully fluent in English).
  // Every result is shown as an accept/reject suggestion below; nothing is
  // added to the CV until the person explicitly accepts it, since only they
  // can actually confirm whether a given duty applied to their own job.
  const suggestNewPoints = async (i: number) => {
    const role = data[i].role.trim();
    if (!role) { toast.error('Add a job title first — AI needs it to know what to suggest.'); return; }

    if (!isAdmin) {
      const ok = await deduct('letter_usage', `cvbuild_suggest_exp_${i}_${Date.now()}`);
      if (!ok) return;
    }

    setSuggestingPoints(prev => ({ ...prev, [i]: true }));
    try {
      const existingBullets = getBullets(data[i].description).filter(b => b.trim());
      const res = await fetch('/.netlify/functions/enhance-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest_experience_points',
          role,
          school: data[i].school,
          existingBullets,
          cvType: isEducator ? 'educator' : 'general',
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'AI failed');

      const newSuggestions: string[] = Array.isArray(result.suggestions) ? result.suggestions : [];
      if (!newSuggestions.length) {
        toast.info("No extra suggestions — you've likely already covered the typical duties for this role.");
      } else {
        setPointSuggestions(prev => ({ ...prev, [i]: newSuggestions }));
      }
      onAiUsed?.(pricing.letterCost);
    } catch (err: any) {
      toast.error(err?.message?.includes('credit') || err?.message?.includes('job title') ? err.message : 'Could not generate suggestions — please try again.');
    } finally {
      setSuggestingPoints(prev => ({ ...prev, [i]: false }));
    }
  };

  const acceptPointSuggestion = (i: number, text: string) => {
    // Drop any lingering blank bullet(s) rather than adding the new point
    // below an empty line — first real point for a role often starts as a
    // single blank placeholder.
    const cleaned = getBullets(data[i].description).filter(b => b.trim());
    setBullets(i, [...cleaned, text]);
    setPointSuggestions(prev => ({ ...prev, [i]: prev[i]?.filter(s => s !== text) }));
  };
  const declinePointSuggestion = (i: number, text: string) => {
    setPointSuggestions(prev => ({ ...prev, [i]: prev[i]?.filter(s => s !== text) }));
  };
  const acceptAllPoints = (i: number) => {
    const list = pointSuggestions[i] || [];
    const cleaned = getBullets(data[i].description).filter(b => b.trim());
    setBullets(i, [...cleaned, ...list]);
    setPointSuggestions(prev => ({ ...prev, [i]: undefined }));
  };
  const declineAllPoints = (i: number) => setPointSuggestions(prev => ({ ...prev, [i]: undefined }));

  const suggestDisabled = (i: number) => suggestingPoints[i] || (!isAdmin && !creditsLoading && balance < pricing.letterCost);

  return (
    <div className="space-y-3">
      {data.map((entry, i) => {
        const bullets = getBullets(entry.description);
        const entrySuggestions = suggestions[i];
        return (
          <div key={i} className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">Experience {i + 1}</h3>
              {data.length > 1 && (
                <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <Field label="Company / Organisation">
              <AutoGrowTextarea value={entry.school} onChange={v => set(i, 'school', v)}
                placeholder="e.g. Acme Corporation, City of Joburg, WCED" />
            </Field>

            <Field label="Job Title / Role">
              <AutoGrowTextarea value={entry.role} onChange={v => set(i, 'role', v)}
                placeholder="e.g. Software Developer, Accountant, Mathematics Educator" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Input value={entry.from} onChange={e => set(i, 'from', e.target.value)} placeholder="Jan 2020" className="rounded-xl" />
              </Field>
              <Field label="To">
                <Input value={entry.to} onChange={e => set(i, 'to', e.target.value)} placeholder="Present" className="rounded-xl" />
              </Field>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
                <Label className="text-sm font-medium">Key Responsibilities / Achievements</Label>
                <div className="flex items-center gap-3 shrink-0">
                  <button type="button" onClick={() => suggestNewPoints(i)} disabled={suggestDisabled(i)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50">
                    {suggestingPoints[i]
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</>
                      : <><Lightbulb className="w-3 h-3" /> Suggest points</>}
                  </button>
                  <button type="button" onClick={() => improveEntry(i)} disabled={aiDisabled(i)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50">
                    {improving[i]
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Improving…</>
                      : <><Sparkles className="w-3 h-3" /> Improve with AI</>}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-0.5">Each point will appear as a bullet on your CV</p>
              <div className="space-y-2">
                {bullets.map((bullet, bi) => (
                  <div key={bi} className="flex items-start gap-2">
                    <span className="text-muted-foreground text-sm shrink-0 w-4 text-center pt-2">•</span>
                    <AutoGrowTextarea value={bullet} onChange={v => editBullet(i, bullets, bi, v)}
                      placeholder={bi === 0 ? 'e.g. Managed a team of 5 staff members' : 'Add another achievement or responsibility...'}
                      className="flex-1 text-sm" />
                    {bullets.length > 1 && (
                      <button onClick={() => remBullet(i, bullets, bi)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 pt-2">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => addBullet(i, bullets)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1">
                <Plus className="w-3.5 h-3.5" /> Add point
              </button>
              <p className="text-xs text-muted-foreground">
                Only wrote one or two points? Tap "Suggest points" for other duties typical of this role — you decide which ones actually apply.
              </p>
            </div>

            {/* ── AI: suggested NEW points (not yet on the CV) ── */}
            {pointSuggestions[i] && pointSuggestions[i]!.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" /> Other duties for this role — only add what applies to you
                  </p>
                  {pointSuggestions[i]!.length > 1 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => declineAllPoints(i)} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">Dismiss all</button>
                      <button onClick={() => acceptAllPoints(i)} className="text-[11px] text-primary font-medium hover:text-primary/80 transition-colors">Add all</button>
                    </div>
                  )}
                </div>
                {pointSuggestions[i]!.map(text => (
                  <div key={text} className="bg-card rounded-lg border border-border p-2.5 space-y-1.5">
                    <p className="text-xs text-foreground">{text}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button onClick={() => acceptPointSuggestion(i, text)}
                        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
                        <Check className="w-3 h-3" /> Yes, add this
                      </button>
                      <button onClick={() => declinePointSuggestion(i, text)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3 h-3" /> Not applicable
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── AI: reworded suggestions for EXISTING points ── */}
            {entrySuggestions && entrySuggestions.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> AI Suggestions
                  </p>
                  {entrySuggestions.length > 1 && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => declineAll(i)} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">Decline all</button>
                      <button onClick={() => acceptAll(i)} className="text-[11px] text-primary font-medium hover:text-primary/80 transition-colors">Accept all</button>
                    </div>
                  )}
                </div>
                {entrySuggestions.map(s => (
                  <div key={s.bulletIndex} className="bg-card rounded-lg border border-border p-2.5 space-y-1.5">
                    <p className="text-xs text-muted-foreground line-through decoration-muted-foreground/50">{s.original}</p>
                    <p className="text-xs text-foreground font-medium">{s.suggested}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button onClick={() => acceptSuggestion(i, s)}
                        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
                        <Check className="w-3 h-3" /> Accept
                      </button>
                      <button onClick={() => declineSuggestion(i, s)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                        <RotateCcw className="w-3 h-3" /> Keep original
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <Button variant="outline" onClick={add} className="w-full rounded-xl gap-2">
        <Plus className="w-4 h-4" /> Add Work Experience
      </Button>
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
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
