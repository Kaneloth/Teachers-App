import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function SecuritySettings() {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailReset = async () => {
    if (!email.trim()) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      toast.success('Password reset email sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Change Password</h3>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-11" />
          </div>
          <Button onClick={handlePasswordReset} disabled={loading || !newPassword} className="w-full rounded-xl h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Send Reset Link</h3>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="h-11" />
          </div>
          <Button variant="outline" onClick={handleEmailReset} disabled={loading || !email} className="w-full rounded-xl h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Email'}
          </Button>
        </div>
      </div>
    </div>
  );
}
