import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Download, FileText, CheckCircle2, RefreshCw, Eye, List, Coins, AlertCircle } from 'lucide-react';
import CVTemplateRenderer from './CVTemplateRenderer';
import ATSScoreBadge from './ATSScoreBadge';
import { exportElementAsPDF } from '@/utils/cvExport';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';
import { useFeatureGates } from '@/hooks/useFeatureGates';

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

interface Props { data: CVData; onChange?: (d: CVData) => void; onGenerated?: (url: string) => void; isFree?: boolean; aiUsed?: boolean }

export default function CVStepReview({ data, onChange, onGenerated, isFree = false, aiUsed = false }: Props) {
  const { user } = useAuth();
  const { balance, loading: creditsLoading, deduct } = useCredits();
  const { gates, loading: gatesLoading } = useFeatureGates();
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
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
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  // A4 at 794px wide (96dpi, same width the real export renders at) is
  // ~1123px tall (297mm). Used below to slice the preview into visually
  // distinct pages instead of one continuous scrolling blob.
  const PAGE_HEIGHT = 1123;
  const [pageCount, setPageCount] = useState(1);

  // Measures the actual available width for the preview and computes the
  // zoom level from that, instead of a fixed 0.45 — otherwise, widening the
  // page around this component (e.g. the desktop split-screen work) does
  // nothing, since a hardcoded zoom never grows to use the extra space it
  // was just given. Capped at 1 so the CV never renders LARGER than true
  // print size just because a very wide screen happens to have the room.
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [previewZoom, setPreviewZoom] = useState(0.45);
  useEffect(() => {
    const el = previewAreaRef.current;
    if (!el) return;
    const measure = () => setPreviewZoom(Math.min(1, Math.max(0.3, el.clientWidth / 794)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Watches the hidden full-size export render (same node the real PDF
  // export captures) so the visible preview below can show the same
  // number of pages, with breaks in roughly the same places, as the
  // actual download — rather than one endless scrolling blob with no
  // indication of where page 1 ends and page 2 begins.
  //
  // This is a close approximation, not pixel-perfect: cvExport.ts computes
  // its own page breaks from jsPDF's point-based text measurement, which
  // doesn't exactly match the browser's CSS layout of the same content.
  // For genuinely identical break points, the export's line-wrapping math
  // would need to be replicated here — this gets the page COUNT and
  // roughly where each page ends right, which is what actually matters
  // for "does my CV run to 2 pages or 3."
  useEffect(() => {
    const el = exportRef.current;
    if (!el) return;
    const measure = () => setPageCount(Math.max(1, Math.ceil(el.scrollHeight / PAGE_HEIGHT)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [safeData]);

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
    // If AI summary was used (letter_usage, 20 credits already spent), only
    // deduct the remaining 70. Otherwise deduct the full 90 (cv_usage).
    const remainingCost = aiUsed ? 70 : 90;  // AI summary costs 20cr, so remaining = 90-20=70
    const ok = await deduct('cv_usage', fileName);
    if (!ok) {
      if (!isAdmin && balance < remainingCost) setShowInsufficientModal(true);
      return;
    }

    setSending(true);
    try {
      const pdfBlob = await exportElementAsPDF(exportRef.current, fileName, { ...safeData, watermark: shouldWatermark });

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
        <div className="space-y-3" ref={previewAreaRef}>
          <ATSScoreBadge data={safeData} />
          {/*
           * Each "page" below is a 794×1123px window (A4 at the same 96dpi
           * scale the real export renders at) showing one vertical slice of
           * the SAME continuously-flowing CV content — the classic
           * print-preview trick: render the full content once per page,
           * absolutely positioned and shifted up by that page's height, so
           * only the relevant slice is visible through the clipped window.
           * The zoom level is measured from this wrapper's own available
           * width rather than a fixed fraction, so it correctly grows to
           * fill whatever space this step actually has — otherwise, on a
           * wide desktop layout, the CV stays pinned at mobile-thumbnail
           * size no matter how much room is sitting empty next to it.
           * Capped at 1 (true print size) so it never renders LARGER than
           * an actual printed page just because a very wide screen has
           * room to spare.
           */}
          <div style={{ zoom: previewZoom }} className="space-y-3">
            {Array.from({ length: pageCount }).map((_, i) => (
              <div key={i}>
                {pageCount > 1 && (
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textAlign: 'center', margin: '0 0 6px' }}>
                    Page {i + 1} of {pageCount}
                  </p>
                )}
                <div
                  className="rounded-xl overflow-hidden border border-border bg-white shadow-sm"
                  style={{ width: '794px', height: `${PAGE_HEIGHT}px`, position: 'relative' }}
                >
                  <div style={{ position: 'absolute', top: `${-i * PAGE_HEIGHT}px`, left: 0 }}>
                    <CVTemplateRenderer data={safeData} forExport cvType={safeData.cvType} />
                  </div>
                  {/*
                   * This slicing technique doesn't know where a real page
                   * break should fall — unlike cvExport.ts, which checks
                   * each line/bullet against the remaining space before
                   * drawing it, this just crops at a fixed pixel height, so
                   * a line of text can end up cut cleanly in half right at
                   * the page boundary. That's a genuine approximation limit
                   * (getting this pixel-perfect would mean re-implementing
                   * cvExport.ts's own line-wrapping math in the browser),
                   * not a bug we can fully fix here. The fade plus the
                   * "Page N of Total" label above at least make it read as
                   * "continues on the next page" rather than "content is
                   * missing or the app is broken."
                   */}
                  {i < pageCount - 1 && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px',
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.95))',
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>
              </div>
            ))}
          </div>
          {pageCount > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              This CV will print as {pageCount} pages — page breaks shown here are approximate; the actual download paginates more precisely
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

      {/* Hidden full-size render used by exportElementAsPDF — added cv-export-root class */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px' }}>
        <div ref={exportRef} className="cv-export-root">
          <CVTemplateRenderer data={safeData} forExport cvType={safeData.cvType} />
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

      {/* Insufficient credits warning — ambient banner, kept number-free
          on purpose (same treatment as CoverLettersPage.tsx); the full
          numbers appear in the dedicated modal below once the user
          actually tries and hits the wall. */}
      {!isAdmin && !creditsLoading && balance < (aiUsed ? 70 : 90) && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Not enough credits</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              You don't have enough credits to generate a CV yet.
            </p>
          </div>
        </div>
      )}

      <Button
        onClick={pdfUrl ? handleRedownload : handleGenerate}
        disabled={sending || (!isAdmin && !pdfUrl && !creditsLoading && balance < (aiUsed ? 70 : 90))}
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
                You need {aiUsed ? 70 : 90} credits to download a CV. You currently have {balance}.
              </p>
            </div>
            <div className="bg-muted rounded-xl p-3 space-y-1 text-xs text-muted-foreground">
              <p>• Starter pack — R39 for 150 credits</p>
              <p>• Standard pack — R59 for 300 credits</p>
              <p>• Business pack — R199 for 2,000 credits</p>
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
