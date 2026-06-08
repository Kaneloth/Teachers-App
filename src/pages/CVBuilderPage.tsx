import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowLeft, FileText, GraduationCap, Briefcase, Save, Clock } from 'lucide-react';
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

const DRAFT_KEY   = 'crosssa_cv_draft';   // in-progress build
const LAST_CV_KEY = 'crosssa_last_cv';    // most recently generated CV (for banner)

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
              Tailored for teachers — includes subjects taught, school history, SACE details, and education-specific templates.
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
              For any industry or role — fully editable personal details, generic work experience, and free-form skills.
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

export default function CVBuilderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Read localStorage synchronously so state is correct on first render ──
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
  const isFree                      = !freshMeta.subscription_plan || freshMeta.subscription_plan === 'free';

  const [showBuilder, setShowBuilder] = useState(initialState.showBuilder);
  const [cvType, setCvType]           = useState<CVType | null>(initialState.draft?.cvType ?? null);
  const [step, setStep]               = useState(initialState.draft?.step ?? 0);
  const [data, setData]               = useState<CVData>(initialState.draft?.data ?? defaultData('educator'));

  // ── Auto-select CV type from user profile (skips the type-selector screen) ─
  useEffect(() => {
    if (cvType !== null) return; // draft already has a type
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

  // ── Auto-save draft to localStorage whenever builder data changes ─────────
  useEffect(() => {
    if (!cvType) return;
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ cvType, data, step, savedAt }));
      setDraftSavedAt(savedAt);
    } catch {}
  }, [data, step, cvType]);

  // ── Background Supabase sync (handles cross-device / fresh installs) ──────
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

  /* ── Edit last CV — loads lastCV as new draft ───────────── */
  const handleEdit = () => {
    if (!lastCVData) return;
    const saved = lastCVData as CVData;
    const savedAt = new Date().toISOString();
    setData(saved);
    setCvType(saved.cvType ?? 'educator');
    setStep(0);
    setShowBuilder(true);
    setDraftSavedAt(savedAt);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ cvType: saved.cvType ?? 'educator', data: saved, step: 0, savedAt })); } catch {}
  };

  /* ── After CV generated — persist to localStorage, clear draft ── */
  const handleCVGenerated = (pdfUrl: string) => {
    const now = new Date().toISOString();
    const newMeta = {
      ...freshMeta,
      last_cv_pdf_url: pdfUrl,
      last_cv_data: data,
      last_cv_generated_at: now,
      cv_count: ((freshMeta.cv_count as number) ?? 0) + 1,
    };
    try { localStorage.setItem(LAST_CV_KEY, JSON.stringify(newMeta)); } catch {}
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setFreshMeta(newMeta);
    setDraftSavedAt(null);
    setCvType(null);
    setStep(0);
    setShowBuilder(false);
  };

  /* ── Last CV state ────────────────────────────────────────── */
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

  /* ── Header (shared between type-select and builder) ─────── */
  const subtitle = cvType === 'educator'
    ? 'Building an Educator CV'
    : cvType === 'general'
    ? 'Building a General CV'
    : 'Build a professional CV in minutes';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-1">
        <button onClick={handleBack} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <FileText className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">CV Builder</h1>
      </div>

      {/* Subtitle */}
      <div className="px-4 pb-4 pt-1">
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Builder (cvType null = auto-resolving from profile, show spinner) */}
      <AnimatePresence mode="wait">
        {cvType === null ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <motion.div
            key="builder"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Numbered stepper */}
            <div className="px-4 pb-2">
              <StepStepper steps={STEPS} current={step} onSelect={setStep} />
            </div>
            {/* Draft auto-save indicator */}
            {draftSavedAt && (
              <p className="flex items-center gap-1 px-4 pb-3 text-xs text-muted-foreground">
                <Clock className="w-3 h-3 shrink-0" />
                Draft saved at {new Date(draftSavedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            {/* Step content */}
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

            {/* Nav buttons */}
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
            {/* Save & Exit — draft is already auto-saved, just navigate away */}
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
        )}
      </AnimatePresence>
    </div>
  );
}
