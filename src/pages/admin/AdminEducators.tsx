import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronRight, X, CheckCircle, UserX, Ban, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { initials, avatarColor, statusBadge } from './adminHelpers';

interface Educator {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  current_school: string;
  sace_number: string;
  bio: string;
  account_status: string;
}

/* ── Edit educator modal ─────────────────────────────────────── */

function EditEducatorModal({ educator, onClose, onSaved }: { educator: Educator; onClose: () => void; onSaved: (updated: Educator) => void }) {
  const { session } = useAuth();
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
    try {
      // Profile fields: direct client update. These columns are in the
      // granted column list for `authenticated`, and the "admins can
      // update any educator row" RLS policy covers targeting someone
      // else's row — so this works without going through a Netlify
      // function.
      const { error } = await supabase.from('educators').update({
        full_name:      form.full_name,
        phone:          form.phone,
        current_school: form.current_school,
        sace_number:    form.sace_number,
        bio:            form.bio,
      }).eq('id', educator.id);
      if (error) throw error;

      // account_status: routed through admin-update-user instead of the
      // direct client update above. That column is deliberately NOT in
      // the granted column list (so a suspended/banned user can't
      // un-suspend themselves via a direct client call) — the column-level
      // grant is role-wide, so it blocks admins' own direct writes too,
      // regardless of the RLS policy that would otherwise allow the row.
      // admin-update-user runs with the service-role key, which bypasses
      // column grants entirely, same as the account-status control in
      // AdminUsers.tsx.
      if (form.account_status !== educator.account_status) {
        const res = await fetch('/.netlify/functions/admin-update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            target_user_id: educator.user_id,
            account_status: form.account_status,
          }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || 'Failed to update account status');
      }

      toast.success('Profile updated');
      onSaved(form);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
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

/* ── Main page ────────────────────────────────────────────────── */

export default function AdminEducators() {
  const [educators, setEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Educator | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('educators')
      .select('id, user_id, full_name, email, phone, current_school, sace_number, bio, account_status')
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Educators</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Educator profiles, school, SACE number, account status</p>
      </div>

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
