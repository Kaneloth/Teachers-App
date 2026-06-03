import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Bell, Moon, Type, Shield, FileText, Headphones,
  Lock, ChevronRight, ChevronDown, Star, Zap,
  Search, AlertTriangle, CheckCircle, UserX, Ban, X,
  Save, Loader2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import DeleteAccountSection from '@/components/DeleteAccountSection';

const TABS = ['General', 'Subscription', 'Security', 'Admin'] as const;
type Tab = typeof TABS[number];

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

function GeneralTab() {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<'Small' | 'Medium' | 'Large'>('Medium');

  return (
    <div className="space-y-3">
      <Card>
        <SettingToggleRow icon={Bell} label="Notifications" sub="Push and in-app alerts" checked={notifications} onChange={setNotifications} />
        <div className="border-t border-border" />
        <SettingToggleRow icon={Moon} label="Dark Mode" sub="Switch to dark theme" checked={darkMode} onChange={setDarkMode} />
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
              <button key={size} onClick={() => setTextSize(size)}
                className={`py-2 rounded-lg text-sm font-medium transition-all ${textSize === size ? 'bg-primary text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >{size}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <SettingLinkRow icon={Shield} label="Privacy Policy" onClick={() => toast.info('Opening Privacy Policy…')} />
        <div className="border-t border-border" />
        <SettingLinkRow icon={FileText} label="Terms of Service" onClick={() => toast.info('Opening Terms of Service…')} />
        <div className="border-t border-border" />
        <SettingLinkRow icon={Headphones} label="Contact Support" onClick={() => toast.info('Opening support…')} />
      </Card>
    </div>
  );
}

/* ── Subscription tab ───────────────────────────────────────── */

const BILLING = [
  { id: 'monthly', label: 'Monthly', badge: null as string | null, save: null as string | null, sub: 'R59/mo', price: 'R59', perMonth: 59 },
  { id: 'semi', label: 'Semi-Annual', badge: 'Popular' as string | null, save: 'Save 20%' as string | null, sub: 'R282 every 6 months', price: 'R47', perMonth: 47 },
  { id: 'annual', label: 'Annual', badge: null as string | null, save: 'Save 41%' as string | null, sub: 'R420/year', price: 'R35', perMonth: 35 },
];

const COMPARISON = [
  { feature: 'CV builds per month', free: '1', pro: 'Unlimited' },
  { feature: 'Personal details', free: 'Locked to profile', pro: 'Locked to profile' },
  { feature: 'CV watermark', free: 'Yes', pro: 'No' },
  { feature: 'Active chats', free: '2', pro: 'Unlimited' },
  { feature: 'Vacancies', free: 'View only', pro: 'View + apply' },
  { feature: 'Ads', free: 'Yes', pro: 'No' },
];

function SubscriptionTab() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ subscription_plan: string; subscription_end: string | null } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'semi' | 'annual'>('semi');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('subscription_plan, subscription_end')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [user]);

  /* Read from profiles first; fall back to user_metadata if profiles update was blocked by RLS */
  const profilePlan = profile?.subscription_plan;
  const metaPlan = user?.user_metadata?.subscription_plan as string | undefined;
  const plan = (profilePlan && profilePlan !== 'free') ? profilePlan : (metaPlan || 'free');

  const profileEnd = profile?.subscription_end;
  const metaEnd = user?.user_metadata?.subscription_end as string | undefined;
  const subEnd = profileEnd ? new Date(profileEnd) : metaEnd ? new Date(metaEnd) : null;

  const isCancelled = user?.user_metadata?.subscription_cancelled === true;
  const isActive = plan !== 'free' && subEnd !== null && subEnd > new Date();
  const selected = BILLING.find(b => b.id === billing)!;

  const activePlanLabel = BILLING.find(b => b.id === plan)?.label ?? plan;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

  const getPlanEndDate = (planId: string): string => {
    const d = new Date();
    if (planId === 'semi') d.setMonth(d.getMonth() + 6);
    else if (planId === 'annual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  };

  const handleSubscribe = async () => {
    if (!user) return;
    setSubscribing(true);
    const endDate = getPlanEndDate(billing);
    /* Write to profiles (primary) */
    await supabase.from('profiles').update({ subscription_plan: billing, subscription_end: endDate }).eq('id', user.id);
    /* Write to user_metadata as reliable fallback (no RLS required) */
    await supabase.auth.updateUser({ data: { subscription_plan: billing, subscription_end: endDate, subscription_cancelled: false } });
    setProfile(prev => ({ ...prev, subscription_plan: billing, subscription_end: endDate }));
    const planObj = BILLING.find(b => b.id === billing);
    toast.success(`🎉 Pro ${planObj?.label} plan activated!`);
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
    }
  };

  return (
    <div className="space-y-4">
      {/* Active plan banner — only shown when subscribed, matches Base44 style */}
      {isActive && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5">
          <Star className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-primary">Pro · {activePlanLabel}</span>
            {subEnd && (
              <span className="text-xs text-muted-foreground ml-2">
                · {isCancelled ? 'Access ends' : 'Renews'} {fmtDate(subEnd)}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 text-white ${isCancelled ? 'bg-amber-500' : 'bg-primary'}`}>
            {isCancelled ? 'Cancelled' : 'Active'}
          </span>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1">PRO PLAN — CHOOSE BILLING</p>
        <div className="space-y-2">
          {BILLING.map(b => (
            <button key={b.id} onClick={() => setBilling(b.id as 'monthly' | 'semi' | 'annual')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left ${billing === b.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${billing === b.id ? 'border-primary' : 'border-muted-foreground'}`}>
                {billing === b.id && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{b.label}</span>
                  {b.badge && <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">{b.badge}</span>}
                  {b.save && <span className="text-[10px] text-primary font-semibold">{b.save}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{b.sub}</p>
              </div>
              <span className="text-sm font-bold text-foreground shrink-0">{b.price}<span className="text-xs font-normal text-muted-foreground">/month</span></span>
            </button>
          ))}
        </div>
      </div>

      <Button
        className="w-full h-12 rounded-2xl text-base font-semibold"
        onClick={handleSubscribe}
        disabled={subscribing}
      >
        {subscribing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Activating…</> : `Subscribe — R${selected.perMonth}/mo`}
      </Button>

      <p className="text-center text-xs text-muted-foreground mt-2">
        Cancel anytime.{' '}
        {isActive && !isCancelled && (
          <a href="#" onClick={handleCancel} className="text-destructive underline underline-offset-2">
            {cancelling ? 'Cancelling…' : 'Cancel subscription'}
          </a>
        )}
      </p>

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
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePw = async () => {
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { toast.error(error.message); } else { toast.success('Password changed!'); setNewPw(''); setPwOpen(false); }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <Card>
        <button onClick={() => setPwOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <p className="flex-1 text-sm font-medium text-foreground text-left">Change Password</p>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${pwOpen ? 'rotate-180' : ''}`} />
        </button>
        {pwOpen && (
          <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">New Password</Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="At least 8 characters" className="rounded-xl" />
            </div>
            <Button onClick={handleChangePw} disabled={saving} className="w-full rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Sign-in method</p>
              <p className="text-xs text-muted-foreground">Currently: Password</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl shrink-0 text-xs" onClick={() => toast.info('Biometric login coming soon')}>
              Switch to Biometric
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2.5 pl-11">
            Switch to Biometric to use your device fingerprint sensor at login.
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

function statusBadge(status: string) {
  const s = (status || 'active').toLowerCase();
  if (s === 'suspended') return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">suspended</span>;
  if (s === 'banned') return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">banned</span>;
  return <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">active</span>;
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

/* Admin tab wrapper */
function AdminTab() {
  const [sub, setSub] = useState<'Educators' | 'ID Verification'>('Educators');

  return (
    <div className="space-y-3">
      {/* Warning banner */}
      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800 font-medium">Admin panel — changes here affect real user accounts.</p>
      </div>

      {/* Sub-tabs */}
      <div className="grid grid-cols-2 bg-muted rounded-2xl p-1">
        {(['Educators', 'ID Verification'] as const).map(t => (
          <button key={t} onClick={() => setSub(t)}
            className={`py-2.5 rounded-xl text-sm font-medium transition-all ${sub === t ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >{t}</button>
        ))}
      </div>

      {sub === 'Educators' ? <EducatorsSubTab /> : <IDVerificationSubTab />}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();

  const isAdmin = !!(user?.user_metadata?.is_admin);

  const visibleTabs = isAdmin ? TABS : (TABS.filter(t => t !== 'Admin') as readonly Tab[]);

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
        <div className={`grid bg-muted rounded-2xl p-1`} style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
          {visibleTabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pb-8 space-y-3">
        {tab === 'General' && <GeneralTab />}
        {tab === 'Subscription' && <SubscriptionTab />}
        {tab === 'Security' && <SecurityTab />}
        {tab === 'Admin' && isAdmin && <AdminTab />}
      </div>
    </div>
  );
}
