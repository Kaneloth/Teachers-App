import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Fingerprint, ShieldX } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState('password');
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState(() => {
    const stored = sessionStorage.getItem('accountBlocked');
    if (stored) { sessionStorage.removeItem('accountBlocked'); return JSON.parse(stored); }
    return null;
  });

  useEffect(() => {
    const method = localStorage.getItem('loginMethod') || 'password';
    setLoginMethod(method);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      // Check account status
      const me = await base44.auth.me();
      const educators = await base44.entities.Educator.filter({ created_by_id: me.id });
      const profile = educators?.[0];
      if (profile?.account_status === 'suspended' || profile?.account_status === 'banned') {
        const blocked = { status: profile.account_status, reason: profile.status_reason };
        sessionStorage.setItem('accountBlocked', JSON.stringify(blocked));
        base44.auth.logout();
        return;
      }
      // Save the token base44 stores in localStorage so biometric can restore it
      const token = localStorage.getItem('base44_access_token');
      if (token) localStorage.setItem('biometricSessionToken', token);
      window.location.href = "/home";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError("");
    setBiometricLoading(true);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('Biometric authentication is not supported on this device.');
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const storedId = localStorage.getItem('biometricCredentialId');
      const allowCredentials = storedId
        ? [{ type: 'public-key', id: Uint8Array.from(atob(storedId), c => c.charCodeAt(0)), transports: ['internal'] }]
        : [];

      await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials,
          userVerification: 'required',
          timeout: 60000,
        },
      });

      // Biometric passed — restore the saved session token and go straight in
      const savedToken = localStorage.getItem('biometricSessionToken');
      if (savedToken) {
        localStorage.setItem('base44_access_token', savedToken);
        window.location.href = "/home";
      } else {
        // No saved token yet — ask once for password to generate one
        setLoginMethod('biometric-confirmed');
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Biometric verification failed. Try again.');
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleBiometricConfirmedLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      const token = localStorage.getItem('base44_access_token');
      if (token) localStorage.setItem('biometricSessionToken', token);
      window.location.href = "/home";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/home");
  };

  const isBiometricMode = loginMethod === 'biometric';
  const isBiometricConfirmed = loginMethod === 'biometric-confirmed';

  if (accountBlocked) {
    return (
      <AuthLayout icon={ShieldX} title={accountBlocked.status === 'banned' ? 'Account Banned' : 'Account Suspended'} subtitle="">
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${accountBlocked.status === 'banned' ? 'bg-red-100' : 'bg-yellow-100'}`}>
            <ShieldX className={`w-8 h-8 ${accountBlocked.status === 'banned' ? 'text-red-600' : 'text-yellow-600'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              {accountBlocked.status === 'banned'
                ? 'Your account has been permanently banned.'
                : 'Your account has been suspended.'}
            </p>
            {accountBlocked.reason && (
              <p className="text-sm text-muted-foreground mt-2 p-3 rounded-xl bg-muted">
                <span className="font-medium">Reason: </span>{accountBlocked.reason}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            If you believe this is a mistake, please contact support at{' '}
            <a href="mailto:support@edumatch.co.za" className="text-primary hover:underline font-medium">
              support@edumatch.co.za
            </a>
          </p>
          <Button variant="outline" className="w-full" onClick={() => setAccountBlocked(null)}>
            ← Back to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {isBiometricMode && (
        <div className="flex flex-col items-center gap-5 py-4">
          <button
            onClick={handleBiometricLogin}
            disabled={biometricLoading}
            className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {biometricLoading
              ? <Loader2 className="w-10 h-10 text-primary animate-spin" />
              : <Fingerprint className="w-10 h-10 text-primary" />}
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {biometricLoading ? 'Verifying...' : 'Tap to sign in with Biometric'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Use your fingerprint or Face ID</p>
          </div>
          <button
            onClick={() => setLoginMethod('password')}
            className="text-xs text-primary hover:underline"
          >
            Use password instead
          </button>
        </div>
      )}

      {isBiometricConfirmed && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm mb-2">
            <Fingerprint className="w-4 h-4 shrink-0" />
            One-time setup: enter your password once to link biometric. Future logins will go straight in.
          </div>
          <form onSubmit={handleBiometricConfirmedLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-bio">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email-bio"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-bio">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password-bio"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in...</> : "Complete Sign-in"}
            </Button>
          </form>
          <button onClick={() => setLoginMethod('biometric')} className="block w-full text-center text-xs text-primary hover:underline mt-2">
            ← Back to biometric
          </button>
        </div>
      )}

      {!isBiometricMode && !isBiometricConfirmed && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              "Log in"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}