import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileText, CheckCircle2, RefreshCw, Eye, List } from 'lucide-react';
import CVTemplateRenderer from './CVTemplateRenderer';
import { exportElementAsPDF } from '@/utils/cvExport';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

// Builds correct public storage URL — getPublicUrl() sometimes omits /public/
function publicStorageUrl(bucket: string, path: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

interface CVData {
  personal: { full_name?: string; email?: string; photo_url?: string; phone?: string; address?: string; bio?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects?: string[]; soft_skills?: string[]; languages?: string[] };
  references?: { name: string; title: string; organisation: string; phone: string; email: string; relationship: string }[];
  template: string;
}

interface Props { data: CVData; onGenerated?: (url: string) => void; isFree?: boolean }

export default function CVStepReview({ data, onGenerated, isFree = false }: Props) {
  const { user } = useAuth();
  const [view, setView] = useState<'preview' | 'summary'>('preview');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const { personal, education, experience, skills } = data;
  const fileName = `CV_${(personal.full_name || 'Educator').replace(/\s+/g, '_')}.pdf`;

  const handleGenerate = async () => {
    if (!exportRef.current) return;
    setSending(true);
    try {
      const pdfBlob = await exportElementAsPDF(exportRef.current, fileName, { ...data, watermark: isFree });

      // ── 1. Trigger immediate device download ─────────────────────────────
      const blobUrl = URL.createObjectURL(pdfBlob);
      const anchor  = document.createElement('a');
      anchor.href     = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);

      // ── 2. Try to upload to Supabase for persistent download link ────────
      let uploadedUrl = '';
      try {
        const path = `${user?.id ?? 'anon'}/cv-${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });
        if (!uploadError) {
          uploadedUrl = publicStorageUrl('avatars', path);
          setPdfUrl(uploadedUrl);
        }
      } catch (_) {
        console.warn('PDF cloud backup failed — local download still succeeded');
      }

      // ── 3. Always notify parent so it saves metadata & shows banner ───────
      // Pass uploadedUrl (empty string if upload failed — parent handles gracefully)
      if (onGenerated) onGenerated(uploadedUrl);

      setSent(true);
      toast.success('CV downloaded to your device!');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to generate CV');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">CV Downloaded!</h2>
        <p className="text-sm text-muted-foreground">Your CV PDF has been saved to your device.</p>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="mt-4 rounded-xl gap-2">
              <FileText className="w-4 h-4" /> Open PDF
            </Button>
          </a>
        )}
        <div className="flex gap-2 justify-center mt-4">
          <Button variant="outline" className="rounded-xl" onClick={() => setSent(false)}>
            Make Changes
          </Button>
          <Button className="rounded-xl gap-2" disabled={sending} onClick={handleGenerate}>
            <RefreshCw className="w-4 h-4" />
            {sending ? 'Generating...' : 'Download Again'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-muted p-1 rounded-xl">
        {(['preview', 'summary'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition-all ${view === v ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
          >
            {v === 'preview' ? <><Eye className="w-4 h-4" /> Preview</> : <><List className="w-4 h-4" /> Summary</>}
          </button>
        ))}
      </div>

      {view === 'preview' ? (
        <div className="rounded-xl overflow-hidden border border-border bg-white shadow-sm">
          {/*
           * Render the CV at its true A4 width (794 px) then zoom the whole
           * thing down to ~45% so it fits a phone screen without any clipping.
           * `zoom` (unlike transform:scale) collapses layout space, so the
           * container height adjusts to the scaled content automatically and
           * the page can scroll normally to reveal references or extra pages.
           */}
          <div style={{ zoom: 0.45 }}>
            <CVTemplateRenderer data={data} forExport />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <SummaryCard title="Personal Details">
            <ReviewRow label="Name"    value={personal.full_name} />
            <ReviewRow label="Email"   value={personal.email} />
            <ReviewRow label="Phone"   value={personal.phone} />
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
            {skills.languages?.length ? (
              <p className="text-sm text-muted-foreground mt-1">Languages: {skills.languages.join(', ')}</p>
            ) : null}
          </SummaryCard>
          {data.references?.filter(r => r.name).length ? (
            <SummaryCard title="References">
              {data.references.filter(r => r.name).map((r, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p className="text-muted-foreground text-xs">{[r.title, r.organisation].filter(Boolean).join(' · ')}</p>
                  {r.relationship && <p className="text-muted-foreground text-xs">{r.relationship}</p>}
                  <p className="text-muted-foreground text-xs">{[r.phone, r.email].filter(Boolean).join(' · ')}</p>
                </div>
              ))}
            </SummaryCard>
          ) : null}
        </div>
      )}

      {/* Hidden full-size render used by exportElementAsPDF — added cv-export-root class */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px' }}>
        <div ref={exportRef} className="cv-export-root">
          <CVTemplateRenderer data={data} forExport />
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={sending}
        className="w-full h-12 rounded-xl text-base font-semibold gap-2"
      >
        <Download className="w-5 h-5" />
        {sending ? 'Generating PDF...' : 'Download PDF'}
      </Button>
    </div>
  );
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}