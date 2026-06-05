import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Flame, MapPin, ArrowRight, Search, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { calculateMatch, MyProfile } from '@/components/search/EducatorCard';

interface Educator {
  id: string;
  full_name: string;
  current_province: string;
  preferred_provinces: string[];
  phase: string;
  subjects: string[];
  is_actively_looking: boolean;
  avatar_url?: string;
  user_id?: string;
  town?: string;
}

interface Stats {
  educators: number;
  active: number;
  provinces: number;
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ educators: 0, active: 0, provinces: 0 });
  const [activeEducators, setActiveEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

  /* ── Subscription check + own profile ────────────────────────── */
  useEffect(() => {
    if (!user) return;

    const metaPlan = user.user_metadata?.subscription_plan as string | undefined;
    const metaEnd  = user.user_metadata?.subscription_end  as string | undefined;
    if (metaPlan && metaPlan !== 'free' && metaEnd && new Date(metaEnd) > new Date()) {
      setIsPro(true);
    } else {
      supabase
        .from('profiles')
        .select('subscription_plan, subscription_end')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setIsPro(
            !!data?.subscription_plan &&
            data.subscription_plan !== 'free' &&
            !!data.subscription_end &&
            new Date(data.subscription_end) > new Date()
          );
        });
    }

    supabase
      .from('educators')
      .select('phase, current_province, town, subjects')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data }) => setMyProfile(data?.[0] ?? null));
  }, [user]);

  /* ── Data fetch ──────────────────────────────────────────────── */
  useEffect(() => {
    const fetchData = async () => {
      const educatorOnly = 'profile_type.eq.educator,profile_type.is.null';

      const [{ count: total }, { count: active }, { data: educators }] = await Promise.all([
        supabase
          .from('educators')
          .select('*', { count: 'exact', head: true })
          .or(educatorOnly),
        supabase
          .from('educators')
          .select('*', { count: 'exact', head: true })
          .eq('is_actively_looking', true)
          .or(educatorOnly),
        supabase
          .from('educators')
          .select('*')
          .eq('is_actively_looking', true)
          .or(educatorOnly)
          .limit(50),
      ]);

      const provinceSet = new Set<string>();
      educators?.forEach(e => e.current_province && provinceSet.add(e.current_province));

      setStats({ educators: total || 0, active: active || 0, provinces: provinceSet.size });
      setActiveEducators(educators || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  /* ── Computed list: exclude own card + gate 85–100% for free users ── */
  const visibleEducators = activeEducators
    .filter(e => e.user_id !== user?.id)
    .filter(e => {
      if (isPro || !myProfile) return true;
      return calculateMatch(myProfile, {
        phase: e.phase,
        current_province: e.current_province,
        town: e.town,
        subjects: e.subjects,
      }) < 85;
    })
    .slice(0, 10);

  return (
    <div className="px-4 max-w-2xl mx-auto">
      <p className="text-sm text-muted-foreground pt-6 pb-5">Find your exchange partner</p>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users,  value: stats.educators, label: 'Educators', color: 'text-primary',   bg: 'bg-primary/10' },
          { icon: Flame,  value: stats.active,    label: 'Active',    color: 'text-amber-500', bg: 'bg-amber-50'   },
          { icon: MapPin, value: stats.provinces, label: 'Provinces', color: 'text-slate-500', bg: 'bg-slate-100'  },
        ].map(({ icon: Icon, value, label, color, bg }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-border p-4 flex flex-col items-center gap-2"
          >
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} strokeWidth={1.75} />
            </div>
            <span className="text-2xl font-bold text-foreground leading-none">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </motion.div>
        ))}
      </div>

      {/* Actively Looking section */}
      <div className="mt-7 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-foreground text-base">Actively Looking</span>
          </div>
          <Link to="/search" className="text-xs text-primary flex items-center gap-1 font-medium">
            See all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : visibleEducators.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Flame className="w-10 h-10 mx-auto mb-3 opacity-20" strokeWidth={1.5} />
            <p className="text-sm font-medium">No educators are actively looking yet.</p>
            <p className="text-xs mt-1">Be the first to set your status!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleEducators.map((ed, i) => (
              <motion.div
                key={ed.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to={`/educator/${ed.id}`}
                  className="flex items-center gap-3 bg-card rounded-2xl border border-border px-4 py-3 hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {ed.avatar_url
                      ? <img src={ed.avatar_url} alt={ed.full_name} className="w-full h-full object-cover" />
                      : <span className="text-sm font-bold text-primary">{ed.full_name[0]?.toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{ed.full_name}</p>

                    {/* Current province — gated for free users */}
                    {isPro ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {ed.current_province} → {ed.preferred_provinces?.join(', ') || 'Any'}
                      </p>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="w-3 h-3 shrink-0" />
                        <span className="italic truncate">Province hidden</span>
                        <span className="shrink-0">→ {ed.preferred_provinces?.join(', ') || 'Any'}</span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground truncate">
                      {ed.phase} · {ed.subjects?.slice(0, 2).join(', ')}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* CTA Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-2 mb-6 bg-primary rounded-2xl p-5 text-white"
      >
        <h3 className="font-bold text-base mb-1">Ready to find your match?</h3>
        <p className="text-sm text-white/80 mb-4">
          Search educators by province, subject, and phase to find your perfect exchange partner.
        </p>
        <Link to="/search">
          <Button variant="outline" className="bg-white text-primary hover:bg-white/90 border-0 font-semibold rounded-xl h-9 text-sm gap-2">
            <Search className="w-4 h-4" /> Start Searching
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
