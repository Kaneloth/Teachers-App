import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, CheckCircle2, Plus, X, ShieldCheck } from 'lucide-react';
import { PROVINCES, SUBJECTS, PHASES } from '@/lib/constants';

const STEPS = ['About You', 'Your School', 'What You Teach'];

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
            i < current ? 'bg-primary text-primary-foreground' :
            i === current ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
            'bg-muted text-muted-foreground'
          }`}>
            {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-8 transition-all ${i < current ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
      <span className="ml-2 text-sm text-muted-foreground font-medium">{STEPS[current]}</span>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [step, setStepp] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name:        '',
    phone:            '',
    id_number:        '',
    sace_number:      '',
    bio:              '',
    current_school:   '',
    current_province: '',
    current_district: '',
    phase:            '',
    subjects:         [] as string[],
    years_experience: '',
  });

  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [customSubject, setCustomSubject] = useState('');

  // Pre-fill name from OAuth metadata
  useEffect(() => {
    const name = (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '') as string;
    if (name) setForm(f => ({ ...f, full_name: name }));
  }, [user]);

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const addSubject = () => {
    const subject = subjectToAdd === 'Other' ? customSubject.trim() : subjectToAdd;
    if (subject && !form.subjects.includes(subject)) {
      setForm(f => ({ ...f, subjects: [...f.subjects, subject] }));
      setSubjectToAdd('');
      setCustomSubject('');
    }
  };

  const removeSubject = (s: string) =>
    setForm(f => ({ ...f, subjects: f.subjects.filter(x => x !== s) }));

  const canNext = () => {
    if (step === 0) return form.full_name.trim().length > 0;
    if (step === 1) return form.current_province !== '' && form.current_school.trim().length > 0;
    if (step === 2) return form.phase !== '' && form.subjects.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const digits  = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const letters = Array.from({ length: 3 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26)),
      ).join('');
      const userCode = `CT-${digits}${letters}`;

      await supabase.from('profiles').update({
        full_name:           form.full_name.trim(),
        phone:               form.phone.trim() || null,
        id_number:           form.id_number.trim().toUpperCase() || null,
        sace_number:         form.sace_number.trim() || null,
        user_code:           userCode,
        onboarding_complete: true,
      }).eq('id', user?.id);

      const educatorData = {
        user_id:          user?.id,
        full_name:        form.full_name.trim(),
        phone:            form.phone.trim() || null,
        bio:              form.bio.trim() || null,
        sace_number:      form.sace_number.trim() || null,
        current_school:   form.current_school.trim(),
        current_province: form.current_province,
        current_district: form.current_district.trim() || null,
        phase:            form.phase,
        subjects:         form.subjects,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
      };

      const { data: existing } = await supabase
        .from('educators').select('id').eq('user_id', user?.id).maybeSingle();

      if (existing) {
        await supabase.from('educators').update(educatorData).eq('id', existing.id);
      } else {
        await supabase.from('educators').insert(educatorData);
      }

      await refreshProfile();
      toast.success('Welcome to EduCross! Your profile is ready.');
      navigate('/home');
    } catch {
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-10">
      <div className="w-full max-w-lg">

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Complete your profile</h1>
          <p className="text-muted-foreground mt-1 text-sm">Help other educators find and trust you</p>
        </div>

        <StepIndicator current={step} total={STEPS.length} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* ── Step 0: About You ───────────────────────────────── */}
            {step === 0 && (
              <>
                <Field label="Full Name" required>
                  <Input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                    placeholder="e.g. Thandi Nkosi" className="h-12 rounded-xl" autoFocus />
                </Field>

                <Field label="Phone Number">
                  <Input value={form.phone} onChange={e => set('phone', e.target.value)}
                    placeholder="e.g. 0821234567" className="h-12 rounded-xl" type="tel" />
                </Field>

                <Field label="SA ID or Passport Number">
                  <Input value={form.id_number} onChange={e => set('id_number', e.target.value)}
                    placeholder="13-digit SA ID or passport number" className="h-12 rounded-xl" />
                </Field>

                <Field label="SACE Number">
                  <Input value={form.sace_number} onChange={e => set('sace_number', e.target.value)}
                    placeholder="e.g. 28901234" className="h-12 rounded-xl" />
                </Field>

                <Field label="About yourself">
                  <Textarea value={form.bio} onChange={e => set('bio', e.target.value)}
                    placeholder="Brief bio — your teaching style, interests, transfer goals…"
                    className="rounded-xl resize-none" rows={3} />
                </Field>
              </>
            )}

            {/* ── Step 1: Your School ─────────────────────────────── */}
            {step === 1 && (
              <>
                <Field label="Current Province" required>
                  <Select value={form.current_province} onValueChange={v => set('current_province', v)}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Current School" required>
                  <Input value={form.current_school} onChange={e => set('current_school', e.target.value)}
                    placeholder="e.g. Northview Primary School" className="h-12 rounded-xl" autoFocus />
                </Field>

                <Field label="District / Circuit">
                  <Input value={form.current_district} onChange={e => set('current_district', e.target.value)}
                    placeholder="e.g. Johannesburg North" className="h-12 rounded-xl" />
                </Field>

                <Field label="Years of Experience">
                  <Input value={form.years_experience} onChange={e => set('years_experience', e.target.value)}
                    placeholder="e.g. 8" className="h-12 rounded-xl" type="number" min="0" max="50" />
                </Field>
              </>
            )}

            {/* ── Step 2: What You Teach ──────────────────────────── */}
            {step === 2 && (
              <>
                <Field label="Phase" required>
                  <Select value={form.phase} onValueChange={v => set('phase', v)}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Subjects" required>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Select value={subjectToAdd} onValueChange={setSubjectToAdd}>
                        <SelectTrigger className="h-10 rounded-xl flex-1">
                          <SelectValue placeholder="Choose a subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          <SelectItem value="Other">Other…</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-xl shrink-0"
                        onClick={addSubject} disabled={!subjectToAdd}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {subjectToAdd === 'Other' && (
                      <Input value={customSubject} onChange={e => setCustomSubject(e.target.value)}
                        placeholder="Enter subject name" className="h-10 rounded-xl" />
                    )}
                    {form.subjects.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {form.subjects.map(s => (
                          <Badge key={s} variant="secondary" className="gap-1 pr-1">
                            {s}
                            <button onClick={() => removeSubject(s)} className="hover:text-destructive transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setStepp(s => s - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button className="flex-1 h-12 rounded-xl" onClick={() => setStepp(s => s + 1)} disabled={!canNext()}>
              Next<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button className="flex-1 h-12 rounded-xl" onClick={handleFinish} disabled={saving || !canNext()}>
              {saving ? 'Saving…' : 'Complete Profile'}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
