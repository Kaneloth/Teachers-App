import { useEffect, useState } from 'react';
import { Coins, Loader2, Plus, Save, Trash2, Star, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

interface CreditPackageRow {
  id: string;
  label: string;
  credits: number;
  price_zar: number;
  note: string | null;
  is_popular: boolean;
  sort_order: number;
  active: boolean;
}

interface CreditCostRow {
  action_type: string;
  label: string;
  cost: number;
}

const PROTECTED_IDS = new Set(['single', 'standard', 'business', 'chat_unlock']);

export default function AdminPricing() {
  const { session } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [packages, setPackages] = useState<CreditPackageRow[]>([]);
  const [costs, setCosts]       = useState<CreditCostRow[]>([]);
  const [signupBonus, setSignupBonus] = useState('');
  const [savingSignup, setSavingSignup] = useState(false);
  const [savingPkg, setSavingPkg]   = useState<string | null>(null);
  const [savingCost, setSavingCost] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const res = await fetch('/.netlify/functions/admin-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await call({ action: 'list' });
      setPackages((data.packages || []).map((p: any) => ({ ...p, credits: Number(p.credits), price_zar: Number(p.price_zar) })));
      setCosts(data.costs || []);
      setSignupBonus(String(data.signup_bonus ?? ''));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load pricing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePackageField = (id: string, field: keyof CreditPackageRow, value: unknown) => {
    setPackages(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const savePackage = async (pkg: CreditPackageRow) => {
    setSavingPkg(pkg.id);
    try {
      await call({
        action: 'update_package',
        id: pkg.id,
        patch: {
          label: pkg.label,
          credits: pkg.credits,
          price_zar: pkg.price_zar,
          note: pkg.note || null,
          is_popular: pkg.is_popular,
          sort_order: pkg.sort_order,
          active: pkg.active,
        },
      });
      toast.success(`${pkg.label} saved`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save package');
    } finally {
      setSavingPkg(null);
    }
  };

  const deletePackage = async (id: string) => {
    if (PROTECTED_IDS.has(id)) {
      toast.error('This package is used elsewhere in the app — deactivate it instead of deleting it.');
      return;
    }
    if (!confirm('Delete this package permanently? This cannot be undone.')) return;
    setSavingPkg(id);
    try {
      await call({ action: 'delete_package', id });
      setPackages(prev => prev.filter(p => p.id !== id));
      toast.success('Package deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete package');
    } finally {
      setSavingPkg(null);
    }
  };

  const updateCostField = (actionType: string, value: number) => {
    setCosts(prev => prev.map(c => (c.action_type === actionType ? { ...c, cost: value } : c)));
  };

  const saveCost = async (row: CreditCostRow) => {
    setSavingCost(row.action_type);
    try {
      await call({ action: 'update_cost', action_type: row.action_type, patch: { cost: row.cost } });
      toast.success(`${row.label} cost saved`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save cost');
    } finally {
      setSavingCost(null);
    }
  };

  const saveSignupBonus = async () => {
    const value = parseInt(signupBonus, 10);
    if (!Number.isFinite(value) || value < 0) { toast.error('Enter a non-negative number'); return; }
    setSavingSignup(true);
    try {
      await call({ action: 'update_signup_bonus', value });
      toast.success('Signup bonus saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save signup bonus');
    } finally {
      setSavingSignup(false);
    }
  };

  // ── New package form state ──────────────────────────────────────────────
  const [newPkg, setNewPkg] = useState({ id: '', label: '', credits: '', price_zar: '', note: '' });
  const createPackage = async () => {
    const credits = parseInt(newPkg.credits, 10);
    const price_zar = parseFloat(newPkg.price_zar);
    if (!newPkg.id.trim() || !newPkg.label.trim()) { toast.error('Id and label are required'); return; }
    if (!Number.isFinite(credits) || credits < 0) { toast.error('Credits must be a non-negative number'); return; }
    if (!Number.isFinite(price_zar) || price_zar < 0) { toast.error('Price must be a non-negative number'); return; }

    try {
      const data = await call({
        action: 'create_package',
        package: {
          id: newPkg.id.trim().toLowerCase(),
          label: newPkg.label.trim(),
          credits,
          price_zar,
          note: newPkg.note.trim() || null,
          sort_order: packages.length,
        },
      });
      setPackages(prev => [...prev, { ...data.package, credits: Number(data.package.credits), price_zar: Number(data.package.price_zar) }]);
      setNewPkg({ id: '', label: '', credits: '', price_zar: '', note: '' });
      setShowNewForm(false);
      toast.success('Package created');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create package');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Pricing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Control credit package prices, per-action credit costs, and the signup bonus.
          Changes here update the purchase modal (Credits page) live — no deploy needed.
        </p>
      </div>

      {/* ── Signup bonus ── */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <Label className="text-sm font-semibold">Signup Bonus</Label>
        <p className="text-xs text-muted-foreground -mt-1">Free credits granted automatically to every new user.</p>
        <div className="flex gap-2">
          <Input
            value={signupBonus}
            onChange={e => setSignupBonus(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="rounded-xl w-32"
          />
          <Button onClick={saveSignupBonus} disabled={savingSignup} className="rounded-xl gap-1.5">
            {savingSignup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </Button>
        </div>
      </div>

      {/* ── Per-action credit costs ── */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <Label className="text-sm font-semibold">Credit Costs</Label>
        <p className="text-xs text-muted-foreground -mt-1">What each action deducts from a user's balance.</p>
        <div className="space-y-2">
          {costs.map(row => (
            <div key={row.action_type} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{row.label}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{row.action_type}</p>
              </div>
              <Input
                value={String(row.cost)}
                onChange={e => updateCostField(row.action_type, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))}
                inputMode="numeric"
                className="rounded-xl w-24 text-right"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => saveCost(row)}
                disabled={savingCost === row.action_type}
                className="rounded-xl shrink-0"
              >
                {savingCost === row.action_type ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Credit packages ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-semibold">Credit Packages</Label>
            <p className="text-xs text-muted-foreground">Shown in the purchase modal, in the order below.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowNewForm(v => !v)} className="rounded-xl gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Package
          </Button>
        </div>

        {showNewForm && (
          <div className="bg-card rounded-2xl border-2 border-dashed border-border p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Id (fixed, lowercase)</Label>
                <Input value={newPkg.id} onChange={e => setNewPkg(p => ({ ...p, id: e.target.value }))} placeholder="e.g. mega" className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Label</Label>
                <Input value={newPkg.label} onChange={e => setNewPkg(p => ({ ...p, label: e.target.value }))} placeholder="Mega Pack" className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Credits</Label>
                <Input value={newPkg.credits} onChange={e => setNewPkg(p => ({ ...p, credits: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Price (ZAR)</Label>
                <Input value={newPkg.price_zar} onChange={e => setNewPkg(p => ({ ...p, price_zar: e.target.value.replace(/[^\d.]/g, '') }))} inputMode="decimal" className="rounded-xl" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Note (optional — leave blank to auto-generate "up to N CVs or M letters")</Label>
                <Input value={newPkg.note} onChange={e => setNewPkg(p => ({ ...p, note: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowNewForm(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button onClick={createPackage} className="flex-1 rounded-xl">Create</Button>
            </div>
          </div>
        )}

        {packages.map(pkg => (
          <div key={pkg.id} className={`bg-card rounded-2xl border p-4 space-y-3 ${pkg.active ? 'border-border' : 'border-border opacity-60'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs text-muted-foreground">{pkg.id}</p>
                {PROTECTED_IDS.has(pkg.id) && <span className="text-[10px] text-muted-foreground">(core)</span>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updatePackageField(pkg.id, 'active', !pkg.active)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title={pkg.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}>
                  {pkg.active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => updatePackageField(pkg.id, 'is_popular', !pkg.is_popular)} className="p-1 transition-colors" title={pkg.is_popular ? 'Popular badge on' : 'Popular badge off'}>
                  <Star className={`w-4 h-4 ${pkg.is_popular ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                </button>
                <button onClick={() => deletePackage(pkg.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Label</Label>
                <Input value={pkg.label} onChange={e => updatePackageField(pkg.id, 'label', e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Sort order</Label>
                <Input value={String(pkg.sort_order)} onChange={e => updatePackageField(pkg.id, 'sort_order', parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} inputMode="numeric" className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Credits</Label>
                <Input value={String(pkg.credits)} onChange={e => updatePackageField(pkg.id, 'credits', parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} inputMode="numeric" className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Price (ZAR)</Label>
                <Input value={String(pkg.price_zar)} onChange={e => updatePackageField(pkg.id, 'price_zar', parseFloat(e.target.value.replace(/[^\d.]/g, '') || '0'))} inputMode="decimal" className="rounded-xl" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Note (optional — leave blank to auto-generate "up to N CVs or M letters")</Label>
                <Input value={pkg.note ?? ''} onChange={e => updatePackageField(pkg.id, 'note', e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <Button onClick={() => savePackage(pkg)} disabled={savingPkg === pkg.id} className="w-full rounded-xl gap-1.5">
              {savingPkg === pkg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </Button>
          </div>
        ))}
      </div>

      <div className="bg-muted/50 rounded-2xl border border-border p-4 flex items-start gap-2">
        <Coins className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          "Core" packages (Starter, Standard, Business, Messaging Unlock) can't be deleted since other parts of the
          app look them up by id — deactivate them instead if you want to hide one from the purchase modal.
        </p>
      </div>
    </div>
  );
}
