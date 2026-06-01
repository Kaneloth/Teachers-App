import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { RefreshCw, ChevronRight, ChevronLeft, Plus, X, CheckCircle2, AlertCircle, Upload, Loader2, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const PROVINCES = [
  'Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape',
  'Mpumalanga', 'Limpopo', 'North West', 'Free State', 'Northern Cape'
];

const SUBJECTS = [
  'Accounting','Afrikaans FAL','Afrikaans HL','Agricultural Sciences',
  'Agricultural Management Practices','Agricultural Technology','Business Studies',
  'Computer Applications Technology','Consumer Studies','Dance Studies','Design',
  'Dramatic Arts','Economics','Engineering Graphics and Design','English FAL',
  'English HL','Geography','History','Hospitality Studies','Information Technology',
  'isiNdebele FAL','isiNdebele HL','isiXhosa FAL','isiXhosa HL','isiZulu FAL',
  'isiZulu HL','Life Orientation','Life Sciences','Mathematical Literacy','Mathematics',
  'Music','Natural Sciences','Physical Sciences','Religion Studies','Sepedi FAL',
  'Sepedi HL','Sesotho FAL','Sesotho HL','Setswana FAL','Setswana HL',
  'Sign Language HL','Siswati FAL','Siswati HL','Social Sciences','Technology',
  'Tshivenda FAL','Tshivenda HL','Tourism','Visual Arts','Xitsonga FAL','Xitsonga HL','Other',
];

const PHASES = ['Foundation', 'Intermediate', 'Senior', 'FET'];
const STEPS = ['About You', 'Your School', 'What You Teach'];

// Simple in-memory OTP store (per session)
let sessionOtp = null;
let sessionOtpPhone = null;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState(false);
  const [idError, setIdError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [idType, setIdType] = useState(null); // 'said' | 'passport'
  const [requiresPassport, setRequiresPassport] = useState(false);

  // Passport upload state
  const [passportFront, setPassportFront] = useState(null);
  const [passportBack, setPassportBack] = useState(null);
  const [uploadingPassport, setUploadingPassport] = useState(false);
  const [passportFrontUrl, setPassportFrontUrl] = useState('');
  const [passportBackUrl, setPassportBackUrl] = useState('');
  const passportFrontRef = useRef();
  const passportBackRef = useRef();

  // Phone OTP state
  const [phoneOtpStep, setPhoneOtpStep] = useState(false); // show OTP input
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [customSubject, setCustomSubject] = useState('');
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
    subjects: [],
    years_experience: '',
  });

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.full_name) setForm(f => ({ ...f, full_name: user.full_name }));
    });
  }, []);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (field === 'id_number') { setIdError(''); setIdType(null); setRequiresPassport(false); }
    if (field === 'phone') { setPhoneError(''); setPhoneVerified(false); setPhoneOtpStep(false); }
  };

  const addSubject = () => {
    const subject = subjectToAdd === 'Other' ? customSubject.trim() : subjectToAdd;
    if (subject && !form.subjects.includes(subject)) {
      setForm(f => ({ ...f, subjects: [...f.subjects, subject] }));
      setSubjectToAdd('');
      setCustomSubject('');
    }
  };

  const removeSubject = (s) => setForm(f => ({ ...f, subjects: f.subjects.filter(x => x !== s) }));

  // Upload a passport image and return URL
  const uploadImage = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  // Send phone OTP (we generate a 6-digit code and "send" via email since no SMS provider)
  const handleSendPhoneOtp = async () => {
    if (!form.phone.trim()) { setPhoneError('Please enter your phone number first.'); return; }

    setSendingOtp(true);
    setPhoneError('');
    try {
      // Check duplicate phone
      const dupRes = await base44.functions.invoke('checkDuplicateContact', { phone: form.phone.trim() });
      if (!dupRes.data.available) {
        setPhoneError(dupRes.data.message);
        setSendingOtp(false);
        return;
      }

      // Generate OTP and send via BulkSMS
      const code = String(Math.floor(100000 + Math.random() * 900000));
      sessionOtp = code;
      sessionOtpPhone = form.phone.trim();

      await base44.functions.invoke('sendSmsOtp', { phone: form.phone.trim(), code });

      setPhoneOtpStep(true);
      toast.success('Verification code sent via SMS.');
      setResendCooldown(60);
    } catch {
      setPhoneError('Failed to send verification code. Please try again.');
    }
    setSendingOtp(false);
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerifyPhoneOtp = () => {
    setVerifyingOtp(true);
    if (phoneOtpCode === sessionOtp && sessionOtpPhone === form.phone.trim()) {
      setPhoneVerified(true);
      setPhoneOtpStep(false);
      sessionOtp = null;
      toast.success('Phone number verified!');
    } else {
      setPhoneError('Incorrect code. Please try again.');
    }
    setVerifyingOtp(false);
  };

  const canNext = () => {
    if (step === 0) {
      const hasBasics = form.full_name.trim().length > 0 && form.id_number.trim().length > 0;
      const phoneOk = !form.phone.trim() || phoneVerified; // phone optional but must be verified if entered
      if (requiresPassport) return hasBasics && phoneOk && passportFrontUrl && passportBackUrl;
      return hasBasics && phoneOk;
    }
    if (step === 1) return form.current_province !== '' && form.current_school.trim().length > 0;
    if (step === 2) return form.phase !== '' && form.subjects.length > 0;
    return true;
  };

  const handleNextStep0 = async () => {
    setCheckingId(true);
    setIdError('');
    try {
      const res = await base44.functions.invoke('checkIdNumber', {
        id_number: form.id_number.trim(),
        full_name: form.full_name.trim(),
      });

      if (!res.data.available) {
        setIdError(res.data.message);
        setCheckingId(false);
        return;
      }

      const detectedIdType = res.data.id_type;
      setIdType(detectedIdType);

      if (detectedIdType === 'passport' && !passportFrontUrl) {
        setRequiresPassport(true);
        setCheckingId(false);
        return; // Stay on step 0, show upload UI
      }

      if (requiresPassport && (!passportFrontUrl || !passportBackUrl)) {
        setIdError('Please upload both pages of your passport.');
        setCheckingId(false);
        return;
      }

      setStep(s => s + 1);
    } catch {
      setIdError('Could not verify ID number. Please try again.');
    }
    setCheckingId(false);
  };

  const runDocumentVerify = async (frontUrl, backUrl) => {
    if (!frontUrl || !backUrl) return;
    try {
      await base44.functions.invoke('verifyPassportDocument', { front_url: frontUrl, back_url: backUrl });
    } catch {
      // Silent — admin can still manually review
    }
  };

  const handleUploadPassportFront = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPassport(true);
    setPassportFront(file);
    const url = await uploadImage(file);
    setPassportFrontUrl(url);
    setUploadingPassport(false);
    if (passportBackUrl) runDocumentVerify(url, passportBackUrl);
  };

  const handleUploadPassportBack = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPassport(true);
    setPassportBack(file);
    const url = await uploadImage(file);
    setPassportBackUrl(url);
    setUploadingPassport(false);
    if (passportFrontUrl) runDocumentVerify(passportFrontUrl, url);
  };

  const handleFinish = async () => {
    setSaving(true);
    const user = await base44.auth.me();

    const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const letters = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
    const userCode = `CT-${digits}${letters}`;

    await base44.auth.updateMe({
      id_number: form.id_number.trim().toUpperCase(),
      id_type: idType || 'said',
      id_verified: idType === 'said', // SA IDs are auto-verified via VerifyNow; passports need admin review
      id_verification_status: idType === 'passport' ? 'needs_review' : 'verified',
      passport_front_url: passportFrontUrl || undefined,
      passport_back_url: passportBackUrl || undefined,
      sace_number: form.sace_number.trim(),
      phone: form.phone.trim() || undefined,
      phone_verified: phoneVerified,
      user_code: userCode,
    });

    const data = {
      full_name: form.full_name,
      phone: form.phone,
      bio: form.bio,
      sace_number: form.sace_number.trim(),
      current_school: form.current_school,
      current_province: form.current_province,
      current_district: form.current_district,
      phase: form.phase,
      subjects: form.subjects,
      years_experience: form.years_experience ? Number(form.years_experience) : undefined,
    };

    const existing = await base44.entities.Educator.filter({ created_by_id: user.id });
    if (existing.length > 0) {
      await base44.entities.Educator.update(existing[0].id, data);
    } else {
      await base44.entities.Educator.create(data);
    }
    window.location.href = '/';
  };

  const stepContent = [
    // Step 0 – About You
    <div key="about" className="space-y-4">
      <Field label="Full Name *">
        <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Thandi Nkosi" className="rounded-xl h-12" autoFocus />
      </Field>

      <Field label="SA ID / Passport Number *">
        <Input
          value={form.id_number}
          onChange={e => set('id_number', e.target.value)}
          placeholder="e.g. 8001015009087 or A12345678"
          className={`rounded-xl h-12 ${idError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        />
        {idError && (
          <div className="flex items-start gap-2 mt-1.5 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{idError}</span>
          </div>
        )}
      </Field>

      {/* Passport upload — shown after passport detected */}
      {requiresPassport && (
        <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">Passport Document Required</p>
          <p className="text-xs text-muted-foreground">Please upload clear photos of your passport for identity verification.</p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Photo / Bio Page *</p>
            <input type="file" accept="image/*" ref={passportFrontRef} className="hidden" onChange={handleUploadPassportFront} />
            <button
              onClick={() => passportFrontRef.current?.click()}
              className={`w-full h-11 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm transition-colors ${
                passportFrontUrl ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {uploadingPassport && !passportFrontUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {passportFrontUrl ? 'Photo page uploaded ✓' : 'Upload photo/bio page'}
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Back / Details Page *</p>
            <input type="file" accept="image/*" ref={passportBackRef} className="hidden" onChange={handleUploadPassportBack} />
            <button
              onClick={() => passportBackRef.current?.click()}
              className={`w-full h-11 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm transition-colors ${
                passportBackUrl ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {uploadingPassport && !passportBackUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {passportBackUrl ? 'Back page uploaded ✓' : 'Upload back/details page'}
            </button>
          </div>
        </div>
      )}

      <Field label="SACE Registration Number">
        <Input value={form.sace_number} onChange={e => set('sace_number', e.target.value)} placeholder="e.g. 123456" className="rounded-xl h-12" />
      </Field>

      <Field label="Phone Number">
        {!phoneOtpStep ? (
          <div className="flex gap-2">
            <Input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+27 XX XXX XXXX"
              className={`rounded-xl h-12 flex-1 ${phoneError && !phoneOtpStep ? 'border-destructive' : ''}`}
              disabled={phoneVerified}
            />
            {form.phone.trim() && !phoneVerified && (
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl shrink-0 gap-1.5 text-xs px-3"
                onClick={handleSendPhoneOtp}
                disabled={sendingOtp}
              >
                {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                Verify
              </Button>
            )}
            {phoneVerified && (
              <div className="h-12 flex items-center px-3 text-primary text-sm font-medium gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Verified
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to your phone via SMS.</p>
            <InputOTP maxLength={6} value={phoneOtpCode} onChange={setPhoneOtpCode}>
              <InputOTPGroup>
                {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 h-10 rounded-xl text-xs" onClick={() => setPhoneOtpStep(false)}>
                Back
              </Button>
              <Button type="button" className="flex-1 h-10 rounded-xl text-xs" onClick={handleVerifyPhoneOtp} disabled={verifyingOtp || phoneOtpCode.length < 6}>
                {verifyingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
              </Button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={handleSendPhoneOtp}
                disabled={resendCooldown > 0 || sendingOtp}
                className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sendingOtp ? 'Sending...' : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive it? Resend code"}
              </button>
            </div>
          </div>
        )}
        {phoneError && (
          <div className="flex items-start gap-2 mt-1.5 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{phoneError}</span>
          </div>
        )}
      </Field>

      <Field label="Short Bio">
        <Textarea value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Tell other educators a little about yourself..." rows={3} className="rounded-xl" />
      </Field>
    </div>,

    // Step 1 – Your School
    <div key="school" className="space-y-4">
      <Field label="Current Province *">
        <Select value={form.current_province} onValueChange={v => set('current_province', v)}>
          <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select your province" /></SelectTrigger>
          <SelectContent>
            {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="School Name *">
        <Input value={form.current_school} onChange={e => set('current_school', e.target.value)} placeholder="e.g. Pretoria High School" className="rounded-xl h-12" />
      </Field>
      <Field label="District">
        <Input value={form.current_district} onChange={e => set('current_district', e.target.value)} placeholder="e.g. Tshwane South" className="rounded-xl h-12" />
      </Field>
    </div>,

    // Step 2 – What You Teach
    <div key="teach" className="space-y-4">
      <Field label="Teaching Phase *">
        <div className="grid grid-cols-2 gap-2">
          {PHASES.map(p => (
            <button
              key={p}
              onClick={() => set('phase', p)}
              className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                form.phase === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-foreground hover:border-primary/50'
              }`}
            >
              {p} Phase
            </button>
          ))}
        </div>
      </Field>
      <Field label="Subjects Taught *">
        <div className="flex gap-2 mb-2">
          <Select value={subjectToAdd} onValueChange={v => { setSubjectToAdd(v); setCustomSubject(''); }}>
            <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder="Add a subject" /></SelectTrigger>
            <SelectContent>
              {SUBJECTS.filter(s => !form.subjects.includes(s)).map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSubject} disabled={!subjectToAdd || (subjectToAdd === 'Other' && !customSubject.trim())}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {subjectToAdd === 'Other' && (
          <Input
            value={customSubject}
            onChange={e => setCustomSubject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubject()}
            placeholder="Type subject name..."
            className="rounded-xl h-11 mb-2"
            autoFocus
          />
        )}
        <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
          {form.subjects.map(s => (
            <Badge key={s} variant="secondary" className="gap-1 pr-1">
              {s}
              <button onClick={() => removeSubject(s)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      </Field>
      <Field label="Years of Experience">
        <Input type="number" min="0" max="50" value={form.years_experience} onChange={e => set('years_experience', e.target.value)} placeholder="e.g. 5" className="rounded-xl h-12" />
      </Field>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 pt-10 pb-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <RefreshCw className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set up your profile</h1>
          <p className="text-muted-foreground mt-1 text-sm">Help other educators find and connect with you</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${i === step ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  i < step ? 'bg-primary border-primary text-primary-foreground'
                  : i === step ? 'border-primary text-primary bg-background'
                  : 'border-muted-foreground text-muted-foreground bg-background'
                }`}>
                  {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="text-xs font-medium text-foreground hidden sm:block">{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4">{STEPS[step]}</h2>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
            >
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex gap-3 mt-4">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 h-12 rounded-xl gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              onClick={step === 0 ? handleNextStep0 : () => setStep(s => s + 1)}
              disabled={!canNext() || checkingId || uploadingPassport}
              className="flex-1 h-12 rounded-xl gap-2"
            >
              {checkingId ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <>Next <ChevronRight className="w-4 h-4" /></>}
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={!canNext() || saving} className="flex-1 h-12 rounded-xl font-semibold">
              {saving ? 'Setting up your profile...' : 'Complete Setup'}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can update all details later from your profile.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}