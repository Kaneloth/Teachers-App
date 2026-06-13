import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw,          setShowPw]          = useState(false);
  const [showConfirmPw,   setShowConfirmPw]   = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);
  const [sessionReady,    setSessionReady]    = useState(false);
  const [sessionError,    setSessionError]    = useState('');

  // ── Exchange the token from the URL for a live session ───────────────────
  // Supabase puts the recovery token in the URL as either:
  //   a) A hash fragment: #access_token=...&type=recovery   (old PKCE flow)
  //   b) A query param:   ?code=...                          (new PKCE flow)
  // We handle both.
  useEffect(() => {
    const exchangeToken = async () => {
      // ── Try query param first (new PKCE flow) ───────────────────────────
      const params = new URLSearchParams(window.location.search);
      const code   = params.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setSessionError('Reset link is invalid or has expired. Please request a new one.');
        } else {
          setSessionReady(true);
        }
        return;
      }

      // ── Try hash fragment (legacy flow) ─────────────────────────────────
      const hash        = window.location.hash.substring(1);
      const hashParams  = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type        = hashParams.get('type');

      if (accessToken && type === 'recovery') {
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken ?? '',
        });
        if (error) {
          setSessionError('Reset link is invalid or has expired. Please request a new one.');
        } else {
          setSessionReady(true);
        }
        return;
      }

      // ── No token found at all ────────────────────────────────────────────
      // Check if there's already a valid recovery session (e.g. user refreshed the page)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      } else {
        setSessionError('No reset token found. Please request a new password reset link.');
      }
    };

    exchangeToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      setDone(true);
      // Sign out so they log in fresh with the new password
      await supabase.auth.signOut();
    }
    setLoading(false);
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Password updated!</h1>
        <p className="text-sm text-muted-foreground">Your password has been changed successfully.</p>
        <Button onClick={() => navigate('/login')} className="rounded-xl w-full h-11 font-semibold">
          Sign In with New Password
        </Button>
      </div>
    );
  }

  // ── Session error state ───────────────────────────────────────────────────
  if (sessionError) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Link expired</h1>
        <p className="text-sm text-muted-foreground">{sessionError}</p>
        <Link to="/forgot-password">
          <Button className="rounded-xl w-full h-11 font-semibold">Request New Reset Link</Button>
        </Link>
      </div>
    );
  }

  // ── Loading while exchanging token ────────────────────────────────────────
  if (!sessionReady) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying reset link…</p>
      </div>
    );
  }

  // ── Reset form ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose a strong password for your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="rounded-xl pr-10"
              minLength={8}
              required
            />
            <button type="button" onClick={() => setShowPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className={`rounded-xl pr-10 ${
                confirmPassword && confirmPassword !== password
                  ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
              minLength={8}
              required
            />
            <button type="button" onClick={() => setShowConfirmPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== password && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading || !password || password !== confirmPassword}
          className="w-full h-11 rounded-xl font-semibold"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-primary font-semibold hover:underline">Back to Sign In</Link>
      </p>
    </div>
  );
}
