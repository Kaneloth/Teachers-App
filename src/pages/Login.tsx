import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Fingerprint, ShieldX, Wifi, Send } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

// Safe sessionStorage wrapper (throws in Safari private mode)
const safeSession = {
  getItem: (key: string): string | null => { try { return sessionStorage.getItem(key); } catch { return null; } },
  setItem: (key: string, val: string) => { try { sessionStorage.setItem(key, val); } catch { /* noop */ } },
  removeItem: (key: string) => { try { sessionStorage.removeItem(key); } catch { /* noop */ } },
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(
        "Login timed out — your connection may be too slow. Try the magic link option below instead."
      )), ms)
    ),
  ]);
}

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, authChecked } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slowConnection, setSlowConnection] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loginMethod, setLoginMethod] = useState("password");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState<{ status: string; reason: string } | null>(() => {
    const stored = safeSession.getItem("accountBlocked");
    if (stored) { safeSession.removeItem("accountBlocked"); return JSON.parse(stored); }
    return null;
  });

  // Navigate to home once AuthContext confirms the user is authenticated.
  useEffect(() => {
    if (authChecked && isAuthenticated) {
      navigate("/home", { replace: true });
    }
  }, [isAuthenticated, authChecked, navigate]);

  useEffect(() => {
    const method = localStorage.getItem("loginMethod") || "password";
    setLoginMethod(method);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSlowConnection(false);
    setLoading(true);
    slowTimer.current = setTimeout(() => setSlowConnection(true), 5000);
    try {
      const { error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        30000,
      );
      if (signInError) throw signInError;

      const { data: { user } } = await withTimeout(supabase.auth.getUser(), 15000);
      if (user) {
        const { data: profile } = await withTimeout(
          supabase.from("profiles").select("account_status, status_reason").eq("id", user.id).single(),
          10000,
        );
        if (profile?.account_status === "suspended" || profile?.account_status === "banned") {
          const blocked = { status: profile.account_status, reason: profile.status_reason };
          safeSession.setItem("accountBlocked", JSON.stringify(blocked));
          await supabase.auth.signOut().catch(() => {});
          setAccountBlocked(blocked);
          return;
        }
        try {
          const savedToken = btoa(user.id + ":" + Date.now());
          localStorage.setItem("biometricSessionToken", savedToken);
        } catch { /* localStorage unavailable */ }
      }
      // Navigation handled by the useEffect watching isAuthenticated
    } catch (err: unknown) {
      setError((err as Error).message || "Invalid email or password");
      setShowMagicLink(true); // surface the magic link option on failure
    } finally {
      if (slowTimer.current) clearTimeout(slowTimer.current);
      setSlowConnection(false);
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError("Enter your email address above first.");
      return;
    }
    setMagicLinkLoading(true);
    setError("");
    try {
      const { error: otpError } = await withTimeout(
        supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: `${window.location.origin}/home` },
        }),
        15000,
      );
      if (otpError) throw otpError;
      setMagicLinkSent(true);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to send login link. Please try again.");
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError("");
    setBiometricLoading(true);
    try {
      if (!window.PublicKeyCredential) throw new Error("Biometric authentication is not supported on this device.");
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const storedId = localStorage.getItem("biometricCredentialId");
      const allowCredentials = storedId
        ? [{ type: "public-key" as PublicKeyCredentialType, id: Uint8Array.from(atob(storedId), c => c.charCodeAt(0)), transports: ["internal" as AuthenticatorTransport] }]
        : [];
      await navigator.credentials.get({
        publicKey: { challenge, rpId: window.location.hostname, allowCredentials, userVerification: "required", timeout: 60000 },
      });
      const savedToken = localStorage.getItem("biometricSessionToken");
      if (savedToken) {
        navigate("/home");
      } else {
        setLoginMethod("biometric-confirmed");
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "NotAllowedError") setError((err as Error).message || "Biometric verification failed.");
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/home` },
    });
  };

  const isBiometricMode = loginMethod === "biometric";
  const isBiometricConfirmed = loginMethod === "biometric-confirmed";

  if (accountBlocked) {
    return (
      <AuthLayout icon={ShieldX} title={accountBlocked.status === "banned" ? "Account Banned" : "Account Suspended"} subtitle="">
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${accountBlocked.status === "banned" ? "bg-red-100" : "bg-yellow-100"}`}>
            <ShieldX className={`w-8 h-8 ${accountBlocked.status === "banned" ? "text-red-600" : "text-yellow-600"}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              {accountBlocked.status === "banned" ? "Your account has been permanently banned." : "Your account has been suspended."}
            </p>
            {accountBlocked.reason && (
              <p className="text-sm text-muted-foreground mt-2 p-3 rounded-xl bg-muted">
                <span className="font-medium">Reason: </span>{accountBlocked.reason}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            If you believe this is a mistake, contact <a href="mailto:support@educross.co.za" className="text-primary hover:underline font-medium">support@educross.co.za</a>
          </p>
          <Button variant="outline" className="w-full" onClick={() => setAccountBlocked(null)}>← Back to Login</Button>
        </div>
      </AuthLayout>
    );
  }

  // Magic link sent confirmation screen
  if (magicLinkSent) {
    return (
      <AuthLayout icon={Send} title="Check your email" subtitle={`We sent a login link to ${email}`}>
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Click the link in the email to sign in. You can close this tab.
          </p>
          <p className="text-xs text-muted-foreground">
            Didn't get it?{" "}
            <button onClick={() => setMagicLinkSent(false)} className="text-primary hover:underline font-medium">
              Try again
            </button>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={<>Don't have an account?{" "}<Link to="/register" className="text-primary font-medium hover:underline">Create one</Link></>}
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {isBiometricMode && (
        <div className="flex flex-col items-center gap-5 py-4">
          <button onClick={handleBiometricLogin} disabled={biometricLoading}
            className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-50">
            {biometricLoading ? <Loader2 className="w-10 h-10 text-primary animate-spin" /> : <Fingerprint className="w-10 h-10 text-primary" />}
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{biometricLoading ? "Verifying..." : "Tap to sign in with Biometric"}</p>
            <p className="text-xs text-muted-foreground mt-1">Use your fingerprint or Face ID</p>
          </div>
          <button onClick={() => setLoginMethod("password")} className="text-xs text-primary hover:underline">Use password instead</button>
        </div>
      )}

      {!isBiometricMode && !isBiometricConfirmed && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in...</> : "Log in"}
          </Button>

          {slowConnection && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs">
              <Wifi className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Slow connection — still trying. Consider using the magic link below instead.</span>
            </div>
          )}

          {/* Magic link fallback — shown after timeout or on demand */}
          {(showMagicLink || slowConnection) && (
            <div className="border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-foreground">Having trouble? Use a magic link</p>
              <p className="text-xs text-muted-foreground">We'll email you a one-click login link — no password needed.</p>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 text-sm"
                onClick={handleMagicLink}
                disabled={magicLinkLoading}
              >
                {magicLinkLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                  : <><Send className="w-4 h-4 mr-2" />Send me a login link</>}
              </Button>
            </div>
          )}

          {!showMagicLink && !slowConnection && (
            <p className="text-center text-xs text-muted-foreground">
              Connection issues?{" "}
              <button type="button" onClick={() => setShowMagicLink(true)} className="text-primary hover:underline">
                Get a magic link instead
              </button>
            </p>
          )}
        </form>
      )}
    </AuthLayout>
  );
}
