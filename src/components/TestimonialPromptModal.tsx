import TestimonialForm from '@/components/TestimonialForm';

interface Props {
  open: boolean;
  onClose: () => void;
  source?: 'public_form' | 'cv_download_prompt' | 'match_prompt';
  title?: string;
  description?: string;
}

/**
 * Lightweight, skippable prompt shown at natural high-satisfaction moments
 * (e.g. right after a CV download completes — see CVStepReview.tsx). Never
 * blocks the action that triggered it; it's rendered after the fact.
 *
 * Wraps TestimonialForm in `compact` mode (its own heading is redundant
 * with the title/description here) so the submission logic, the
 * `testimonials` table insert, and the "Thanks for sharing!" confirmation
 * state all live in one place rather than being duplicated per-prompt-site.
 */
export default function TestimonialPromptModal({
  open,
  onClose,
  source = 'cv_download_prompt',
  title = 'Got a moment?',
  description = "We'd love to hear about your experience.",
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <TestimonialForm
          source={source}
          compact
          // TestimonialForm shows its own "Thanks for sharing!" confirmation
          // panel on submit — give the person a moment to see that before
          // the modal dismisses itself, rather than yanking it away instantly.
          onSubmitted={() => setTimeout(onClose, 2200)}
        />

        <button
          onClick={onClose}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
