import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, GraduationCap, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PROVINCES, SUBJECTS, PHASES } from '@/lib/constants';

const STEPS = ['welcome', 'personal', 'location', 'teaching', 'done'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    current_province: '',
    current_school: '',
    town: '',
    phase: '',
    subjects: [] as string[],
    years_experience: '',
    preferred_provinces: [] as string[],
    is_actively_looking: false,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);
      supabase.from('educators').select('id').eq('user_id', user.id).single().then(({ data }) => {
        if (data) navigate('/home');
      });
    });
  }, [navigate]);

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));

  const setField = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));
  const toggleArray = (field: 'subjects' | 'preferred_provinces', val: string) => {
    setForm(f => {
      const arr = f[field];
      return { ...f, [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
  };

  const handleFinish = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('educators').insert({
        user_id: userId,
        full_name: form.full_name,
        current_province: form.current_province,
        current_school: form.current_school,
        town: form.town,
        phase: form.phase,
        subjects: form.subjects,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
        preferred_provinces: form.preferred_provinces,
        is_actively_looking: form.is_actively_looking,
      });
      if (error) throw error;
      next();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const currentStep = STEPS[step];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {currentStep !== 'welcome' && currentStep !== 'done' && (
          <div className="flex gap-1 mb-8">
            {['personal', 'location', 'teaching'].map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${i < step - 1 ? 'bg-primary' : i === step - 1 ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        )}

        {currentStep === 'welcome' && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 mb-6">
              <GraduationCap className="w-10 h-10 text-primary" />
              <span className="text-3xl font-bold text-foreground">EduCross</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Welcome!</h1>
            <p className="text-muted-foreground mb-8">Let's set up your educator profile so you can find exchange partners across South Africa.</p>
            <Button onClick={next} className="w-full h-12 rounded-xl font-semibold">
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {currentStep === 'personal' && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Personal info</h2>
            <p className="text-sm text-muted-foreground mb-6">Tell us your name</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="e.g. Thabo Nkosi" className="h-12" autoFocus />
              </div>
            </div>
            <Button onClick={next} disabled={!form.full_name.trim()} className="w-full h-12 rounded-xl font-semibold mt-6">
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {currentStep === 'location' && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Where do you teach?</h2>
            <p className="text-sm text-muted-foreground mb-6">And where would you like to go?</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Current Province *</Label>
                <Select value={form.current_province} onValueChange={val => setField('current_province', val)}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Select province" /></SelectTrigger>
                  <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>School Name</Label>
                <Input value={form.current_school} onChange={e => setField('current_school', e.target.value)} placeholder="Your school" className="h-12" />
              </div>
              <div className="space-y-2">
                <Label>Town / City</Label>
                <Input value={form.town} onChange={e => setField('town', e.target.value)} placeholder="e.g. Port Elizabeth" className="h-12" />
              </div>
              <div>
                <Label className="mb-2 block">Preferred Provinces (want to move to)</Label>
                <div className="flex flex-wrap gap-2">
                  {PROVINCES.filter(p => p !== form.current_province).map(p => (
                    <button key={p} type="button" onClick={() => toggleArray('preferred_provinces', p)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.preferred_provinces.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={next} disabled={!form.current_province} className="w-full h-12 rounded-xl font-semibold mt-6">
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {currentStep === 'teaching' && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Teaching details</h2>
            <p className="text-sm text-muted-foreground mb-6">Phase and subjects you teach</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Phase *</Label>
                <Select value={form.phase} onValueChange={val => setField('phase', val)}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Select phase" /></SelectTrigger>
                  <SelectContent>{PHASES.map(ph => <SelectItem key={ph} value={ph}>{ph}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Subjects *</Label>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {SUBJECTS.map(s => (
                    <button key={s} type="button" onClick={() => toggleArray('subjects', s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.subjects.includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Years of Experience</Label>
                <Input type="number" min={0} max={50} value={form.years_experience} onChange={e => setField('years_experience', e.target.value)} placeholder="e.g. 5" className="h-12" />
              </div>
            </div>
            <Button onClick={handleFinish} disabled={saving || !form.phase || form.subjects.length === 0} className="w-full h-12 rounded-xl font-semibold mt-6">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <>Finish Setup <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </div>
        )}

        {currentStep === 'done' && (
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">You're all set!</h2>
            <p className="text-muted-foreground mb-8">Your educator profile has been created. Start exploring exchange partners!</p>
            <Button onClick={() => navigate('/home')} className="w-full h-12 rounded-xl font-semibold">
              Go to App <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
