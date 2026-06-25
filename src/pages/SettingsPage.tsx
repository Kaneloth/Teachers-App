import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Bell, Moon, Type, Shield, FileText, Headphones,
  Lock, ChevronRight, ChevronDown, Star, Zap,
  Search, AlertTriangle, CheckCircle, UserX, Ban, X,
  Save, Loader2, Fingerprint, Coins, Crown, Plus, Minus, History, ScrollText, ShieldCheck, Trash2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import DeleteAccountSection from '@/components/DeleteAccountSection';

const ALL_TABS = ['General', 'Security', 'Admin', 'Gates'] as const;
type Tab = typeof ALL_TABS[number];

/* ── shared primitives ─────────────────────────────────────── */

function SettingToggleRow({
  icon: Icon, label, sub, checked, onChange,
}: { icon: React.ElementType; label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SettingLinkRow({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="flex-1 text-sm font-medium text-foreground text-left">{label}</p>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/* ── General tab ────────────────────────────────────────────── */

const TEXT_SIZES: Record<string, string> = { Small: '13px', Medium: '16px', Large: '19px' };

function applyDark(val: boolean) {
  document.documentElement.classList.toggle('dark', val);
  localStorage.setItem('crosssa_dark_mode', val ? '1' : '0');
}

function applyTextSize(size: string) {
  document.documentElement.style.fontSize = TEXT_SIZES[size] ?? '16px';
  localStorage.setItem('crosssa_text_size', size);
}

function GeneralTab() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(
    () => localStorage.getItem('crosssa_notifications') !== '0'
  );
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('crosssa_dark_mode') === '1' ||
          document.documentElement.classList.contains('dark')
  );
  const [textSize, setTextSize] = useState<'Small' | 'Medium' | 'Large'>(
    () => (localStorage.getItem('crosssa_text_size') as 'Small' | 'Medium' | 'Large') || 'Medium'
  );

  useEffect(() => {
    applyDark(darkMode);
    applyTextSize(textSize);
  }, []);

  const handleDarkMode = (val: boolean) => {
    setDarkMode(val);
    applyDark(val);
  };

  const handleTextSize = (size: 'Small' | 'Medium' | 'Large') => {
    setTextSize(size);
    applyTextSize(size);
  };

  const openLegalDoc = (path: string) => {
    window.open(path, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-3">
      <Card>
        <SettingToggleRow icon={Bell} label="Notifications" sub="Push and in-app alerts" checked={notifications}
          onChange={v => { setNotifications(v); localStorage.setItem('crosssa_notifications', v ? '1' : '0'); }} />
        <div className="border-t border-border" />
        <SettingToggleRow icon={Moon} label={darkMode ? 'Dark Mode' : 'Light Mode'} sub={darkMode ? 'Switch to light theme' : 'Switch to dark theme'} checked={darkMode} onChange={handleDarkMode} />
      </Card>

      <Card>
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Type className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Text Size</p>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-muted rounded-xl p-1">
            {(['Small', 'Medium', 'Large'] as const).map(size => (
              <button key={size} onClick={() => handleTextSize(size)}
                className={`py-2 rounded-lg text-sm font-medium transition-all ${textSize === size ? 'bg-primary text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >{size}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <SettingLinkRow icon={Shield} label="Privacy Policy" onClick={() => openLegalDoc('/Privacy Policy.html')} />
        <div className="border-t border-border" />
        <SettingLinkRow icon={FileText} label="Terms of Service" onClick={() => openLegalDoc('/Terms and Conditions.html')} />
        <div className="border-t border-border" />
        {/* Optional: Add PAIA Manual row if desired */}
        <SettingLinkRow icon={FileText} label="PAIA Manual" onClick={() => openLegalDoc('/PAIA Manual.html')} />
        <div className="border-t border-border" />
        <SettingLinkRow icon={Headphones} label="Contact Support" onClick={() => navigate('/support')} />
      </Card>
    </div>
  );
}

/* ── Feature Gates tab ─────────────────────────────────────────── */
function FeatureGatesTab() {
  const GATES = [
    { key: 'advanced_search', label: 'Advanced Search & Matches', desc: 'R79+ gate — unlocks filters, matches page, radius search for all users' },
    { key: 'guides_access',   label: 'Guides Access',             desc: 'R79+ gate — unlocks guide downloads for all users' },
    { key: 'cv_credits',      label: 'CV Credit Gate',            desc: 'Whether CV downloads cost 9 credits' },
    { key: 'chat_credits',    label: 'Chat Credit Gate',          desc: 'Whether starting a new chat costs 5 credits' },
    { key: 'id_verification', label: 'ID Verification Gate',      desc: 'Whether ID verification requires R79+ purchase' },
    { key: 'templates_access',  label: 'CV Templates Gate',        desc: 'When off — all users get all 10 CV templates without purchasing' },
    { key: 'profile_edit_lock', label: 'Profile Edit Lock (30 days)', desc: 'When off — users can update their profile at any time without the 30-day cooldown' },
  ];
  const { session } = useAuth();
  const [globalGates, setGlobalGates] = useState<Record<string, boolean>>({});
  const [saving, setSaving]           = useState<string | null>(null);
  const [loaded, setLoaded]           = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/.netlify/functions/admin-feature-gates', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(data => {
        const g: Record<string, boolean> = {};
        for (const row of (data.global || [])) g[row.gate_key] = row.enabled;
        setGlobalGates(g);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [session?.access_token]);

  const toggle = async (key: string, value: boolean) => {
    if (!session?.access_token) return;
    setSaving(key);
    const res = await fetch('/.netlify/functions/admin-feature-gates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ gate_key: key, enabled: value }),
    });
    if (res.ok) {
      setGlobalGates(p => ({ ...p, [key]: value }));
      toast.success(`${value ? 'Enabled' : 'Disabled'} globally for all users.`);
    } else {
      toast.error('Failed to save gate — check Netlify function is deployed.');
    }
    setSaving(null);
  };

  if (!loaded) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Global Feature Gates</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Applies to ALL users. Per-user overrides (set in Edit User) take precedence.
          Admins always bypass all gates regardless.
        </p>
      </div>
      <div className="space-y-3">
        {GATES.map(({ key, label, desc }) => {
          const enabled = globalGates[key] !== false;
          return (
            <div key={key} className={`rounded-2xl border-2 px-4 py-4 transition-all ${enabled ? 'border-border bg-card' : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10'}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${enabled ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700 dark:bg-amber-800/30 dark:text-amber-400'}`}>
                      {enabled ? 'Active' : 'Disabled globally'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <Switch checked={enabled} onCheckedChange={v => toggle(key, v)} disabled={saving === key} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          ⚠️ Disabling a gate removes the restriction for ALL users. Use Edit User for individual overrides.
        </p>
      </div>
    </div>
  );
}

/* ── Subscription tab (Pro users only) ─────────────────────── */

const BILLING = [
  { id: 'monthly',     label: 'Monthly',     badge: null as string | null, save: null as string | null,       sub: 'R59/mo',                price: 'R59', perMonth: 59 },
  { id: 'semi_annual', label: 'Semi-Annual', badge: 'Popular' as string | null, save: 'Save 33%' as string | null, sub: 'R234 every 6 months', price: 'R39', perMonth: 39 },
  { id: 'annual',      label: 'Annual',      badge: null as string | null, save: 'Save 51%' as string | null, sub: 'R348/year',              price: 'R29', perMonth: 29 },
];

const COMPARISON = [
  { feature: 'CV download',             free: '9 credits',        pro: '9 credits'           },
  { feature: 'Cover letter',            free: '2 credits',        pro: '2 credits'           },
  { feature: 'New chat',                free: '5 credits',        pro: '5 credits'           },
  { feature: 'Guide download',          free: '3 credits',        pro: '3 credits'           },
  { feature: 'ID verification',         free: '30 credits',       pro: '30 credits'          },
  { feature: 'Advanced search',         free: 'R79+ purchase',    pro: 'R79+ purchase'       },
  { feature: 'Signup credits',          free: '18 free credits',  pro: '18 free credits'     },
  { feature: 'Credits expire',          free: 'Never',            pro: 'Never'               },
];

function SubscriptionTab() {
  const { user } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<{ subscription_plan: string; subscription_end: string | null } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'semi_annual' | 'annual'>('semi_annual');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('subscription_plan, subscription_end')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data);
        if (data?.subscription_plan && data.subscription_plan !== 'free') {
          setBilling(data.subscription_plan as 'monthly' | 'semi_annual' | 'annual');
        }
      });
  }, [user]);

  const profilePlan = profile?.subscription_plan;
  const metaPlan = user?.user_metadata?.subscription_plan as string | undefined;
  const plan = (profilePlan && profilePlan !== 'free') ? profilePlan : (metaPlan || 'free');

  const profileEnd = profile?.subscription_end;
  const metaEnd = user?.user_metadata?.subscription_end as string | undefined;
  const subEnd = profileEnd ? new Date(profileEnd) : metaEnd ? new Date(metaEnd) : null;

  const isCancelled = user?.user_metadata?.subscription_cancelled === true;
  const isActive = plan !== 'free' && subEnd !== null && subEnd > new Date();
  const activePlanLabel = BILLING.find(b => b.id === plan)?.label ?? plan;
  const selected = BILLING.find(b => b.id === billing) ?? BILLING[0];

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

  const getPlanEndDate = (planId: string): string => {
    const d = new Date();
    if (planId === 'semi_annual') d.setMonth(d.getMonth() + 6);
    else if (planId === 'annual') d.setFullYear(d.getFullYear() + 1);
    else                          d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  };

  const handleSwitch = async () => {
    if (!user) return;
    if (billing === plan) { toast.info('That is already your current plan.'); return; }
    setSubscribing(true);
    const endDate = getPlanEndDate(billing);
    await supabase.from('profiles').update({ subscription_plan: billing, subscription_end: endDate }).eq('id', user.id);
    await supabase.auth.updateUser({ data: { subscription_plan: billing, subscription_end: endDate, subscription_cancelled: false } });
    setProfile(prev => ({ ...prev, subscription_plan: billing, subscription_end: endDate }));
    toast.success(`✅ Switched to Pro ${BILLING.find(b => b.id === billing)?.label}!`);
    setSubscribing(false);
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to cancel? You will keep access until your current period ends.')) return;
    setCancelling(true);
    const { error } = await supabase.auth.updateUser({ data: { subscription_cancelled: true } });
    setCancelling(false);
    if (error) {
      toast.error('Failed to cancel: ' + error.message);
    } else {
      toast.success('Subscription cancelled. You keep access until your current period ends.');
      // Navigate away from the Subscription tab immediately — the auth
      // session refresh triggered by updateUser will cause a re-render
      // where isPro may briefly be false, removing this tab from
      // visibleTabs. Staying on it causes a crash as the component
      // tries to render with stale/undefined state.
      setSearchParams({ tab: 'General' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Current plan banner */}
      {isActive && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
          <Star className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">Pro · {activePlanLabel}</p>
            {subEnd && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {isCancelled ? 'Access ends' : 'Renews'} {fmtDate(subEnd)}
              </p>
            )}
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white ${isCancelled ? 'bg-amber-500' : 'bg-primary'}`}>
            {isCancelled ? 'Cancelled' : 'Active'}
          </span>
        </div>
      )}

      {/* Switch billing cycle */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1">
          {isCancelled ? 'Reactivate — choose billing' : 'Switch billing cycle'}
        </p>
        <div className="space-y-2">
          {BILLING.map(b => (
            <button key={b.id} onClick={() => setBilling(b.id as 'monthly' | 'semi_annual' | 'annual')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left ${billing === b.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${billing === b.id ? 'border-primary' : 'border-muted-foreground'}`}>
                {billing === b.id && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{b.label}</span>
                  {b.id === plan && !isCancelled && (
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Current</span>
                  )}
                  {b.badge && b.id !== plan && (
                    <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">{b.badge}</span>
                  )}
                  {b.save && <span className="text-[10px] text-primary font-semibold">{b.save}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{b.sub}</p>
              </div>
              <span className="text-sm font-bold text-foreground shrink-0">
                {b.price}<span className="text-xs font-normal text-muted-foreground">/mo</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Button className="w-full h-12 rounded-2xl text-base font-semibold" onClick={handleSwitch} disabled={subscribing || billing === plan}>
        {subscribing
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Updating…</>
          : billing === plan && !isCancelled
            ? 'Current plan selected'
            : `Switch to ${selected.label} — R${selected.perMonth}/mo`}
      </Button>

      <p className="text-center text-xs text-muted-foreground -mt-1">
        {isActive && !isCancelled && (
          <a href="#" onClick={handleCancel} className="text-destructive underline underline-offset-2">
            {cancelling ? 'Cancelling…' : 'Cancel subscription'}
          </a>
        )}
        {(!isActive || isCancelled) && (
          <span>Your subscription is no longer active.</span>
        )}
      </p>

      {/* Plan comparison */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">Plan Comparison</p>
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/50 px-4 py-2 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground">Feature</span>
            <span className="text-xs font-semibold text-muted-foreground text-center">Free</span>
            <span className="text-xs font-semibold text-primary text-center">Pro</span>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-3 px-4 py-2.5 ${i < COMPARISON.length - 1 ? 'border-b border-border/50' : ''}`}>
              <span className="text-xs text-foreground">{row.feature}</span>
              <span className="text-xs text-muted-foreground text-center">{row.free}</span>
              <span className={`text-xs text-center font-medium ${row.pro === row.free ? 'text-muted-foreground' : 'text-primary'}`}>{row.pro}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Security tab ───────────────────────────────────────────── */

function SecurityTab() {
  const { user } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [loginMethod, setLoginMethod] = useState(
    () => localStorage.getItem('loginMethod') || 'password'
  );
  const [enrolling, setEnrolling] = useState(false);

  // Google-only users have no 'email' identity — they never set a password.
  const isGoogleOnly = !user?.identities?.some(id => id.provider === 'email');

  const enrollBiometric = async (): Promise<boolean> => {
    if (!window.PublicKeyCredential) {
      toast.error('Biometric authentication is not supported on this device or browser.');
      return false;
    }
    try {
      setEnrolling(true);
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userIdBytes = new TextEncoder().encode(user?.id || 'crosssa-user');
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Crosssa', id: window.location.hostname },
          user: {
            id: userIdBytes,
            name: user?.email || 'user',
            displayName: user?.user_metadata?.full_name || user?.email || 'User',
          },
          pubKeyCredParams: [
            { alg: -7,   type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      });
      if (credential) {
        const raw = (credential as PublicKeyCredential).rawId;
        localStorage.setItem('biometricCredentialId', btoa(String.fromCharCode(...new Uint8Array(raw))));
        // Snapshot both tokens right now so biometric restore works on the very
        // first attempt after enrollment (before TOKEN_REFRESHED ever fires).
        const { data: { session: snap } } = await supabase.auth.getSession();
        if (snap?.access_token && snap?.refresh_token) {
          localStorage.setItem('crosssa_biometric_access_token', snap.access_token);
          localStorage.setItem('crosssa_biometric_refresh_token', snap.refresh_token);
        }
        return true;
      }
      return false;
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        toast.error('Biometric enrollment failed: ' + (err.message || 'Unknown error'));
      }
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
      toast.success('Biometric login enabled! You will be prompted for your fingerprint or Face ID next time you sign in.');
    } else {
      localStorage.removeItem('biometricCredentialId');
      localStorage.setItem('loginMethod', 'password');
      setLoginMethod('password');
      toast.success('Switched back to password login.');
    }
  };

  const handleChangePw = async () => {
    // Google-only users have no current password — only validate new fields.
    if (!isGoogleOnly && !currentPw) { toast.error('Please enter your current password.'); return; }
    if (!newPw || !confirmPw) { toast.error('Please fill in all fields.'); return; }
    if (newPw !== confirmPw) { toast.error('New passwords do not match.'); return; }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isGoogleOnly ? 'Password created! You can now log in with email & password.' : 'Password changed!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwOpen(false);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      {/* Change / Create Password */}
      <Card>
        <button onClick={() => setPwOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-foreground">
              {isGoogleOnly ? 'Create Password' : 'Change Password'}
            </p>
            {isGoogleOnly && (
              <p className="text-xs text-muted-foreground">Add a password so you can also log in with email</p>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${pwOpen ? 'rotate-180' : ''}`} />
        </button>
        {pwOpen && (
          <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
            {/* Current password only shown for email/password users */}
            {!isGoogleOnly && (
              <div className="space-y-1.5">
                <Label className="text-sm">Current Password</Label>
                <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Your current password" className="rounded-xl" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm">New Password</Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="At least 8 characters" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password"
                className={`rounded-xl ${confirmPw && confirmPw !== newPw ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {confirmPw && confirmPw !== newPw && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
            <Button onClick={handleChangePw} disabled={saving} className="w-full rounded-xl">
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isGoogleOnly ? 'Create Password' : 'Update Password'}
            </Button>
          </div>
        )}
      </Card>

      {/* Sign-in Method */}
      <Card>
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {loginMethod === 'biometric'
                ? <Fingerprint className="w-4 h-4 text-primary" />
                : <Lock className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Sign-in method</p>
              <p className="text-xs text-muted-foreground">
                Currently: {loginMethod === 'biometric' ? 'Biometric' : 'Password'}
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              className="rounded-xl shrink-0 text-xs"
              onClick={handleSwitchMethod}
              disabled={enrolling}
            >
              {enrolling
                ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Enrolling…</>
                : loginMethod === 'biometric' ? 'Switch to Password' : 'Switch to Biometric'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2.5 pl-11">
            {loginMethod === 'biometric'
              ? "Using your device's fingerprint or Face ID to sign in."
              : 'Switch to Biometric to use your device fingerprint sensor at login.'}
          </p>
        </div>
      </Card>

      <DeleteAccountSection />
    </div>
  );
}

/* ── Admin tab ──────────────────────────────────────────────── */

interface Educator {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  current_school: string;
  sace_number: string;
  bio: string;
  account_status: string;
}

const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
];

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function statusBadge(status: string, emailConfirmed = true, profileType?: string | null) {
  if (!emailConfirmed) return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">pending</span>;
  if (!profileType) return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">incomplete</span>;
  const s = (status || 'active').toLowerCase();
  if (s === 'suspended') return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">suspended</span>;
  if (s === 'banned') return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">banned</span>;
  return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">active</span>;
}


/* ── Users sub-tab (all users — general + educator) ────────────────────── */

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
}

function EditUserModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: (u: AdminUser) => void }) {
  const { session } = useAuth();
  const [accountStatus,     setAccountStatus]     = useState(user.account_status || 'active');
  const [isAdminFlag,       setIsAdminFlag]       = useState(user.is_admin);
  const [templatesUnlocked, setTemplatesUnlocked] = useState(!!(user.templates_unlocked));
  const [isHidden,          setIsHidden]          = useState(!!(user.is_hidden));
  const [userGateOverrides, setUserGateOverrides] = useState<Record<string,boolean|undefined>>({});
  const [gatesLoading,      setGatesLoading]      = useState(true);

  // Load existing per-user gate overrides for this user via Netlify function
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s?.access_token) { setGatesLoading(false); return; }
      fetch('/.netlify/functions/admin-feature-gates', {
        headers: { Authorization: `Bearer ${s.access_token}` },
      })
        .then(r => r.json())
        .then(data => {
          const overrides: Record<string,boolean> = {};
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
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
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
              <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-primary" /> {user.credit_balance}
              </p>
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
                    <button onClick={() => setUserGateOverrides(p => { const n = {...p}; delete n[key]; return n; })}
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

function UsersSubTab() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/admin-list-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
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
    <div className="space-y-3">
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
        />
      )}
    </div>
  );
}

/* ── Credits sub-tab ──────────────────────────────────────────────────── */

interface LedgerEntry {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  ref_id: string | null;
  created_at: string;
}

function CreditsSubTab() {
  const { session } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userCode, setUserCode] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const search = async () => {
    const q = searchInput.trim();
    if (!q) { toast.error('Enter an email address or CR- code'); return; }
    setLoading(true);
    try {
      // A CR- code (e.g. "CR-1234ABC") doesn't contain "@"; an email
      // always does — use that to decide which field to search by.
      const isEmail = q.includes('@');
      const res = await fetch('/.netlify/functions/admin-adjust-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(
          isEmail ? { action: 'view', target_email: q } : { action: 'view', target_user_code: q }
        ),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'User not found');
      setUserId(result.user_id);
      setUserEmail(result.email ?? q);
      setUserCode(result.user_code ?? null);
      setBalance(result.balance);
      setLedger(result.ledger ?? []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load credits');
      setUserId(null);
      setUserEmail('');
      setUserCode(null);
      setBalance(null);
      setLedger([]);
    } finally {
      setLoading(false);
    }
  };

  const adjust = async (sign: 1 | -1) => {
    const amt = parseInt(adjustAmount, 10);
    if (!userId) return;
    if (!amt || amt <= 0) { toast.error('Enter a positive number of credits'); return; }

    setAdjusting(true);
    try {
      const res = await fetch('/.netlify/functions/admin-adjust-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: 'adjust',
          target_user_id: userId,
          amount: amt * sign,
          description: adjustReason || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Adjustment failed');

      toast.success(`${sign > 0 ? 'Added' : 'Removed'} ${amt} credits`);
      setBalance(result.new_balance);
      setAdjustAmount('');
      setAdjustReason('');
      await search(); // refresh ledger
    } catch (e: any) {
      toast.error(e.message || 'Adjustment failed');
    } finally {
      setAdjusting(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(); }}
            placeholder="user@example.com or CR- code"
            className="pl-9 rounded-2xl h-11"
          />
        </div>
        <Button onClick={search} disabled={loading} className="rounded-2xl h-11 px-4">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look up'}
        </Button>
      </div>

      {balance !== null && (
        <>
          {/* Balance card */}
          <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Coins className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Current Balance</p>
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">{userEmail}</p>
                {userCode && <p className="text-xs font-mono font-semibold text-primary">{userCode}</p>}
              </div>
            </div>
            <p className="text-2xl font-bold text-primary">{balance}</p>
          </div>

          {/* Adjust form */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <Label className="text-sm font-semibold">Manual Adjustment</Label>
            <div className="flex gap-2">
              <Input
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="Amount"
                inputMode="numeric"
                className="rounded-xl w-28"
              />
              <Input
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                placeholder="Reason (optional)"
                className="rounded-xl flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => adjust(-1)} disabled={adjusting} className="flex-1 rounded-xl gap-1.5">
                <Minus className="w-4 h-4" /> Remove
              </Button>
              <Button onClick={() => adjust(1)} disabled={adjusting} className="flex-1 rounded-xl gap-1.5">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>

          {/* Ledger history */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Transaction History
            </p>
            {ledger.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No transactions yet</p>
            ) : (
              <div className="space-y-0 rounded-2xl border border-border overflow-hidden bg-card">
                {ledger.map((entry, i) => (
                  <div key={entry.id}>
                    {i > 0 && <div className="border-t border-border mx-4" />}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground capitalize">{entry.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.description || '—'}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(entry.created_at)}</p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ml-3 ${entry.amount > 0 ? 'text-primary' : 'text-destructive'}`}>
                        {entry.amount > 0 ? '+' : ''}{entry.amount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


/* ── Audit Log sub-tab ────────────────────────────────────────────────── */

interface AuditLogEntry {
  id: string;
  admin_email: string;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  credit_adjustment: 'Credit Adjustment',
  user_update:       'User Update',
};

function AuditLogSubTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('admin_audit_log')
      .select('id, admin_email, action, target_user_id, target_email, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (actionFilter !== 'all') query = query.eq('action', actionFilter);

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load audit log: ' + error.message);
    } else {
      setEntries((data as AuditLogEntry[]) ?? []);
    }
    setLoading(false);
  }, [actionFilter]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const renderDetails = (entry: AuditLogEntry) => {
    const d = entry.details || {};
    if (entry.action === 'credit_adjustment') {
      const amount = d.amount as number | undefined;
      return (
        <p className="text-xs text-muted-foreground">
          {typeof amount === 'number' && (
            <span className={amount > 0 ? 'text-primary font-semibold' : 'text-destructive font-semibold'}>
              {amount > 0 ? '+' : ''}{amount} credits
            </span>
          )}
          {d.description ? ` · ${d.description}` : ''}
          {typeof d.new_balance === 'number' ? ` · new balance ${d.new_balance}` : ''}
        </p>
      );
    }
    if (entry.action === 'user_update') {
      const parts = Object.entries(d).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
      return <p className="text-xs text-muted-foreground">{parts.join(' · ') || '—'}</p>;
    }
    return <p className="text-xs text-muted-foreground">{JSON.stringify(d)}</p>;
  };

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'credit_adjustment', 'user_update'] as const).map(a => (
          <button key={a} onClick={() => setActionFilter(a)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${actionFilter === a ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
            {a === 'all' ? 'All Actions' : ACTION_LABELS[a]}
          </button>
        ))}
      </div>

      {!loading && (
        <p className="text-xs text-muted-foreground px-1">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <ScrollText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No admin actions yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Credit adjustments and user updates will appear here as they happen.
          </p>
        </div>
      ) : (
        <div className="space-y-0 rounded-2xl border border-border overflow-hidden bg-card">
          {entries.map((entry, i) => (
            <div key={entry.id}>
              {i > 0 && <div className="border-t border-border mx-4" />}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </span>
                    {entry.target_email && (
                      <span className="text-xs text-muted-foreground truncate">→ {entry.target_email}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(entry.created_at)}</span>
                </div>
                {renderDetails(entry)}
                <p className="text-[10px] text-muted-foreground mt-1">by {entry.admin_email}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Edit modal */
function EditEducatorModal({ educator, onClose, onSaved }: { educator: Educator; onClose: () => void; onSaved: (updated: Educator) => void }) {
  const [form, setForm] = useState({ ...educator });
  const [saving, setSaving] = useState(false);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const setStatus = (s: string) => setForm(f => ({ ...f, account_status: s }));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('educators').update({
      full_name: form.full_name,
      phone: form.phone,
      current_school: form.current_school,
      sace_number: form.sace_number,
      bio: form.bio,
      account_status: form.account_status,
    }).eq('id', educator.id);
    if (error) {
      toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Profile updated');
      onSaved(form);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Edit Profile — {educator.full_name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Full Name</Label>
            <Input {...field('full_name')} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Phone</Label>
            <Input {...field('phone')} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Current School</Label>
            <Input {...field('current_school')} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">SACE Number</Label>
            <Input {...field('sace_number')} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Bio</Label>
            <textarea
              {...field('bio')}
              rows={4}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Account status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Account Status</Label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatus('active')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${form.account_status === 'active' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Reinstate
              </button>
              <button
                onClick={() => setStatus('suspended')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${form.account_status === 'suspended' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-border text-muted-foreground'}`}
              >
                <UserX className="w-3.5 h-3.5" /> Suspend
              </button>
              <button
                onClick={() => setStatus('banned')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${form.account_status === 'banned' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground'}`}
              >
                <Ban className="w-3.5 h-3.5" /> Ban
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
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

/* Educators sub-tab */
function EducatorsSubTab() {
  const [educators, setEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Educator | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('educators')
      .select('id, full_name, email, phone, current_school, sace_number, bio, account_status')
      .order('full_name');
    setEducators((data as Educator[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = educators.filter(e =>
    !search ||
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.current_school?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or school..."
          className="pl-9 rounded-2xl h-11"
        />
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-muted-foreground px-1">{filtered.length} educator{filtered.length !== 1 ? 's' : ''}</p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">No educators found</p>
      ) : (
        <div className="space-y-0 rounded-2xl border border-border overflow-hidden bg-card">
          {filtered.map((edu, i) => (
            <div key={edu.id}>
              {i > 0 && <div className="border-t border-border mx-4" />}
              <button
                onClick={() => setEditing(edu)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className={`w-9 h-9 rounded-full ${avatarColor(edu.full_name || '?')} flex items-center justify-center shrink-0`}>
                  <span className="text-white text-xs font-bold">{initials(edu.full_name || '?')}</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-foreground truncate">{edu.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{edu.email || edu.current_school || '—'}</p>
                </div>
                {statusBadge(edu.account_status)}
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditEducatorModal
          educator={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setEducators(list => list.map(e => e.id === updated.id ? updated : e));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ID Verification sub-tab */
function IDVerificationSubTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
        <Shield className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">ID Verification Queue</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Pending SACE certificate uploads will appear here for manual review.
      </p>
    </div>
  );
}

/* ── Testimonials moderation sub-tab ───────────────────────────── */
interface TestimonialRow {
  id: string;
  name: string;
  role_label: string | null;
  quote: string;
  rating: number | null;
  source: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

function TestimonialsSubTab() {
  const [rows, setRows] = useState<TestimonialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('testimonials')
      .select('id, name, role_label, quote, rating, source, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filter !== 'all') query = query.eq('status', filter);

    const { data, error } = await query;
    if (error) toast.error('Failed to load testimonials: ' + error.message);
    setRows((data as TestimonialRow[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('testimonials').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Failed to update: ' + error.message); return; }
    toast.success(status === 'approved' ? 'Testimonial approved — now live on the landing page.' : 'Testimonial rejected.');
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const deleteTestimonial = async (id: string) => {
    if (!window.confirm('Permanently delete this testimonial? This cannot be undone.')) return;
    const { error } = await supabase.from('testimonials').delete().eq('id', id);
    if (error) { toast.error('Failed to delete: ' + error.message); return; }
    toast.success('Testimonial deleted.');
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const sourceLabel = (s: string) => ({
    public_form: 'Public form', cv_download_prompt: 'CV download prompt', match_prompt: 'New match prompt',
  }[s] || s);

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'
            }`}
          >{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-5 h-5 border-3 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No {filter !== 'all' ? filter : ''} testimonials.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(t => (
            <div key={t.id} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  {t.role_label && <p className="text-xs text-muted-foreground">{t.role_label}</p>}
                </div>
                {t.rating && (
                  <span className="text-xs font-medium text-amber-500 shrink-0">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</span>
                )}
              </div>
              <p className="text-sm text-foreground/90 italic mb-2">"{t.quote}"</p>
              <p className="text-[11px] text-muted-foreground mb-3">{sourceLabel(t.source)} · {fmtDate(t.created_at)}</p>
              {t.status === 'pending' ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setStatus(t.id, 'approved')} className="rounded-xl flex-1">Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(t.id, 'rejected')} className="rounded-xl flex-1">Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => deleteTestimonial(t.id)} className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.status === 'approved' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                    {t.status === 'approved' ? 'Approved — live on landing page' : 'Rejected'}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => deleteTestimonial(t.id)} className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5 h-7 px-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Admin tab wrapper */
const ADMIN_SUBTABS = ['Users', 'Credits', 'Audit Log', 'Educators', 'ID Verification', 'Testimonials'] as const;
type AdminSubTab = typeof ADMIN_SUBTABS[number];

function AdminTab() {
  const [sub, setSub] = useState<AdminSubTab>('Users');

  return (
    <div className="space-y-3">
      {/* Warning banner */}
      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800 font-medium">Admin panel — changes here affect real user accounts.</p>
      </div>

      {/* Sub-tabs — horizontal scroll instead of a grid, since a 2-row grid
          gets cramped once there are more than ~4-5 sub-tabs. */}
      <div className="flex gap-1 bg-muted rounded-2xl p-1 overflow-x-auto scrollbar-hide">
        {ADMIN_SUBTABS.map(t => (
          <button key={t} onClick={() => setSub(t)}
            className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${sub === t ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >{t}</button>
        ))}
      </div>

      {sub === 'Users'         && <UsersSubTab />}
      {sub === 'Credits'       && <CreditsSubTab />}
      {sub === 'Audit Log'     && <AuditLogSubTab />}
      {sub === 'Educators'     && <EducatorsSubTab />}
      {sub === 'ID Verification' && <IDVerificationSubTab />}
      {sub === 'Testimonials'   && <TestimonialsSubTab />}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();

  const isAdmin = !!(user?.user_metadata?.is_admin);

  /* Build visible tabs */
  const visibleTabs = ALL_TABS.filter(t => {
    if (t === 'Admin') return isAdmin;
    if (t === 'Gates') return isAdmin;
    return true;
  });

  const raw = searchParams.get('tab') || 'General';
  const tab = (visibleTabs.includes(raw as Tab) ? raw : 'General') as Tab;

  const setTab = (t: Tab) => setSearchParams({ tab: t });

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      {/* Tab bar */}
      <div className="px-4 pb-4">
        <div className="grid bg-muted rounded-2xl p-1" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
          {visibleTabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pb-8 space-y-3">
        {tab === 'General'      && <GeneralTab />}
        {tab === 'Security'     && <SecurityTab />}
        {tab === 'Admin'        && isAdmin && <AdminTab />}
        {tab === 'Gates'        && isAdmin && <FeatureGatesTab />}
      </div>
    </div>
  );
}
