import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowLeft, FileText, GraduationCap, Briefcase, Save, Clock, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
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

export type CVType = 'educator' | 'general';

const STEPS = ['Personal', 'Education', 'Experience', 'Skills', 'References', 'Extras', 'Template', 'Review'];

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
}

function defaultData(cvType: CVType): CVData {
  return {
    cvType,
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
  };
}

/* ── CV type selector ───────────────────────────────────────── */
function CVTypeSelector({ onSelect }: { onSelect: (t: CVType) => void }) {
  return (
    <div className="px-4 pb-6">
      <p className="text-sm text-muted-foreground mb-5">What kind of CV would you like to build?</p>
      <div className="space-y-3">
        <button
          onClick={() => onSelect('educator')}
          className="w-full flex items-start gap-4 bg-card rounded-2xl border border-border px-4 py-4 hover:border-primary hover:shadow-sm transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Educator CV</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Tailored for teachers — includes subjects taught, school history, SACE details, and education‑specific templates.
            </p>
          </div>
        </button>

        <button
          onClick={() => onSelect('general')}
          className="w-full flex items-start gap-4 bg-card rounded-2xl border border-border px-4 py-4 hover:border-primary hover:shadow-sm transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">General CV</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              For any industry or role — fully editable personal details, generic work experience, and free‑form skills.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

/* ── Numbered stepper ───────────────────────────────────────── */
function StepStepper({ steps, current, onSelect }: { steps: string[]; current: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex items-center overflow-x-auto scrollbar-hide gap-0 pb-1">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center shrink-0">
            <button onClick={() => onSelect(i)} className="flex items-center gap-1.5 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                  active
                    ? 'bg-primary border-primary text-white'
                    : done
                    ? 'bg-primary/20 border-primary/40 text-primary'
                    : 'bg-transparent border-border text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              {active && (
                <span className="text-xs font-semibold text-primary whitespace-nowrap">{label}</span>
              )}
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

/* ── Upload CV Component (AI never touches personal info) ── */
function CVUploadZone({ onDataExtracted, cvType }: { onDataExtracted: (data: CVData) => void; cvType: CVType }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'freetext'>('upload');

  /** Merge AI-parsed data into a fresh default — never overwrite personal info */
  const mergeAndEmit = (parsed: Partial<CVData>, newData: CVData) => {
    if (parsed.education?.length)       newData.education       = parsed.education;
    if (parsed.experience?.length)      newData.experience      = parsed.experience;
    if (parsed.skills)                  newData.skills          = { ...newData.skills, ...parsed.skills };
    if (parsed.references?.length)      newData.references      = parsed.references;
    if (parsed.custom_sections?.length) newData.custom_sections = parsed.custom_sections;
    // Let the AI-generated bio populate the summary field
    if (parsed.personal?.bio)           newData.personal        = { ...newData.personal, bio: parsed.personal.bio };
    onDataExtracted(newData);
  };

  const processFile = async (file: File) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) { toast.error('Please upload a PDF or DOCX file'); return; }
    if (file.size > 10 * 1024 * 1024)      { toast.error('File too large (max 10MB)');         return; }

    setUploading(true);
    const formData = new FormData();
    formData.append('cvFile', file);
    formData.append('cvType', cvType);

    try {
      const res    = await fetch('/.netlify/functions/enhance-cv', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to process CV');
      mergeAndEmit(result.data, defaultData(cvType));
      toast.success('CV imported and restructured by AI!');
    } catch (err: any) {
      toast.error(err.message || 'AI processing failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const processFreeText = async () => {
    if (!freeText.trim()) { toast.error('Please type something about yourself first.'); return; }
    setUploading(true);
    try {
      const res    = await fetch('/.netlify/functions/enhance-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_freetext', text: freeText, cvType }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'AI processing failed');
      mergeAndEmit(result.data, defaultData(cvType));
      toast.success('AI has structured your information into CV sections!');
    } catch (err: any) {
      toast.error(err.message || 'AI processing failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  return (
    <div className="px-4 pb-4">
      <p className="text-xs text-muted-foreground mb-3">
        Speed up your CV — import an existing CV or describe yourself and our AI will fill in the sections for you.
      </p>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl mb-3">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all ${activeTab === 'upload' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload CV
        </button>
        <button
          onClick={() => setActiveTab('freetext')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all ${activeTab === 'freetext' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
        >
          <Loader2 className="w-3.5 h-3.5" /> Tell AI About You
        </button>
      </div>

      {/* Upload tab */}
      {activeTab === 'upload' && (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
            dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('cv-upload-input')?.click()}
        >
          <input id="cv-upload-input" type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileInput} disabled={uploading} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI is restructuring your CV…</p>
              <p className="text-xs text-muted-foreground">Identifying sections, skills & experience</p>
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

      {/* Free-text tab */}
      {activeTab === 'freetext' && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Tell us about yourself</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Write anything — your job history, qualifications, skills, achievements.
              Even unstructured notes work. Our AI will extract and organise everything into the right CV sections.
            </p>
            <textarea
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              rows={7}
              placeholder={cvType === 'educator'
                ? 'e.g. I have been teaching Maths and Science at Soweto High School since 2015. Before that I worked at Pretoria Primary for 4 years teaching Grade 4-6. I have a B.Ed from UNISA completed in 2011. I also do extramural sports coaching and was nominated for a teaching award in 2019...'
                : 'e.g. I have 8 years experience in accounting, mainly at KPMG where I worked as a senior auditor from 2016 to 2022. I have a BCom degree from UCT. I am good at Excel, SAP and team leadership...'}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              disabled={uploading}
            />
          </div>
          <button
            onClick={processFreeText}
            disabled={uploading || !freeText.trim()}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 hover:bg-primary/90"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> AI is structuring your info…</>
              : <><Upload className="w-4 h-4" /> Structure with AI</>
            }
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function CVBuilderPage() {
  const { user, updateUserMeta } = useAuth();
  const navigate = useNavigate();

  const [initialState] = useState(() => {
    const lastMeta: Record<string, unknown> = (() => {
      try { return JSON.parse(localStorage.getItem(LAST_CV_KEY) ?? '{}'); } catch { return {}; }
    })();
    const draft: { cvType: CVType; data: CVData; step: number; savedAt: string } | null = (() => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        return d?.cvType && d?.data ? d : null;
      } catch { return null; }
    })();
    return {
      lastMeta,
      draft,
      showBuilder: draft ? true : !lastMeta.last_cv_data,
    };
  });

  const [freshMeta, setFreshMeta]   = useState(initialState.lastMeta);
  const lastCVData                  = freshMeta.last_cv_data;
  const lastCVPdfUrl                = freshMeta.last_cv_pdf_url as string | undefined;
  const lastCVGeneratedAt           = freshMeta.last_cv_generated_at as string | undefined;

  // Live subscription check
  const [dbPlan, setDbPlan] = useState<string | null>(null);
  const [dbEnd,  setDbEnd]  = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('subscription_plan, subscription_end')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setDbPlan(data?.subscription_plan ?? null);
        setDbEnd(data?.subscription_end  ?? null);
      });
  }, [user]);

  const isFree = (() => {
    const plan = dbPlan ?? (freshMeta.subscription_plan as string | undefined) ?? 'free';
    const end  = dbEnd  ?? (freshMeta.subscription_end  as string | undefined) ?? null;
    if (!plan || plan === 'free') return true;
    if (!end) return true;
    return new Date(end) <= new Date();
  })();

  const [showBuilder, setShowBuilder] = useState(initialState.showBuilder);
  const [cvType, setCvType]           = useState<CVType | null>(initialState.draft?.cvType ?? null);
  const [step, setStep]               = useState(initialState.draft?.step ?? 0);
  const [data, setData]               = useState<CVData>(initialState.draft?.data ?? defaultData('educator'));

  // Auto‑select CV type from user profile (skip type selector)
  useEffect(() => {
    if (cvType !== null) return;
    if (!user) { setCvType('general'); return; }
    supabase
      .from('educators')
      .select('profile_type')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data: row }) => {
        const t: CVType = row?.profile_type === 'general' ? 'general' : 'educator';
        setCvType(t);
        setData(defaultData(t));
      });
  }, [user]);

  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(initialState.draft?.savedAt ?? null);

  // Auto‑save draft to localStorage
  useEffect(() => {
    if (!cvType) return;
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ cvType, data, step, savedAt }));
      setDraftSavedAt(savedAt);
    } catch {}
  }, [data, step, cvType]);

  // Background sync from user metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      const m = (u?.user_metadata ?? {}) as Record<string, unknown>;
      if (m.last_cv_data) {
        try { localStorage.setItem(LAST_CV_KEY, JSON.stringify(m)); } catch {}
        setFreshMeta(m);
        if (!initialState.draft && !initialState.lastMeta.last_cv_data) {
          setShowBuilder(false);
        }
      }
    });
  }, []);

  const prev = () => setStep(s => Math.max(0, s - 1));
  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));

  const handleSelectType = (t: CVType) => {
    setCvType(t);
    setData(defaultData(t));
    setStep(0);
  };

  const handleBack = () => {
    if (lastCVData) {
      setShowBuilder(false);
    } else {
      navigate(-1);
    }
  };

  const handleEdit = () => {
    if (!lastCVData) return;
    const saved = lastCVData as CVData;
    setData(saved);
    setCvType(saved.cvType ?? 'educator');
    setStep(0);
    setShowBuilder(true);
    const savedAt = new Date().toISOString();
    setDraftSavedAt(savedAt);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ cvType: saved.cvType ?? 'educator', data: saved, step: 0, savedAt })); } catch {}
  };

  const handleCVGenerated = async (pdfUrl: string) => {
    const now = new Date().toISOString();
    const newMeta = {
      ...freshMeta,
      // Only update pdf URL if we got one — keep old URL if upload failed
      last_cv_pdf_url: pdfUrl || (freshMeta.last_cv_pdf_url as string | undefined) || '',
      last_cv_data: data,          // always save the latest CV data for Edit & Re-generate
      last_cv_generated_at: now,
      cv_count: ((freshMeta.cv_count as number) ?? 0) + 1,
    };
    try { localStorage.setItem(LAST_CV_KEY, JSON.stringify(newMeta)); } catch {}
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setFreshMeta(newMeta);
    // Also persist to Supabase user metadata so it survives across devices/browsers
    try {
      await updateUserMeta({
        last_cv_pdf_url: newMeta.last_cv_pdf_url,
        last_cv_data:    data,
        last_cv_generated_at: now,
        cv_count:        newMeta.cv_count,
      });
    } catch (_) { /* metadata sync failure is non-critical */ }
    setDraftSavedAt(null);
    setCvType(null);
    setStep(0);
    setShowBuilder(false);
  };

  // ✅ AI data handler: preserve personal info
  const handleAIDataExtracted = (newData: CVData) => {
    setData(prev => ({
      ...newData,
      personal: prev.personal, // NEVER overwrite personal details
    }));
    setStep(0);
    setShowBuilder(true);
    const savedAt = new Date().toISOString();
    setDraftSavedAt(savedAt);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        cvType: newData.cvType,
        data: {
          ...newData,
          personal: data.personal, // ensure saved draft keeps original personal
        },
        step: 0,
        savedAt,
      }));
    } catch {}
  };

  // Last CV banner view
  if (!showBuilder && lastCVData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 px-4 pt-4 pb-5">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">CV Builder</h1>
        </div>
        <div className="px-4">
          <LastCVBanner
            lastCV={{ pdf_url: lastCVPdfUrl, generated_at: lastCVGeneratedAt, cv_data: lastCVData }}
            onBuildNew={() => { setShowBuilder(true); }}
            onEdit={handleEdit}
          />
        </div>
      </div>
    );
  }

  const subtitle = cvType === 'educator'
    ? 'Building an Educator CV'
    : cvType === 'general'
    ? 'Building a General CV'
    : 'Build a professional CV in minutes';

  // Builder mode – if cvType is selected, render upload zone + stepper
  if (cvType === null) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 px-4 pt-4 pb-1">
          <button onClick={handleBack} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">CV Builder</h1>
        </div>
        <div className="px-4 pb-4 pt-1">
          <p className="text-sm text-muted-foreground">Choose a CV type to start</p>
        </div>
        <CVTypeSelector onSelect={handleSelectType} />
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
      </div>

      <div className="px-4 pb-4 pt-1">
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* ✅ AI Upload Zone – always visible on Step 0 (Personal) */}
      {step === 0 && (
        <CVUploadZone onDataExtracted={handleAIDataExtracted} cvType={cvType} />
      )}

      {/* Stepper + Builder UI */}
      <motion.div
        key="builder"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
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
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && <CVStepPersonal cvType={cvType} data={data.personal} onChange={personal => setData(d => ({ ...d, personal }))} />}
              {step === 1 && <CVStepEducation data={data.education} onChange={education => setData(d => ({ ...d, education }))} />}
              {step === 2 && <CVStepExperience cvType={cvType} data={data.experience} onChange={experience => setData(d => ({ ...d, experience }))} />}
              {step === 3 && <CVStepSkills cvType={cvType} data={data.skills} onChange={skills => setData(d => ({ ...d, skills }))} />}
              {step === 4 && <CVStepReferences cvType={cvType} data={data.references} onChange={references => setData(d => ({ ...d, references }))} />}
              {step === 5 && <CVStepExtras data={data.custom_sections} onChange={custom_sections => setData(d => ({ ...d, custom_sections }))} />}
              {step === 6 && <CVStepTemplate selected={data.template} onChange={template => setData(d => ({ ...d, template }))} isFree={isFree} />}
              {step === 7 && <CVStepReview data={data} onGenerated={handleCVGenerated} isFree={isFree} />}
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

        <div className="px-4 pb-6 pt-1">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="w-full rounded-xl gap-2 text-muted-foreground text-sm"
          >
            <Save className="w-4 h-4" /> Save &amp; Exit — continue later
          </Button>
        </div>
      </motion.div>
    </div>
  );
}