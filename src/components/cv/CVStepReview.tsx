import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileText, CheckCircle2, RefreshCw, Eye, List, Coins, AlertCircle } from 'lucide-react';
import CVTemplateRenderer from './CVTemplateRenderer';
import { exportElementAsPDF } from '@/utils/cvExport';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import TestimonialPromptModal from '@/components/TestimonialPromptModal';

// Builds correct public storage URL — getPublicUrl() sometimes omits /public/
function publicStorageUrl(bucket: string, path: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

interface CVData {
  personal: { full_name?: string; email?: string; photo_url?: string; phone?: string; address?: string; bio?: string; job_title?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects?: string[]; soft_skills?: string[]; languages?: string[] };
  references?: { name: string; title: string; organisation: string; phone: string; email: string; relationship: string }[];
  template: string;
}

interface Props { data: CVData; onGenerated?: (url: string) => void; isFree?: boolean; aiUsed?: boolean }

export default function CVStepReview({ data, onGenerated, isFree = false, aiUsed = false }: Props) {
  const { user } = useAuth();
  const { balance, loading: creditsLoading, deduct } = useCredits();
  const { gates, loading: gatesLoading } = useFeatureGates();
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [view, setView] = useState<'preview' | 'summary'>('preview');
  const [showTestimonialPrompt, setShowTestimonialPrompt] = useState(false);

  // Check if the user has ever bought credits (purchase entry in ledger).
  // If yes → no watermark. If only signup_bonus credits → watermark applies.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('credit_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('type', ['purchase', 'monthly_pro'])
      .then(({ count }) => setHasPurchased((count ?? 0) > 0));
  }, [user]);

  // Watermark = user has never paid (only has free signup credits)
  const isAdmin = !!(user?.user_metadata?.is_admin);
  // cv_watermark gate: when OFF, watermark disabled for everyone
  const watermarkGateActive = !gatesLoading && gates.cv_watermark !== false;
  const shouldWatermark = watermarkGateActive && !hasPurchased && !isAdmin;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Existing stored PDF — re-download this for free without generating a new one
  const existingPdfUrl = (user?.user_metadata?.last_cv_pdf_url as string | undefined) ?? null;

  const { personal, education, experience, skills } = data;
  const fileName = `CV_${(personal.full_name || 'Educator').replace(/\s+/g, '_')}.pdf`;

  // Re-download the already-stored PDF — FREE, no credit deduction
  const handleRedownload = async () => {
    const url = pdfUrl;
    if (!url) return;
    setSending(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
      toast.success('CV downloaded — no credits charged.');
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    } finally {
      setSending(false);
    }
  };

  const handleGenerate = async () => {
    if (!exportRef.current) return;

    // ── Credit check ─────────────────────────────────────────────────────
    // If AI summary was used (1 credit already spent), only deduct 5 more.
    // Otherwise deduct the full 9 credits.
    const remainingCost = aiUsed ? 7 : 9;  // AI summary costs 2cr, so remaining = 9-2=7
    const ok = await deduct('cv_usage', fileName);
    if (!ok) {
      if (!isAdmin && balance < remainingCost) setShowInsufficientModal(true);
      return;
    }

    setSending(true);
    try {
      const pdfBlob = await exportElementAsPDF(exportRef.current, fileName, { ...data, watermark: shouldWatermark });

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

      // Prompt for a testimonial a moment after the download completes —
      // a natural high-satisfaction point. Once per browser session so
      // it's not naggy on repeat "Download Again" clicks.
      if (!sessionStorage.getItem('crosssa_testimonial_prompted')) {
        sessionStorage.setItem('crosssa_testimonial_prompted', 'true');
        setTimeout(() => setShowTestimonialPrompt(true), 1500);
      }
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
          <Button className="rounded-xl gap-2" disabled={sending} onClick={handleRedownload}>
            <RefreshCw className="w-4 h-4" />
            {sending ? 'Downloading...' : 'Download Again (free)'}
          </Button>
        </div>
        <TestimonialPromptModal
          open={showTestimonialPrompt}
          onClose={() => setShowTestimonialPrompt(false)}
          source="cv_download_prompt"
          title="Got your CV! 🎉"
          description="Mind sharing a quick review of your experience building it?"
        />
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
            {personal.job_title && <ReviewRow label="Job Title" value={personal.job_title} />}
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



      {/* Watermark notice for free users */}
      {!hasPurchased && !isAdmin && (
        <div className="flex items-start gap-2 bg-muted border border-border rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Your CV will include a <strong>free watermark</strong> in the footer.{' '}
            <a href="/credits" className="text-primary underline font-medium">Buy credits</a>{' '}
            to remove it — watermark is removed automatically on any paid download.
          </p>
        </div>
      )}

      {/* Insufficient credits warning */}
      {!isAdmin && !creditsLoading && balance < (aiUsed ? 7 : 9) && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Not enough credits</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              You have {balance} credit{balance !== 1 ? 's' : ''} but need {aiUsed ? 7 : 9} to generate a CV.
            </p>
          </div>
        </div>
      )}

      <Button
        onClick={pdfUrl ? handleRedownload : handleGenerate}
        disabled={sending || (!isAdmin && !pdfUrl && !creditsLoading && balance < (aiUsed ? 7 : 9))}
        className="w-full h-12 rounded-xl text-sm font-semibold gap-2"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {sending
            ? 'Downloading...'
            : pdfUrl
              ? 'Download CV (free — already generated)'
              : `Download PDF · ${aiUsed ? 7 : 9} credits${shouldWatermark ? ' · watermarked' : ''}`}
        </span>
      </Button>

      {/* Insufficient credits modal */}
      {showInsufficientModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowInsufficientModal(false); }}>
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
                <Coins className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Not Enough Credits</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You need {aiUsed ? 7 : 9} credits to download a CV. You currently have {balance}.
              </p>
            </div>
            <div className="bg-muted rounded-xl p-3 space-y-1 text-xs text-muted-foreground">
              <p>• Starter pack — R39 for 15 credits</p>
              <p>• Standard pack — R59 for 30 credits</p>
              <p>• Pro pack — R99 for 60 credits</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl"
                onClick={() => setShowInsufficientModal(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl gap-1.5"
                onClick={() => { setShowInsufficientModal(false); window.location.href = '/credits'; }}>
                <Coins className="w-4 h-4" /> Buy Credits
              </Button>
            </div>
          </div>
        </div>
      )}
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