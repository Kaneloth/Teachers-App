import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, MailCheck, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';

async function sendPhoneOtp(phone: string): Promise<string | null> {
  const res = await fetch('/.netlify/functions/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return (data as { error?: string }).error || 'Failed to send SMS';
  }
  return null;
}

async function verifyPhoneOtp(phone: string, otp: string): Promise<string | null> {
  const res = await fetch('/.netlify/functions/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return (data as { error?: string }).error || 'Invalid code';
  }
  return null;
}

type Step = 'form' | 'email-otp' | 'phone-otp';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [step, setStep] = useState<Step>('form');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  // ── Step 1: password login ────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
        await supabase.auth.resend({ type: 'signup', email });
        setStep('email-otp');
        toast.info('A verification code has been sent to your email.');
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    const u = data.user;
    const phone = u?.user_metadata?.phone as string | undefined;
    const phoneVerified = u?.user_metadata?.phone_verified as boolean | undefined;

    // If phone exists but isn't verified, require phone OTP before entry
    if (phone && !phoneVerified) {
      setUserPhone(phone);
      const err = await sendPhoneOtp(phone);
      if (err) {
        toast.error('Could not send SMS: ' + err);
        // Sign out so they can't bypass phone verification
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      setStep('phone-otp');
      toast.info('Please verify your phone number to continue.');
      setLoading(false);
      return;
    }

    navigate('/home');
    setLoading(false);
  };

  // ── Step 2a: verify email OTP (unconfirmed-email path) ────────
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: emailOtp, type: 'email' });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const u = data.user;
    const phone = u?.user_metadata?.phone as string | undefined;
    const phoneVerified = u?.user_metadata?.phone_verified as boolean | undefined;

    if (phone && !phoneVerified) {
      setUserPhone(phone);
      const err = await sendPhoneOtp(phone);
      if (err) {
        toast.error('Could not send SMS: ' + err);
        setLoading(false);
        return;
      }
      setStep('phone-otp');
      toast.success('Email confirmed! Now verify your phone number.');
      setLoading(false);
      return;
    }

    toast.success('Email verified! Welcome back.');
    navigate('/home');
    setLoading(false);
  };

  // ── Step 2b: verify phone OTP ─────────────────────────────────
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const err = await verifyPhoneOtp(userPhone, phoneOtp);
    if (err) {
      toast.error(err);
    } else {
      // Mark phone as verified in user metadata
      await supabase.auth.updateUser({ data: { phone_verified: true } });
      toast.success('Phone verified! Welcome back.');
      navigate('/home');
    }
    setLoading(false);
  };

  const handleResendEmailOtp = async () => {
    setResendLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) toast.error(error.message);
    else toast.success('New code sent — check your inbox.');
    setResendLoading(false);
  };

  const handleResendPhoneOtp = async () => {
    setResendLoading(true);
    const err = await sendPhoneOtp(userPhone);
    if (err) toast.error(err);
    else toast.success('New SMS code sent.');
    setResendLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/home` },
    });
    if (error) toast.error(error.message);
    setGoogleLoading(false);
  };

  // ── Email OTP screen ──────────────────────────────────────────
  if (step === 'email-otp') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <MailCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We sent an 8-digit code to <strong>{email}</strong>.<br />Enter it below to continue.
          </p>
        </div>
        <form onSubmit={handleVerifyEmail} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emailOtp">Verification Code</Label>
            <Input
              id="emailOtp"
              value={emailOtp}
              onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="12345678"
              className="rounded-xl text-center text-2xl tracking-[0.4em] font-mono"
              maxLength={8}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </div>
          <Button type="submit" disabled={loading || emailOtp.length < 8} className="w-full h-11 rounded-xl font-semibold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Email →'}
          </Button>
        </form>
        <div className="text-center space-y-2 text-sm text-muted-foreground">
          <p>
            Didn't receive it?{' '}
            <button onClick={handleResendEmailOtp} disabled={resendLoading} className="text-primary font-semibold hover:underline disabled:opacity-50">
              {resendLoading ? 'Sending…' : 'Resend code'}
            </button>
          </p>
          <p>
            Wrong email?{' '}
            <button onClick={() => { setStep('form'); setEmailOtp(''); }} className="text-primary font-semibold hover:underline">
              Go back
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Phone OTP screen ──────────────────────────────────────────
  if (step === 'phone-otp') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <Smartphone className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verify your number</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We sent a 6-digit SMS code to <strong>{userPhone}</strong>.<br />Enter it below to sign in.
          </p>
        </div>
        <form onSubmit={handleVerifyPhone} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phoneOtp">SMS Verification Code</Label>
            <Input
              id="phoneOtp"
              value={phoneOtp}
              onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="rounded-xl text-center text-2xl tracking-[0.4em] font-mono"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </div>
          <Button type="submit" disabled={loading || phoneOtp.length < 6} className="w-full h-11 rounded-xl font-semibold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Sign In'}
          </Button>
        </form>
        <div className="text-center space-y-2 text-sm text-muted-foreground">
          <p>
            Didn't receive it?{' '}
            <button onClick={handleResendPhoneOtp} disabled={resendLoading} className="text-primary font-semibold hover:underline disabled:opacity-50">
              {resendLoading ? 'Sending…' : 'Resend SMS'}
            </button>
          </p>
          <p>
            <button onClick={() => { setStep('form'); setPhoneOtp(''); }} className="text-primary font-semibold hover:underline">
              Back to sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Normal login form ─────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your EduCross account</p>
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
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="educator@example.co.za" className="rounded-xl" required />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Input id="password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="rounded-xl pr-10" required />
            <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary font-semibold hover:underline">Create one</Link>
      </p>
    </div>
  );
}
