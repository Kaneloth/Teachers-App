import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronRight, X, CheckCircle, UserX, Ban, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { initials, avatarColor, statusBadge } from './adminHelpers';

interface GeneralUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  bio: string;
  account_status: string;
}

/* ── Edit general user modal ─────────────────────────────────── */

function EditGeneralUserModal({ user, onClose, onSaved }: { user: GeneralUser; onClose: () => void; onSaved: (updated: GeneralUser) => void }) {
  const { session } = useAuth();
  const [form, setForm] = useState({ ...user });
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
      // Profile fields: direct client update — same split as
      // AdminEducators.tsx's EditEducatorModal, and for the same reason.
      const { error } = await supabase.from('educators').update({
        full_name: form.full_name,
        phone:     form.phone,
        bio:       form.bio,
      }).eq('id', user.id);
      if (error) throw error;

      // account_status: routed through admin-update-user, not a direct
      // client update — that column is deliberately excluded from the
      // granted column list (so a suspended/banned user can't reinstate
      // themselves via a direct client call), which blocks admins' own
      // direct writes too, regardless of RLS. admin-update-user runs with
      // the service-role key, which bypasses column grants entirely.
      if (form.account_status !== user.account_status) {
        const res = await fetch('/.netlify/functions/admin-update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            target_user_id: user.user_id,
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
          <h2 className="text-base font-bold text-foreground">Edit Profile — {user.full_name}</h2>
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

export default function AdminGeneralUsers() {
  const [users, setUsers] = useState<GeneralUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<GeneralUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('educators')
      .select('id, user_id, full_name, email, phone, bio, account_status')
      .eq('profile_type', 'general')
      .order('full_name');
    setUsers((data as GeneralUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">General Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Non-educator profiles — account status only, no school/SACE fields</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9 rounded-2xl h-11"
        />
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-muted-foreground px-1">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">No general users found</p>
      ) : (
        <div className="space-y-0 rounded-2xl border border-border overflow-hidden bg-card">
          {filtered.map((u, i) => (
            <div key={u.id}>
              {i > 0 && <div className="border-t border-border mx-4" />}
              <button
                onClick={() => setEditing(u)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className={`w-9 h-9 rounded-full ${avatarColor(u.full_name || '?')} flex items-center justify-center shrink-0`}>
                  <span className="text-white text-xs font-bold">{initials(u.full_name || '?')}</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-foreground truncate">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email || '—'}</p>
                </div>
                {statusBadge(u.account_status)}
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditGeneralUserModal
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
