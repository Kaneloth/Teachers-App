// src/pages/Search.tsx
import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import EducatorCard, { qualifiesForMatchesPage, MyProfile } from '@/components/search/EducatorCard';
import SearchFilters, { Filters, DEFAULT_FILTERS } from '@/components/search/SearchFilters';
import SubscriptionModal from '@/components/SubscriptionModal'; // shows credits purchase

interface Educator {
  id: string;
  full_name: string;
  avatar_url?: string;
  is_actively_looking?: boolean;
  is_sace_verified?: boolean;
  current_province?: string;
  town?: string;
  preferred_provinces?: string[];
  preferred_districts?: string[];
  subjects?: string[];
  phase?: string;
  user_id?: string;
  profile_type?: string;
  distance_km?: number;
  is_hidden?: boolean;
}

interface Props {
  embedded?: boolean;
}

export default function Search({ embedded = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [educators, setEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [isPro, setIsPro] = useState(false);
  const { gates, loading: gatesLoading } = useFeatureGates();
  // Gate off = everyone gets access regardless of purchase
  const effectiveIsPro = !gatesLoading && (!gates.advanced_search || isPro);
  const [showSubModal, setShowSubModal] = useState(false);

  /* ── Fetch current user's profile + subscription status ─────── */
  useEffect(() => {
    if (!user) return;
    // Admins always get advanced search access
    if (user.user_metadata?.is_admin) { setIsPro(true); }
    else {
      // Advanced search unlocked by R79+ purchase OR if gate is disabled globally/per-user
      supabase
        .from('credit_ledger')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'purchase')
        .gte('amount', 60)
        .limit(1)
        .then(({ data }) => {
          setIsPro(!!(data && data.length > 0));
        });
    }

    // preferred_districts is needed for the town-swap exclusion check below.
    supabase
      .from('educators')
      .select('phase, current_province, town, subjects, preferred_districts')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data }) => {
        setMyProfile(data?.[0] ?? null);
      });
  }, [user]);

  /* ── Search bar query update ─────────────────────────────────── */
  const handleQueryChange = (value: string) => {
    setQuery(value);
  };

  /* ── Fetch educators ────────────────────────────────────────── */
  const fetchEducators = useCallback(async () => {
    setLoading(true);

    // Radius search is Pro-only and requires a geocoded town (set by
    // SearchFilters once the user types/blurs a valid place name).
    const useRadius = effectiveIsPro && filters.radiusKm > 0 && filters.townLat != null && filters.townLng != null;

    let results: Educator[] = [];

    if (useRadius) {
      const { data, error } = await supabase.rpc('nearby_educators', {
        search_lat: filters.townLat,
        search_lng: filters.townLng,
        radius_km:  filters.radiusKm,
        exclude_user_id: user?.id ?? null,
      });

      if (error) {
        console.error('[Search] nearby_educators error:', error);
      }

      results = (data || []).map((r: any) => ({ ...r.educator, distance_km: r.distance_km }));
      results = results.filter(e => e.profile_type === 'educator' || e.profile_type == null);
      results = results.filter(e => !e.is_admin);  // never show admin accounts in search

      // The RPC only does the geo-radius filter — apply the remaining
      // filters client-side. Province is deliberately NOT applied here:
      // SearchFilters disables/clears province whenever radius search is
      // active, since the two would otherwise silently contradict each
      // other (e.g. "within 45km of Polokwane" + "KZN").
      if (filters.phase)      results = results.filter(e => e.phase === filters.phase);
      if (filters.activeOnly) results = results.filter(e => e.is_actively_looking);
      if (filters.subject)    results = results.filter(e => e.subjects?.includes(filters.subject));

    } else {
      let q = supabase.from('educators').select('*');

      if (user?.id) q = q.neq('user_id', user.id);
      q = q.or('profile_type.eq.educator,profile_type.is.null');
      q = q.eq('is_admin', false);  // never show admin accounts in search

      if (filters.province) q = q.eq('current_province', filters.province);
      if (filters.phase)      q = q.eq('phase', filters.phase);
      if (filters.activeOnly) q = q.eq('is_actively_looking', true);
      if (filters.subject)    q = q.contains('subjects', [filters.subject]);

      const { data } = await q.limit(50);
      results = data || [];

      // Town free-text filter (all users, non-radius mode) — matches
      // educators whose current town contains this text.
      if (filters.town.trim()) {
        const lowerTown = filters.town.trim().toLowerCase();
        results = results.filter(e => e.town?.toLowerCase().includes(lowerTown));
      }
    }

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

    /* Text search filter (search bar) */
    if (query.trim()) {
      const lower = query.toLowerCase();
      results = results.filter(e =>
        e.full_name?.toLowerCase().includes(lower) ||
        e.current_province?.toLowerCase().includes(lower) ||
        e.subjects?.some(s => s.toLowerCase().includes(lower))
      );
    }

    /* Filter hidden profiles — only when no specific filters are active.
       If the user has applied province/subject/phase/town filters,
       hidden profiles are still shown (they opted in to filtered visibility). */
    const hasActiveFilters = !!(
      filters.province || filters.phase ||
      (filters.subjects && filters.subjects.length > 0) ||
      filters.town.trim() || filters.radiusKm > 0
    );
    if (!hasActiveFilters) {
      results = results.filter(e => !e.is_hidden);
    }

    /* Exclude anyone who already qualifies for the Matches page (≥85% match
       or a town-swap opportunity) — avoids the same person being listed on
       both Search and Matches. Applies to all users: for free users this
       also means their best matches are reserved for the Pro-gated Matches
       page, consistent with "Pro unlocks your highest-quality matches". */
    if (myProfile && !effectiveIsPro) {
      // For free users only: exclude high-match educators from Search so they
      // appear in the locked Matches tab instead (creating an incentive to upgrade).
      // R79+ users see ALL educators in one unified search — no exclusions.
      results = results.filter(e => !qualifiesForMatchesPage(myProfile, {
        phase: e.phase,
        current_province: e.current_province,
        town: e.town,
        subjects: e.subjects,
        preferred_districts: e.preferred_districts,
      }, undefined, false));
    }

    setEducators(results);
    setLoading(false);
  }, [filters, query, user, myProfile, isPro]);

  useEffect(() => { fetchEducators(); }, [fetchEducators]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEducators();
    setRefreshing(false);
  };

  return (
    <div className={!embedded ? "max-w-2xl mx-auto" : ""}>
      {/* Header – only shown when not embedded */}
      {!embedded && (
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
          <p className="text-sm text-muted-foreground pl-1">
            {effectiveIsPro
              ? 'All educators shown with match scores — use filters to refine your search.'
              : <>Search educators · <span className="text-primary font-medium">R79+ pack</span> unlocks match scores &amp; advanced filters.</>}
          </p>
        </div>
      )}

      {/* Search bar + filters */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search educators..."
            className="pl-9 rounded-xl bg-muted/40 border-border"
          />
        </div>
        <SearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          isPro={effectiveIsPro}
          onProGate={() => setShowSubModal(true)} // buy R79+ pack to unlock
        />
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
              <EducatorCard
                key={ed.id}
                educator={ed}
                myProfile={myProfile ?? undefined}
                isPro={effectiveIsPro}
                index={i}
                distanceKm={ed.distance_km}
              />
            ))}
          </div>
        </>
      )}

      <SubscriptionModal open={showSubModal} onClose={() => setShowSubModal(false)} />
    </div>
  );
}
