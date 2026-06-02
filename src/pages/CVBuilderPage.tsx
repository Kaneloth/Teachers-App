import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowLeft, FileText, GraduationCap, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import CVStepPersonal from '@/components/cv/CVStepPersonal';
import CVStepEducation from '@/components/cv/CVStepEducation';
import CVStepExperience from '@/components/cv/CVStepExperience';
import CVStepSkills from '@/components/cv/CVStepSkills';
import CVStepTemplate from '@/components/cv/CVStepTemplate';
import CVStepReview from '@/components/cv/CVStepReview';
import LastCVBanner from '@/components/cv/LastCVBanner';

export type CVType = 'educator' | 'general';

const STEPS = ['Personal', 'Education', 'Experience', 'Skills', 'Template', 'Review'];

interface CVData {
  cvType: CVType;
  personal: { full_name: string; email: string; phone: string; address: string; bio: string; photo_url?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects: string[]; soft_skills: string[]; languages: string[] };
  template: string;
}

function defaultData(cvType: CVType): CVData {
  return {
    cvType,
    personal: { full_name: '', email: '', phone: '', address: '', bio: '' },
    education: [{ institution: '', qualification: '', year: '' }],
    experience: [{ school: '', role: '', from: '', to: '', description: '' }],
    skills: { subjects: [], soft_skills: [], languages: [] },
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
  const meta = user?.user_metadata ?? {};
  const lastCVData = meta.last_cv_data;
  const lastCVPdfUrl = meta.last_cv_pdf_url as string | undefined;
  const lastCVGeneratedAt = meta.last_cv_generated_at as string | undefined;

  const [showBuilder, setShowBuilder] = useState(!lastCVData);
  const [cvType, setCvType] = useState<CVType | null>(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<CVData>(defaultData('educator'));

  const prev = () => setStep(s => Math.max(0, s - 1));
  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));

  const handleSelectType = (t: CVType) => {
    setCvType(t);
    setData(defaultData(t));
    setStep(0);
  };

  const handleBack = () => {
    if (cvType !== null) {
      setCvType(null);
    } else if (lastCVData) {
      setShowBuilder(false);
    } else {
      navigate(-1);
    }
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
            onBuildNew={() => { setShowBuilder(true); setCvType(null); }}
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

      {/* Subtitle + builds-left badge */}
      <div className="flex items-center justify-between px-4 pb-4 pt-1 gap-3">
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        {cvType && (
          <div className="shrink-0 bg-muted rounded-xl px-3 py-1 text-xs text-muted-foreground font-medium whitespace-nowrap">
            1 build left
          </div>
        )}
      </div>

      {/* Type selection or builder */}
      <AnimatePresence mode="wait">
        {cvType === null ? (
          <motion.div
            key="type-select"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <CVTypeSelector onSelect={handleSelectType} />
          </motion.div>
        ) : (
          <motion.div
            key="builder"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Numbered stepper */}
            <div className="px-4 pb-4">
              <StepStepper steps={STEPS} current={step} onSelect={setStep} />
            </div>

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
                  {step === 4 && <CVStepTemplate selected={data.template} onChange={template => setData(d => ({ ...d, template }))} />}
                  {step === 5 && <CVStepReview data={data} onGenerated={() => {}} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Nav buttons */}
            <div className="flex gap-3 px-4 pt-4 pb-6">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
