import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText, Send, Plus, Pencil, Clock, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface LastCV {
  pdf_url?: string;
  generated_at?: string;
  cv_data?: Record<string, unknown>;
}

interface Props {
  lastCV: LastCV;
  onBuildNew: () => void;
  onEdit: () => void;
  buildsLeft: number;
  isFree: boolean;
}

export default function LastCVBanner({ lastCV, onBuildNew, onEdit, buildsLeft, isFree }: Props) {
  const [resending, setResending] = useState(false);

  const email = (lastCV.cv_data?.personal as { email?: string } | undefined)?.email || '';

  const handleResend = async () => {
    if (!email) { toast.error('No email found on your last CV.'); return; }
    setResending(true);
    try {
      await supabase.functions.invoke('generateAndEmailCV', { body: lastCV.cv_data });
      toast.success('CV resent to ' + email);
    } catch {
      toast.error('Failed to resend CV');
    } finally {
      setResending(false);
    }
  };

  const noBuildsLeft = isFree && buildsLeft <= 0;

  return (
    <div className="space-y-3">
      {/* Last CV card */}
      <div className="bg-card border border-border rounded-2xl px-4 py-4 space-y-3">
        {/* Info row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Your Last Generated CV</p>
              {lastCV.generated_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {format(new Date(lastCV.generated_at), 'dd MMM yyyy, HH:mm')}
                </p>
              )}
            </div>
          </div>
          {/* Free tier builds-left badge */}
          {isFree && (
            <div className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
              noBuildsLeft
                ? 'bg-destructive/10 text-destructive'
                : buildsLeft === 1
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-muted text-muted-foreground'
            }`}>
              {noBuildsLeft ? 'No builds left' : `${buildsLeft} build${buildsLeft !== 1 ? 's' : ''} left`}
            </div>
          )}
        </div>

        {/* Download PDF */}
        {lastCV.pdf_url && (
          <a href={lastCV.pdf_url} target="_blank" rel="noopener noreferrer" className="block">
            <Button variant="outline" className="w-full rounded-xl gap-2 h-10">
              <FileText className="w-4 h-4" /> Download PDF
            </Button>
          </a>
        )}

        {/* Resend */}
        {email && (
          <Button
            onClick={handleResend}
            variant="outline"
            disabled={resending}
            className="w-full rounded-xl gap-2 h-10"
          >
            <Send className="w-4 h-4" />
            {resending ? 'Resending...' : `Resend to ${email}`}
          </Button>
        )}
      </div>

      {/* Edit & Re-generate */}
      <div className="bg-card border border-border rounded-2xl px-4 py-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">Make changes to this CV</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Opens your saved CV so you can update any field and re-generate.
          {isFree && ' Each re-generation uses one of your free builds.'}
        </p>
        {noBuildsLeft ? (
          <Button disabled className="w-full rounded-xl gap-2 h-10 mt-1">
            <Lock className="w-4 h-4" /> Upgrade to Edit & Re-generate
          </Button>
        ) : (
          <Button onClick={onEdit} className="w-full rounded-xl gap-2 h-10 mt-1">
            <Pencil className="w-4 h-4" /> Edit & Re-generate
          </Button>
        )}
        {noBuildsLeft && (
          <p className="text-xs text-center text-muted-foreground pt-0.5">
            You've used all {2} free CV builds. Upgrade for unlimited access.
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or start fresh</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Build New */}
      <Button variant="outline" onClick={onBuildNew} className="w-full rounded-xl gap-2 h-10">
        <Plus className="w-4 h-4" /> Build a New CV
      </Button>
    </div>
  );
}
