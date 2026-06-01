import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground">We sent a password reset link to <strong>{email}</strong></p>
        <Link to="/login"><Button variant="outline" className="rounded-xl">Back to Sign In</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send a reset link</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="educator@example.co.za" className="rounded-xl" required />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-primary font-semibold hover:underline">Back to Sign In</Link>
      </p>
    </div>
  );
}
