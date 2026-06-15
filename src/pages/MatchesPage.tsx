import { useEffect, useState, useCallback } from 'react';
import { Users, MapPin, BookOpen, ShieldCheck, Lock, Zap, ArrowLeft, ArrowLeftRight, Search as SearchIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import SubscriptionModal from '@/components/SubscriptionModal';
import SearchFilters, { Filters, DEFAULT_FILTERS } from '@/components/search/SearchFilters';
import { calculateMatch, qualifiesForMatchesPage, isTownSwapMatch } from '@/components/search/EducatorCard';

interface Educator {
  id: string;
  full_name: string;
  avatar_url?: string;
  current_province?: string;
  preferred_provinces?: string[];
  preferred_districts?: string[];
  subjects?: string[];
  phase?: string;
  town?: string;
  is_actively_looking?: boolean;
  is_sace_verified?: boolean;
  user_id?: string;
  profile_type?: string;
  score?: number;
  isDistrictSwap?: boolean;
  distance_km?: number;
}

interface Props {
  embedded?: boolean;
}

export default function MatchesPage({ embedded = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myProfile, setMyProfile] = useState<Educator | null>(null);
  const [matches, setMatches] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [proChecked, setProChecked] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  // Pro-only: search bar + advanced filters (town/radius/province/subject/phase/active)
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  /* ── Subscription check (dual source) + own profile ──────────────────── */
  useEffect(() => {
    if (!user) return;

    (async () => {
      const metaPlan = user.user_metadata?.subscription_plan as string | undefined;
      const metaEnd  = user.user_metadata?.subscription_end  as string | undefined;
      const isProMeta = metaPlan && metaPlan !== 'free' && metaEnd && new Date(metaEnd) > new Date();

      if (isProMeta) {
        setIsPro(true);
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_plan, subscription_end')
          .eq('id', user.id)
          .single();
        const proFromDb =
          profile?.subscription_plan &&
          profile.subscription_plan !== 'free' &&
          profile.subscription_end &&
          new Date(profile.subscription_end) > new Date();
        setIsPro(!!proFromDb);
      }
      setProChecked(true);

      const { data: mine } = await supabase
        .from('educators')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setMyProfile(mine ?? null);
      if (!mine) setLoading(false);
    })();
  }, [user]);

  /* ── Fetch & score matches ─────────────────────────────────────────────
     Free: ≥85% / town-swap only (existing "top matches" behaviour).
     Pro:  ALL educators of all match percentages, with the same
           town/radius/province/subject/phase/active filters as Search. */
  const fetchMatches = useCallback(async () => {
    if (!user || !myProfile || !proChecked) return;
    setLoading(true);

    let results: Educator[] = [];

    if (isPro) {
      const useRadius = filters.radiusKm > 0 && filters.townLat != null && filters.townLng != null;

      if (useRadius) {
        const { data, error } = await supabase.rpc('nearby_educators', {
          search_lat: filters.townLat,
          search_lng: filters.townLng,
          radius_km:  filters.radiusKm,
          exclude_user_id: user.id,
        });

        if (error) console.error('[MatchesPage] nearby_educators error:', error);

        results = (data || []).map((r: any) => ({ ...r.educator, distance_km: r.distance_km }));
        results = results.filter(e => e.profile_type === 'educator' || e.profile_type == null);

        if (filters.phase)      results = results.filter(e => e.phase === filters.phase);
        if (filters.activeOnly) results = results.filter(e => e.is_actively_looking);
        if (filters.subject)    results = results.filter(e => e.subjects?.includes(filters.subject));

      } else {
        let q = supabase.from('educators').select('*')
          .neq('user_id', user.id)
          .or('profile_type.eq.educator,profile_type.is.null');

        if (filters.province) q = q.eq('current_province', filters.province);
        if (filters.phase)      q = q.eq('phase', filters.phase);
        if (filters.activeOnly) q = q.eq('is_actively_looking', true);
        if (filters.subject)    q = q.contains('subjects', [filters.subject]);

        const { data } = await q.limit(50);
        results = data || [];

        if (filters.town.trim()) {
          const lowerTown = filters.town.trim().toLowerCase();
          results = results.filter(e => e.town?.toLowerCase().includes(lowerTown));
        }
      }

      if (query.trim()) {
        const lower = query.toLowerCase();
        results = results.filter(e =>
          e.full_name?.toLowerCase().includes(lower) ||
          e.current_province?.toLowerCase().includes(lower) ||
          e.subjects?.some(s => s.toLowerCase().includes(lower))
        );
      }

    } else {
      const { data: all } = await supabase
        .from('educators')
        .select('*')
        .neq('user_id', user.id)
        .or('profile_type.eq.educator,profile_type.is.null');

      results = all || [];
    }

    const scored = results.map(e => {
      const score = calculateMatch(
        { phase: myProfile.phase, current_province: myProfile.current_province, town: myProfile.town, subjects: myProfile.subjects },
        { phase: e.phase,         current_province: e.current_province,         town: e.town,         subjects: e.subjects }
      );
      return { ...e, score, isDistrictSwap: isTownSwapMatch(myProfile, e) };
    });

    const final = isPro
      // Pro: everyone, sorted by match strength.
      ? scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      // Free: 85–100% with the weighted formula, OR a direct town-swap
      // opportunity (shared subject + reciprocal town preference)
      // regardless of overall score.
      : scored.filter(e => qualifiesForMatchesPage(myProfile, e, e.score ?? 0))
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    setMatches(final);
    setLoading(false);
  }, [user, myProfile, isPro, proChecked, filters, query]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={!embedded ? "px-4 py-6 space-y-4 max-w-lg mx-auto" : "space-y-4"}>
      {/* Header – only shown when not embedded */}
      {!embedded && (
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{isPro ? 'Educators' : 'Transfer Matches'}</h1>
            <p className="text-sm text-muted-foreground">
              {isPro ? 'All educators, sorted by match — use filters to narrow your search.' : 'Educators who match your transfer preferences'}
            </p>
          </div>
        </div>
      )}

      {/* Pro: search bar + advanced filters (town/radius/province/subject/phase/active) */}
      {isPro && (
        <div className="flex items-center gap-2 sticky top-0 z-10 bg-background pt-1 pb-1">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search educators..."
              className="pl-9 rounded-xl bg-muted/40 border-border"
            />
          </div>
          <SearchFilters
            filters={filters}
            onFiltersChange={setFilters}
            isPro={isPro}
            onProGate={() => setShowSubModal(true)}
          />
        </div>
      )}

      {/* ── Free users: full lock screen, no cards shown ─────────── */}
      {!isPro ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Unlock Your Matches</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Upgrade to Pro to see your strongest transfer matches, view their full profiles, and connect directly — giving you the best chance of finding the right exchange partner, faster.
          </p>
          <Button
            onClick={() => setShowSubModal(true)}
            className="gap-2 rounded-2xl px-8 h-11 font-semibold"
          >
            <Zap className="w-4 h-4" />
            Upgrade to Pro
          </Button>
        </div>
      ) : !myProfile ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Complete your profile to see matches</p>
          <Link to="/onboarding" className="text-primary text-sm hover:underline mt-2 block">Set up profile →</Link>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          {isPro ? (
            <>
              <p className="font-medium">No educators found</p>
              <p className="text-sm mt-1 max-w-xs mx-auto">Try adjusting your search or filters.</p>
            </>
          ) : (
            <>
              <p className="font-medium">No high matches yet</p>
              <p className="text-sm mt-1 max-w-xs mx-auto">
                Your closest transfer matches will appear here as more educators join.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {isPro && (
            <p className="text-xs text-muted-foreground px-1">
              {matches.length} educator{matches.length !== 1 ? 's' : ''} found
            </p>
          )}
          {matches.map((ed, i) => (
            <MatchCard key={ed.id} ed={ed} myProfile={myProfile} index={i} />
          ))}
        </div>
      )}

      <SubscriptionModal open={showSubModal} onClose={() => setShowSubModal(false)} />
    </div>
  );
}

/* ── Match card ─────────────────────────────────────────────────── */
function MatchCard({
  ed,
  myProfile,
  index,
}: {
  ed: Educator;
  myProfile: Educator;
  index: number;
}) {
  const matchPct = Math.min(ed.score ?? 0, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to={`/educator/${ed.id}`}
        className="block bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {ed.avatar_url
              ? <img src={ed.avatar_url} alt={ed.full_name} className="w-full h-full object-cover rounded-full" />
              : <span className="text-sm font-bold text-primary">{ed.full_name[0]?.toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-semibold text-sm text-foreground truncate">{ed.full_name}</h3>
                {ed.is_sace_verified && (
                  <span title="Identity Verified" className="shrink-0 flex items-center gap-0.5 bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-primary/20">
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              {/* Match percentage badge */}
              <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                matchPct === 100
                  ? 'bg-primary text-white'
                  : matchPct >= 85
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {matchPct}%
              </span>
            </div>
            <div className="space-y-1 mt-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                {ed.current_province} → wants {myProfile.current_province}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="w-3 h-3 shrink-0" />
                {ed.phase} · {ed.subjects?.slice(0, 2).join(', ')}
              </div>
              {ed.distance_km != null && (
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {ed.distance_km < 1 ? '<1 km away' : `${Math.round(ed.distance_km)} km away`}
                </div>
              )}
            </div>
            {/* Town swap callout — explains why this match appears even
                if the % is below the usual 85% threshold */}
            {ed.isDistrictSwap && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary mt-1.5">
                <ArrowLeftRight className="w-3 h-3 shrink-0" />
                Direct district swap opportunity
              </div>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {(ed.subjects || [])
                .filter((s: string) => (myProfile.subjects || []).includes(s))
                .map(s => (
                  <Badge key={s} className="text-[10px] bg-primary/10 text-primary border-0">{s}</Badge>
                ))}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
