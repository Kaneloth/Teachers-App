import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import {
  ChevronRight, ChevronLeft, Plus, X,
  CheckCircle2, AlertCircle, Upload, Loader2,
  Phone, ShieldCheck, IdCard, FileText,
} from 'lucide-react';
import { PROVINCES, SUBJECTS, PHASES } from '@/lib/constants';

const STEPS = ['About You', 'Your School', 'What You Teach'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
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
            i < current
              ? 'bg-primary text-primary-foreground'
              : i === current
              ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
              : 'bg-muted text-muted-foreground'
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
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── ID / passport ─────────────────────────────────────────────────────────
  const [idType, setIdType] = useState<'said' | 'passport' | null>(null);
  const [verifyingId, setVerifyingId] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [idError, setIdError] = useState('');

  const [passportFrontUrl, setPassportFrontUrl] = useState('');
  const [passportBackUrl, setPassportBackUrl] = useState('');
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const passportFrontRef = useRef<HTMLInputElement>(null);
  const passportBackRef = useRef<HTMLInputElement>(null);

  // ── Phone OTP ─────────────────────────────────────────────────────────────
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Subjects ──────────────────────────────────────────────────────────────
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [customSubject, setCustomSubject] = useState('');

  // ── Form ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    id_number: '',
    sace_number: '',
    bio: '',
    current_school: '',
    current_province: '',
    current_district: '',
    phase: '',
    subjects: [] as string[],
    years_experience: '',
  });

  useEffect(() => {
    const name = (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '') as string;
    if (name) setForm(f => ({ ...f, full_name: name }));
  }, [user]);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const set = (field: string, value: unknown) => {
    setForm(f => ({ ...f, [field]: value }));
    if (field === 'id_number') { setIdError(''); setIdType(null); setIdVerified(false); }
    if (field === 'phone') {
      setPhoneError(''); setPhoneVerified(false);
      setPhoneOtpSent(false); setPhoneOtpCode('');
    }
  };

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Phone OTP ─────────────────────────────────────────────────────────────
  const handleSendPhoneOtp = async () => {
    if (!form.phone.trim()) { setPhoneError('Please enter your phone number first.'); return; }
    setSendingOtp(true);
    setPhoneError('');
    try {
      const { data, error } = await supabase.functions.invoke('send-phone-otp', {
        body: { phone: form.phone.trim(), user_id: user?.id },
      });
      if (error || !data?.success) throw new Error(data?.message ?? 'Failed to send OTP');
      setPhoneOtpSent(true);
      toast.success('Verification code sent via SMS.');
      startCooldown();
    } catch (err: unknown) {
      setPhoneError((err as Error).message || 'Failed to send code. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setVerifyingOtp(true);
    setPhoneError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
        body: { phone: form.phone.trim(), code: phoneOtpCode },
      });
      if (error || !data?.success) throw new Error(data?.message ?? 'Incorrect code');
      setPhoneVerified(true);
      setPhoneOtpSent(false);
      setPhoneOtpCode('');
      toast.success('Phone number verified!');
    } catch (err: unknown) {
      setPhoneError((err as Error).message || 'Incorrect code. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── ID / passport ─────────────────────────────────────────────────────────
  const handleVerifyId = async () => {
    const id = form.id_number.trim();
    if (!id) { setIdError('Please enter your SA ID or passport number.'); return; }

    const isSaid = /^\d{13}$/.test(id);
    setIdType(isSaid ? 'said' : 'passport');

    if (isSaid) {
      setVerifyingId(true);
      setIdError('');
      try {
        const { data, error } = await supabase.functions.invoke('verify-sa-id', {
          body: { id_number: id },
        });
        if (error || !data?.success) throw new Error(data?.message ?? 'ID verification failed');
        setIdVerified(true);
        toast.success('SA ID verified!');
      } catch (err: unknown) {
        setIdError((err as Error).message || 'Could not verify this ID. Please check and try again.');
        setIdType(null);
      } finally {
        setVerifyingId(false);
      }
    }
    // Passport detected — upload UI appears automatically
  };

  const uploadPassportImage = async (file: File, side: 'front' | 'back') => {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user?.id}/passport_${side}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('passports').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data: { publicUrl } } = supabase.storage.from('passports').getPublicUrl(path);
    return publicUrl;
  };

  const handlePassportUpload = async (file: File, side: 'front' | 'back') => {
    if (side === 'front') setUploadingFront(true);
    else setUploadingBack(true);
    try {
      const url = await uploadPassportImage(file, side);
      const newFront = side === 'front' ? url : passportFrontUrl;
      const newBack  = side === 'back'  ? url : passportBackUrl;
      if (side === 'front') setPassportFrontUrl(url);
      else setPassportBackUrl(url);

      if (newFront && newBack) {
        setIdVerified(true);
        supabase.functions.invoke('verify-passport', {
          body: { front_url: newFront, back_url: newBack, user_id: user?.id },
        }).catch(() => {});
        toast.success('Passport images uploaded — our team will review within 24–48 hrs.');
      }
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      if (side === 'front') setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  // ── Subjects ──────────────────────────────────────────────────────────────
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

  // ── Validation ────────────────────────────────────────────────────────────
  const canNext = (): boolean => {
    if (step === 0) {
      const hasName  = form.full_name.trim().length > 0;
      const hasPhone = phoneVerified;
      const hasId    = form.id_number.trim().length > 0;
      const idOk     = idType === 'passport'
        ? passportFrontUrl !== '' && passportBackUrl !== ''
        : idVerified;
      return hasName && hasPhone && hasId && idOk;
    }
    if (step === 1) return form.current_province !== '' && form.current_school.trim().length > 0;
    if (step === 2) return form.phase !== '' && form.subjects.length > 0;
    return true;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true);
    try {
      const digits  = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const letters = Array.from({ length: 3 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26)),
      ).join('');
      const userCode = `CT-${digits}${letters}`;

      await supabase.from('profiles').update({
        full_name:               form.full_name.trim(),
        phone:                   form.phone.trim(),
        phone_verified:          phoneVerified,
        id_number:               form.id_number.trim().toUpperCase(),
        id_type:                 idType ?? 'said',
        id_verified:             idType === 'said',
        id_verification_status:  idType === 'passport' ? 'needs_review' : 'verified',
        passport_front_url:      passportFrontUrl || null,
        passport_back_url:       passportBackUrl  || null,
        sace_number:             form.sace_number.trim() || null,
        user_code:               userCode,
        onboarding_complete:     true,
      }).eq('id', user?.id);

      const educatorData = {
        user_id:          user?.id,
        full_name:        form.full_name.trim(),
        phone:            form.phone.trim(),
        bio:              form.bio.trim(),
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
    } catch (err: unknown) {
      toast.error('Failed to save profile. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-10">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Complete your profile</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Help other educators find and trust you
          </p>
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

            {/* ── STEP 0: About You ─────────────────────────────────────────── */}
            {step === 0 && (
              <>
                <Field label="Full Name *">
                  <Input
                    value={form.full_name}
                    onChange={e => set('full_name', e.target.value)}
                    placeholder="e.g. Thandi Nkosi"
                    className="h-12 rounded-xl"
                    autoFocus
                  />
                </Field>

                {/* Phone + OTP */}
                <Field label="Phone Number *">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={form.phone}
                        onChange={e => set('phone', e.target.value)}
                        placeholder="e.g. 0821234567"
                        className={`h-12 rounded-xl flex-1 ${phoneVerified ? 'border-green-500' : ''}`}
                        disabled={phoneVerified || phoneOtpSent}
                      />
                      {phoneVerified ? (
                        <div className="h-12 px-3 flex items-center gap-1.5 rounded-xl bg-green-50 dark:bg-green-950 border border-green-500 text-green-600 text-sm font-medium shrink-0">
                          <CheckCircle2 className="w-4 h-4" /> Verified
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 rounded-xl shrink-0 gap-1.5"
                          onClick={handleSendPhoneOtp}
                          disabled={sendingOtp || phoneOtpSent || !form.phone.trim()}
                        >
                          {sendingOtp
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Phone className="w-4 h-4" />}
                          {phoneOtpSent ? 'Sent' : 'Send OTP'}
                        </Button>
                      )}
                    </div>

                    {phoneOtpSent && !phoneVerified && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2 pt-1"
                      >
                        <p className="text-xs text-muted-foreground">
                          Enter the 6-digit code sent to {form.phone}
                        </p>
                        <div className="flex gap-2 items-center">
                          <InputOTP maxLength={6} value={phoneOtpCode} onChange={setPhoneOtpCode}>
                            <InputOTPGroup>
                              {[0, 1, 2, 3, 4, 5].map(i => (
                                <InputOTPSlot key={i} index={i} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                          <Button
                            type="button"
                            size="sm"
                            className="h-10 rounded-xl"
                            onClick={handleVerifyPhoneOtp}
                            disabled={verifyingOtp || phoneOtpCode.length < 6}
                          >
                            {verifyingOtp
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : 'Verify'}
                          </Button>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSendPhoneOtp}
                            disabled={resendCooldown > 0 || sendingOtp}
                            className="text-xs text-primary disabled:text-muted-foreground hover:underline"
                          >
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPhoneOtpSent(false); setPhoneOtpCode(''); }}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Change number
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {phoneError && (
                      <div className="flex items-start gap-1.5 text-destructive text-xs">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{phoneError}</span>
                      </div>
                    )}
                  </div>
                </Field>

                {/* SA ID / Passport */}
                <Field label="SA ID or Passport Number *">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={form.id_number}
                        onChange={e => set('id_number', e.target.value)}
                        placeholder="13-digit SA ID or passport number"
                        className={`h-12 rounded-xl flex-1 ${
                          idVerified ? 'border-green-500' : idError ? 'border-destructive' : ''
                        }`}
                        disabled={idVerified}
                      />
                      {idVerified ? (
                        <div className="h-12 px-3 flex items-center gap-1.5 rounded-xl bg-green-50 dark:bg-green-950 border border-green-500 text-green-600 text-sm font-medium shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                          {idType === 'passport' ? 'Submitted' : 'Verified'}
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 rounded-xl shrink-0 gap-1.5"
                          onClick={handleVerifyId}
                          disabled={verifyingId || !form.id_number.trim()}
                        >
                          {verifyingId
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <IdCard className="w-4 h-4" />}
                          {verifyingId ? 'Checking…' : 'Verify'}
                        </Button>
                      )}
                    </div>

                    {idError && (
                      <div className="flex items-start gap-1.5 text-destructive text-xs">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{idError}</span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      SA ID: enter your 13-digit number. Passport: enter your number, then upload photos below.
                    </p>

                    {/* Passport upload section */}
                    {idType === 'passport' && !idVerified && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-muted/50 border border-border rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <p className="text-sm font-semibold">Upload your passport pages</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Upload clear photos of both pages. Your passport will be reviewed by our team.
                        </p>

                        {/* Front page */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Photo / Bio page *</p>
                          <input
                            type="file"
                            accept="image/*"
                            ref={passportFrontRef}
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handlePassportUpload(f, 'front');
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => passportFrontRef.current?.click()}
                            disabled={uploadingFront}
                            className={`w-full h-12 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm transition-colors ${
                              passportFrontUrl
                                ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-600'
                                : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/80'
                            }`}
                          >
                            {uploadingFront ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                            ) : passportFrontUrl ? (
                              <><CheckCircle2 className="w-4 h-4" /> Photo page uploaded</>
                            ) : (
                              <><Upload className="w-4 h-4" /> Upload photo / bio page</>
                            )}
                          </button>
                        </div>

                        {/* Back page */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Back / Visa page *</p>
                          <input
                            type="file"
                            accept="image/*"
                            ref={passportBackRef}
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handlePassportUpload(f, 'back');
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => passportBackRef.current?.click()}
                            disabled={uploadingBack || !passportFrontUrl}
                            className={`w-full h-12 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm transition-colors ${
                              passportBackUrl
                                ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-600'
                                : !passportFrontUrl
                                ? 'border-border text-muted-foreground opacity-40 cursor-not-allowed'
                                : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/80'
                            }`}
                          >
                            {uploadingBack ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                            ) : passportBackUrl ? (
                              <><CheckCircle2 className="w-4 h-4" /> Back page uploaded</>
                            ) : (
                              <><Upload className="w-4 h-4" /> Upload back / visa page</>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {idType === 'passport' && idVerified && (
                      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Passport submitted — our team will review within 24–48 hours.</span>
                      </div>
                    )}
                  </div>
                </Field>
              </>
            )}

            {/* ── STEP 1: Your School ───────────────────────────────────────── */}
            {step === 1 && (
              <>
                <Field label="Current Province *">
                  <Select value={form.current_province} onValueChange={v => set('current_province', v)}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select your province" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="School Name *">
                  <Input
                    value={form.current_school}
                    onChange={e => set('current_school', e.target.value)}
                    placeholder="e.g. Soweto High School"
                    className="h-12 rounded-xl"
                    autoFocus
                  />
                </Field>

                <Field label="District / Circuit">
                  <Input
                    value={form.current_district}
                    onChange={e => set('current_district', e.target.value)}
                    placeholder="e.g. Johannesburg South District"
                    className="h-12 rounded-xl"
                  />
                </Field>

                <Field label="SACE Number">
                  <Input
                    value={form.sace_number}
                    onChange={e => set('sace_number', e.target.value)}
                    placeholder="e.g. 12345678"
                    className="h-12 rounded-xl"
                  />
                </Field>

                <Field label="Years of Experience">
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={form.years_experience}
                    onChange={e => set('years_experience', e.target.value)}
                    placeholder="e.g. 5"
                    className="h-12 rounded-xl"
                  />
                </Field>
              </>
            )}

            {/* ── STEP 2: What You Teach ───────────────────────────────────── */}
            {step === 2 && (
              <>
                <Field label="Teaching Phase *">
                  <Select value={form.phase} onValueChange={v => set('phase', v)}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select your phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Subjects You Teach *">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Select value={subjectToAdd} onValueChange={setSubjectToAdd}>
                        <SelectTrigger className="h-11 rounded-xl flex-1">
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBJECTS.filter(s => !form.subjects.includes(s)).map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                          <SelectItem value="Other">Other…</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-xl shrink-0"
                        onClick={addSubject}
                        disabled={!subjectToAdd}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {subjectToAdd === 'Other' && (
                      <Input
                        value={customSubject}
                        onChange={e => setCustomSubject(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addSubject()}
                        placeholder="Type subject name…"
                        className="h-11 rounded-xl"
                        autoFocus
                      />
                    )}

                    {form.subjects.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {form.subjects.map(s => (
                          <Badge key={s} variant="secondary" className="gap-1.5 pr-1.5 pl-2.5 py-1">
                            {s}
                            <button
                              type="button"
                              onClick={() => removeSubject(s)}
                              className="ml-0.5 hover:text-destructive transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Short Bio">
                  <Textarea
                    value={form.bio}
                    onChange={e => set('bio', e.target.value)}
                    placeholder="Tell other educators a little about yourself, your teaching style, or what you're looking for in a transfer partner…"
                    className="rounded-xl resize-none"
                    rows={4}
                  />
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 gap-3">
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setStep(s => s - 1)}
              disabled={saving}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          ) : (
            <div />
          )}

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              className="gap-1.5 min-w-32"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="gap-1.5 min-w-44"
              onClick={handleFinish}
              disabled={!canNext() || saving}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                <>Finish &amp; enter app <ChevronRight className="w-4 h-4" /></>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
