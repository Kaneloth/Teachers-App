import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Eye, EyeOff, Loader2, MailCheck, Upload, X,
  CreditCard, BookOpen, CheckCircle2, XCircle, ShieldCheck, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

/* ── SA ID local format check (Luhn + date) ─────────────────── */
function validateSAIdFormat(id: string): { valid: boolean; message: string } {
  if (!/^\d{13}$/.test(id)) return { valid: false, message: 'ID must be exactly 13 digits.' };
  const month = parseInt(id.slice(2, 4));
  const day   = parseInt(id.slice(4, 6));
  if (month < 1 || month > 12) return { valid: false, message: 'Invalid birth month in ID number.' };
  if (day   < 1 || day   > 31) return { valid: false, message: 'Invalid birth day in ID number.'   };
  let sum = 0, alt = false;
  for (let i = id.length - 1; i >= 0; i--) {
    let n = parseInt(id[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  if (sum % 10 !== 0) return { valid: false, message: 'ID number checksum is invalid. Please check for typos.' };
  return { valid: true, message: '' };
}

/* ── File → base64 ──────────────────────────────────────────── */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Image upload tile ───────────────────────────────────────── */
function ImageUploadTile({
  label, file, onChange, onClear,
}: {
  label: string; file: File | null; onChange: (f: File) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview  = file ? URL.createObjectURL(file) : null;
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt={label} className="w-full h-32 object-cover" />
          <button type="button" onClick={onClear}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full h-32 rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors flex flex-col items-center justify-center gap-2">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Tap to upload photo</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) onChange(e.target.files[0]); }} />
    </div>
  );
}

/* ── Verification result badge ───────────────────────────────── */
type VerifyState = 'idle' | 'verified' | 'unverified' | 'error';

function VerifyBadge({ state, message }: { state: VerifyState; message: string }) {
  if (state === 'idle' || !message) return null;
  const styles: Record<Exclude<VerifyState, 'idle'>, string> = {
    verified:   'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    unverified: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    error:      'bg-red-50   text-red-700   dark:bg-red-900/20   dark:text-red-400',
  };
  const icons: Record<Exclude<VerifyState, 'idle'>, React.ReactElement> = {
    verified:   <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />,
    unverified: <AlertCircle  className="w-4 h-4 mt-0.5 shrink-0" />,
    error:      <XCircle      className="w-4 h-4 mt-0.5 shrink-0" />,
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${styles[state as Exclude<VerifyState, 'idle'>]}`}>
      {icons[state as Exclude<VerifyState, 'idle'>]}
      <span>{message}</span>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
type Step    = 'form' | 'email-otp';
type DocType = 'id'   | 'passport';

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');

  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);

  const [docType,        setDocType]        = useState<DocType>('id');
  const [idNumber,       setIdNumber]       = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportFront,  setPassportFront]  = useState<File | null>(null);
  const [passportBack,   setPassportBack]   = useState<File | null>(null);

  const [idVerifyState,       setIdVerifyState]       = useState<VerifyState>('idle');
  const [idVerifyMsg,         setIdVerifyMsg]         = useState('');
  const [passportVerifyState, setPassportVerifyState] = useState<VerifyState>('idle');
  const [passportVerifyMsg,   setPassportVerifyMsg]   = useState('');
  const [verifyLoading,       setVerifyLoading]       = useState(false);

  const [emailOtp,      setEmailOtp]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const switchDocType = (t: DocType) => {
    setDocType(t);
    setIdVerifyState('idle'); setIdVerifyMsg('');
    setPassportVerifyState('idle'); setPassportVerifyMsg('');
    setIdNumber(''); setPassportNumber('');
    setPassportFront(null); setPassportBack(null);
  };

  const handleIdChange = (val: string) => {
    setIdNumber(val.replace(/\D/g, ''));
    setIdVerifyState('idle'); setIdVerifyMsg('');
  };
  const handlePassportNumberChange = (val: string) => {
    setPassportNumber(val.toUpperCase());
    setPassportVerifyState('idle'); setPassportVerifyMsg('');
  };
  const handlePassportFrontChange = (f: File) => { setPassportFront(f);  setPassportVerifyState('idle'); setPassportVerifyMsg(''); };
  const handlePassportBackChange  = (f: File) => { setPassportBack(f);   setPassportVerifyState('idle'); setPassportVerifyMsg(''); };
  const clearPassportFront = () => { setPassportFront(null); setPassportVerifyState('idle'); setPassportVerifyMsg(''); };
  const clearPassportBack  = () => { setPassportBack(null);  setPassportVerifyState('idle'); setPassportVerifyMsg(''); };

  /* ── Verify SA ID via VerifyNow ──────────────────────────── */
  const handleVerifyId = async () => {
    // Quick local format check first
    const local = validateSAIdFormat(idNumber);
    if (!local.valid) {
      setIdVerifyState('error');
      setIdVerifyMsg(local.message);
      toast.error(local.message);
      return;
    }

    setVerifyLoading(true);
    try {
      const res  = await fetch('/.netlify/functions/verify-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idNumber }),
      });

      let data: { verified?: boolean; error?: string; details?: unknown } = {};
      try { data = await res.json(); } catch { /* non-JSON body */ }

      if (data.error) {
        // Service returned a meaningful error — show it but let user proceed
        setIdVerifyState('unverified');
        setIdVerifyMsg(`Could not verify: ${data.error}. You may still continue.`);
        toast.warning(data.error);
        return;
      }

      if (data.verified) {
        setIdVerifyState('verified');
        setIdVerifyMsg('ID number verified with Home Affairs records.');
        toast.success('SA ID verified successfully.');
      } else {
        setIdVerifyState('unverified');
        setIdVerifyMsg('ID number could not be confirmed. You may still continue — we will follow up.');
        toast.warning('ID verification inconclusive. You can still register.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setIdVerifyState('unverified');
      setIdVerifyMsg('Verification service unreachable. You may still continue.');
      toast.warning(msg);
    } finally {
      setVerifyLoading(false);
    }
  };

  /* ── Verify Passport via VerifyNow ───────────────────────── */
  const handleVerifyPassport = async () => {
    if (!passportNumber.trim()) {
      toast.error('Please enter your passport number first.');
      return;
    }
    if (!passportFront || !passportBack) {
      toast.error('Please upload both the front and back photos of your passport.');
      return;
    }

    setVerifyLoading(true);
    try {
      const [frontBase64, backBase64] = await Promise.all([
        fileToBase64(passportFront),
        fileToBase64(passportBack),
      ]);

      const res  = await fetch('/.netlify/functions/verify-passport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passportNumber,
          frontBase64,
          frontType: passportFront.type,
          backBase64,
          backType: passportBack.type,
        }),
      });

      let data: { verified?: boolean; error?: string; details?: unknown } = {};
      try { data = await res.json(); } catch { /* non-JSON body */ }

      if (data.error) {
        setPassportVerifyState('unverified');
        setPassportVerifyMsg(`Could not verify: ${data.error}. You may still continue.`);
        toast.warning(data.error);
        return;
      }

      if (data.verified) {
        setPassportVerifyState('verified');
        setPassportVerifyMsg('Passport documents verified successfully.');
        toast.success('Passport verified successfully.');
      } else {
        setPassportVerifyState('unverified');
        setPassportVerifyMsg('Passport could not be confirmed. You may still continue — we will follow up.');
        toast.warning('Passport verification inconclusive. You can still register.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setPassportVerifyState('unverified');
      setPassportVerifyMsg('Verification service unreachable. You may still continue.');
      toast.warning(msg);
    } finally {
      setVerifyLoading(false);
    }
  };

  /* ── Create account ───────────────────────────────────────── */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (docType === 'id' && !idNumber.trim()) {
      toast.error('Please enter your ID number.'); return;
    }
    if (docType === 'passport' && !passportNumber.trim()) {
      toast.error('Please enter your passport number.'); return;
    }
    if (docType === 'passport' && (!passportFront || !passportBack)) {
      toast.error('Please upload both passport images.'); return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          full_name: fullName,
          phone,
          doc_type: docType,
          doc_verified: docType === 'id'
            ? idVerifyState === 'verified'
            : passportVerifyState === 'verified',
          ...(docType === 'id'
            ? { id_number: idNumber }
            : { passport_number: passportNumber }),
          subscription_plan: 'free',
        },
      },
    });
    if (error) { toast.error(error.message); }
    else        { setStep('email-otp'); toast.success('Check your email for a verification code!'); }
    setLoading(false);
  };

  /* ── Verify email OTP ─────────────────────────────────────── */
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: emailOtp, type: 'email' });
    if (error) { toast.error(error.message); setLoading(false); return; }

    if (docType === 'passport' && data.user && (passportFront || passportBack)) {
      const uid = data.user.id;
      const uploads = [];
      if (passportFront) {
        const ext = passportFront.name.split('.').pop();
        uploads.push(supabase.storage.from('documents').upload(`${uid}/passport-front.${ext}`, passportFront, { upsert: true }));
      }
      if (passportBack) {
        const ext = passportBack.name.split('.').pop();
        uploads.push(supabase.storage.from('documents').upload(`${uid}/passport-back.${ext}`, passportBack, { upsert: true }));
      }
      const results = await Promise.all(uploads);
      if (results.some(r => r.error))
        toast.warning('Account created, but passport images failed to upload. Re-upload from your profile.');
    }

    toast.success('Email verified! Setting up your profile…');
    navigate('/onboarding');
    setLoading(false);
  };

  const handleResendEmailOtp = async () => {
    setResendLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) toast.error(error.message);
    else       toast.success('New code sent — check your inbox.');
    setResendLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
    if (error) toast.error(error.message);
    setGoogleLoading(false);
  };

  /* ── Email OTP screen ─────────────────────────────────────── */
  if (step === 'email-otp') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <MailCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We sent an 8-digit code to <strong>{email}</strong>
          </p>
        </div>
        <form onSubmit={handleVerifyEmail} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emailOtp">Verification Code</Label>
            <Input
              id="emailOtp" value={emailOtp}
              onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="12345678"
              className="rounded-xl text-center text-2xl tracking-[0.4em] font-mono"
              maxLength={8} inputMode="numeric" autoComplete="one-time-code" autoFocus required
            />
          </div>
          <Button type="submit" disabled={loading || emailOtp.length < 8} className="w-full h-11 rounded-xl font-semibold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
          </Button>
        </form>
        <div className="text-center space-y-2 text-sm text-muted-foreground">
          <p>Didn't receive it?{' '}
            <button onClick={handleResendEmailOtp} disabled={resendLoading}
              className="text-primary font-semibold hover:underline disabled:opacity-50">
              {resendLoading ? 'Sending…' : 'Resend code'}
            </button>
          </p>
          <p>Wrong email?{' '}
            <button onClick={() => { setStep('form'); setEmailOtp(''); }}
              className="text-primary font-semibold hover:underline">Go back</button>
          </p>
        </div>
      </div>
    );
  }

  /* ── Registration form ────────────────────────────────────── */
  const idBtnDone      = idVerifyState       === 'verified' || idVerifyState       === 'unverified';
  const passportBtnDone = passportVerifyState === 'verified' || passportVerifyState === 'unverified';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
        <p className="text-sm text-muted-foreground mt-1">Join 1,200+ South African educators</p>
      </div>

      <Button variant="outline" onClick={handleGoogle} disabled={googleLoading} className="w-full h-11 rounded-xl gap-3">
        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <svg viewBox="0 0 24 24" className="w-4 h-4">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continue with Google
      </Button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or</span><div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {/* Basic info */}
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Thabo Pretorius" className="rounded-xl" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="educator@example.co.za" className="rounded-xl" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="081 234 5678" className="rounded-xl" inputMode="tel" />
        </div>

        {/* Document type toggle */}
        <div className="space-y-2">
          <Label>Identity Document</Label>
          <div className="grid grid-cols-2 bg-muted rounded-xl p-1 gap-1">
            <button type="button" onClick={() => switchDocType('id')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${docType === 'id' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
              <CreditCard className="w-4 h-4" /> SA ID
            </button>
            <button type="button" onClick={() => switchDocType('passport')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${docType === 'passport' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
              <BookOpen className="w-4 h-4" /> Passport
            </button>
          </div>
        </div>

        {/* ── SA ID ── */}
        {docType === 'id' && (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="idNumber">SA ID Number</Label>
              <Input
                id="idNumber" value={idNumber}
                onChange={e => handleIdChange(e.target.value)}
                placeholder="8001015009087"
                className={`rounded-xl font-mono tracking-wider
                  ${idVerifyState === 'verified'   ? 'border-green-500 focus-visible:ring-green-500' : ''}
                  ${idVerifyState === 'unverified' ? 'border-amber-500 focus-visible:ring-amber-500' : ''}
                  ${idVerifyState === 'error'      ? 'border-red-500   focus-visible:ring-red-500'   : ''}`}
                inputMode="numeric" maxLength={13} required
              />
              <p className="text-xs text-muted-foreground pl-1">13-digit South African ID number</p>
            </div>
            <VerifyBadge state={idVerifyState} message={idVerifyMsg} />
            <Button
              type="button"
              variant={idBtnDone ? 'outline' : 'default'}
              onClick={handleVerifyId}
              disabled={idNumber.length !== 13 || verifyLoading || idBtnDone}
              className={`w-full h-10 rounded-xl gap-2 font-medium
                ${idVerifyState === 'verified'   ? 'border-green-500 text-green-700 dark:text-green-400' : ''}
                ${idVerifyState === 'unverified' ? 'border-amber-500 text-amber-700 dark:text-amber-400' : ''}`}
            >
              {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" />
                : idVerifyState === 'verified'   ? <><CheckCircle2 className="w-4 h-4" /> ID Verified</>
                : idVerifyState === 'unverified' ? <><AlertCircle  className="w-4 h-4" /> Verification Inconclusive</>
                :                                  <><ShieldCheck  className="w-4 h-4" /> Verify ID Number</>}
            </Button>
          </div>
        )}

        {/* ── Passport ── */}
        {docType === 'passport' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="passportNumber">Passport Number</Label>
              <Input
                id="passportNumber" value={passportNumber}
                onChange={e => handlePassportNumberChange(e.target.value)}
                placeholder="A12345678"
                className={`rounded-xl font-mono tracking-wider
                  ${passportVerifyState === 'verified'   ? 'border-green-500 focus-visible:ring-green-500' : ''}
                  ${passportVerifyState === 'unverified' ? 'border-amber-500 focus-visible:ring-amber-500' : ''}
                  ${passportVerifyState === 'error'      ? 'border-red-500   focus-visible:ring-red-500'   : ''}`}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ImageUploadTile label="Passport — Front" file={passportFront} onChange={handlePassportFrontChange} onClear={clearPassportFront} />
              <ImageUploadTile label="Passport — Back"  file={passportBack}  onChange={handlePassportBackChange}  onClear={clearPassportBack}  />
            </div>
            <p className="text-xs text-muted-foreground pl-1">Upload clear photos of both sides of your passport.</p>
            <VerifyBadge state={passportVerifyState} message={passportVerifyMsg} />
            <Button
              type="button"
              variant={passportBtnDone ? 'outline' : 'default'}
              onClick={handleVerifyPassport}
              disabled={verifyLoading || passportBtnDone}
              className={`w-full h-10 rounded-xl gap-2 font-medium
                ${passportVerifyState === 'verified'   ? 'border-green-500 text-green-700 dark:text-green-400' : ''}
                ${passportVerifyState === 'unverified' ? 'border-amber-500 text-amber-700 dark:text-amber-400' : ''}`}
            >
              {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" />
                : passportVerifyState === 'verified'   ? <><CheckCircle2 className="w-4 h-4" /> Passport Verified</>
                : passportVerifyState === 'unverified' ? <><AlertCircle  className="w-4 h-4" /> Verification Inconclusive</>
                :                                        <><ShieldCheck  className="w-4 h-4" /> Verify Passport Documents</>}
            </Button>
          </div>
        )}

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" type={showPw ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"
              className="rounded-xl pr-10" minLength={8} required />
            <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        By registering you agree to our{' '}
        <span className="underline cursor-pointer">Terms of Service</span> and{' '}
        <span className="underline cursor-pointer">Privacy Policy</span>.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
