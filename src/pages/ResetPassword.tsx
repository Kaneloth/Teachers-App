import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
      navigate('/login');
    }
    setLoading(false);
  };

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
            <Input id="password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className="rounded-xl pr-10" minLength={8} required />
            <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm Password</Label>
          <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className="rounded-xl" required />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
        </Button>
      </form>
    </div>
  );
}
