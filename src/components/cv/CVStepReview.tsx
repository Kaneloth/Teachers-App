import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Download, FileText, CheckCircle2, RefreshCw, Eye, List, Coins, Loader2 } from 'lucide-react';
import ATSScoreBadge from './ATSScoreBadge';
import { useCVPdfPreview } from './useCVPdfPreview';
import CVPreviewPageGuard from './CVPreviewPageGuard';
import { exportElementAsPDF } from '@/utils/cvExport';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import { usePricing, PurchaseModal } from '@/components/credits/CreditBalance';
import InsufficientCreditsModal from '@/components/credits/InsufficientCreditsModal';

// Builds correct public storage URL — getPublicUrl() sometimes omits /public/
function publicStorageUrl(bucket: string, path: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

// Language entries are meant to be plain strings (e.g. "English"), but the
// AI CV-import flow can produce structured proficiency objects instead —
// { language: 'English', read: true, speak: true, write: true } — which
// React refuses to render directly (React error #31: "Objects are not
// valid as a React child"), blanking the whole Preview step. This
// normalizes any entry to a safe string before it ever reaches
// CVTemplateRenderer, so the crash can't happen regardless of what that
// component does internally or where else a bad entry might come from.
function normalizeLanguage(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const obj = entry as { language?: string; read?: boolean; speak?: boolean; write?: boolean };
    const skillsList = [obj.read && 'read', obj.speak && 'speak', obj.write && 'write']
      .filter(Boolean)
      .join(', ');
    if (obj.language) return skillsList ? `${obj.language} (${skillsList})` : obj.language;
  }
  return String(entry);
}

interface CVData {
  personal: { full_name?: string; email?: string; photo_url?: string; phone?: string; address?: string; bio?: string; job_title?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects?: string[]; soft_skills?: string[]; languages?: string[] };
  references?: { name: string; title: string; organisation: string; phone: string; email: string; relationship: string }[];
  custom_sections?: { title: string; type: 'text' | 'bullets' | 'table'; content?: string; columns?: string[]; rows?: string[][] }[];
  template: string;
  cvType?: 'educator' | 'general';
  hidden_sections?: string[];
}

interface Props { data: CVData; onChange?: (d: CVData) => void; onGenerated?: (url: string) => void; isFree?: boolean; onGoToSummary?: () => void }

export default function CVStepReview({ data, onChange, onGenerated, isFree = false, onGoToSummary }: Props) {
  const { user } = useAuth();
  const { deduct, insufficientCredits, dismissInsufficientCredits } = useCredits();
  const pricing = usePricing();
  // Download cost (cvCost) no longer needs reading out here — there's no
  // more pre-emptive "balance < cvCost" check or ambient low-balance
  // banner (see the Download button below). The server is still the one
  // true source for the actual charge: deduct-credits.js charges the full
  // admin-configured cv_usage cost every time, independent of any AI
  // actions spent earlier in the wizard.
  const { gates, loading: gatesLoading } = useFeatureGates();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [view, setView] = useState<'preview' | 'summary'>('preview');

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
  // Deliberately NOT gated by cv_watermark — this is a separate, always-on
  // protection against someone grabbing a full-resolution copy of the CV
  // straight from the free preview (e.g. a mobile screenshot of the whole
  // page). Whether the admin wants a visible watermark on paid downloads
  // is a different decision from whether an unpaid preview should render
  // at full fidelity, so this stays independent of that gate.
  const previewResolutionRestricted = !hasPurchased && !isAdmin;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Existing stored PDF — re-download this for free without generating a new one
  const existingPdfUrl = (user?.user_metadata?.last_cv_pdf_url as string | undefined) ?? null;

  const { personal, education, experience, skills } = data;

  // ── Hide/show sections — Personal, Education, and Experience are always
  // shown (they're not toggleable at all, by design); Skills, References,
  // and each Custom Section can be individually hidden. This never deletes
  // the underlying data — hidden_sections is purely a display filter that
  // both CVTemplateRenderer.tsx and cvExport.ts already respect, so toggling
  // something back on later restores it exactly as it was.
  const hiddenSet = new Set(data.hidden_sections || []);
  const isVisible = (key: string) => !hiddenSet.has(key);
  const toggleSection = (key: string, visible: boolean) => {
    if (!onChange) return;
    const next = new Set(hiddenSet);
    if (visible) next.delete(key); else next.add(key);
    onChange({ ...data, hidden_sections: Array.from(next) });
  };

  // Sanitized copy — see normalizeLanguage above. Used for both the visible
  // preview and the hidden export render, so a malformed languages entry
  // can never crash either one.
  const safeData: CVData = {
    ...data,
    skills: {
      ...skills,
      languages: (skills.languages || []).map(normalizeLanguage),
    },
  };

  // Renders the real, downloadable PDF (exportElementAsPDF — the exact
  // same code path the Download button below calls) and rasterizes its
  // actual pages, instead of approximating page breaks from this
  // component's own CSS layout the way the old cvPagination.ts-based
  // version did. That approximation could snap breaks to safe line
  // boundaries, but it still couldn't match cvExport.ts's own, completely
  // independent jsPDF-based layout — confirmed by a CV that downloaded as
  // 2 pages but previewed as 3, with different content split between
  // them. This way the preview literally IS the download, just rasterized
  // to images here instead of saved to disk. Only generates while the
  // Preview tab is actually showing (`enabled: view === 'preview'`) so
  // switching to Summary doesn't keep regenerating a PDF nobody's looking
  // at. Passes the exact same `shouldWatermark` flag handleGenerate below
  // passes to the real export, so the preview shows (or doesn't show) the
  // watermark the actual download will carry right now.
  // Low-res (0.75) for anyone who hasn't paid and isn't an admin — still
  // perfectly legible at normal on-screen viewing size, but a screenshot
  // or saved copy of it is visibly soft/pixelated if blown up or printed,
  // rather than a crisp, directly reusable copy of the finished CV.
  // Purchasers/admins get the sharper 1.5 since there's no leak risk once
  // they can already download the real thing.
  const { pages, loading: previewLoading, error: previewError } = useCVPdfPreview(
    { ...safeData, watermark: shouldWatermark },
    view === 'preview',
    previewResolutionRestricted ? 0.75 : 1.5,
  );

  const fileName = `CV_${(personal.full_name || 'Educator').replace(/\s+/g, '_')}.pdf`;

  // A new download is locked until the CV has a Professional Summary.
  // Re-downloading an already-generated PDF (pdfUrl) is free and unaffected.
  const summaryMissing = !(personal.bio || '').trim();
  const downloadLocked = summaryMissing && !pdfUrl;

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
    // ── Credit check ─────────────────────────────────────────────────────
    // Server-side deduct-credits.js reads the real admin-configured cost
    // from credit_costs directly — nothing to compute here anymore, the
    // hook surfaces insufficientCredits automatically on failure.
    if (summaryMissing) { toast.error('Add a Professional Summary first.'); return; }
    const ok = await deduct('cv_usage', fileName, { has_summary: !summaryMissing });
    if (!ok) return; // insufficientCredits is now set automatically by the hook if that was the cause

    setSending(true);
    try {
      // exportElementAsPDF's first argument is unused by the function
      // (confirmed from its source — everything it draws comes from the
      // cvData argument), so there's no need for a hidden full-size DOM
      // render just to have something to pass here.
      const pdfBlob = await exportElementAsPDF(document.body, fileName, { ...safeData, watermark: shouldWatermark });

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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex bg-muted rounded-xl p-1 gap-1">
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
        <div className="space-y-3">
          <ATSScoreBadge data={safeData} />
          {/*
           * Each image below is one ACTUAL page of the real generated PDF
           * (same exportElementAsPDF code path the Download button calls),
           * rasterized by useCVPdfPreview — not a DOM approximation of it.
           * That guarantees the page count and content distribution shown
           * here match what downloading right now will actually produce.
           */}
          {pages.length === 0 && previewLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-xs">Rendering preview…</p>
            </div>
          )}
          {previewError && pages.length === 0 && (
            <p className="text-xs text-destructive text-center py-16">{previewError}</p>
          )}
          <div className="space-y-3 mx-auto" style={{ maxWidth: '480px' }}>
            {pages.map((page, i) => (
              <div key={i}>
                {pages.length > 1 && (
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textAlign: 'center', margin: '0 0 6px' }}>
                    {page.isReferences ? 'References' : `Page ${i + 1} of ${pages.length}`}
                  </p>
                )}
                <CVPreviewPageGuard
                  src={page.dataUrl}
                  alt={page.isReferences ? 'References page' : `Page ${i + 1}`}
                  className="w-full rounded-xl overflow-hidden border border-border bg-white shadow-sm block"
                />
              </div>
            ))}
          </div>
          {previewLoading && pages.length > 0 && (
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Updating preview…
            </p>
          )}
          {!previewLoading && pages.length > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              This CV will print as {pages.length} pages
            </p>
          )}
          {!previewLoading && pages.length > 0 && (
            <p className="text-[11px] text-muted-foreground text-center">
              The "PREVIEW" watermark above is just for browsing — it won't appear in your downloaded PDF.
            </p>
          )}
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
          <SummaryCard title="Skills & Languages" toggle={{ visible: isVisible('skills'), onChange: v => toggleSection('skills', v) }}>
            <div className="flex flex-wrap gap-1">
              {[...(skills.subjects || []), ...(skills.soft_skills || [])].map(s => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
            {skills.languages?.length ? (
              <p className="text-sm text-muted-foreground mt-1">Languages: {skills.languages.map(normalizeLanguage).join(', ')}</p>
            ) : null}
          </SummaryCard>
          {data.references?.filter(r => r.name).length ? (
            <SummaryCard title="References" toggle={{ visible: isVisible('references'), onChange: v => toggleSection('references', v) }}>
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
          {(data.custom_sections || []).filter(s => s.title).map((s, i) => (
            <SummaryCard key={i} title={s.title} toggle={{ visible: isVisible(`custom:${s.title}`), onChange: v => toggleSection(`custom:${s.title}`, v) }}>
              <p className="text-xs text-muted-foreground">
                {s.type === 'table' ? `${(s.rows || []).length} row(s)` : (s.content || '').split('\n').filter(Boolean).length + ' line(s)'}
              </p>
            </SummaryCard>
          ))}
        </div>
      )}


      {/* No ambient "not enough credits" banner anymore — the button stays
          live and clickable regardless of balance. A short-balance user
          clicks Download like anyone else; handleGenerate's deduct() call
          fails server-side (402), the hook sets insufficientCredits, and
          the InsufficientCreditsModal below appears with its own "Top Up
          Credits" button straight into PurchaseModal — one clear moment
          with a direct next step, instead of a passive warning the user
          has to notice and act on themselves before they even try. */}
      {downloadLocked && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <span className="flex-1">Add a Professional Summary first — it's the first thing employers read.</span>
          {onGoToSummary && (
            <button type="button" onClick={onGoToSummary} className="font-semibold underline underline-offset-2 shrink-0">Add it now</button>
          )}
        </div>
      )}
      <Button
        onClick={pdfUrl ? handleRedownload : handleGenerate}
        disabled={sending || downloadLocked}
        title={downloadLocked ? 'Add a Professional Summary first' : undefined}
        className="w-full h-12 rounded-xl text-sm font-semibold gap-2"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {sending
            ? 'Downloading...'
            : pdfUrl
              ? 'Download CV (free — already generated)'
              : `Download PDF${shouldWatermark ? ' · watermarked' : ''}`}
        </span>
      </Button>

      {/* Insufficient credits modal — appears only after a failed attempt;
          specific numbers are useful here rather than intimidating. */}
      {insufficientCredits && (
        <InsufficientCreditsModal
          needed={insufficientCredits.needed}
          have={insufficientCredits.have}
          message={insufficientCredits.message}
          onDismiss={dismissInsufficientCredits}
          onTopUp={() => { dismissInsufficientCredits(); setShowPurchaseModal(true); }}
        />
      )}

      {showPurchaseModal && (
        <PurchaseModal onClose={() => setShowPurchaseModal(false)} pricing={pricing} />
      )}
    </div>
  );
}

function SummaryCard({ title, children, toggle }: { title: string; children: React.ReactNode; toggle?: { visible: boolean; onChange: (v: boolean) => void } }) {
  return (
    <div className={`bg-card rounded-2xl border p-4 space-y-2 transition-opacity ${toggle && !toggle.visible ? 'border-border opacity-60' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        {toggle && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">{toggle.visible ? 'On CV' : 'Hidden'}</span>
            <Switch checked={toggle.visible} onCheckedChange={toggle.onChange} className="scale-75" />
          </div>
        )}
      </div>
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
