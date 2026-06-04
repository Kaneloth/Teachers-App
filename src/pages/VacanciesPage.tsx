import { useEffect, useState } from 'react';
import {
  Briefcase, MapPin, Calendar, ExternalLink, Search,
  ArrowLeft, Clock, RefreshCw, Loader2, Building2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { format, differenceInDays, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import SubscriptionModal from '@/components/SubscriptionModal';

interface Vacancy {
  id: string;
  title: string;
  school?: string;
  province?: string;
  district?: string;
  phase?: string;
  post_type?: string;
  subjects?: string[];
  post_level?: string;
  closing_date?: string;
  institution?: string;
  description?: string;
  source?: string;
  reference?: string;
  application_url?: string;
  posted_by_school?: boolean;
  created_at: string;
}

const PROVINCES = [
  'Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape',
  'Mpumalanga', 'Limpopo', 'North West', 'Free State', 'Northern Cape',
];

const TYPES = ['School-Based', 'Circuit', 'District', 'Provincial', 'National'];

const SOURCE_BADGE: Record<string, string> = {
  Adzuna:    'bg-green-50 text-green-700 border-green-200',
  Careers24: 'bg-purple-50 text-purple-700 border-purple-200',
  School:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  DPSA:      'bg-blue-50 text-blue-700 border-blue-200',
  Indeed:    'bg-orange-50 text-orange-700 border-orange-200',
};

function DaysLeftBadge({ closing_date }: { closing_date?: string }) {
  if (!closing_date) return null;
  const date = new Date(closing_date);
  if (isPast(date)) {
    return (
      <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 shrink-0">
        Expired
      </span>
    );
  }
  const days = differenceInDays(date, new Date());
  const color = days <= 3
    ? 'text-destructive bg-destructive/10 border-destructive/20'
    : days <= 7
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-primary bg-primary/10 border-primary/20';
  return (
    <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 border shrink-0 ${color}`}>
      {days === 0 ? 'Closes today' : days === 1 ? '1 day left' : `${days} days left`}
    </span>
  );
}

const FREE_APPLY_LIMIT = 5;

function VacancyCard({
  vacancy: v,
  index: i,
  isPro,
  isApplied,
  appliedCount,
  onApply,
  onUpgrade,
}: {
  vacancy: Vacancy;
  index: number;
  isPro: boolean;
  isApplied: boolean;
  appliedCount: number;
  onApply: (vacancyId: string, url: string) => void;
  onUpgrade: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.03 }}
    >
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        {/* Title + days left */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground text-sm leading-snug flex-1">{v.title}</h3>
          <DaysLeftBadge closing_date={v.closing_date} />
        </div>

        {/* School + post level */}
        {(v.school || v.post_level) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {[v.school, v.post_level ? `Post Level ${v.post_level}` : null].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}

        {/* Province / district */}
        {(v.province || v.district) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            <span>{[v.province, v.district].filter(Boolean).join(' – ')}</span>
          </div>
        )}

        {/* Closing date */}
        {v.closing_date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>Closes: {format(new Date(v.closing_date), 'dd MMM yyyy')}</span>
          </div>
        )}

        {/* Subjects + post_type + phase tags */}
        {(v.subjects?.length || v.post_type || v.phase) && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {v.subjects?.map(s => (
              <span key={s} className="text-[10px] bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 border border-border">
                {s}
              </span>
            ))}
            {v.post_type && (
              <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5 font-medium">
                {v.post_type}
              </span>
            )}
            {v.phase && (
              <span className="text-[10px] text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-0.5 font-medium">
                {v.phase}
              </span>
            )}
          </div>
        )}

        {/* Expandable description (snippet / DPSA Ctrl+F tip) */}
        {v.description && (
          <div className="pt-0.5">
            <button
              onClick={() => setExpanded(x => !x)}
              className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide details' : 'Show details'}
            </button>
            {expanded && (
              <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/40 rounded-xl px-3 py-2">
                {v.description}
              </p>
            )}
          </div>
        )}

        {/* Footer: source · ref · apply button */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
          <span className="text-[10px] text-muted-foreground truncate">
            {v.reference ? `Ref: ${v.reference} · ` : ''}
            {v.posted_by_school
              ? 'School Post'
              : v.source
                ? `via ${v.source}`
                : ''}
          </span>
          {v.application_url ? (
            isPro ? (
              <a href={v.application_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1">
                  Apply <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            ) : isApplied ? (
              /* Already used one of their 5 slots on this post — re-clicking is fine */
              <a href={v.application_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1 text-primary border-primary/40">
                  Applied <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            ) : appliedCount < FREE_APPLY_LIMIT ? (
              /* Still has free slots */
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg gap-1"
                onClick={() => onApply(v.id, v.application_url!)}
              >
                Apply <ExternalLink className="w-3 h-3" />
              </Button>
            ) : (
              /* Limit reached */
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg gap-1 text-primary border-primary/40"
                onClick={onUpgrade}
              >
                🔒 Upgrade to Apply
              </Button>
            )
          ) : (
            <span className="text-[10px] text-muted-foreground italic shrink-0">No link</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Apply tracking helpers (localStorage cache + user_metadata backup) ── */
const appliedKey = (userId: string) => `crosssa_applied_vacancies_${userId}`;

function getLocalAppliedIds(userId: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(appliedKey(userId)) || '[]')); }
  catch { return new Set(); }
}

function saveLocalAppliedIds(userId: string, ids: Set<string>) {
  localStorage.setItem(appliedKey(userId), JSON.stringify([...ids]));
}

export default function VacanciesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  /* Subscription check — dual source (profiles + user_metadata fallback) */
  const [subProfile, setSubProfile] = useState<{ subscription_plan: string; subscription_end: string | null } | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('subscription_plan, subscription_end').eq('id', user.id).single()
      .then(({ data }) => setSubProfile(data));
  }, [user]);
  const profilePlan = subProfile?.subscription_plan;
  const metaPlan = user?.user_metadata?.subscription_plan as string | undefined;
  const plan = (profilePlan && profilePlan !== 'free') ? profilePlan : (metaPlan || 'free');
  const profileEnd = subProfile?.subscription_end;
  const metaEnd = user?.user_metadata?.subscription_end as string | undefined;
  const subEnd = profileEnd ? new Date(profileEnd) : metaEnd ? new Date(metaEnd) : null;
  const isPro = plan !== 'free' && subEnd !== null && subEnd > new Date();

  /* ── Free-tier apply tracking (localStorage + user_metadata server backup) ── */
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [showSubModal, setShowSubModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Merge local cache with server-stored IDs from user_metadata
    const local = getLocalAppliedIds(user.id);
    const serverIds: string[] = user.user_metadata?.free_applied_ids ?? [];
    const merged = new Set([...local, ...serverIds]);
    // Sync merged set back to localStorage so it stays fresh
    saveLocalAppliedIds(user.id, merged);
    setAppliedIds(merged);
  }, [user]);

  const handleApply = async (vacancyId: string, url: string) => {
    if (!user) return;
    const updated = new Set(appliedIds);
    updated.add(vacancyId);
    setAppliedIds(updated);
    // Save to localStorage (immediate) + user_metadata (persistent across devices)
    saveLocalAppliedIds(user.id, updated);
    supabase.auth.updateUser({ data: { free_applied_ids: [...updated] } });
    window.open(url, '_blank', 'noopener,noreferrer');
    const remaining = FREE_APPLY_LIMIT - updated.size;
    if (remaining > 0) {
      toast.success(`Application opened`, {
        description: `${remaining} free application${remaining !== 1 ? 's' : ''} remaining.`,
      });
    } else {
      toast.info(`Last free application used — upgrade to Pro for unlimited applications.`);
      setShowSubModal(true);
    }
  };

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('');
  const [type, setType] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vacancies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setVacancies(data || []);
    if (data?.length) setLastUpdated(new Date(data[0].created_at));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const adminSecret = import.meta.env.VITE_ADMIN_SECRET;
      if (!adminSecret) throw new Error('VITE_ADMIN_SECRET not set');

      const res = await fetch('/.netlify/functions/fetch-vacancies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Unknown error');

      const { adzuna = 0, careers24 = 0 } = json.sources ?? {};
      const total = json.total ?? (adzuna + careers24);
      const logLines: string[] = json.log ?? [];

      if (total > 0) {
        const parts = [];
        if (adzuna)    parts.push(`${adzuna} Adzuna`);
        if (careers24) parts.push(`${careers24} Careers24`);
        toast.success(`${total} posts imported — ${parts.join(' · ')}`, { duration: 6000 });
      } else {
        // Show the first meaningful log line so the user can see the actual reason
        const detail = logLines.find(l => l.includes('error') || l.includes('skipped') || l.includes('results')) || logLines[0] || 'No details available';
        toast.info(`0 posts found — ${detail}`, { duration: 10000 });
      }
      await load();
    } catch (e: any) {
      toast.error(`Refresh failed: ${e.message}`);
    }
    setRefreshing(false);
  };

  const filtered = vacancies.filter(v => {
    if (province && v.province !== province) return false;
    if (type && v.post_type !== type) return false;
    if (query.trim()) {
      const lower = query.toLowerCase();
      if (
        !v.title?.toLowerCase().includes(lower) &&
        !v.school?.toLowerCase().includes(lower) &&
        !v.district?.toLowerCase().includes(lower) &&
        !v.subjects?.some(s => s.toLowerCase().includes(lower))
      ) return false;
    }
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <Briefcase className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-lg font-bold text-foreground truncate">Vacancies</h1>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-xl gap-1.5 text-xs h-8 shrink-0"
          >
            {refreshing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            {refreshing ? 'Fetching…' : 'Refresh'}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-0.5 pl-1">
          <p className="text-sm text-muted-foreground">Teaching posts across South Africa</p>
          {lastUpdated && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
              <Clock className="w-3 h-3" />
              Updated {format(lastUpdated, 'dd MMM yyyy')}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title, school, district or subject…"
            className="pl-9 rounded-xl bg-muted/30 border-border"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <Select value={province} onValueChange={v => setProvince(v === 'all' ? '' : v)}>
          <SelectTrigger className="rounded-xl bg-card text-sm">
            <SelectValue placeholder="All Provinces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Provinces</SelectItem>
            {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={v => setType(v === 'all' ? '' : v)}>
          <SelectTrigger className="rounded-xl bg-card text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Source legend */}
      <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
        {Object.entries(SOURCE_BADGE).map(([src, cls]) => (
          <span key={src} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{src}</span>
        ))}
        <span className="text-[10px] text-muted-foreground">— vacancy source</span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading vacancies…</p>
        </div>
      ) : vacancies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Briefcase className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">No vacancies yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Vacancies are fetched automatically. Check back soon, or tap Refresh to fetch now.
          </p>
          <Button onClick={handleRefresh} disabled={refreshing} className="rounded-xl gap-2">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {refreshing ? 'Fetching vacancies…' : 'Fetch Vacancies Now'}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground px-4 pb-3">
            {filtered.length} post{filtered.length !== 1 ? 's' : ''} found
            {vacancies.length !== filtered.length ? ` (of ${vacancies.length} total)` : ''}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground px-8">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No posts match your filters</p>
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="px-4 pb-6 space-y-3">
              {filtered.map((v, i) => (
                <VacancyCard
                  key={v.id}
                  vacancy={v}
                  index={i}
                  isPro={isPro}
                  isApplied={appliedIds.has(v.id)}
                  appliedCount={appliedIds.size}
                  onApply={handleApply}
                  onUpgrade={() => setShowSubModal(true)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <SubscriptionModal open={showSubModal} onClose={() => setShowSubModal(false)} />
    </div>
  );
}
