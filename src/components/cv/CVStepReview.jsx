import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Mail, FileText, CheckCircle2, RefreshCw, Eye, List } from 'lucide-react';
import CVTemplateRenderer from './CVTemplateRenderer';
import { exportElementAsPDF } from '@/utils/cvExport';

export default function CVStepReview({ data, onGenerated }) {
  const [view, setView] = useState('preview'); // 'preview' | 'summary'
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const exportRef = useRef(null);

  const { personal, education, experience, skills, template } = data;

  const handleGenerate = async () => {
    if (!personal.email) {
      toast.error('Please add your email address in the Personal step.');
      return;
    }
    setSending(true);

    // 1. Export PDF client-side
    const pdfBlob = await exportElementAsPDF(
      exportRef.current,
      `CV_${(personal.full_name || 'Educator').replace(/\s+/g, '_')}.pdf`
    );

    // 2. Upload blob to get a URL
    const pdfFile = new File([pdfBlob], `CV_${(personal.full_name || 'Educator').replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' });
    const { file_url: uploadedUrl } = await base44.integrations.Core.UploadFile({ file: pdfFile });

    // 3. Send email via backend
    await base44.functions.invoke('generateAndEmailCV', {
      ...data,
      _pdf_url_override: uploadedUrl, // backend uses this URL instead of re-generating
    });

    setPdfUrl(uploadedUrl);
    setSending(false);
    setSent(true);
    toast.success('CV emailed to ' + personal.email);
    if (onGenerated) onGenerated(uploadedUrl);
  };

  if (sent) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">CV Sent!</h2>
        <p className="text-sm text-muted-foreground">
          Your CV PDF has been emailed to <strong>{personal.email}</strong>.
        </p>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="mt-4 rounded-xl gap-2">
              <FileText className="w-4 h-4" /> Download PDF
            </Button>
          </a>
        )}
        <p className="text-xs text-muted-foreground mt-2">Check your inbox (and spam folder).</p>
        <div className="flex gap-2 justify-center mt-4">
          <Button variant="outline" className="rounded-xl" onClick={() => setSent(false)}>
            Make Changes
          </Button>
          <Button className="rounded-xl gap-2" disabled={sending} onClick={handleGenerate}>
            <RefreshCw className="w-4 h-4" />
            {sending ? 'Resending...' : 'Resend CV'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2 bg-muted p-1 rounded-xl">
        <button
          onClick={() => setView('preview')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition-all ${
            view === 'preview' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
          }`}
        >
          <Eye className="w-4 h-4" /> Preview
        </button>
        <button
          onClick={() => setView('summary')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition-all ${
            view === 'summary' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
          }`}
        >
          <List className="w-4 h-4" /> Summary
        </button>
      </div>

      {view === 'preview' ? (
        <div className="rounded-xl overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <div style={{ minWidth: '320px' }}>
              <CVTemplateRenderer data={data} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <SummaryCard title="Personal Details">
            <ReviewRow label="Name" value={personal.full_name} />
            <ReviewRow label="Email" value={personal.email} />
            <ReviewRow label="Phone" value={personal.phone} />
            <ReviewRow label="Address" value={personal.address} />
            {personal.bio && <ReviewRow label="Summary" value={personal.bio} />}
          </SummaryCard>

          <SummaryCard title="Education">
            {education.filter(e => e.institution).map((e, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium text-foreground">{e.qualification}</p>
                <p className="text-muted-foreground text-xs">{e.institution} · {e.year}</p>
              </div>
            ))}
          </SummaryCard>

          <SummaryCard title="Experience">
            {experience.filter(e => e.school).map((e, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium text-foreground">{e.role}</p>
                <p className="text-muted-foreground text-xs">{e.school} · {e.from} – {e.to}</p>
              </div>
            ))}
          </SummaryCard>

          <SummaryCard title="Skills & Languages">
            <div className="flex flex-wrap gap-1">
              {[...(skills.subjects || []), ...(skills.soft_skills || [])].map(s => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
            {skills.languages?.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">Languages: {skills.languages.join(', ')}</p>
            )}
          </SummaryCard>
        </div>
      )}

      {/* Hidden export-quality render */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px' }}>
        <div ref={exportRef}>
          <CVTemplateRenderer data={data} forExport />
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={sending}
        className="w-full h-12 rounded-xl text-base font-semibold gap-2"
      >
        <Mail className="w-5 h-5" />
        {sending ? 'Generating & Sending...' : `Email My CV to ${personal.email || '...'}`}
      </Button>
    </div>
  );
}

function SummaryCard({ title, children }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}