import { useEffect, useState } from 'react';
import {
  Coins, Loader2, RefreshCw, ChevronLeft, ChevronRight, Download,
  Filter, X, Calendar, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

interface MovementRow {
  id: string;
  user_id: string;
  user_full_name: string | null;
  amount: number;
  type: string;
  description: string | null;
  ref_id: string | null;
  created_at: string;
}

interface Filters {
  name: string;
  user_id: string;
  type: string;
  reason: string;
  amount_min: string;
  amount_max: string;
  date_from: string;
  date_to: string;
}

const EMPTY_FILTERS: Filters = {
  name: '', user_id: '', type: '', reason: '',
  amount_min: '', amount_max: '', date_from: '', date_to: '',
};

const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminCreditsMovement() {
  const { session } = useAuth();

  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const res = await fetch('/.netlify/functions/admin-credits-movement', {
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
    if (filters.type) f.type = filters.type;
    if (filters.reason) f.reason = filters.reason;
    if (filters.amount_min) f.amount_min = Number(filters.amount_min);
    if (filters.amount_max) f.amount_max = Number(filters.amount_max);
    if (filters.date_from) f.date_from = filters.date_from;
    if (filters.date_to) f.date_to = filters.date_to;
    return f;
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await call({ action: 'list', page, pageSize, filters: activeFiltersForApi() });
      setRows(data.rows);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load credit movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.access_token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, page, pageSize]);

  const applyFilters = () => { setPage(1); load(); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); setTimeout(load, 0); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await call({ action: 'export', filters: activeFiltersForApi() });
      const exportRows: MovementRow[] = data.rows;
      if (!exportRows.length) { toast.error('No movements match the current filters'); return; }
      if (data.truncated) toast.error('Export capped at 10,000 rows — narrow your filters to get everything');

      const headers = ['ID', 'User Name', 'User ID', 'Amount (Credits)', 'Type', 'Description', 'Ref ID', 'Date'];
      const csvRows = exportRows.map(r => [
        r.id, r.user_full_name || '', r.user_id, r.amount, r.type, r.description || '', r.ref_id || '', r.created_at,
      ]);
      const csv = [headers, ...csvRows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credits_movement_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${exportRows.length} movements`);
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" /> Credits Movement
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">What activities move credits, and in which direction</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
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
              <FilterField label="Type">
                <Input value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} placeholder="e.g. cv_usage" className="h-9 rounded-lg text-sm" />
              </FilterField>
              <FilterField label="Description contains">
                <Input value={filters.reason} onChange={e => setFilters(f => ({ ...f, reason: e.target.value }))} placeholder="Search description..." className="h-9 rounded-lg text-sm" />
              </FilterField>
              <FilterField label="Amount range (credits)">
                <div className="flex gap-1.5">
                  <Input type="number" value={filters.amount_min} onChange={e => setFilters(f => ({ ...f, amount_min: e.target.value }))} placeholder="Min" className="h-9 rounded-lg text-sm" />
                  <Input type="number" value={filters.amount_max} onChange={e => setFilters(f => ({ ...f, amount_max: e.target.value }))} placeholder="Max" className="h-9 rounded-lg text-sm" />
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
        <p className="text-sm text-muted-foreground text-center py-10">No credit movements match these filters.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            // Direction is read straight off the stored sign — a positive
            // amount is credits coming IN (purchase, adjustment), negative
            // is credits going OUT (cv_usage, letter_usage). This assumes
            // credit_ledger.amount is genuinely signed (positive for
            // grants, negative for deductions) rather than always-positive
            // with direction implied only by `type` — worth confirming
            // against a real deduction row if this ever looks backwards.
            const isPositive = r.amount >= 0;
            return (
              <div key={r.id} className="bg-card rounded-2xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.user_full_name || 'Unknown user'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.user_id}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 flex items-center gap-1 ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                    {isPositive ? <ArrowUpCircle className="w-3.5 h-3.5" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}
                    {isPositive ? '+' : ''}{r.amount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
                  <span className="truncate">{r.description || r.type}</span>
                  <span className="shrink-0 bg-muted px-1.5 py-0.5 rounded-md text-[10px]">{r.type}</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                  <Calendar className="w-3 h-3" /> {fmtDate(r.created_at)}
                </div>
              </div>
            );
          })}
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
