import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowLeft, FileText, GraduationCap, Briefcase, ShieldAlert, ShieldCheck } from 'lucide-react';
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
import CVStepTemplate from '@/components/cv/CVStepTemplate';
import CVStepReview from '@/components/cv/CVStepReview';
import LastCVBanner from '@/components/cv/LastCVBanner';

export type CVType = 'educator' | 'general';

const STEPS = ['Personal', 'Education', 'Experience', 'Skills', 'References', 'Template', 'Review'];

interface CVData {
  cvType: CVType;
  personal: { full_name: string; email: string; phone: string; address: string; bio: string; photo_url?: string; id_number?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects: string[]; soft_skills: string[]; languages: string[] };
  references: RefEntry[];
  template: string;
}

function defaultData(cvType: CVType): CVData {
  return {
    cvType,
    personal: { full_name: '', email: '', phone: '', address: '', bio: '', id_number: '' },
    education: [{ institution: '', qualification: '', year: '' }],
    experience: [{ school: '', role: '', from: '', to: '', description: '' }],
    skills: { subjects: [], soft_skills: [], languages: [] },
    references: [
      { name: '', title: '', organisation: '', phone: '', email: '', relationship: '' },
      { name: '', title: '', organisation: '', phone: '', email: '', relationship: '' },
    ],
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
  const cvCount = (meta.cv_count as number) ?? 0;
  const isFree = !meta.subscription_plan || meta.subscription_plan === 'free';
  const FREE_LIMIT = 2;
  const buildsLeft = Math.max(0, FREE_LIMIT - cvCount);

  const [showBuilder, setShowBuilder] = useState(!lastCVData);
  const [cvType, setCvType] = useState<CVType | null>(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<CVData>(defaultData('educator'));
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', user.id)
      .single()
      .then(({ data: profile }) => setIsVerified(profile?.is_verified ?? false));
  }, [user]);

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

  /* ── ID verification gate ────────────────────────────────── */
  if (isVerified === null) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 px-4 pt-4 pb-5">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">CV Builder</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 px-4 pt-4 pb-5">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">CV Builder</h1>
        </div>
        <div className="px-4 pb-8">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">Identity Verification Required</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You need to verify your identity before you can create a CV. This helps us ensure that
                all educators on Crosssa are who they say they are.
              </p>
            </div>
            <div className="w-full bg-muted rounded-xl px-4 py-3 text-left space-y-2">
              <p className="text-xs font-semibold text-foreground">Why is this required?</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-start gap-2"><ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> Builds trust with schools reviewing your CV</li>
                <li className="flex items-start gap-2"><ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> Prevents fraudulent applications</li>
                <li className="flex items-start gap-2"><ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> Keeps the platform safe for all educators</li>
              </ul>
            </div>
            <div className="flex flex-col gap-2 w-full pt-1">
              <Button onClick={() => navigate('/profile')} className="w-full h-11 rounded-xl font-semibold gap-2">
                <ShieldCheck className="w-4 h-4" /> Verify My Identity
              </Button>
              <Button variant="ghost" onClick={() => navigate(-1)} className="w-full h-10 rounded-xl text-muted-foreground">
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Free tier limit gate ────────────────────────────────── */
  if (showBuilder && isFree && cvCount >= FREE_LIMIT) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 px-4 pt-4 pb-5">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">CV Builder</h1>
        </div>
        <div className="px-4 pb-8">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">Free Plan Limit Reached</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You've used all <strong>{FREE_LIMIT} free CV builds</strong> included in your plan.
                Upgrade to create unlimited CVs and unlock premium templates.
              </p>
            </div>

            {/* Usage bar */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>CVs created</span>
                <span className="font-semibold text-foreground">{cvCount} / {FREE_LIMIT}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
              </div>
            </div>

            {/* What you get */}
            <div className="w-full bg-muted rounded-xl px-4 py-3 text-left space-y-2">
              <p className="text-xs font-semibold text-foreground">What you get with a paid plan</p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {[
                  'Unlimited CV builds',
                  'Access to all premium templates',
                  'Priority application support',
                  'Verified badge on your profile',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2 w-full pt-1">
              <Button onClick={() => navigate('/subscribe')} className="w-full h-11 rounded-xl font-semibold">
                Upgrade Plan
              </Button>
              <Button variant="ghost" onClick={() => { setShowBuilder(false); }} className="w-full h-10 rounded-xl text-muted-foreground">
                View My Last CV
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        {cvType && isFree && (
          <div className={`shrink-0 rounded-xl px-3 py-1 text-xs font-medium whitespace-nowrap ${buildsLeft === 0 ? 'bg-destructive/10 text-destructive' : buildsLeft === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
            {buildsLeft === 0 ? 'No builds left' : `${buildsLeft} build${buildsLeft !== 1 ? 's' : ''} left`}
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
                  {step === 4 && <CVStepReferences cvType={cvType} data={data.references} onChange={references => setData(d => ({ ...d, references }))} />}
                  {step === 5 && <CVStepTemplate selected={data.template} onChange={template => setData(d => ({ ...d, template }))} />}
                  {step === 6 && <CVStepReview data={data} onGenerated={() => {}} />}
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
