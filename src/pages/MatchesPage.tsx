import { useEffect, useState } from 'react';
import { Users, MapPin, BookOpen, ShieldCheck, Lock, Zap, ArrowLeft, ArrowLeftRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import SubscriptionModal from '@/components/SubscriptionModal';
import { calculateMatch } from '@/components/search/EducatorCard';

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
  score?: number;
  isDistrictSwap?: boolean;
}

interface Props {
  embedded?: boolean;
}

/**
 * "District swap" exception — included on the Matches page even if the
 * weighted match score is below the normal 85% threshold, because it
 * represents a direct transfer-exchange opportunity:
 *   - Both educators share at least one subject, AND
 *   - My current district is one of THEIR preferred districts, OR
 *   - Their current district is one of MY preferred districts
 * (i.e. each could plausibly move to where the other currently is).
 */
function isDistrictSwapMatch(mine: Educator, them: Educator): boolean {
  const mySubjects   = new Set((mine.subjects || []).map(s => s.toLowerCase()));
  const theirSubjects = new Set((them.subjects || []).map(s => s.toLowerCase()));
  const sharesSubject = [...mySubjects].some(s => theirSubjects.has(s));
  if (!sharesSubject) return false;

  const iWantTheirDistrict = !!(them.town && (mine.preferred_districts || []).includes(them.town));
  const theyWantMyDistrict = !!(mine.town && (them.preferred_districts || []).includes(mine.town));

  return iWantTheirDistrict || theyWantMyDistrict;
}

export default function MatchesPage({ embedded = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myProfile, setMyProfile] = useState<Educator | null>(null);
  const [matches, setMatches] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      /* ── Subscription check (dual source) ─────────────────────── */
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

      /* ── Fetch & score matches ─────────────────────────────────── */
      const { data: mine } = await supabase
        .from('educators')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mine) { setLoading(false); return; }
      setMyProfile(mine);

      const { data: all } = await supabase
        .from('educators')
        .select('*')
        .neq('user_id', user.id)
        .or('profile_type.eq.educator,profile_type.is.null');

      if (!all) { setLoading(false); return; }

      const scored = all
        .map(e => {
          const score = calculateMatch(
            { phase: mine.phase, current_province: mine.current_province, town: mine.town, subjects: mine.subjects },
            { phase: e.phase,    current_province: e.current_province,    town: e.town,    subjects: e.subjects }
          );
          return {
            ...e,
            score,
            isDistrictSwap: isDistrictSwapMatch(mine, e),
          };
        })
        // Matches page: 85–100% with the weighted formula, OR a direct
        // district-swap opportunity (shared subject + reciprocal district
        // preference) regardless of overall score.
        .filter(e => e.score >= 85 || e.isDistrictSwap)
        .sort((a, b) => b.score - a.score);

      setMatches(scored);
      setLoading(false);
    };

    fetchData();
  }, [user]);

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
            <h1 className="text-xl font-bold text-foreground">Transfer Matches</h1>
            <p className="text-sm text-muted-foreground">Educators who match your transfer preferences</p>
          </div>
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
          <p className="font-medium">No high matches yet</p>
          <p className="text-sm mt-1 max-w-xs mx-auto">
            Your closest transfer matches will appear here as more educators join. In the meantime, browse the Search page to find educators near you.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
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
            </div>
            {/* District swap callout — explains why this match appears even
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
