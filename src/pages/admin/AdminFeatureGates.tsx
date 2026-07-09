import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const GATES = [
  { key: 'advanced_search', label: 'Advanced Search & Matches', desc: 'R79+ gate — unlocks filters, matches page, radius search for all users' },
  { key: 'guides_access',   label: 'Guides Access',             desc: 'R79+ gate — unlocks guide downloads for all users' },
  { key: 'cv_credits',      label: 'CV Credit Gate',            desc: 'Whether CV downloads cost credits' },
  { key: 'chat_credits',    label: 'Chat Credit Gate',          desc: 'Whether starting a new chat costs credits' },
  { key: 'id_verification', label: 'ID Verification Gate',      desc: 'Whether ID verification requires R79+ purchase' },
  { key: 'templates_access',  label: 'CV Templates Gate',        desc: 'When off — all users get all 10 CV templates without purchasing' },
  { key: 'profile_edit_lock', label: 'Profile Edit Lock (30 days)', desc: 'When off — users can update their profile at any time without the 30-day cooldown' },
  { key: 'cv_watermark',      label: 'CV Watermark',              desc: 'When on — free users get a watermark on CV downloads. When off — all CVs download without watermark.' },
];

export default function AdminFeatureGates() {
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Feature Gates</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Applies to ALL users. Per-user overrides (set in Users → Edit User) take precedence.
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
          ⚠️ Disabling a gate removes the restriction for ALL users. Use Users → Edit User for individual overrides.
        </p>
      </div>
    </div>
  );
}
