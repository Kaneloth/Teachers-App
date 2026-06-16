import { X } from 'lucide-react';
import TestimonialForm from './TestimonialForm';

interface Props {
  open: boolean;
  onClose: () => void;
  source: 'cv_download_prompt' | 'match_prompt';
  title?: string;
  description?: string;
}

export default function TestimonialPromptModal({ open, onClose, source, title, description }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">{title ?? 'Enjoying Crosssa?'}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {description ?? 'Share a quick review — it really helps other educators discover us.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4">
          <TestimonialForm source={source} onSubmitted={() => setTimeout(onClose, 1800)} compact />
        </div>
        <button onClick={onClose} className="w-full text-center text-xs text-muted-foreground py-3 border-t border-border hover:text-foreground transition-colors">
          Maybe later
        </button>
      </div>
    </div>
  );
}
