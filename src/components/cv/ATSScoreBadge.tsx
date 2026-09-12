import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react';
import { computeATSScore } from './atsScore';

interface Props {
  data: any;
  /** Compact mode drops the checklist entirely — just the score pill, for
   *  tight spaces like the mobile drawer's collapsed handle. */
  compact?: boolean;
}

function scoreColor(score: number): { text: string; bg: string; ring: string } {
  if (score >= 80) return { text: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' };
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-100', ring: 'ring-amber-200' };
  return { text: 'text-destructive', bg: 'bg-destructive/10', ring: 'ring-destructive/20' };
}

export default function ATSScoreBadge({ data, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const { score, checks } = computeATSScore(data);
  const colors = scoreColor(score);
  const failedFirst = [...checks].sort((a, b) => Number(a.passed) - Number(b.passed));

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${colors.bg} ${colors.text}`}>
        ATS {score}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${colors.ring} ring-1 overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 ${colors.bg}`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${colors.text}`}>ATS Score: {score}/100</span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {score >= 80 ? 'Looks parser-friendly' : score >= 50 ? 'A few quick wins available' : 'Needs attention'}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="bg-card px-3 py-2.5 space-y-1.5 max-h-64 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground pb-1">
            A heuristic estimate, not a guarantee — real ATS software varies by employer.
          </p>
          {failedFirst.map(c => (
            <div key={c.id} className="flex items-start gap-2">
              {c.passed
                ? <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{c.label}</p>
                {!c.passed && <p className="text-[11px] text-muted-foreground mt-0.5">{c.tip}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
