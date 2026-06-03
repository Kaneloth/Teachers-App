import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';

type DeleteStep = 'auth' | 'confirm';

export default function DeleteAccountSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DeleteStep>('auth');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* OAuth users (Google sign-in) have no password — skip the auth step */
  const isOAuthUser = user?.app_metadata?.provider === 'google' ||
    (user?.app_metadata?.providers as string[] | undefined)?.includes('google');

  const handleToggle = () => {
    setOpen(v => !v);
    if (open) {
      setStep('auth');
      setPassword('');
      setConfirmText('');
    }
  };

  /* Step 1 — password users must re-verify before seeing the confirm step */
  const handleVerify = async () => {
    if (!password) { toast.error('Please enter your password.'); return; }
    if (!user?.email) { toast.error('No email found on your account.'); return; }
    setVerifying(true);
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    setVerifying(false);
    if (error) { toast.error('Incorrect password. Please try again.'); return; }
    setStep('confirm');
  };

  /* Step 2 — type DELETE then call the Netlify function */
  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');

      const res = await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      /* Sign out locally — the server already deleted the auth record */
      await supabase.auth.signOut();
      toast.success('Your account has been deleted.');
      navigate('/');
    } catch (err: unknown) {
      toast.error('Failed to delete account: ' + (err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-destructive/30 overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Delete Account</p>
            <p className="text-xs text-muted-foreground">Permanently remove your account and all data</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-destructive/20 pt-4 space-y-4">

          {/* Step 1 — verify identity (password users only) */}
          {step === 'auth' && !isOAuthUser && (
            <>
              <p className="text-sm text-muted-foreground">
                To continue, please confirm your password.
              </p>
              <div className="space-y-1.5">
                <Label className="text-sm">Your Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  placeholder="Enter your current password"
                  className="rounded-xl"
                />
              </div>
              <Button
                onClick={handleVerify}
                disabled={verifying || !password}
                variant="outline"
                className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/5"
              >
                {verifying ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Verifying…</> : 'Verify Password'}
              </Button>
            </>
          )}

          {/* OAuth users skip straight to confirm */}
          {step === 'auth' && isOAuthUser && (
            <>
              <div className="bg-destructive/10 rounded-xl p-3">
                <p className="text-sm font-semibold text-destructive mb-1">This cannot be undone!</p>
                <p className="text-xs text-muted-foreground">
                  Your profile, CV data, messages, and all associated data will be permanently deleted.
                </p>
              </div>
              <Button
                onClick={() => setStep('confirm')}
                variant="outline"
                className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/5"
              >
                Continue
              </Button>
            </>
          )}

          {/* Step 2 — type DELETE */}
          {step === 'confirm' && (
            <>
              <div className="bg-destructive/10 rounded-xl p-3">
                <p className="text-sm font-semibold text-destructive mb-1">This cannot be undone!</p>
                <p className="text-xs text-muted-foreground">
                  Your profile, CV data, messages, and all associated data will be permanently deleted.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Type <span className="font-bold text-destructive">DELETE</span> to confirm
                </Label>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="rounded-xl border-destructive/40 focus-visible:ring-destructive"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setStep('auth'); setConfirmText(''); }}
                  className="flex-1 rounded-xl"
                  disabled={deleting}
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={confirmText !== 'DELETE' || deleting}
                  variant="destructive"
                  className="flex-1 rounded-xl"
                >
                  {deleting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Deleting…</> : 'Delete My Account'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
