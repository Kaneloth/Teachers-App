import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X, Table2, List, AlignLeft, Sparkles, Loader2, Check, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';

export interface CustomSection {
  title: string;
  type: 'text' | 'bullets' | 'table';
  content?: string;
  columns?: string[];
  rows?: string[][];
}

interface SectionSuggestion {
  title: string;
  kind: 'extracted' | 'idea';
  type: 'bullets' | 'text';
  rationale: string;
  content: string;
}

interface Props {
  data: CustomSection[];
  onChange: (d: CustomSection[]) => void;
  fullCvData?: {
    personal?: { bio?: string };
    education?: { institution: string; qualification: string; year: string }[];
    experience?: { school: string; role: string; from: string; to: string; description: string }[];
    skills?: { subjects: string[]; soft_skills: string[]; languages: string[] };
  };
  onAiUsed?: () => void;
  isEducator?: boolean;
}

export default function CVStepExtras({ data, onChange, fullCvData, onAiUsed, isEducator = true }: Props) {
  const { user } = useAuth();
  const isAdmin = !!(user?.user_metadata?.is_admin);
  const { balance, loading: creditsLoading, deduct } = useCredits();

  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SectionSuggestion[] | null>(null);
  const [dismissedIdx, setDismissedIdx] = useState<Set<number>>(new Set());

  const addSection = () => onChange([...data, { title: '', type: 'bullets', content: '' }]);
  const removeSection = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const updateSection = (i: number, patch: Partial<CustomSection>) => {
    const updated = [...data];
    updated[i] = { ...updated[i], ...patch };
    onChange(updated);
  };

  // ── AI: suggest additional sections ─────────────────────────────────────
  const aiDisabled = suggesting || (!isAdmin && !creditsLoading && balance < 20);

  const fetchSuggestions = async () => {
    if (!isAdmin) {
      const ok = await deduct('letter_usage', `ai_suggest_sections_${Date.now()}`);
      if (!ok) return;
    }
    setSuggesting(true);
    setDismissedIdx(new Set());
    try {
      const res = await fetch('/.netlify/functions/enhance-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest_sections',
          cvData: {
            personal:   { bio: fullCvData?.personal?.bio || '' },
            education:  fullCvData?.education  ?? [],
            experience: fullCvData?.experience ?? [],
            skills:     fullCvData?.skills      ?? { subjects: [], soft_skills: [], languages: [] },
            custom_sections: data,
          },
          cvType: isEducator ? 'educator' : 'general',
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'AI failed');

      if (!result.suggestions?.length) {
        toast.success("Your CV already covers the sections most relevant to you — nothing more to suggest right now.");
        setSuggestions(null);
      } else {
        setSuggestions(result.suggestions);
      }
      onAiUsed?.();
    } catch (err: any) {
      toast.error(err?.message?.includes('credit') ? err.message : 'Could not generate suggestions — please try again.');
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggestion = (s: SectionSuggestion, idx: number) => {
    onChange([...data, { title: s.title, type: s.type, content: s.content || '' }]);
    setDismissedIdx(prev => new Set(prev).add(idx));
  };
  const dismissSuggestion = (idx: number) => setDismissedIdx(prev => new Set(prev).add(idx));

  const changeType = (i: number, type: CustomSection['type']) => {
    const base: CustomSection = { ...data[i], type };
    if (type === 'table') {
      base.columns = base.columns?.length ? base.columns : ['Column 1', 'Column 2'];
      base.rows    = base.rows?.length    ? base.rows    : [['', '']];
      base.content = undefined;
    } else {
      base.content = base.content ?? '';
      base.columns = undefined;
      base.rows    = undefined;
    }
    const updated = [...data];
    updated[i] = base;
    onChange(updated);
  };

  const getBullets = (content = '') => {
    const lines = content.split('\n');
    return lines.length > 0 ? lines : [''];
  };
  const setBullets = (i: number, bullets: string[]) => updateSection(i, { content: bullets.join('\n') });

  const addColumn = (si: number) => {
    const s = data[si];
    const cols = [...(s.columns || []), `Column ${(s.columns?.length || 0) + 1}`];
    const rows = (s.rows || []).map(r => [...r, '']);
    updateSection(si, { columns: cols, rows });
  };
  const removeColumn = (si: number, ci: number) => {
    const s = data[si];
    if ((s.columns?.length || 0) <= 1) return;
    updateSection(si, {
      columns: (s.columns || []).filter((_, i) => i !== ci),
      rows:    (s.rows    || []).map(r => r.filter((_, i) => i !== ci)),
    });
  };
  const updateColumn = (si: number, ci: number, value: string) => {
    const cols = [...(data[si].columns || [])];
    cols[ci] = value;
    updateSection(si, { columns: cols });
  };
  const addRow = (si: number) => {
    const s = data[si];
    updateSection(si, { rows: [...(s.rows || []), new Array(s.columns?.length || 2).fill('')] });
  };
  const removeRow = (si: number, ri: number) => {
    updateSection(si, { rows: (data[si].rows || []).filter((_, i) => i !== ri) });
  };
  const updateCell = (si: number, ri: number, ci: number, value: string) => {
    const rows = (data[si].rows || []).map((r, ridx) =>
      ridx === ri ? r.map((c, cidx) => (cidx === ci ? value : c)) : r
    );
    updateSection(si, { rows });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Add any section not covered above — e.g. Training Workshops, Awards, Publications, or Certifications.
        Each section can be plain text, a bullet list, or a table.
      </p>

      {/* AI: suggest additional sections */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Not sure what else to add?</p>
            <p className="text-xs text-muted-foreground mt-0.5">AI can suggest sections based on what you've already told us</p>
          </div>
          <button type="button" onClick={fetchSuggestions} disabled={aiDisabled}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50 shrink-0">
            {suggesting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…</>
              : <><Sparkles className="w-3.5 h-3.5" /> Suggest Sections</>}
          </button>
        </div>

        {suggestions && suggestions.filter((_, i) => !dismissedIdx.has(i)).length > 0 && (
          <div className="space-y-2 pt-1">
            {suggestions.map((s, i) => {
              if (dismissedIdx.has(i)) return null;
              return (
                <div key={i} className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    {s.kind === 'extracted'
                      ? <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      : <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.rationale}</p>
                      {s.kind === 'extracted' && s.content && (
                        <p className="text-xs text-foreground bg-card rounded-lg border border-border p-2 mt-1.5 italic">
                          "{s.content.length > 140 ? s.content.slice(0, 140) + '…' : s.content}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => acceptSuggestion(s, i)}
                      className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
                      <Check className="w-3 h-3" /> {s.kind === 'extracted' ? 'Add this section' : 'Add empty section'}
                    </button>
                    <button onClick={() => dismissSuggestion(i)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-3 h-3" /> Not relevant
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {data.map((section, si) => {
        const bullets = getBullets(section.content);
        return (
          <div key={si} className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">
                {section.title || `Section ${si + 1}`}
              </h3>
              <button onClick={() => removeSection(si)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Section Title</Label>
              <Input
                value={section.title}
                onChange={e => updateSection(si, { title: e.target.value })}
                placeholder="e.g. Training Workshops"
                className="rounded-xl"
              />
            </div>

            {/* Content type picker */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Content Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'text',    icon: AlignLeft, label: 'Paragraph' },
                  { key: 'bullets', icon: List,      label: 'Bullet List' },
                  { key: 'table',   icon: Table2,    label: 'Table' },
                ] as const).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => changeType(si, key)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 px-2 text-xs font-medium transition-all ${
                      section.type === key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Paragraph ── */}
            {section.type === 'text' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Content</Label>
                <textarea
                  value={section.content ?? ''}
                  onChange={e => updateSection(si, { content: e.target.value })}
                  placeholder="Type your content here..."
                  rows={4}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>
            )}

            {/* ── Bullet List ── */}
            {section.type === 'bullets' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Bullet Points</Label>
                <div className="space-y-2">
                  {bullets.map((bullet, bi) => (
                    <div key={bi} className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm shrink-0 w-4 text-center">•</span>
                      <Input
                        value={bullet}
                        onChange={e => {
                          const b = getBullets(section.content);
                          b[bi] = e.target.value;
                          setBullets(si, b);
                        }}
                        placeholder="Enter a point..."
                        className="rounded-xl flex-1 text-sm"
                      />
                      {bullets.length > 1 && (
                        <button
                          onClick={() => {
                            const b = bullets.filter((_, i) => i !== bi);
                            setBullets(si, b.length ? b : ['']);
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setBullets(si, [...bullets, ''])}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add point
                </button>
              </div>
            )}

            {/* ── Table ── */}
            {section.type === 'table' && (
              <div className="space-y-4">
                {/* Column headers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Column Headers</Label>
                    <button
                      onClick={() => addColumn(si)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add column
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {(section.columns || []).map((col, ci) => (
                      <div key={ci} className="flex items-center gap-1 shrink-0">
                        <Input
                          value={col}
                          onChange={e => updateColumn(si, ci, e.target.value)}
                          placeholder={`Column ${ci + 1}`}
                          className="rounded-xl text-xs h-8 w-32"
                        />
                        {(section.columns?.length || 0) > 1 && (
                          <button
                            onClick={() => removeColumn(si, ci)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rows */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Rows</Label>
                    <button
                      onClick={() => addRow(si)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add row
                    </button>
                  </div>
                  {(section.rows || []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No rows yet — click "Add row" to start.</p>
                  )}
                  <div className="space-y-2">
                    {(section.rows || []).map((row, ri) => (
                      <div key={ri} className="flex gap-2 overflow-x-auto pb-0.5 items-center">
                        <span className="text-xs text-muted-foreground shrink-0 w-4 text-right">{ri + 1}</span>
                        {row.map((cell, ci) => (
                          <Input
                            key={ci}
                            value={cell}
                            onChange={e => updateCell(si, ri, ci, e.target.value)}
                            placeholder={section.columns?.[ci] || `Col ${ci + 1}`}
                            className="rounded-xl text-xs h-8 w-32 shrink-0"
                          />
                        ))}
                        <button
                          onClick={() => removeRow(si, ri)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live preview hint */}
                {(section.columns?.length || 0) > 0 && (section.rows?.length || 0) > 0 && (
                  <div className="rounded-xl overflow-hidden border border-border text-xs">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {section.columns!.map((col, ci) => (
                            <th key={ci} className="bg-primary/10 text-primary px-2 py-1.5 text-left font-semibold text-[10px] uppercase tracking-wide border-b border-border">
                              {col || `Col ${ci + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows!.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-2 py-1.5 text-foreground border-b border-border/50 text-[11px]">
                                {cell || <span className="text-muted-foreground italic">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Button variant="outline" onClick={addSection} className="w-full rounded-xl gap-2">
        <Plus className="w-4 h-4" /> Add Custom Section
      </Button>
    </div>
  );
}
