import { useEffect, useMemo, useState } from 'react';
import {
  Ticket, Loader2, Plus, Upload, Download, Trash2, Ban, Power, PowerOff,
  Search, Copy, Check, FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

interface ReferralCodeRow {
  id: string;
  code: string;
  recipient_name: string;
  recipient_initials: string;
  year: number;
  credits: number;
  status: 'inactive' | 'active' | 'redeemed' | 'expired' | 'revoked';
  expires_at: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<ReferralCodeRow['status'], string> = {
  inactive: 'Inactive',
  active:   'Active',
  redeemed: 'Redeemed',
  expired:  'Expired',
  revoked:  'Revoked',
};

const STATUS_STYLES: Record<ReferralCodeRow['status'], string> = {
  inactive: 'bg-muted text-muted-foreground border-border',
  active:   'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
  redeemed: 'bg-primary/10 text-primary border-primary/20',
  expired:  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  revoked:  'bg-destructive/10 text-destructive border-destructive/20',
};

/** Parses a "name,initials" CSV (optionally with a header row). */
function parseCsv(text: string): { name: string; initials: string }[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstCols = lines[0].split(',').map(c => c.trim().toLowerCase());
  const hasHeader = firstCols[0] === 'name' || firstCols.includes('name');
  const rows: { name: string; initials: string }[] = [];

  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const [name, initials] = cols;
    if (name && initials) rows.push({ name, initials });
  }
  return rows;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminReferralCodes() {
  const { session } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [codes, setCodes]       = useState<ReferralCodeRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch]     = useState('');
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName]         = useState('');
  const [newInitials, setNewInitials] = useState('');
  const [newActivate, setNewActivate] = useState(true);
  const [creating, setCreating]       = useState(false);

  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkFile, setBulkFile]         = useState<File | null>(null);
  const [bulkActivate, setBulkActivate] = useState(true);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number } | null>(null);

  const [exporting, setExporting] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const res = await fetch('/.netlify/functions/admin-referral-codes', {
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
      setCodes(data.codes || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load referral codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return codes.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        if (!c.code.toLowerCase().includes(term) && !c.recipient_name.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [codes, statusFilter, search]);

  const createCode = async () => {
    if (!newName.trim() || !newInitials.trim()) { toast.error('Name and initials are required'); return; }
    setCreating(true);
    try {
      const data = await call({
        action: 'create',
        recipient_name: newName.trim(),
        recipient_initials: newInitials.trim(),
        activate: newActivate,
      });
      setCodes(prev => [data.referral_code, ...prev]);
      setNewName(''); setNewInitials(''); setNewActivate(true);
      setShowAddForm(false);
      toast.success(`Code ${data.referral_code.code} created`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create code');
    } finally {
      setCreating(false);
    }
  };

  const downloadTemplate = () => {
    downloadCsv('referral-codes-template.csv', 'name,initials\nThabo Mokoena,TM\nLindiwe Dlamini,LD\n');
  };

  const uploadBulk = async () => {
    if (!bulkFile) { toast.error('Choose a CSV file first'); return; }
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const text = await bulkFile.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast.error('No valid rows found — expected columns: name,initials'); return; }
      if (rows.length > 500) { toast.error(`Max 500 rows per upload (found ${rows.length})`); return; }

      const data = await call({ action: 'bulk_upload', rows, activate: bulkActivate });
      setBulkResult({ created: data.created?.length || 0, skipped: data.skipped?.length || 0 });
      if (data.created?.length) setCodes(prev => [...data.created, ...prev]);
      toast.success(`${data.created?.length || 0} code(s) created${data.skipped?.length ? `, ${data.skipped.length} skipped` : ''}`);
      setBulkFile(null);
    } catch (e: any) {
      toast.error(e.message || 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const doAction = async (action: 'activate' | 'deactivate' | 'revoke' | 'delete', row: ReferralCodeRow) => {
    if (action === 'delete' && !confirm(`Permanently delete code ${row.code}? This cannot be undone.`)) return;
    setBusyId(row.id);
    try {
      const data = await call({ action, id: row.id });
      if (action === 'delete') {
        setCodes(prev => prev.filter(c => c.id !== row.id));
      } else {
        setCodes(prev => prev.map(c => (c.id === row.id ? data.referral_code : c)));
      }
      toast.success(
        action === 'activate'   ? `${row.code} activated` :
        action === 'deactivate' ? `${row.code} deactivated` :
        action === 'revoke'     ? `${row.code} revoked` :
        `${row.code} deleted`
      );
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} code`);
    } finally {
      setBusyId(null);
    }
  };

  const copyCode = (row: ReferralCodeRow) => {
    navigator.clipboard?.writeText(row.code).then(() => {
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const data = await call({ action: 'export', status: statusFilter === 'all' ? 'all' : statusFilter });
      const rows: { recipient_name: string; code: string }[] = data.rows || [];
      const csv = ['Learner Name,Token', ...rows.map(r => `"${r.recipient_name.replace(/"/g, '""')}",${r.code}`)].join('\n');
      downloadCsv(`referral-codes-${statusFilter}.csv`, csv);
      toast.success(`Exported ${rows.length} code(s)`);
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
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
        <h1 className="text-xl font-bold text-foreground">Referral Codes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Issue codes that grant a new learner +90 bonus credits (on top of the normal signup bonus) when
          entered at signup. Each code is single-use and expires 30 days after activation.
        </p>
      </div>

      {/* ── Add single code ── */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Add a Code</Label>
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(v => !v)} className="rounded-xl gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Code
          </Button>
        </div>

        {showAddForm && (
          <div className="border-2 border-dashed border-border rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Recipient Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Thabo Mokoena" className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Initials (2 letters)</Label>
                <Input
                  value={newInitials}
                  onChange={e => setNewInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                  placeholder="TM"
                  className="rounded-xl"
                  maxLength={2}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={newActivate} onChange={e => setNewActivate(e.target.checked)} className="rounded" />
              Activate immediately (starts the 30-day expiry now)
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button onClick={createCode} disabled={creating} className="flex-1 rounded-xl">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk CSV upload ── */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-semibold">Bulk Upload</Label>
            <p className="text-xs text-muted-foreground">CSV with columns: name,initials — up to 500 rows.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="rounded-xl gap-1.5">
              <FileDown className="w-3.5 h-3.5" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkForm(v => !v)} className="rounded-xl gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload CSV
            </Button>
          </div>
        </div>

        {showBulkForm && (
          <div className="border-2 border-dashed border-border rounded-2xl p-4 space-y-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={e => { setBulkFile(e.target.files?.[0] || null); setBulkResult(null); }}
              className="rounded-xl"
            />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={bulkActivate} onChange={e => setBulkActivate(e.target.checked)} className="rounded" />
              Activate all codes immediately
            </label>
            {bulkResult && (
              <p className="text-xs text-muted-foreground">
                Last upload: {bulkResult.created} created, {bulkResult.skipped} skipped.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowBulkForm(false); setBulkFile(null); }} className="flex-1 rounded-xl">Cancel</Button>
              <Button onClick={uploadBulk} disabled={bulkUploading || !bulkFile} className="flex-1 rounded-xl gap-1.5">
                {bulkUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Filter / search / export ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="rounded-xl w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="redeemed">Redeemed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or code…" className="rounded-xl pl-8" />
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={exporting} className="rounded-xl gap-1.5">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export CSV
        </Button>
      </div>

      {/* ── Code list ── */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-card rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
            No referral codes match this filter.
          </div>
        )}

        {filtered.map(row => (
          <div key={row.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm font-semibold text-foreground truncate">{row.code}</p>
                <button onClick={() => copyCode(row)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  {copiedId === row.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLES[row.status]}`}>
                  {STATUS_LABELS[row.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {row.recipient_name} · {row.credits} credits
                {row.status === 'active' && row.expires_at && ` · expires ${new Date(row.expires_at).toLocaleDateString()}`}
                {row.status === 'redeemed' && row.redeemed_at && ` · redeemed ${new Date(row.redeemed_at).toLocaleDateString()}`}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {(row.status === 'inactive' || row.status === 'expired') && (
                <button
                  onClick={() => doAction('activate', row)}
                  disabled={busyId === row.id}
                  title="Activate"
                  className="p-1.5 text-muted-foreground hover:text-green-600 transition-colors"
                >
                  <Power className="w-4 h-4" />
                </button>
              )}
              {row.status === 'active' && (
                <button
                  onClick={() => doAction('deactivate', row)}
                  disabled={busyId === row.id}
                  title="Deactivate"
                  className="p-1.5 text-muted-foreground hover:text-amber-600 transition-colors"
                >
                  <PowerOff className="w-4 h-4" />
                </button>
              )}
              {row.status !== 'redeemed' && row.status !== 'revoked' && (
                <button
                  onClick={() => doAction('revoke', row)}
                  disabled={busyId === row.id}
                  title="Revoke"
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Ban className="w-4 h-4" />
                </button>
              )}
              {row.status !== 'redeemed' && (
                <button
                  onClick={() => doAction('delete', row)}
                  disabled={busyId === row.id}
                  title="Delete"
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  {busyId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
