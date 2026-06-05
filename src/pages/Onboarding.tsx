import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

const PROVINCES = ['Gauteng','KwaZulu-Natal','Western Cape','Eastern Cape','Mpumalanga','Limpopo','North West','Free State','Northern Cape'];
const PHASES = ['Foundation','Intermediate','Senior','FET'];
const SUBJECTS = ['Mathematics','Mathematical Literacy','Physical Sciences','Life Sciences','English HL','English FAL','Afrikaans HL','Afrikaans FAL','History','Geography','Business Studies','Accounting','Economics','Life Orientation','Computer Applications Technology','Information Technology'];

const STEPS = ['Personal', 'School', 'Teaching', 'Transfer'];

/** Generates a unique Crosssa reference code: CR-DDDDLLL (4 digits + 3 uppercase letters) */
function generateUserCode(): string {
  const digits  = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const letters = Array.from({ length: 3 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  return `CR-${digits}${letters}`;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: user?.user_metadata?.full_name || '',
    sace_number: '',
    bio: '',
    current_school: '',
    current_province: '',
    town: '',
    phase: '',
    subjects: [] as string[],
    years_experience: '',
    preferred_provinces: [] as string[],
    is_actively_looking: false,
  });

  const set = (field: string, value: unknown) => setForm(p => ({ ...p, [field]: value }));
  const toggleSubject  = (s: string) => set('subjects',            form.subjects.includes(s)            ? form.subjects.filter(x => x !== s)            : [...form.subjects, s]);
  const toggleProvince = (p: string) => set('preferred_provinces', form.preferred_provinces.includes(p) ? form.preferred_provinces.filter(x => x !== p) : [...form.preferred_provinces, p]);

  const handleFinish = async () => {
    setLoading(true);
    try {
      // 1 — Insert educator profile
      const { error } = await supabase.from('educators').insert([{
        ...form,
        user_id: user?.id,
        years_experience: form.years_experience ? parseInt(form.years_experience, 10) : null,
      }]);
      if (error) throw error;

      // 2 — Generate and persist the user code
      const userCode = generateUserCode();
      await supabase.auth.updateUser({ data: { user_code: userCode } });

      // 3 — Send welcome email with the user code (fire-and-forget)
      const email     = user?.email ?? '';
      const fullName  = form.full_name || user?.user_metadata?.full_name || '';
      supabase.functions
        .invoke('sendWelcomeEmail', { body: { email, full_name: fullName, user_code: userCode } })
        .catch(() => { /* non-blocking */ });

      toast.success('Profile created! Welcome to Crosssa!');
      navigate('/home');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fdfa] via-white to-[#f0fdf4] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Set Up Your Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
          <div className="flex gap-1 mt-4 justify-center">
            {STEPS.map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-primary w-8' : 'bg-muted w-4'}`} />)}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          {step === 0 && (
            <>
              <Field label="Full Name"><Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Thabo Pretorius" className="rounded-xl" /></Field>
              <Field label="SACE Number (optional)"><Input value={form.sace_number} onChange={e => set('sace_number', e.target.value)} placeholder="e.g. 20012345" className="rounded-xl" /></Field>
              <Field label="Bio / Professional Summary">
                <Textarea value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Tell other educators about yourself..." rows={3} className="rounded-xl" />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Current School"><Input value={form.current_school} onChange={e => set('current_school', e.target.value)} placeholder="e.g. Pretoria High School" className="rounded-xl" /></Field>
              <Field label="Province">
                <Select value={form.current_province} onValueChange={v => set('current_province', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select province" /></SelectTrigger>
                  <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Town / Circuit"><Input value={form.town} onChange={e => set('town', e.target.value)} placeholder="e.g. Pretoria" className="rounded-xl" /></Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Phase">
                <Select value={form.phase} onValueChange={v => set('phase', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select phase" /></SelectTrigger>
                  <SelectContent>{PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Years of Experience"><Input type="number" value={form.years_experience} onChange={e => set('years_experience', e.target.value)} placeholder="e.g. 5" className="rounded-xl" /></Field>
              <Field label="Subjects (select all that apply)">
                <div className="flex flex-wrap gap-2 mt-1">
                  {SUBJECTS.map(s => (
                    <button key={s} onClick={() => toggleSubject(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.subjects.includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'}`}
                    >{s}</button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Preferred Transfer Provinces (select all)">
                <div className="flex flex-wrap gap-2 mt-1">
                  {PROVINCES.map(p => (
                    <button key={p} onClick={() => toggleProvince(p)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.preferred_provinces.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'}`}
                    >{p}</button>
                  ))}
                </div>
              </Field>
              <div className="flex items-center justify-between bg-muted/50 rounded-xl p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Actively looking for transfer?</p>
                  <p className="text-xs text-muted-foreground">Shows "Actively Looking" badge on your profile</p>
                </div>
                <button onClick={() => set('is_actively_looking', !form.is_actively_looking)}
                  className={`w-12 h-6 rounded-full transition-colors ${form.is_actively_looking ? 'bg-primary' : 'bg-border'} relative`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_actively_looking ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(p => p - 1)} className="flex-1 rounded-xl gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(p => p + 1)} className="flex-1 rounded-xl gap-2">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={loading} className="flex-1 rounded-xl font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finish Setup'}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <button onClick={() => navigate('/home')} className="hover:underline">Skip for now</button>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
