import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowLeft, FileText, Save, Clock, Upload, Loader2, RotateCcw, Coins, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';
import CreditBalance from '@/components/credits/CreditBalance';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import CVStepPersonal from '@/components/cv/CVStepPersonal';
import CVStepEducation from '@/components/cv/CVStepEducation';
import CVStepExperience from '@/components/cv/CVStepExperience';
import CVStepSkills from '@/components/cv/CVStepSkills';
import CVStepReferences from '@/components/cv/CVStepReferences';
import type { RefEntry } from '@/components/cv/CVStepReferences';
import CVStepExtras from '@/components/cv/CVStepExtras';
import type { CustomSection } from '@/components/cv/CVStepExtras';
import CVStepTemplate from '@/components/cv/CVStepTemplate';
import CVStepReview from '@/components/cv/CVStepReview';
import LastCVBanner from '@/components/cv/LastCVBanner';

// Kept for backward compatibility with saved drafts / last CV data
export type CVType = 'educator' | 'general';

const STEPS = ['Personal', 'Education', 'Experience', 'Skills', 'Extras', 'References', 'Template', 'Review'];

const DRAFT_KEY   = 'crosssa_cv_draft';
const LAST_CV_KEY = 'crosssa_last_cv';

interface CVData {
  cvType: CVType;
  personal: {
    full_name: string; email: string; phone: string; address: string; bio: string;
    photo_url?: string; id_number?: string;
    gender?: string; population_group?: string; citizenship?: string; drivers_licence?: string[];
  };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects: string[]; soft_skills: string[]; languages: string[] };
  references: RefEntry[];
  custom_sections: CustomSection[];
  template: string;
  job_description?: string;
}

function defaultData(): CVData {
  return {
    cvType: 'general',
    personal: { full_name: '', email: '', phone: '', address: '', bio: '', id_number: '', gender: '', population_group: '', citizenship: '', drivers_licence: [] },
    education: [{ institution: '', qualification: '', year: '' }],
    experience: [{ school: '', role: '', from: '', to: '', description: '' }],
    skills: { subjects: [], soft_skills: [], languages: [] },
    references: [
      { name: '', title: '', organisation: '', phone: '', email: '', relationship: '' },
      { name: '', title: '', organisation: '', phone: '', email: '', relationship: '' },
    ],
    custom_sections: [],
    template: 'classic',
    job_description: '',
  };
}

/* ── Numbered stepper ───────────────────────────────────────── */
function StepStepper({ steps, current, onSelect }: { steps: string[]; current: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex items-center overflow-x-auto scrollbar-hide gap-0 pb-1">
      {steps.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center shrink-0">
            <button onClick={() => onSelect(i)} className="flex items-center gap-1.5 shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                active ? 'bg-primary border-primary text-white'
                       : done  ? 'bg-primary/20 border-primary/40 text-primary'
                               : 'bg-transparent border-border text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              {active && <span className="text-xs font-semibold text-primary whitespace-nowrap">{label}</span>}
            </button>
            {i < steps.length - 1 && (
              <div className={`w-6 h-px mx-1 shrink-0 ${i < current ? 'bg-primary/40' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Upload / AI Zone ───────────────────────────────────────── */
function CVUploadZone({ onDataExtracted, deduct, onAiUsed, balance, creditsLoading, onJobDesc }: {
  onDataExtracted: (data: CVData) => void;
  deduct: (type: 'cv_usage' | 'letter_usage', refId?: string) => Promise<boolean>;
  onAiUsed: () => void;
  balance: number;
  creditsLoading: boolean;
  onJobDesc?: (jd: string) => void;
}) {
  const [uploading,     setUploading]     = useState(false);
  const [dragActive,    setDragActive]    = useState(false);
  const [freeText,      setFreeText]      = useState('');
  const [activeTab,     setActiveTab]     = useState<'upload' | 'freetext'>('upload');
  const [jobDesc,       setJobDesc]       = useState('');
  const [showJobDesc,   setShowJobDesc]   = useState(false);

  const mergeAndEmit = (parsed: Partial<CVData>, base: CVData) => {
    if (parsed.education?.length)        base.education       = parsed.education;
    if (parsed.experience?.length)       base.experience      = parsed.experience;
    if (parsed.skills)                   base.skills          = { ...base.skills, ...parsed.skills };
    if (parsed.references?.length)       base.references      = parsed.references;
    if (parsed.custom_sections?.length)  base.custom_sections = parsed.custom_sections;
    if (parsed.personal?.bio)            base.personal        = { ...base.personal, bio: parsed.personal.bio };
    onDataExtracted(base);
  };

  const processFile = async (file: File) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type))   { toast.error('Please upload a PDF or DOCX file'); return; }
    if (file.size > 10 * 1024 * 1024)  { toast.error('File too large (max 10MB)');         return; }

    // Deduct 1 credit before calling AI — prevents free abuse of CV import
    const ok = await deduct('letter_usage', `cv_import_${Date.now()}`);
    if (!ok) return; // insufficient credits — toast already shown

    setUploading(true);
    const formData = new FormData();
    formData.append('cvFile', file);
    formData.append('cvType', 'general');
    if (jobDesc.trim()) formData.append('jobDescription', jobDesc.trim());
    try {
      const res    = await fetch('/.netlify/functions/enhance-cv', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to process CV');
      mergeAndEmit(result.data, defaultData());
      onAiUsed(); // AI used — reduces CV download cost by 1
      toast.success('CV imported! 1 credit used. Review and complete your details.');
    } catch (err: any) {
      toast.error(err.message || 'AI processing failed. Please try again.');
    } finally { setUploading(false); }
  };

  const processFreeText = async () => {
    if (!freeText.trim()) { toast.error('Please type something about yourself first.'); return; }

    // Deduct 1 credit before calling AI
    const ok = await deduct('letter_usage', `cv_freetext_${Date.now()}`);
    if (!ok) return; // insufficient credits — toast already shown

    setUploading(true);
    try {
      const res    = await fetch('/.netlify/functions/enhance-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_freetext', text: freeText, cvType: 'general', jobDescription: jobDesc.trim() || undefined }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'AI processing failed');
      mergeAndEmit(result.data, defaultData());
      onAiUsed(); // AI used — reduces CV download cost by 1
      toast.success('AI has structured your info! 1 credit used. Review and complete your details.');
    } catch (err: any) {
      toast.error(err.message || 'AI processing failed. Please try again.');
    } finally { setUploading(false); }
  };

  return (
    <div className="px-4 pb-4">
      <p className="text-xs text-muted-foreground mb-3">
        Speed up your CV — import an existing CV or describe yourself and our AI will fill in the sections for you.{' '}
        <span className="font-medium text-primary">1 credit per AI action.</span>
      </p>
      {/* Optional job description */}
      <div className="mb-3">
        <button
          onClick={() => setShowJobDesc(v => !v)}
          className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:text-primary/80 transition-colors mb-2"
        >
          <Briefcase className="w-3.5 h-3.5" />
          {showJobDesc ? 'Hide job description' : '+ Tailor CV to a job description (optional)'}
        </button>
        {showJobDesc && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Paste the job description below. AI will tailor your professional summary to match the role's keywords — without exaggerating your qualifications.
            </p>
            <textarea
              value={jobDesc}
              onChange={e => {
                const val = e.target.value;
                if (val.length > 3000) {
                  toast.error('Job description is too long. Please keep it under 3,000 characters (currently ' + val.length + '). Try pasting only the key requirements section.');
                  return;
                }
                setJobDesc(val);
                onJobDesc?.(val);
              }}
              placeholder="Paste the job posting or description here..."
              rows={5}
              className={`w-full rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none ${jobDesc.length > 2800 ? 'border-amber-400' : 'border-input'}`}
            />
            <p className={`text-xs text-right mt-1 ${jobDesc.length > 2800 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
              {jobDesc.length} / 3,000 characters{jobDesc.length > 2800 ? ' — approaching limit' : ''}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-xl mb-3">
        <button onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all ${activeTab === 'upload' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
          <Upload className="w-3.5 h-3.5" /> Upload CV
        </button>
        <button onClick={() => setActiveTab('freetext')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all ${activeTab === 'freetext' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
          <Loader2 className="w-3.5 h-3.5" /> Tell AI About You
        </button>
      </div>

      {activeTab === 'upload' && (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => { e.preventDefault(); setDragActive(false); if (balance < 1) { toast.error('Not enough credits to use AI import.'); return; } const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
          onClick={() => { if (balance < 1) { toast.error('Not enough credits to use AI import.'); return; } document.getElementById('cv-upload-input')?.click(); }}
        >
          <input id="cv-upload-input" type="file" accept=".pdf,.doc,.docx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} disabled={uploading} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI is restructuring your CV…</p>
              <p className="text-xs text-muted-foreground">Identifying sections, skills &amp; experience</p>
            </div>
          ) : (
            <>
              <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Drop your CV here or tap to browse</p>
              <p className="text-xs text-muted-foreground mt-1">PDF or DOCX · AI will intelligently restructure all sections</p>
            </>
          )}
        </div>
      )}

      {activeTab === 'freetext' && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Tell us about yourself</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Write anything — your job history, qualifications, skills, achievements. Even unstructured notes work. Our AI will organise everything into the right CV sections.
            </p>
            <textarea
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              rows={7}
              placeholder="e.g. I have 8 years experience in accounting, mainly at KPMG where I worked as a senior auditor from 2016 to 2022. I have a BCom from UCT. I am skilled in Excel, SAP and team leadership..."
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              disabled={uploading}
            />
          </div>
          <button onClick={processFreeText} disabled={uploading || !freeText.trim() || (!creditsLoading && balance < 1)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 hover:bg-primary/90">
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> AI is structuring your info…</>
              : <><Loader2 className="w-4 h-4" /> Structure with AI · 1 credit</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function CVBuilderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { balance, loading: creditsLoading, deduct } = useCredits();

  const [initialState] = useState(() => {
    const lastMeta: Record<string, unknown> = (() => {
      try { return JSON.parse(localStorage.getItem(LAST_CV_KEY) ?? '{}'); } catch { return {}; }
    })();
    const draft: { cvType: CVType; data: CVData; step: number; savedAt: string } | null = (() => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        return d?.data ? d : null;
      } catch { return null; }
    })();
    return { lastMeta, draft, showBuilder: draft ? true : !lastMeta.last_cv_data };
  });

  const [freshMeta, setFreshMeta] = useState(initialState.lastMeta);
  const lastCVData                = freshMeta.last_cv_data;
  const lastCVPdfUrl              = freshMeta.last_cv_pdf_url as string | undefined;
  const lastCVGeneratedAt         = freshMeta.last_cv_generated_at as string | undefined;

  const isAdmin = !!(user?.user_metadata?.is_admin);

  // Has this user ever bought credits (one-off pack or monthly Pro grant)?
  // If yes → all 17 templates unlock permanently, regardless of current
  // balance. If no → only the free Classic template is available.
  const [hasPurchased,      setHasPurchased]      = useState(false);
  const [templatesUnlocked, setTemplatesUnlocked] = useState(false);
  const [isEducator,         setIsEducator]         = useState(false);

  useEffect(() => {
    if (!user) return;
    // Check credit purchase history
    supabase
      .from('credit_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('type', ['purchase', 'monthly_pro'])
      .then(({ count }) => setHasPurchased((count ?? 0) > 0));
    // Check admin-granted template unlock
    supabase
      .from('educators')
      .select('templates_unlocked, profile_type')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setTemplatesUnlocked(!!(data?.templates_unlocked));
        setIsEducator(!data || data.profile_type !== 'general');
      });
  }, [user]);

  // isFree gates the template picker (CVStepTemplate): true = only Classic
  // template available. Admins, users who have purchased, or users with
  // admin-granted template access get all templates unlocked.
  const isFree = !hasPurchased && !isAdmin && !templatesUnlocked;

  const [showBuilder,      setShowBuilder]      = useState(initialState.showBuilder);
  const [step,             setStep]             = useState(initialState.draft?.step ?? 0);
  const [data,             setData]             = useState<CVData>(initialState.draft?.data ?? defaultData());
  const [draftSavedAt,     setDraftSavedAt]     = useState<string | null>(initialState.draft?.savedAt ?? null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [aiUsed,           setAiUsed]           = useState(false); // AI summary used — reduces CV download cost

  // Auto‑save draft
  useEffect(() => {
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ cvType: 'general', data, step, savedAt }));
      setDraftSavedAt(savedAt);
    } catch {}
  }, [data, step]);

  // Background sync from user metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      const m = (u?.user_metadata ?? {}) as Record<string, unknown>;
      if (m.last_cv_data) {
        try { localStorage.setItem(LAST_CV_KEY, JSON.stringify(m)); } catch {}
        setFreshMeta(m);
        if (!initialState.draft && !initialState.lastMeta.last_cv_data) setShowBuilder(false);
      }
    });
  }, []);

  // Pre-fill personal info from profile on first load
  useEffect(() => {
    if (!user || initialState.draft) return;
    supabase.from('educators').select('full_name, phone, bio, town, current_province').eq('user_id', user.id).maybeSingle()
      .then(({ data: profile }) => {
        const location = [profile?.town, profile?.current_province].filter(Boolean).join(', ');
        setData(prev => ({
          ...prev,
          personal: {
            ...prev.personal,
            full_name: prev.personal.full_name || profile?.full_name || user.user_metadata?.full_name || '',
            email:     prev.personal.email     || user.email || '',
            phone:     prev.personal.phone     || profile?.phone || user.user_metadata?.phone || '',
            address:   prev.personal.address   || location || '',
            bio:       prev.personal.bio       || profile?.bio || '',
          },
        }));
      });
  }, [user]);

  const prev = () => setStep(s => Math.max(0, s - 1));
  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));

  const handleReset = () => {
    setData(defaultData());
    setStep(0);
    setDraftSavedAt(null);
    setShowResetConfirm(false);
    setAiUsed(false);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    toast.success('CV cleared — start fresh!');
  };

  const handleBack = () => {
    if (lastCVData) { setShowBuilder(false); } else { navigate(-1); }
  };

  const handleEdit = () => {
    if (!lastCVData) return;
    const saved = lastCVData as CVData;
    setData(saved);
    setStep(0);
    setShowBuilder(true);
    const savedAt = new Date().toISOString();
    setDraftSavedAt(savedAt);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ cvType: 'general', data: saved, step: 0, savedAt })); } catch {}
  };

  const handleCVGenerated = (pdfUrl: string) => {
    const now = new Date().toISOString();
    const newMeta = { ...freshMeta, last_cv_pdf_url: pdfUrl, last_cv_data: data, last_cv_generated_at: now, cv_count: ((freshMeta.cv_count as number) ?? 0) + 1 };
    try { localStorage.setItem(LAST_CV_KEY, JSON.stringify(newMeta)); } catch {}
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setFreshMeta(newMeta);
    setDraftSavedAt(null);
    setStep(0);
    setShowBuilder(false);

    // Also persist to Supabase auth user_metadata — CoverLettersPage.tsx
    // reads last_cv_data from user_metadata (not localStorage) to give the
    // AI cover letter generator real CV context (education, experience,
    // skills). Without this call, that data only ever lived in
    // localStorage, so the cover letter AI never actually had access to
    // any user's real CV data — explaining generic letters that never
    // named a real qualification regardless of prompt wording.
    if (user) {
      // Save both last_cv_data AND last_cv_pdf_url to user_metadata so the
      // PDF re-download link and CV context work on any device the user signs
      // into — not just the one they generated the CV on.
      supabase.auth.updateUser({
        data: {
          last_cv_data:          data,
          last_cv_pdf_url:       pdfUrl || null,
          last_cv_generated_at:  now,
        }
      }).catch((err) => {
        console.error('[CVBuilderPage] Failed to save CV metadata to user_metadata:', err);
      });
    }
  };

  const handleAIDataExtracted = (newData: CVData) => {
    setData(prev => ({ ...newData, personal: prev.personal }));
    setStep(0);
    setShowBuilder(true);
    const savedAt = new Date().toISOString();
    setDraftSavedAt(savedAt);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ cvType: 'general', data: { ...newData, personal: data.personal }, step: 0, savedAt })); } catch {}
  };

  // Last CV banner
  if (!showBuilder && lastCVData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 px-4 pt-4 pb-5">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">CV Builder</h1>
          <div className="ml-auto">
            {!isEducator || hasPurchased ? <CreditBalance /> : (
              <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-semibold">
                <Coins className="w-3 h-3" />
                {creditsLoading ? '…' : balance}
              </div>
            )}
          </div>
        </div>
        <div className="px-4">
          <LastCVBanner
            lastCV={{ pdf_url: lastCVPdfUrl, generated_at: lastCVGeneratedAt, cv_data: lastCVData }}
            onBuildNew={() => setShowBuilder(true)}
            onEdit={handleEdit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 px-4 pt-4 pb-1">
        <button onClick={handleBack} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <FileText className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">CV Builder</h1>
        <div className="ml-auto">
          {!isEducator || hasPurchased ? <CreditBalance /> : (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-semibold">
              <Coins className="w-3 h-3" />
              {creditsLoading ? '…' : balance}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 pt-1">
        <p className="text-sm text-muted-foreground">Build a professional CV in minutes</p>
      </div>

      {step === 0 && <CVUploadZone onDataExtracted={handleAIDataExtracted} deduct={deduct} onAiUsed={() => setAiUsed(true)} balance={balance} creditsLoading={creditsLoading} onJobDesc={jd => setData(d => ({ ...d, job_description: jd }))} />}

      <motion.div key="builder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
        <div className="px-4 pb-2">
          <StepStepper steps={STEPS} current={step} onSelect={setStep} />
        </div>

        {draftSavedAt && (
          <p className="flex items-center gap-1 px-4 pb-3 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            Draft saved at {new Date(draftSavedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        <div className="px-4">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              {step === 0 && <CVStepPersonal data={data.personal} fullCvData={data} onChange={personal => setData(d => ({ ...d, personal }))} onAiUsed={() => setAiUsed(true)} jobDescription={data.job_description} />}
              {step === 1 && <CVStepEducation data={data.education} onChange={education => setData(d => ({ ...d, education }))} />}
              {step === 2 && <CVStepExperience data={data.experience} onChange={experience => setData(d => ({ ...d, experience }))} />}
              {step === 3 && <CVStepSkills data={data.skills} onChange={skills => setData(d => ({ ...d, skills }))} />}
              {step === 4 && <CVStepExtras data={data.custom_sections} onChange={custom_sections => setData(d => ({ ...d, custom_sections }))} />}
              {step === 5 && <CVStepReferences data={data.references} onChange={references => setData(d => ({ ...d, references }))} />}
              {step === 6 && <CVStepTemplate selected={data.template} onChange={template => setData(d => ({ ...d, template }))} isFree={isFree} />}
              {step === 7 && <CVStepReview data={data} onGenerated={handleCVGenerated} isFree={isFree} aiUsed={aiUsed} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex gap-3 px-4 pt-4 pb-2">
          {step > 0 && (
            <Button variant="outline" onClick={prev} className="flex-1 rounded-xl gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 && (
            <Button onClick={next} className="flex-1 rounded-xl gap-2">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="px-4 pb-2 pt-1">
          <Button variant="ghost" onClick={() => navigate(-1)} className="w-full rounded-xl gap-2 text-muted-foreground text-sm">
            <Save className="w-4 h-4" /> Save &amp; Exit — continue later
          </Button>
        </div>

        <div className="px-4 pb-6">
          {!showResetConfirm ? (
            <button onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors py-1">
              <RotateCcw className="w-3 h-3" /> Reset CV &amp; clear all fields
            </button>
          ) : (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 space-y-2">
              <p className="text-xs text-center text-destructive font-medium">This will clear all your CV data. Are you sure?</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)} className="flex-1 rounded-lg text-xs h-8">Cancel</Button>
                <Button variant="destructive" size="sm" onClick={handleReset} className="flex-1 rounded-lg text-xs h-8 gap-1">
                  <RotateCcw className="w-3 h-3" /> Yes, clear all
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

    </div>
  );
}
