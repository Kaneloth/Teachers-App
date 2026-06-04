import { useEffect, useState } from 'react';
import { Users, MapPin, BookOpen, ShieldCheck, Lock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import SubscriptionModal from '@/components/SubscriptionModal';

const FREE_PREVIEW_COUNT = 2;

interface Educator {
  id: string;
  full_name: string;
  avatar_url?: string;
  current_province?: string;
  preferred_provinces?: string[];
  subjects?: string[];
  phase?: string;
  is_actively_looking?: boolean;
  is_sace_verified?: boolean;
  user_id?: string;
  score?: number;
}

export default function MatchesPage() {
  const { user } = useAuth();
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
        .neq('user_id', user.id);

      if (!all) { setLoading(false); return; }

      const scored = all
        .filter(e => e.is_actively_looking)
        .map(e => {
          let score = 0;
          const wantsMyProvince   = e.preferred_provinces?.includes(mine.current_province);
          const iWantTheirProvince = mine.preferred_provinces?.includes(e.current_province);
          if (wantsMyProvince)    score += 40;
          if (iWantTheirProvince) score += 40;
          const sharedSubjects = (e.subjects || []).filter((s: string) => (mine.subjects || []).includes(s)).length;
          score += sharedSubjects * 10;
          if (e.phase === mine.phase) score += 10;
          return { ...e, score };
        })
        .filter(e => e.score! > 0)
        .sort((a, b) => b.score! - a.score!)
        .slice(0, 20);

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

  const visibleMatches  = isPro ? matches : matches.slice(0, FREE_PREVIEW_COUNT);
  const lockedMatches   = isPro ? []       : matches.slice(FREE_PREVIEW_COUNT);
  const hasLocked       = lockedMatches.length > 0;

  return (
    <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Transfer Matches</h1>
        <p className="text-sm text-muted-foreground">Educators who match your transfer preferences</p>
      </div>

      {!myProfile ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Complete your profile to see matches</p>
          <Link to="/onboarding" className="text-primary text-sm hover:underline mt-2 block">Set up profile →</Link>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No matches yet</p>
          <p className="text-sm mt-1">Check back as more educators join Crosssa</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* ── Visible matches ──────────────────────────────────── */}
          {visibleMatches.map((ed, i) => (
            <MatchCard key={ed.id} ed={ed} myProfile={myProfile} index={i} />
          ))}

          {/* ── Locked matches (blurred) + upgrade wall ──────────── */}
          {hasLocked && (
            <div className="relative">
              {/* Blurred preview cards */}
              <div className="space-y-3 pointer-events-none select-none">
                {lockedMatches.slice(0, 3).map((ed, i) => (
                  <div key={ed.id} className="blur-sm opacity-60">
                    <MatchCard ed={ed} myProfile={myProfile} index={visibleMatches.length + i} />
                  </div>
                ))}
              </div>

              {/* Upgrade overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-background via-background/90 to-transparent rounded-2xl px-6 py-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <p className="text-base font-bold text-foreground text-center">
                  {lockedMatches.length} more match{lockedMatches.length !== 1 ? 'es' : ''} hidden
                </p>
                <p className="text-sm text-muted-foreground text-center mt-1 mb-4">
                  Upgrade to Pro to see all your transfer matches and connect with the right educators.
                </p>
                <Button
                  onClick={() => setShowSubModal(true)}
                  className="gap-2 rounded-2xl px-6 h-11 font-semibold"
                >
                  <Zap className="w-4 h-4" />
                  Unlock All Matches
                </Button>
              </div>
            </div>
          )}

          {/* Free user footer hint (when all matches fit in preview) */}
          {!isPro && !hasLocked && matches.length > 0 && (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">
                Upgrade to Pro for unlimited matches and direct messaging.
              </p>
              <button
                onClick={() => setShowSubModal(true)}
                className="text-xs font-semibold text-primary shrink-0"
              >
                Upgrade
              </button>
            </div>
          )}
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
