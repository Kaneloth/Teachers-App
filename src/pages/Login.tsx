import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, MailCheck, Fingerprint } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type LoginMethod = 'password' | 'biometric' | 'biometric-confirmed';
type Step = 'form' | 'email-otp';

const BIO_CRED_ID_KEY = 'biometricCredentialId'; // saved during fingerprint registration

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => localStorage.getItem('crosssa_last_email') || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const [step, setStep] = useState<Step>('form');
  const [emailOtp, setEmailOtp] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Load preferred login method from localStorage
  useEffect(() => {
    const method = localStorage.getItem('loginMethod') as LoginMethod || 'password';
    setLoginMethod(method);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 1. Biometric login – verify fingerprint, then check existing session
  // ─────────────────────────────────────────────────────────────
  const handleBiometricLogin = async () => {
    setError('');
    setBiometricLoading(true);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('Biometric authentication is not supported on this device.');
      }

      // Prepare WebAuthn challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const storedId = localStorage.getItem(BIO_CRED_ID_KEY);
      if (!storedId) {
        // No fingerprint registered yet → ask for password first
        setLoginMethod('biometric-confirmed');
        return;
      }

      const allowCredentials = [{
        type: 'public-key' as const,
        id: Uint8Array.from(atob(storedId), c => c.charCodeAt(0)),
        transports: ['internal'] as AuthenticatorTransport[],
      }];

      await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials,
          userVerification: 'required',
          timeout: 60000,
        },
      });

      // ✅ Biometric succeeded – now check for existing Supabase session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User already has a valid session → go straight in
        navigate('/home');
      } else {
        // No session – need one-time password to create it
        setLoginMethod('biometric-confirmed');
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Biometric verification failed. Please try again.');
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 2. One‑time password entry (creates the session for future biometric)
  // ─────────────────────────────────────────────────────────────
  const handleBiometricConfirmedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
      // Session is now stored automatically by Supabase
      localStorage.setItem('crosssa_last_email', email);
      // Optional: remember biometric preference
      localStorage.setItem('loginMethod', 'biometric');
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 3. Standard password login
  // ─────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      const msg = signInErr.message.toLowerCase();
      if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
        await supabase.auth.resend({ type: 'signup', email });
        setStep('email-otp');
        toast.info('A verification code has been sent to your email.');
      } else {
        setError(signInErr.message);
      }
    } else {
      localStorage.setItem('crosssa_last_email', email);
      localStorage.setItem('loginMethod', 'biometric'); // enable biometric for next time
      navigate('/home');
    }
    setLoading(false);
  };

  // ─────────────────────────────────────────────────────────────
  // 4. Email OTP (unconfirmed email)
  // ─────────────────────────────────────────────────────────────
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: emailOtp, type: 'email' });
    if (error) {
      setError(error.message);
    } else {
      localStorage.setItem('crosssa_last_email', email);
      localStorage.setItem('loginMethod', 'biometric');
      toast.success('Email verified! Welcome back.');
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

  // ─────────────────────────────────────────────────────────────
  // 5. Google OAuth
  // ─────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/home` },
    });
    if (error) toast.error(error.message);
    setGoogleLoading(false);
  };

  // Google SVG icon
  const GoogleSvg = (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  // ─────────────────────────────────────────────────────────────
  // 6. Screens
  // ─────────────────────────────────────────────────────────────
  if (step === 'email-otp') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <MailCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We sent an 8-digit code to <strong>{email}</strong>.<br />Enter it below to sign in.
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Sign In'}
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

  if (loginMethod === 'biometric') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Log in to your account</p>
        </div>

        <Button variant="outline" onClick={handleGoogle} disabled={googleLoading} className="w-full h-11 rounded-xl gap-3">
          {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : GoogleSvg}
          Continue with Google
        </Button>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <div className="flex flex-col items-center gap-4 py-4">
          <button
            onClick={handleBiometricLogin}
            disabled={biometricLoading}
            className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center transition-all hover:bg-primary/20 active:scale-95 disabled:opacity-60"
          >
            {biometricLoading
              ? <Loader2 className="w-12 h-12 text-primary animate-spin" />
              : <Fingerprint className="w-12 h-12 text-primary" />}
          </button>
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-foreground">
              {biometricLoading ? 'Verifying…' : 'Tap to sign in with Biometric'}
            </p>
            <p className="text-sm text-muted-foreground">Use your fingerprint or Face ID</p>
          </div>
          <button
            onClick={() => setLoginMethod('password')}
            className="text-sm text-primary font-medium hover:underline"
          >
            Use password instead
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">Create one</Link>
        </p>
      </div>
    );
  }

  if (loginMethod === 'biometric-confirmed') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">One-time setup</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your password once to link biometric. Future logins will go straight in.</p>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 text-primary text-sm">
          <Fingerprint className="w-4 h-4 shrink-0" />
          Biometric verified — just confirm your password to complete setup.
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <form onSubmit={handleBiometricConfirmedLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-bio">Email</Label>
            <Input
              id="email-bio"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-xl"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password-bio">Password</Label>
            <div className="relative">
              <Input
                id="password-bio"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="rounded-xl pr-10"
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Logging in…</> : 'Complete Sign-in'}
          </Button>
        </form>
        <button onClick={() => setLoginMethod('biometric')} className="block w-full text-center text-sm text-primary hover:underline">
          ← Back to biometric
        </button>
      </div>
    );
  }

  // Standard password form
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your Crosssa account</p>
      </div>

      <Button variant="outline" onClick={handleGoogle} disabled={googleLoading} className="w-full h-11 rounded-xl gap-3">
        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : GoogleSvg}
        Continue with Google
      </Button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

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

      <div className="text-center space-y-2 text-sm text-muted-foreground">
        {localStorage.getItem('loginMethod') === 'biometric' && (
          <p>
            <button
              onClick={() => setLoginMethod('biometric')}
              className="flex items-center gap-1.5 mx-auto text-primary font-medium hover:underline"
            >
              <Fingerprint className="w-4 h-4" />
              Use biometric instead
            </button>
          </p>
        )}
        <p>
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}