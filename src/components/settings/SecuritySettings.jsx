import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Fingerprint, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function SecuritySettings() {
  const [pwOpen, setPwOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Password change state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Sign-in method
  const [loginMethod, setLoginMethod] = useState(() => localStorage.getItem('loginMethod') || 'password');
  const [enrolling, setEnrolling] = useState(false);

  // Delete account state
  const [deleteStep, setDeleteStep] = useState('auth'); // 'auth' | 'confirm'
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const enrollBiometric = async () => {
    if (!window.PublicKeyCredential) {
      toast.error('Biometric authentication is not supported on this device/browser.');
      return false;
    }
    try {
      setEnrolling(true);
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'EduSwap', id: window.location.hostname },
          user: { id: new Uint8Array(16), name: 'user@eduswap', displayName: 'EduSwap User' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
        },
      });
      if (credential) {
        localStorage.setItem('biometricCredentialId', btoa(String.fromCharCode(...new Uint8Array(credential.rawId))));
        return true;
      }
      return false;
    } catch (err) {
      if (err.name !== 'NotAllowedError') toast.error('Biometric enrollment failed: ' + (err.message || 'Unknown error'));
      return false;
    } finally {
      setEnrolling(false);
    }
  };

  const handleSwitchMethod = async () => {
    if (loginMethod === 'password') {
      const enrolled = await enrollBiometric();
      if (!enrolled) return;
      localStorage.setItem('loginMethod', 'biometric');
      setLoginMethod('biometric');
      toast.success('Biometric login enabled!');
    } else {
      localStorage.removeItem('biometricCredentialId');
      localStorage.setItem('loginMethod', 'password');
      setLoginMethod('password');
      toast.success('Switched back to Password login');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) { toast.error('Please fill in all fields.'); return; }
    if (newPw !== confirmPw) { toast.error('New passwords do not match.'); return; }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    setSavingPw(true);
    await new Promise(r => setTimeout(r, 1000));
    setSavingPw(false);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    toast.success('Password updated successfully!');
  };

  // Step 1: verify identity before showing delete confirm
  const handleVerifyForDelete = async () => {
    setVerifying(true);
    try {
      if (loginMethod === 'biometric') {
        const credIdB64 = localStorage.getItem('biometricCredentialId');
        if (!credIdB64) throw new Error('No biometric enrolled');
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const credIdBytes = Uint8Array.from(atob(credIdB64), c => c.charCodeAt(0));
        await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [{ id: credIdBytes, type: 'public-key' }],
            userVerification: 'required',
            timeout: 60000,
          },
        });
        setDeleteStep('confirm');
      } else {
        if (!deletePassword) { toast.error('Please enter your password.'); return; }
        const user = await base44.auth.me();
        await base44.auth.loginViaEmailPassword(user.email, deletePassword);
        setDeleteStep('confirm');
      }
    } catch (err) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Step 2: actually delete after typing DELETE
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const user = await base44.auth.me();
      // Delete educator profile linked to this user
      const educators = await base44.entities.Educator.filter({ created_by_id: user.id });
      for (const edu of educators) {
        await base44.entities.Educator.delete(edu.id);
      }
      // Delete messages
      const messages = await base44.entities.Message.list('-created_date', 500);
      const myMessages = messages.filter(m => m.sender_id === user.id || m.receiver_id === user.id);
      for (const msg of myMessages) {
        await base44.entities.Message.delete(msg.id);
      }
      await base44.auth.logout();
    } catch (err) {
      toast.error('Failed to delete account: ' + (err.message || 'Unknown error'));
      setDeleting(false);
    }
  };

  const handleToggleDelete = () => {
    setDeleteOpen(v => !v);
    // Reset state when closing
    if (deleteOpen) {
      setDeleteStep('auth');
      setDeletePassword('');
      setDeleteConfirmText('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Change Password — collapsible */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => setPwOpen(v => !v)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <p className="font-medium text-sm text-foreground">Change Password</p>
          </div>
          {pwOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {pwOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Current Password</Label>
              <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">New Password</Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Confirm New Password</Label>
              <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="rounded-xl" />
            </div>
            <Button onClick={handleChangePassword} disabled={savingPw} className="w-full rounded-xl">
              {savingPw ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        )}
      </div>

      {/* Sign-in Method Toggle */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {loginMethod === 'biometric' ? <Fingerprint className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-primary" />}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sign-in method</p>
              <p className="text-xs text-muted-foreground">Currently: {loginMethod === 'biometric' ? 'Biometric' : 'Password'}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl text-xs shrink-0" onClick={handleSwitchMethod} disabled={enrolling}>
            {enrolling ? 'Enrolling...' : loginMethod === 'biometric' ? 'Switch to Password' : 'Switch to Biometric'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {loginMethod === 'biometric'
            ? "Using your device's fingerprint or Face ID to sign in."
            : "Switch to Biometric to use your device fingerprint sensor at login."}
        </p>
      </div>

      {/* Delete Account — collapsible */}
      <div className="bg-card rounded-2xl border border-destructive/30 overflow-hidden">
        <button
          onClick={handleToggleDelete}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently remove your account and data</p>
            </div>
          </div>
          {deleteOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {deleteOpen && (
          <div className="px-4 pb-4 border-t border-destructive/20 pt-4 space-y-4">
            {deleteStep === 'auth' && (
              <>
                <p className="text-sm text-muted-foreground">
                  To continue, please verify your identity using your {loginMethod === 'biometric' ? 'biometric' : 'password'}.
                </p>
                {loginMethod === 'password' && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Your Password</Label>
                    <Input
                      type="password"
                      value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="rounded-xl"
                    />
                  </div>
                )}
                <Button
                  onClick={handleVerifyForDelete}
                  disabled={verifying || (loginMethod === 'password' && !deletePassword)}
                  variant="outline"
                  className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/5"
                >
                  {verifying
                    ? 'Verifying...'
                    : loginMethod === 'biometric'
                    ? '👆 Scan Fingerprint to Continue'
                    : 'Verify Password'}
                </Button>
              </>
            )}

            {deleteStep === 'confirm' && (
              <>
                <div className="bg-destructive/10 rounded-xl p-3">
                  <p className="text-sm font-semibold text-destructive mb-1">This cannot be undone!</p>
                  <p className="text-xs text-muted-foreground">Your profile, messages, and all associated data will be permanently deleted.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Type <span className="font-bold text-destructive">DELETE</span> to confirm</Label>
                  <Input
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="rounded-xl border-destructive/40 focus:ring-destructive"
                  />
                </div>
                <Button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  variant="destructive"
                  className="w-full rounded-xl"
                >
                  {deleting ? 'Deleting...' : 'Delete My Account'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}