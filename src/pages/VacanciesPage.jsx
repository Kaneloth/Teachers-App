import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, ExternalLink, Briefcase, RefreshCw, Calendar, ArrowLeft, Building2, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const PROVINCES = [
  'All Provinces', 'Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape',
  'Mpumalanga', 'Limpopo', 'North West', 'Free State', 'Northern Cape'
];

const POST_TYPES = ['All Types', 'School-Based', 'District-Based', 'Circuit-Based'];

export default function VacanciesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [province, setProvince] = useState('All Provinces');
  const [postType, setPostType] = useState('All Types');
  const [refreshing, setRefreshing] = useState(false);

  const { data: vacancies = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['vacancies'],
    queryFn: () => base44.entities.Vacancy.filter({ is_active: true }, '-created_date', 100),
    staleTime: 1000 * 60 * 30,
  });

  const filtered = vacancies.filter(v => {
    const matchProvince = province === 'All Provinces' || v.province === province;
    const matchType = postType === 'All Types' || v.post_type === postType;
    const q = searchText.toLowerCase();
    const matchSearch = !searchText ||
      v.title?.toLowerCase().includes(q) ||
      v.school?.toLowerCase().includes(q) ||
      v.district?.toLowerCase().includes(q) ||
      (v.subjects || []).some(s => s.toLowerCase().includes(q));
    return matchProvince && matchType && matchSearch;
  });

  const handleAdminRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await base44.functions.invoke('fetchVacancies', {});
      toast.success(res.data?.message || 'Vacancies refreshed');
      queryClient.invalidateQueries({ queryKey: ['vacancies'] });
    } catch (e) {
      toast.error('Failed to refresh vacancies');
    }
    setRefreshing(false);
  };

  const daysUntilClose = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Closed';
    if (diff === 0) return 'Closes today';
    if (diff === 1) return '1 day left';
    return `${diff} days left`;
  };

  const urgencyColor = (dateStr) => {
    if (!dateStr) return 'bg-muted text-muted-foreground';
    const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'bg-muted text-muted-foreground';
    if (diff <= 3) return 'bg-destructive/10 text-destructive';
    if (diff <= 7) return 'bg-accent/15 text-accent-foreground';
    return 'bg-primary/10 text-primary';
  };

  const postTypeBadgeColor = (type) => {
    if (type === 'District-Based') return 'bg-purple-100 text-purple-700';
    if (type === 'Circuit-Based') return 'bg-blue-100 text-blue-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const lastUpdated = vacancies[0]?.fetched_at
    ? new Date(vacancies[0].fetched_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <Briefcase className="w-5 h-5 text-primary" strokeWidth={2.5} />
          <h1 className="text-xl font-bold text-foreground">Vacancies</h1>
        </div>
        {user?.role === 'admin' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdminRefresh}
            disabled={refreshing}
            className="rounded-xl gap-1.5 text-xs h-8"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {refreshing ? 'Fetching...' : 'Refresh'}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Teaching posts across South Africa</p>
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Updated {lastUpdated}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, school, district or subject..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-9 rounded-xl h-10 bg-card"
          />
        </div>
        <div className="flex gap-2">
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger className="flex-1 rounded-xl h-9 bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={postType} onValueChange={setPostType}>
            <SelectTrigger className="flex-1 rounded-xl h-9 bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading vacancies...</p>
        </div>
      ) : vacancies.length === 0 ? (
        /* Empty state — no vacancies in DB yet */
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Briefcase className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">No vacancies yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Vacancies are fetched automatically every morning. Check back soon, or ask an admin to refresh now.
          </p>
          {user?.role === 'admin' && (
            <Button onClick={handleAdminRefresh} disabled={refreshing} className="rounded-xl gap-2">
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {refreshing ? 'Fetching vacancies...' : 'Fetch Vacancies Now'}
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            {filtered.length} post{filtered.length !== 1 ? 's' : ''} found
            {vacancies.length !== filtered.length ? ` (of ${vacancies.length} total)` : ''}
          </p>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">No posts match your filters.</p>
              </div>
            ) : (
              filtered.map((v, i) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="bg-card rounded-2xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm text-foreground leading-snug flex-1">{v.title}</h3>
                      <Badge className={`text-[10px] px-2 py-0.5 border-0 shrink-0 ${urgencyColor(v.closing_date)}`}>
                        {daysUntilClose(v.closing_date)}
                      </Badge>
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{v.school}{v.post_level ? ` · ${v.post_level}` : ''}</span>
                      </div>
                      {(v.province || v.district) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{[v.province, v.district].filter(Boolean).join(' – ')}</span>
                        </div>
                      )}
                      {v.closing_date && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>Closes: {new Date(v.closing_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {(v.subjects || []).map(s => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                      {v.phase && v.phase !== 'Any' && (
                        <Badge variant="outline" className="text-[10px]">{v.phase} Phase</Badge>
                      )}
                      {v.post_type && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${postTypeBadgeColor(v.post_type)}`}>
                          {v.post_type}
                        </span>
                      )}
                    </div>

                    {v.requirements && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{v.requirements}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {v.reference ? `Ref: ${v.reference} · ` : ''}via {v.source}
                      </span>
                      {v.source_url && (
                        <a href={v.source_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg gap-1">
                            View / Apply <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}