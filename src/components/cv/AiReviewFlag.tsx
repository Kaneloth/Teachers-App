import { Sparkles, Check } from 'lucide-react';

/**
 * Soft "please check this" highlight for content the AI wrote or filled in.
 *
 * - A warm amber ring pulses a few times (not endlessly) to catch the eye,
 *   then stays as a calm static ring with a short banner.
 * - It goes away when the person taps "Looks good" or edits the content
 *   (the parent clears its flag on edit).
 * - Respects "reduce motion": the pulse is skipped, the ring + banner remain.
 *
 * Place at: src/components/cv/AiReviewFlag.tsx
 */
export default function AiReviewFlag({
  active, onReviewed, label = "Added by AI — please read it through and check it's accurate", children,
}: {
  active: boolean;
  onReviewed: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  if (!active) return <>{children}</>;
  return (
    <div className="crosssa-ai-flag rounded-2xl ring-2 ring-amber-400/80 p-2 space-y-2">
      <style>{`
        @keyframes crosssa-check-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
          50%      { box-shadow: 0 0 0 7px rgba(245, 158, 11, 0.35); }
        }
        .crosssa-ai-flag { animation: crosssa-check-pulse 1.3s ease-in-out 4; }
        @media (prefers-reduced-motion: reduce) { .crosssa-ai-flag { animation: none; } }
      `}</style>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
          <Sparkles className="w-3.5 h-3.5 shrink-0" /> {label}
        </p>
        <button
          type="button"
          onClick={onReviewed}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold px-2.5 py-1 transition-colors"
        >
          <Check className="w-3 h-3" /> Looks good
        </button>
      </div>
      {children}
    </div>
  );
}
