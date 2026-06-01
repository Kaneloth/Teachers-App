import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import CVStepPersonal from '@/components/cv/CVStepPersonal';
import CVStepEducation from '@/components/cv/CVStepEducation';
import CVStepExperience from '@/components/cv/CVStepExperience';
import CVStepSkills from '@/components/cv/CVStepSkills';
import CVStepTemplate from '@/components/cv/CVStepTemplate.jsx';
import CVStepReview from '@/components/cv/CVStepReview.jsx';
import LastCVBanner from '@/components/cv/LastCVBanner';
import { FileText, ChevronLeft, ChevronRight, ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { base44 } from '@/api/base44Client';

const STEPS = [
  { id: 'personal', label: 'Personal' },
  { id: 'education', label: 'Education' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'template', label: 'Template' },
  { id: 'review', label: 'Review' },
];

const INITIAL_DATA = {
  personal: { full_name: '', email: '', phone: '', address: '', bio: '', photo_url: '' },
  education: [{ institution: '', qualification: '', year: '' }],
  experience: [{ school: '', role: '', from: '', to: '', description: '' }],
  skills: { subjects: [], soft_skills: [], languages: [] },
  template: 'classic',
};

export default function CVBuilderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(INITIAL_DATA);
  const [lastCV, setLastCV] = useState(null); // { pdf_url, cv_data, generated_at }
  const [showBuilder, setShowBuilder] = useState(false);
  const { canBuildCV, cvBuildsRemaining, tier, tierConfig, isLoading } = useSubscription();

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.last_cv_pdf_url) {
        setLastCV({
          pdf_url: user.last_cv_pdf_url,
          cv_data: user.last_cv_data || null,
          generated_at: user.last_cv_generated_at || null,
        });
      }
    });
  }, []);

  const updateData = (section, value) => {
    setData(d => ({ ...d, [section]: value }));
  };

  const onCVGenerated = async (pdfUrl) => {
    const user = await base44.auth.me();
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const currentKey = user.cv_builds_month_key || '';
    const currentCount = currentKey === thisMonthKey ? (user.cv_builds_this_month || 0) : 0;
    await base44.auth.updateMe({
      cv_builds_this_month: currentCount + 1,
      cv_builds_month_key: thisMonthKey,
      last_cv_pdf_url: pdfUrl,
      last_cv_data: data,
      last_cv_generated_at: now.toISOString(),
    });
    setLastCV({ pdf_url: pdfUrl, cv_data: data, generated_at: now.toISOString() });
  };

  const stepComponents = [
    <CVStepPersonal data={data.personal} onChange={v => updateData('personal', v)} />,
    <CVStepEducation data={data.education} onChange={v => updateData('education', v)} />,
    <CVStepExperience data={data.experience} onChange={v => updateData('experience', v)} />,
    <CVStepSkills data={data.skills} onChange={v => updateData('skills', v)} />,
    <CVStepTemplate selected={data.template} onChange={v => updateData('template', v)} />,
    <CVStepReview data={data} onGenerated={onCVGenerated} />,
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!canBuildCV) {
    return (
      <div className="px-4 pt-6 pb-8">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <FileText className="w-5 h-5 text-primary" strokeWidth={2.5} />
          <h1 className="text-xl font-bold text-foreground">CV Builder</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">CV Build Limit Reached</h2>
          <p className="text-sm text-muted-foreground mb-1 max-w-xs">
            {tier === 'free'
              ? 'The Free Tier allows 1 CV build per month. Upgrade to Basic for 15 CVs/month, or Premium for unlimited.'
              : 'You have used all 15 CV builds for this month. Upgrade to Premium for unlimited builds.'}
          </p>
          <p className="text-xs text-muted-foreground mb-6">Resets at the start of next month.</p>
          <Button
            onClick={() => navigate('/settings', { state: { tab: 'subscription' } })}
            className="rounded-xl px-8 h-11 text-base font-semibold"
          >
            Upgrade Plan
          </Button>
        </div>
      </div>
    );
  }

  // Show last CV banner if user has one and hasn't clicked "Build New"
  if (lastCV && !showBuilder) {
    return (
      <div className="px-4 pt-6 pb-8">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <FileText className="w-5 h-5 text-primary" strokeWidth={2.5} />
          <h1 className="text-xl font-bold text-foreground">CV Builder</h1>
        </div>
        <LastCVBanner
          lastCV={lastCV}
          onBuildNew={() => {
            if (lastCV?.cv_data) setData(lastCV.cv_data);
            setShowBuilder(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <FileText className="w-5 h-5 text-primary" strokeWidth={2.5} />
        <h1 className="text-xl font-bold text-foreground">CV Builder</h1>
      </div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-muted-foreground">Build a professional teaching CV in minutes</p>
        {tierConfig.cvBuildsPerMonth !== Infinity && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg">
            {cvBuildsRemaining} build{cvBuildsRemaining !== 1 ? 's' : ''} left
          </span>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-colors ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                  ? 'bg-primary/20 text-primary cursor-pointer'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </button>
            <span className={`text-[10px] font-medium ${i === step ? 'text-primary' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-3 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="mb-6">
        {stepComponents[step]}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 rounded-xl gap-2">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
        )}
        {step < STEPS.length - 1 && (
          <Button onClick={() => setStep(s => s + 1)} className="flex-1 rounded-xl gap-2">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}