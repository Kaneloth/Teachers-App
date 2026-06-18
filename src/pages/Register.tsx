import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Step = 'form' | 'email-otp';

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');

  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw,          setShowPw]          = useState(false);
  const [showConfirmPw,   setShowConfirmPw]   = useState(false);

  const [emailOtp,      setEmailOtp]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName, phone, subscription_plan: 'free' },
      },
    });
    if (error) { toast.error(error.message); }
    else        { setStep('email-otp'); toast.success('Check your email for a verification code!'); }
    setLoading(false);
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: emailOtp, type: 'email' });
    if (error) { toast.error(error.message); }
    else        { toast.success('Email verified! Setting up your profile…'); navigate('/onboarding'); }
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
            We sent an 6-digit code to <strong>{email}</strong>
          </p>
        </div>
        <form onSubmit={handleVerifyEmail} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emailOtp">Verification Code</Label>
            <Input
              id="emailOtp" value={emailOtp}
              onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="rounded-xl text-center text-2xl tracking-[0.4em] font-mono"
              maxLength={6} inputMode="numeric" autoComplete="one-time-code" autoFocus required
            />
          </div>
          <Button type="submit" disabled={loading || emailOtp.length < 6} className="w-full h-11 rounded-xl font-semibold">
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
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" type={showPw ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"
              className="rounded-xl pr-10" minLength={8} required />
            <button type="button" onClick={() => setShowPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input id="confirmPassword" type={showConfirmPw ? 'text' : 'password'} value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password"
              className={`rounded-xl pr-10 ${confirmPassword && confirmPassword !== password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              minLength={8} required />
            <button type="button" onClick={() => setShowConfirmPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== password && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        By registering you agree to our{' '}
        <a
          href="/Terms%20and%20Conditions.html"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary"
        >
          Terms of Service
        </a>{' '}
        and{' '}
        <a
          href="/Privacy%20Policy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary"
        >
          Privacy Policy
        </a>.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
      </p>
    </div>
  );
}