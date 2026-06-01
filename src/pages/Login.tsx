import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Fingerprint, ShieldX } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

// Safe sessionStorage wrapper (throws in Safari private mode)
const safeSession = {
  getItem: (key: string): string | null => { try { return sessionStorage.getItem(key); } catch { return null; } },
  setItem: (key: string, val: string) => { try { sessionStorage.setItem(key, val); } catch { /* noop */ } },
  removeItem: (key: string) => { try { sessionStorage.removeItem(key); } catch { /* noop */ } },
};

// Race an async op against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out. Check your connection and try again.")), ms)
    ),
  ]);
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState("password");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState<{ status: string; reason: string } | null>(() => {
    const stored = safeSession.getItem("accountBlocked");
    if (stored) { safeSession.removeItem("accountBlocked"); return JSON.parse(stored); }
    return null;
  });

  useEffect(() => {
    const method = localStorage.getItem("loginMethod") || "password";
    setLoginMethod(method);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        15000,
      );
      if (signInError) throw signInError;

      const { data: { user } } = await withTimeout(supabase.auth.getUser(), 8000);
      if (user) {
        const { data: profile } = await withTimeout(
          supabase.from("profiles").select("account_status, status_reason").eq("id", user.id).single(),
          8000,
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
      navigate("/home");
    } catch (err: unknown) {
      setError((err as Error).message || "Invalid email or password");
    } finally {
      setLoading(false);
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
        </form>
      )}
    </AuthLayout>
  );
}
