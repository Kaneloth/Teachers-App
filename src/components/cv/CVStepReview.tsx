import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileText, CheckCircle2, RefreshCw, Eye, List } from 'lucide-react';
import CVTemplateRenderer from './CVTemplateRenderer';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { generateDocxBlob } from '@/lib/generateDocxBlob';

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
  const { user, updateUserMeta } = useAuth();
  const [view, setView] = useState<'preview' | 'summary'>('preview');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [docxUrl, setDocxUrl] = useState<string | null>(null);

  const { personal, education, experience, skills } = data;
  const fileName = `CV_${(personal.full_name || 'Educator').replace(/\s+/g, '_')}.docx`;

  const handleGenerate = async () => {
    setSending(true);
    try {
      // 1. Generate DOCX blob
      const blob = await generateDocxBlob(data, user);

      // 2. Download DOCX to user's device
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);

      // 3. (Optional) Upload DOCX to Supabase for "last CV" banner
      const path = `${user?.id ?? 'anon'}/cv-${Date.now()}.docx`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        const uploadedUrl = urlData.publicUrl;
        if (uploadedUrl) {
          setDocxUrl(uploadedUrl);
          const newCount = ((user?.user_metadata?.cv_count as number) ?? 0) + 1;
          await updateUserMeta({
            last_cv_pdf_url: uploadedUrl, // store as DOCX (field name remains but content is DOCX)
            last_cv_data: data,
            last_cv_generated_at: new Date().toISOString(),
            cv_count: newCount,
          });
          if (onGenerated) onGenerated(uploadedUrl);
        }
      }

      setSent(true);
      toast.success('CV downloaded as Word document!');
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error).message || 'Failed to generate CV');
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
        <p className="text-sm text-muted-foreground">Your CV (Word document) has been saved to your device.</p>
        {docxUrl && (
          <a href={docxUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="mt-4 rounded-xl gap-2">
              <FileText className="w-4 h-4" /> Open CV
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
          <div style={{ zoom: 0.45 }}>
            <CVTemplateRenderer data={data} forExport watermark={isFree} />
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

      <Button
        onClick={handleGenerate}
        disabled={sending}
        className="w-full h-12 rounded-xl text-base font-semibold gap-2"
      >
        <Download className="w-5 h-5" />
        {sending ? 'Generating Word document...' : 'Download CV (Word)'}
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