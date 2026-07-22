import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronRight, Crown, X, User, CheckCircle, UserX, Ban,
  ShieldCheck, FileText, Coins, Save, Loader2, Plus, Minus,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { initials, avatarColor, statusBadge } from './adminHelpers';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  user_code: string | null;
  profile_type: 'educator' | 'general' | null;
  account_status: string;
  current_school: string | null;
  is_admin: boolean;
  email_confirmed: boolean;
  subscription_plan: string;
  subscription_end: string | null;
  deleted_at: string | null;
  credit_balance: number;
  created_at: string;
  last_sign_in_at: string | null;
  templates_unlocked?: boolean;
  is_hidden?: boolean;
}

/* ── Edit user modal ─────────────────────────────────────────── */

function EditUserModal({ user, onClose, onSaved, onBalanceChanged }: { user: AdminUser; onClose: () => void; onSaved: (u: AdminUser) => void; onBalanceChanged: (userId: string, newBalance: number) => void }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [accountStatus,     setAccountStatus]     = useState(user.account_status || 'active');
  const [isAdminFlag,       setIsAdminFlag]       = useState(user.is_admin);
  const [templatesUnlocked, setTemplatesUnlocked] = useState(!!(user.templates_unlocked));
  const [isHidden,          setIsHidden]          = useState(!!(user.is_hidden));
  const [userGateOverrides, setUserGateOverrides] = useState<Record<string, boolean | undefined>>({});
  const [gatesLoading,      setGatesLoading]      = useState(true);
  const [creditBalance,     setCreditBalance]     = useState(user.credit_balance);
  const [adjustingCredits,  setAdjustingCredits]  = useState(false);

  // Load existing per-user gate overrides for this user via Netlify function
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s?.access_token) { setGatesLoading(false); return; }
      fetch('/.netlify/functions/admin-feature-gates', {
        headers: { Authorization: `Bearer ${s.access_token}` },
      })
        .then(r => r.json())
        .then(data => {
          const overrides: Record<string, boolean> = {};
          for (const row of (data.perUser || []).filter((r: any) => r.user_id === user.id))
            overrides[row.gate_key] = row.enabled;
          setUserGateOverrides(overrides);
          setGatesLoading(false);
        })
        .catch(() => setGatesLoading(false));
    });
  }, [user.id]);

  const [saving,    setSaving]    = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleVerifyEmail = async () => {
    if (!window.confirm(`Manually verify ${user.email}? This bypasses OTP and marks the account as confirmed.`)) return;
    setVerifying(true);
    try {
      const res = await fetch('/.netlify/functions/admin-verify-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ target_user_id: user.id }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Verification failed');
      toast.success(`${user.email} has been manually verified.`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to verify user');
    } finally {
      setVerifying(false);
    }
  };

  const adjustCredits = async (sign: 1 | -1) => {
    setAdjustingCredits(true);
    try {
      const res = await fetch('/.netlify/functions/admin-adjust-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: 'adjust',
          target_user_id: user.id,
          amount: 10 * sign,
          description: 'Quick adjustment from Users panel',
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Adjustment failed');
      setCreditBalance(result.new_balance);
      onBalanceChanged(user.id, result.new_balance);
      toast.success(`${sign > 0 ? 'Added' : 'Removed'} 10 credits`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to adjust credits');
    } finally {
      setAdjustingCredits(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        target_user_id:     user.id,
        account_status:     accountStatus,
        is_admin:           isAdminFlag,
        templates_unlocked: templatesUnlocked,
        is_hidden:          isHidden,
      };

      const res = await fetch('/.netlify/functions/admin-update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Update failed');

      toast.success('User updated successfully.');
      if (isAdminFlag !== user.is_admin) {
        toast.info('Admin access change takes effect when the user next opens or refreshes the app.', { duration: 6000 });
      }
      // Save per-user gate overrides via Netlify function (needs service role)
      const tok = (await supabase.auth.getSession()).data.session?.access_token;
      for (const [gate_key, enabled] of Object.entries(userGateOverrides)) {
        if (enabled === undefined) {
          await fetch('/.netlify/functions/admin-feature-gates', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
            body: JSON.stringify({ gate_key, user_id: user.id }),
          });
        } else {
          await fetch('/.netlify/functions/admin-feature-gates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
            body: JSON.stringify({ gate_key, user_id: user.id, enabled }),
          });
        }
      }
      onSaved({
        ...user,
        account_status:     accountStatus,
        is_admin:           isAdminFlag,
        templates_unlocked: templatesUnlocked,
        is_hidden:          isHidden,
        credit_balance:     creditBalance,
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">{user.full_name || user.email}</h2>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {user.user_code && (
              <p className="text-xs font-mono font-semibold text-primary mt-0.5">{user.user_code}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { onClose(); navigate(`/profile/${user.id}`); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-2.5 py-1.5 rounded-xl"
            >
              <User className="w-3.5 h-3.5" /> Edit Profile
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Profile type + credit balance (read-only info) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted rounded-xl px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Profile Type</p>
              <p className="text-sm font-semibold text-foreground capitalize">{user.profile_type || '—'}</p>
            </div>
            <div className="bg-muted rounded-xl px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Credit Balance</p>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-primary" /> {creditBalance}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => adjustCredits(-1)}
                    disabled={adjustingCredits}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => adjustCredits(1)}
                    disabled={adjustingCredits}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">±10 per tap · applies immediately</p>
            </div>
          </div>

          {/* Account status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Account Status</Label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setAccountStatus('active')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${accountStatus === 'active' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                <CheckCircle className="w-3.5 h-3.5" /> Active
              </button>
              <button onClick={() => setAccountStatus('suspended')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${accountStatus === 'suspended' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-border text-muted-foreground'}`}>
                <UserX className="w-3.5 h-3.5" /> Suspend
              </button>
              <button onClick={() => setAccountStatus('banned')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${accountStatus === 'banned' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground'}`}>
                <Ban className="w-3.5 h-3.5" /> Ban
              </button>
            </div>
          </div>

          {/* Profile visibility */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border">
            <div className="flex items-center gap-2 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Hide Profile</p>
                <p className="text-xs text-muted-foreground">Hides from browse lists · still shows in filtered searches</p>
              </div>
            </div>
            <Switch checked={isHidden} onCheckedChange={setIsHidden} />
          </div>

          {/* Per-user gate overrides */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Per-User Gate Overrides</p>
            <p className="text-xs text-muted-foreground">These override the global gates for this user only. Leave unset to follow global settings.</p>
            {[
              { key: 'advanced_search', label: 'Advanced Search & Matches' },
              { key: 'guides_access',   label: 'Guides Access (R79+ gate)' },
              { key: 'cv_credits',      label: 'CV Credit Gate' },
              { key: 'chat_credits',    label: 'Chat Credit Gate' },
            ].map(({ key, label }) => {
              const override = userGateOverrides[key];
              return (
                <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {override === undefined ? 'Following global setting' : override ? 'Unlocked for this user' : 'Locked for this user'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setUserGateOverrides(p => ({ ...p, [key]: true }))}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${override === true ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}>
                      On
                    </button>
                    <button onClick={() => setUserGateOverrides(p => ({ ...p, [key]: false }))}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${override === false ? 'bg-destructive text-white border-destructive' : 'border-border text-muted-foreground hover:border-destructive'}`}>
                      Off
                    </button>
                    <button onClick={() => setUserGateOverrides(p => { const n = { ...p }; delete n[key]; return n; })}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${override === undefined ? 'bg-muted border-border text-foreground' : 'border-border text-muted-foreground hover:border-border'}`}>
                      Global
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Admin flag */}
          <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Crown className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Admin Access</p>
                <p className="text-xs text-muted-foreground">Grants full dashboard authority</p>
              </div>
            </div>
            <Switch checked={isAdminFlag} onCheckedChange={setIsAdminFlag} />
          </div>

          {/* Templates unlock */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-teal-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Unlock CV Templates</p>
                <p className="text-xs text-muted-foreground">All 12 templates without requiring a purchase</p>
              </div>
            </div>
            <Switch checked={templatesUnlocked} onCheckedChange={setTemplatesUnlocked} />
          </div>

          {/* CV Watermark — per-user override */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-orange-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">CV Watermark</p>
                <p className="text-xs text-muted-foreground">
                  {userGateOverrides['cv_watermark'] === undefined
                    ? 'Following global setting'
                    : userGateOverrides['cv_watermark'] ? 'Override ON — watermark shown' : 'Override OFF — no watermark'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUserGateOverrides(p => ({ ...p, cv_watermark: undefined }))}
                className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded-full px-2 py-0.5 transition-colors"
              >
                Reset
              </button>
              <Switch
                checked={userGateOverrides['cv_watermark'] ?? true}
                onCheckedChange={v => setUserGateOverrides(p => ({ ...p, cv_watermark: v }))}
              />
            </div>
          </div>

          {/* Manual email verification — only shown for unverified users */}
          {!user.email_confirmed && (
            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Email Not Verified</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Manually verify if OTP email bounced or inbox was full</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyEmail}
                disabled={verifying}
                className="shrink-0 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100 gap-1.5"
              >
                {verifying
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ShieldCheck className="w-3.5 h-3.5" />}
                {verifying ? 'Verifying…' : 'Verify Now'}
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────── */

export default function AdminUsers() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    // Wait for the session to actually be populated before firing. On a
    // fresh page load / direct navigation to /admin/users, useAuth()'s
    // session can still be null for a moment while it hydrates from
    // storage. Firing immediately sent `Authorization: Bearer undefined`
    // — not an empty header, but the literal string "undefined" — which
    // requireAdmin.js correctly rejects via supabase.auth.getUser() as an
    // "Invalid session" 401. Leaving `loading` untouched here (it starts
    // true) keeps the spinner showing instead of flashing an error toast;
    // this effect re-runs automatically once `session` populates, because
    // that changes `load`'s identity via the useCallback dependency below.
    if (!session?.access_token) return;

    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/admin-list-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ search }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to load users');
      setUsers(result.users ?? []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [session, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All users — general and educator profiles</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load(); }}
          placeholder="Search by name, email, or CR- code..."
          className="pl-9 rounded-2xl h-11"
        />
      </div>

      {!loading && (
        <p className="text-xs text-muted-foreground px-1">{users.length} user{users.length !== 1 ? 's' : ''}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">No users found</p>
      ) : (
        <div className="space-y-0 rounded-2xl border border-border overflow-hidden bg-card">
          {users.map((u, i) => (
            <div key={u.id}>
              {i > 0 && <div className="border-t border-border mx-4" />}
              <button onClick={() => setEditing(u)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className={`w-9 h-9 rounded-full ${avatarColor(u.full_name || u.email || '?')} flex items-center justify-center shrink-0`}>
                  <span className="text-white text-xs font-bold">{initials(u.full_name || u.email || '?')}</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{u.full_name || u.email}</p>
                    {u.is_admin && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email} · <span className="capitalize">{u.profile_type || 'unset'}</span> · {u.credit_balance} cr
                  </p>
                  {u.user_code && (
                    <p className="text-[11px] font-mono text-primary/80 truncate">{u.user_code}</p>
                  )}
                </div>
                {statusBadge(u.account_status, u.email_confirmed, u.profile_type)}
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setUsers(list => list.map(u => u.id === updated.id ? updated : u));
            setEditing(null);
          }}
          onBalanceChanged={(userId, newBalance) => {
            setUsers(list => list.map(u => u.id === userId ? { ...u, credit_balance: newBalance } : u));
          }}
        />
      )}
    </div>
  );
}
