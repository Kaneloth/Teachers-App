import { useEffect, useState } from 'react';
import {
  Wallet, Loader2, RefreshCw, ChevronLeft, ChevronRight, Download,
  Filter, X, Archive, Calendar, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

interface TxRow {
  id: number;
  user_id: string;
  user_full_name: string | null;
  amount: number;
  reason: string;
  package_id: string | null;
  balance_after: number;
  payment_ref: string | null;
  created_at: string;
  financial_year?: string;
}

interface Filters {
  name: string;
  user_id: string;
  package_id: string;
  amount_min: string;
  amount_max: string;
  balance_min: string;
  balance_max: string;
  date_from: string;
  date_to: string;
}

const EMPTY_FILTERS: Filters = {
  name: '', user_id: '', package_id: '',
  amount_min: '', amount_max: '', balance_min: '', balance_max: '',
  date_from: '', date_to: '',
};

const fmtZAR = (n: number) => `R${Number(n).toFixed(2)}`;
const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminTransactions() {
  const { session } = useAuth();

  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [source, setSource] = useState<'live' | 'archive'>('live');
  const [financialYear, setFinancialYear] = useState('');
  const [pastYears, setPastYears] = useState<{ financial_year: string; count: number }[]>([]);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivePreview, setArchivePreview] = useState<{ count: number; earliest: string | null; latest: string | null } | null>(null);
  const [archiveLabel, setArchiveLabel] = useState('');
  const [archiving, setArchiving] = useState(false);

  const call = async (fn: string, body: Record<string, unknown>) => {
    const res = await fetch(`/.netlify/functions/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const activeFiltersForApi = () => {
    const f: Record<string, unknown> = {};
    if (filters.name) f.name = filters.name;
    if (filters.user_id) f.user_id = filters.user_id;
    if (filters.package_id) f.package_id = filters.package_id;
    if (filters.amount_min) f.amount_min = Number(filters.amount_min);
    if (filters.amount_max) f.amount_max = Number(filters.amount_max);
    if (filters.balance_min) f.balance_min = Number(filters.balance_min);
    if (filters.balance_max) f.balance_max = Number(filters.balance_max);
    if (filters.date_from) f.date_from = filters.date_from;
    if (filters.date_to) f.date_to = filters.date_to;
    return f;
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await call('admin-transactions', {
        action: 'list',
        source,
        financial_year: source === 'archive' ? financialYear : undefined,
        page, pageSize,
        filters: activeFiltersForApi(),
      });
      setRows(data.rows);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.access_token) return;
    if (source === 'archive' && !financialYear) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, source, financialYear, page, pageSize]);

  useEffect(() => {
    if (!session?.access_token) return;
    call('admin-archive-transactions', { action: 'list_years' })
      .then(d => setPastYears(d.years || []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const applyFilters = () => { setPage(1); load(); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); setTimeout(load, 0); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await call('admin-transactions', {
        action: 'export',
        source,
        financial_year: source === 'archive' ? financialYear : undefined,
        filters: activeFiltersForApi(),
      });
      const exportRows: TxRow[] = data.rows;
      if (!exportRows.length) { toast.error('No transactions match the current filters'); return; }
      if (data.truncated) toast.error('Export capped at 10,000 rows — narrow your filters to get everything');

      const headers = ['ID', 'User Name', 'User ID', 'Amount (ZAR)', 'Reason', 'Package', 'Balance After', 'Payment Ref', 'Date'];
      const csvRows = exportRows.map(r => [
        r.id, r.user_full_name || '', r.user_id, r.amount, r.reason, r.package_id || '', r.balance_after, r.payment_ref || '', r.created_at,
      ]);
      const csv = [headers, ...csvRows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${source === 'archive' ? financialYear : 'current'}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${exportRows.length} transactions`);
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const openArchiveModal = async () => {
    setShowArchiveModal(true);
    setArchivePreview(null);
    setArchiveLabel('');
    try {
      const data = await call('admin-archive-transactions', { action: 'preview' });
      setArchivePreview(data);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load preview');
      setShowArchiveModal(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveLabel.trim()) { toast.error('Enter a label for this financial year'); return; }
    setArchiving(true);
    try {
      const data = await call('admin-archive-transactions', { action: 'archive', financial_year: archiveLabel.trim() });
      toast.success(`Archived ${data.archived_count} transactions as "${data.financial_year}"`);
      setShowArchiveModal(false);
      setPage(1);
      load();
      call('admin-archive-transactions', { action: 'list_years' }).then(d => setPastYears(d.years || [])).catch(() => {});
    } catch (e: any) {
      toast.error(e.message || 'Archiving failed');
    } finally {
      setArchiving(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Transactions
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real money flows — credit purchases and messaging unlocks</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setSource('live'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${source === 'live' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        >
          Current
        </button>
        {pastYears.map(y => (
          <button
            key={y.financial_year}
            onClick={() => { setSource('archive'); setFinancialYear(y.financial_year); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${source === 'archive' && financialYear === y.financial_year ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {y.financial_year} ({y.count})
          </button>
        ))}
        <button onClick={openArchiveModal} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/15 transition-colors">
          <Archive className="w-3.5 h-3.5" /> Start New Financial Year
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border">
        <button onClick={() => setShowFilters(s => !s)} className="w-full flex items-center justify-between p-3">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
          </span>
          <span className="text-xs text-muted-foreground">{showFilters ? 'Hide' : 'Show'}</span>
        </button>
        {showFilters && (
          <div className="p-3 pt-0 space-y-3 border-t border-border">
            <div className="grid grid-cols-2 gap-2">
              <FilterField label="User name">
                <Input value={filters.name} onChange={e => setFilters(f => ({ ...f, name: e.target.value }))} placeholder="Search name..." className="h-9 rounded-lg text-sm" />
              </FilterField>
              <FilterField label="User ID">
                <Input value={filters.user_id} onChange={e => setFilters(f => ({ ...f, user_id: e.target.value }))} placeholder="Exact UUID..." className="h-9 rounded-lg text-sm" />
              </FilterField>
              <FilterField label="Package">
                <Input value={filters.package_id} onChange={e => setFilters(f => ({ ...f, package_id: e.target.value }))} placeholder="e.g. standard" className="h-9 rounded-lg text-sm" />
              </FilterField>
              <FilterField label="Amount range (R)">
                <div className="flex gap-1.5">
                  <Input type="number" value={filters.amount_min} onChange={e => setFilters(f => ({ ...f, amount_min: e.target.value }))} placeholder="Min" className="h-9 rounded-lg text-sm" />
                  <Input type="number" value={filters.amount_max} onChange={e => setFilters(f => ({ ...f, amount_max: e.target.value }))} placeholder="Max" className="h-9 rounded-lg text-sm" />
                </div>
              </FilterField>
              <FilterField label="Balance range">
                <div className="flex gap-1.5">
                  <Input type="number" value={filters.balance_min} onChange={e => setFilters(f => ({ ...f, balance_min: e.target.value }))} placeholder="Min" className="h-9 rounded-lg text-sm" />
                  <Input type="number" value={filters.balance_max} onChange={e => setFilters(f => ({ ...f, balance_max: e.target.value }))} placeholder="Max" className="h-9 rounded-lg text-sm" />
                </div>
              </FilterField>
              <FilterField label="Date range">
                <div className="flex gap-1.5">
                  <Input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} className="h-9 rounded-lg text-sm" />
                  <Input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} className="h-9 rounded-lg text-sm" />
                </div>
              </FilterField>
            </div>
            <div className="flex gap-2">
              <Button onClick={applyFilters} size="sm" className="flex-1 rounded-lg">Apply Filters</Button>
              {activeFilterCount > 0 && (
                <Button onClick={clearFilters} variant="outline" size="sm" className="rounded-lg gap-1.5"><X className="w-3.5 h-3.5" /> Clear</Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Show</span>
          {[10, 50, 100].map(n => (
            <button key={n} onClick={() => { setPageSize(n); setPage(1); }}
              className={`px-2 py-1 rounded-md ${pageSize === n ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {n}
            </button>
          ))}
        </div>
        <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm" className="rounded-lg gap-1.5">
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} CSV
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No transactions match these filters.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="bg-card rounded-2xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.user_full_name || 'Unknown user'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.user_id}</p>
                </div>
                <span className="text-sm font-bold text-primary shrink-0">{fmtZAR(r.amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
                <span className="truncate">{r.reason}{r.package_id ? ` (${r.package_id})` : ''}</span>
                <span className="shrink-0">#{r.id}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(r.created_at)}</span>
                <span>Balance after: <strong className="text-foreground">{r.balance_after}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg gap-1">
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} total</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg gap-1">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold">Start New Financial Year</h3>
            </div>
            {archivePreview === null ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  This will move all <strong className="text-foreground">{archivePreview.count}</strong> current transactions
                  {archivePreview.earliest && archivePreview.latest && (
                    <> (spanning {new Date(archivePreview.earliest).toLocaleDateString('en-ZA')} to {new Date(archivePreview.latest).toLocaleDateString('en-ZA')})</>
                  )} into an archive, then reset the live table so the next transaction starts again at #1. This cannot be undone.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Label this financial year</Label>
                  <Input value={archiveLabel} onChange={e => setArchiveLabel(e.target.value)} placeholder="e.g. 2025/2026" className="rounded-xl" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowArchiveModal(false)} className="flex-1 rounded-xl">Cancel</Button>
                  <Button variant="destructive" onClick={confirmArchive} disabled={archiving || archivePreview.count === 0} className="flex-1 rounded-xl gap-1.5">
                    {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />} Archive
                  </Button>
                </div>
                {archivePreview.count === 0 && <p className="text-xs text-muted-foreground text-center">Nothing to archive right now.</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
