import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { FileText, Send, Plus, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function LastCVBanner({ lastCV, onBuildNew }) {
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!lastCV?.cv_data?.personal?.email) {
      toast.error('No email found on your last CV.');
      return;
    }
    setResending(true);
    await base44.functions.invoke('generateAndEmailCV', lastCV.cv_data);
    setResending(false);
    toast.success('CV resent to ' + lastCV.cv_data.personal.email);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Your Last Generated CV</p>
            {lastCV.generated_at && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Generated {format(new Date(lastCV.generated_at), 'dd MMM yyyy, HH:mm')}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {lastCV.pdf_url && (
            <a href={lastCV.pdf_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full rounded-xl gap-2">
                <FileText className="w-4 h-4" /> Download PDF
              </Button>
            </a>
          )}
          <Button
            onClick={handleResend}
            disabled={resending}
            className="w-full rounded-xl gap-2"
          >
            <Send className="w-4 h-4" />
            {resending ? 'Resending...' : `Resend to ${lastCV.cv_data?.personal?.email || 'my email'}`}
          </Button>
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Button variant="outline" onClick={onBuildNew} className="w-full rounded-xl gap-2">
        <Plus className="w-4 h-4" /> Build / Edit CV
      </Button>
    </div>
  );
}