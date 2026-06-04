import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, MailCheck, Fingerprint } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Step = 'form' | 'email-otp';

// ── Refresh-token helpers ─────────────────────────────────────────────────────
// Access tokens expire after ~1 hour and cannot be disabled in Supabase.
// Refresh tokens effectively never expire when Time-box and Inactivity are both
// set to 0 in Supabase → Auth → Sessions, which is already the case here.
// AuthContext.onAuthStateChange keeps this value current on every rotation so
// it never goes stale while the app is open.

const BIO_RT_KEY = 'crosssa_biometric_refresh_token';

function saveRefreshToken(rt: string) {
  localStorage.setItem(BIO_RT_KEY, rt);
}

function loadRefreshToken(): string | null {
  return localStorage.getItem(BIO_RT_KEY);
}

// Stage 1 — use Supabase's own in-memory session if it is still valid (avoids
//           replaying a token that the auto-refresh timer already consumed).
// Stage 2 — exchange the stored refresh token for a new session (works after
//           a local-scope logout because the token remains valid server-side).
async function restoreSession(): Promise<boolean> {
  const { data: { session: existing } } = await supabase.auth.getSession();
  if (existing) return true;

  const refreshToken = loadRefreshToken();
  if (!refreshToken) return false;

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return false;
    saveRefreshToken(data.session.refresh_token); // persist rotated token
    return true;
  } catch {
    return false;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail]       = useState(() => localStorage.getItem('crosssa_last_email') || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [step, setStep]         = useState<Step>('form');
  const [emailOtp, setEmailOtp] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const [loginMethod, setLoginMethod] = useState(
    () => localStorage.getItem('loginMethod') || 'password'
  );
  const [biometricLoading, setBiometricLoading] = useState(false);

  // ── After any successful login ────────────────────────────────────────────
  // onAuthStateChange in AuthContext saves the latest refresh token
  // automatically, so we only need to persist the email hint and navigate.

  const afterLogin = () => {
    localStorage.setItem('crosssa_last_email', email);
    navigate('/home');
  };

  // ── Biometric login ───────────────────────────────────────────────────────

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('Biometric not supported on this device.');
      }

      const storedId = localStorage.getItem('biometricCredentialId');
      if (!storedId) throw new Error('No biometric credential found. Please log in with your password first.');

      // 1. Verify fingerprint / Face ID via WebAuthn
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname,
          allowCredentials: [{
            type: 'public-key',
            id: Uint8Array.from(atob(storedId), c => c.charCodeAt(0)),
            transports: ['internal'] as AuthenticatorTransport[],
          }],
          userVerification: 'required',
          timeout: 60000,
        },
      });

      // 2. Fingerprint passed — restore the Supabase session.
      //    Stage 1: use Supabase's own session if already active (e.g. after an
      //             app resume where the auto-refresh timer already ran).
      //    Stage 2: use the stored refresh token (survives local-scope logout
      //             because AuthContext uses signOut({ scope: 'local' })).
      const restored = await restoreSession();
      if (restored) {
        navigate('/home');
      } else {
        // Refresh token is no longer valid (e.g. user changed password or Supabase
        // admin revoked all sessions). Fall back to password login once.
        localStorage.setItem('loginMethod', 'password');
        setLoginMethod('password');
        toast.error('Your saved session has expired. Please sign in with your password to refresh it.');
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        toast.error(err.message || 'Biometric verification failed.');
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  // ── Password login ────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
        await supabase.auth.resend({ type: 'signup', email });
        setStep('email-otp');
        toast.info('A verification code has been sent to your email.');
      } else {
        toast.error(error.message);
      }
    } else {
      afterLogin();
    }
    setLoading(false);
  };

  // ── Email OTP ─────────────────────────────────────────────────────────────

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: emailOtp, type: 'email' });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Email verified! Welcome back.');
      afterLogin();
    }
    setLoading(false);
  };

  const handleResendEmailOtp = async () => {
    setResendLoading(true);
    await supabase.auth.resend({ type: 'signup', email });
    toast.success('New code sent — check your inbox.');
    setResendLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/home` },
    });
    setGoogleLoading(false);
  };

  // ── Shared UI helpers ─────────────────────────────────────────────────────

  const GoogleSvg = (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  const Divider = () => (
    <div className="relative flex items-center gap-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground">or</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );

  // ── Email OTP screen ──────────────────────────────────────────────────────

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

  // ── Biometric screen ──────────────────────────────────────────────────────

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
        <Divider />
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
          <button onClick={() => setLoginMethod('password')} className="text-sm text-primary font-medium hover:underline">
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

  // ── Standard password form ────────────────────────────────────────────────

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
      <Divider />
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="educator@example.co.za" className="rounded-xl" required />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Input id="password" type={showPw ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="rounded-xl pr-10" required />
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
          <button onClick={() => setLoginMethod('biometric')} className="flex items-center gap-1.5 mx-auto text-primary font-medium hover:underline">
            <Fingerprint className="w-4 h-4" /> Use biometric instead
          </button>
        )}
        <p>Don't have an account?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
