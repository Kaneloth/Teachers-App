import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import EducatorCard from '@/components/search/EducatorCard';
import SearchFilters, { Filters } from '@/components/search/SearchFilters';

interface Educator {
  id: string;
  full_name: string;
  avatar_url?: string;
  is_actively_looking?: boolean;
  is_sace_verified?: boolean;
  current_province?: string;
  town?: string;
  preferred_provinces?: string[];
  subjects?: string[];
  phase?: string;
  user_id?: string;
}

interface MyProfile {
  current_province?: string;
  preferred_provinces?: string[];
  subjects?: string[];
  phase?: string;
}

/** Same scoring formula used by MatchesPage — capped at 100. */
function computeMatchScore(e: Educator, mine: MyProfile): number {
  let score = 0;
  // "Any" in preferred_provinces means willing to go anywhere
  const wantsMyProvince    = e.preferred_provinces?.includes('Any') ||
                             (mine.current_province ? e.preferred_provinces?.includes(mine.current_province) : false);
  const iWantTheirProvince = mine.preferred_provinces?.includes('Any') ||
                             (e.current_province ? mine.preferred_provinces?.includes(e.current_province) : false);
  if (wantsMyProvince)    score += 40;
  if (iWantTheirProvince) score += 40;
  const shared = (e.subjects || []).filter(s => (mine.subjects || []).includes(s)).length;
  score += shared * 10;
  if (e.phase && e.phase === mine.phase) score += 10;
  return Math.min(score, 100);
}

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [educators, setEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>({ province: '', subject: '', phase: '', activeOnly: false });
  const [mySubjects, setMySubjects] = useState<string[]>([]);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

  /* ── Fetch current user's educator profile ─────────────────── */
  useEffect(() => {
    if (!user) return;
    supabase
      .from('educators')
      .select('subjects, current_province, preferred_provinces, phase')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data }) => {
        const p = data?.[0] ?? null;
        setMySubjects(p?.subjects || []);
        setMyProfile(p);
      });
  }, [user]);

  /* ── Fetch educators ────────────────────────────────────────── */
  const fetchEducators = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('educators').select('*');

    // Always exclude the current user's own card
    if (user?.id) q = q.neq('user_id', user.id);

    if (filters.province)    q = q.eq('current_province', filters.province);
    if (filters.phase)       q = q.eq('phase', filters.phase);
    if (filters.activeOnly)  q = q.eq('is_actively_looking', true);
    if (filters.subject)     q = q.contains('subjects', [filters.subject]);

    const { data } = await q.limit(50);
    let results: Educator[] = data || [];

    /* Overlay verified status from profiles table */
    if (results.length > 0) {
      const userIds = results.map(e => e.user_id).filter(Boolean) as string[];
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, is_verified')
        .in('id', userIds);
      const verifiedIds = new Set(
        (profileData ?? [])
          .filter((p: { is_verified?: boolean }) => p.is_verified)
          .map((p: { id: string }) => p.id)
      );
      results = results.map(e => ({
        ...e,
        is_sace_verified: verifiedIds.has(e.user_id ?? ''),
      }));
    }

    /* Text search filter */
    if (query.trim()) {
      const lower = query.toLowerCase();
      results = results.filter(e =>
        e.full_name?.toLowerCase().includes(lower) ||
        e.current_province?.toLowerCase().includes(lower) ||
        e.subjects?.some(s => s.toLowerCase().includes(lower))
      );
    }

    /* Exclude 85–100 % matches — those belong on the Matches page only.
       If the user has no profile yet we can't compute scores, so show everyone. */
    if (myProfile) {
      results = results.filter(e => computeMatchScore(e, myProfile) < 85);
    } else if (user?.id) {
      // Still exclude own card client-side as a safety net
      results = results.filter(e => e.user_id !== user.id);
    }

    setEducators(results);
    setLoading(false);
  }, [filters, query, user, myProfile]);

  useEffect(() => { fetchEducators(); }, [fetchEducators]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEducators();
    setRefreshing(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <button onClick={handleRefresh} className="p-1 rounded-full hover:bg-muted transition-colors">
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <h1 className="text-lg font-bold text-foreground">Find Educators</h1>
        </div>
        <p className="text-sm text-muted-foreground pl-1">Search by name, province, or subject</p>
      </div>

      {/* Search bar + filters */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search educators..."
            className="pl-9 rounded-xl bg-muted/40 border-border"
          />
        </div>
        <SearchFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : educators.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground px-8">
          <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No educators found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground px-4 pb-2">
            {educators.length} educator{educators.length !== 1 ? 's' : ''} found
          </p>
          <div className="space-y-2 px-4 pb-6">
            {educators.map((ed, i) => (
              <EducatorCard key={ed.id} educator={ed} mySubjects={mySubjects} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
