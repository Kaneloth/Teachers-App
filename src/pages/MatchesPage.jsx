import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, MapPin, BookOpen, Flame, Star, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';

function getComplementaryScore(me, other) {
  let score = 0;

  // Core requirement: other wants to come where I am, and I want to go where they are
  const theyWantMyProvince = other.preferred_provinces?.includes(me.current_province);
  const iWantTheirProvince = me.preferred_provinces?.includes(other.current_province);

  if (theyWantMyProvince) score += 50;
  if (iWantTheirProvince) score += 50;

  // Bonus: shared subjects (same subjects = easier replacement)
  const mySubjects = new Set((me.subjects || []).map(s => s.toLowerCase()));
  const theirSubjects = (other.subjects || []).map(s => s.toLowerCase());
  const sharedSubjects = theirSubjects.filter(s => mySubjects.has(s));
  score += Math.min(sharedSubjects.length * 10, 30);

  // Bonus: same phase
  if (me.phase && other.phase === me.phase) score += 20;

  return Math.min(score, 100);
}

export default function MatchesPage() {
  const navigate = useNavigate();
  const { data: myProfile, isLoading: loadingMe } = useQuery({
    queryKey: ['my-educator-profile'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const results = await base44.entities.Educator.filter({ created_by_id: user.id });
      return results[0] || null;
    },
  });

  const { data: allEducators = [], isLoading: loadingAll } = useQuery({
    queryKey: ['all-educators-matches'],
    queryFn: () => base44.entities.Educator.filter({ is_actively_looking: true }),
    enabled: !!myProfile,
  });

  const matches = useMemo(() => {
    if (!myProfile || !allEducators.length) return [];
    return allEducators
      .filter(e => e.id !== myProfile.id && e.created_by_id !== myProfile.created_by_id)
      .map(e => ({ ...e, score: getComplementaryScore(myProfile, e) }))
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [myProfile, allEducators]);

  const isLoading = loadingMe || loadingAll;

  if (isLoading) {
    return (
      <div className="px-4 pt-6 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card rounded-2xl border border-border p-4 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (!myProfile) {
    return (
      <div className="px-4 pt-16 text-center">
        <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="font-semibold text-foreground mb-1">No profile found</p>
        <p className="text-sm text-muted-foreground">Complete your profile to see matches.</p>
        <Link to="/profile" className="text-sm text-primary font-medium mt-3 inline-block">Set up profile →</Link>
      </div>
    );
  }

  if (!myProfile.is_actively_looking) {
    return (
      <div className="px-4 pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Your Matches</h1>
          <p className="text-sm text-muted-foreground mt-1">Educators with complementary transfer interests</p>
        </div>
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-5 text-center">
          <Flame className="w-10 h-10 mx-auto mb-3 text-accent" />
          <p className="font-semibold text-foreground mb-1">You're not actively looking</p>
          <p className="text-sm text-muted-foreground mb-3">Enable "Actively Looking" in your profile to appear in matches and see yours.</p>
          <Link to="/profile" className="text-sm text-primary font-semibold">Update Profile →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Your Matches</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Educators who want to come to <span className="font-medium text-foreground">{myProfile.current_province}</span> and are from your preferred provinces
        </p>
      </div>

      {/* My Transfer Summary */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <ArrowLeftRight className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Your transfer</p>
          <p className="text-xs text-muted-foreground truncate">
            {myProfile.current_province} → {myProfile.preferred_provinces?.join(', ') || 'Any province'}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs">{matches.length} matches</Badge>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-foreground mb-1">No matches yet</p>
          <p className="text-sm">No educators currently match your transfer preferences.</p>
          <p className="text-xs mt-1 text-muted-foreground">Check back as more educators join.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((educator, i) => (
            <MatchCard key={educator.id} educator={educator} myProfile={myProfile} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({ educator, myProfile, index }) {
  const mySubjects = new Set((myProfile.subjects || []).map(s => s.toLowerCase()));
  const sharedSubjects = (educator.subjects || []).filter(s => mySubjects.has(s.toLowerCase()));

  const theyWantMyProvince = educator.preferred_provinces?.includes(myProfile.current_province);
  const iWantTheirProvince = myProfile.preferred_provinces?.includes(educator.current_province);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link
        to={`/educator/${educator.id}`}
        className="block bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-all group"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {educator.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-sm text-foreground truncate">{educator.full_name}</p>
              {educator.is_sace_verified && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0 shrink-0">SACE ✓</Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{educator.current_province} → {educator.preferred_provinces?.join(', ') || 'Any'}</span>
            </div>

            {sharedSubjects.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <BookOpen className="w-3 h-3 shrink-0" />
                <span className="truncate">Shared: {sharedSubjects.join(', ')}</span>
              </div>
            )}

            <div className="flex gap-1.5 flex-wrap">
              {theyWantMyProvince && (
                <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                  Wants {myProfile.current_province}
                </span>
              )}
              {iWantTheirProvince && (
                <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">
                  From your target
                </span>
              )}
              {educator.phase === myProfile.phase && (
                <span className="text-[10px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-medium">
                  Same phase
                </span>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                <circle
                  cx="24" cy="24" r="20" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeDasharray={`${(educator.score / 100) * 125.6} 125.6`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
                {educator.score}%
              </span>
            </div>
            <Star className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}