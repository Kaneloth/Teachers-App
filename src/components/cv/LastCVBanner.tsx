import { Button } from '@/components/ui/button';
import { FileText, Plus, Pencil, Clock, Download } from 'lucide-react';
import { format } from 'date-fns';

interface LastCV {
  pdf_url?: string;
  generated_at?: string;
  cv_data?: Record<string, unknown>;
}

interface Props {
  lastCV: LastCV;
  onBuildNew: () => void;
  onEdit: () => void;
}

export default function LastCVBanner({ lastCV, onBuildNew, onEdit }: Props) {
  const personal = lastCV.cv_data?.personal as { full_name?: string; email?: string } | undefined;
  const ownerName = personal?.full_name || 'Your CV';
  const template  = (lastCV.cv_data?.template as string | undefined) ?? 'classic';
  const templateLabel = template.charAt(0).toUpperCase() + template.slice(1);

  return (
    <div className="space-y-3">
      {/* Last CV card */}
      <div className="bg-card border border-border rounded-2xl px-4 py-4 space-y-3">
        {/* Info row */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{ownerName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {lastCV.generated_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(lastCV.generated_at), 'dd MMM yyyy, HH:mm')}
                </p>
              )}
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {templateLabel} template
              </span>
            </div>
          </div>
        </div>

        {/* Download PDF — only shown if we have a valid PDF URL */}
        {lastCV.pdf_url ? (
          <a href={lastCV.pdf_url} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full rounded-xl gap-2 h-10">
              <Download className="w-4 h-4" /> Download Last PDF
            </Button>
          </a>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-1">
            PDF not available — use Edit &amp; Re-generate to create a new one.
          </p>
        )}
      </div>

      {/* Edit & Re-generate */}
      <div className="bg-card border border-border rounded-2xl px-4 py-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">Make changes to this CV</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Opens your saved CV so you can update any field and re-download.
        </p>
        <Button onClick={onEdit} variant="outline" className="w-full rounded-xl gap-2 h-10 mt-1">
          <Pencil className="w-4 h-4" /> Edit &amp; Re-generate
        </Button>
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
