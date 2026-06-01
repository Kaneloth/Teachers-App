import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Send } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, authChecked } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const [magicMode, setMagicMode]       = useState(false);
  const [magicSent, setMagicSent]       = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  // Redirect once auth is confirmed
  useEffect(() => {
    if (authChecked && isAuthenticated) navigate("/home", { replace: true });
  }, [isAuthenticated, authChecked, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      // Navigation handled by the useEffect above once AuthContext confirms isAuthenticated
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("fetch")) {
        setError("Connection timed out. Try the magic link option below — it works even on slow connections.");
        setMagicMode(true);
      } else {
        setError(msg || "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setMagicLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/home` },
      });
      if (err) throw err;
      setMagicSent(true);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to send link. Please try again.");
    } finally {
      setMagicLoading(false);
    }
  };

  const handleGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/home` },
    });

  if (magicSent) {
    return (
      <AuthLayout icon={Send} title="Check your email" subtitle={`Sent a login link to ${email}`}>
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Click the link in the email to sign in. You can close this tab.</p>
          <button onClick={() => { setMagicSent(false); setMagicMode(false); }} className="text-xs text-primary hover:underline">
            ← Try again
          </button>
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

      {!magicMode ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in...</> : "Log in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Connection issues?{" "}
            <button type="button" onClick={() => setMagicMode(true)} className="text-primary hover:underline">
              Get a magic link instead
            </button>
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="magic-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="magic-email" type="email" autoComplete="email" autoFocus placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-12" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">We'll email you a one-click sign-in link — no password needed.</p>
          <Button className="w-full h-12 font-medium" onClick={handleMagicLink} disabled={magicLoading}>
            {magicLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-2" />Send login link</>}
          </Button>
          <button onClick={() => { setMagicMode(false); setError(""); }} className="w-full text-xs text-muted-foreground hover:underline">
            ← Use password instead
          </button>
        </div>
      )}
    </AuthLayout>
  );
}
