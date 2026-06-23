import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, MapPin, ArrowRight, Search, FileText, Briefcase, BookOpen, LayoutGrid, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { calculateMatch, MyProfile } from '@/components/search/EducatorCard';
import GeneralHomePage from '@/pages/GeneralHomePage';

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
  cvs: number;
  vacancies: number;
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ cvs: 0, vacancies: 0 });
  const [activeEducators, setActiveEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [profileType, setProfileType] = useState<'educator' | 'general' | null>(null);

  /* ── Subscription check + own profile + user type ────────────── */
  useEffect(() => {
    if (!user) {
      setProfileType('educator'); // unauthenticated → show educator dashboard
      return;
    }

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
      .select('phase, current_province, town, subjects, profile_type')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0] ?? null;
        setMyProfile(row);
        setProfileType((row?.profile_type as 'educator' | 'general') ?? 'educator');
      });
  }, [user]);

  /* ── Data fetch ──────────────────────────────────────────────── */
  useEffect(() => {
    const fetchData = async () => {
      const educatorOnly = 'profile_type.eq.educator,profile_type.is.null';

      const [{ count: cvCount }, { count: vacCount }, { data: educators }] = await Promise.all([
        supabase
          .from('credit_ledger')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'cv_usage'),
        supabase
          .from('vacancies')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('educators')
          .select('*')
          .eq('is_actively_looking', true)
          .eq('is_hidden', false)
          .or(educatorOnly)
          .limit(50),
      ]);

      setStats({ cvs: cvCount || 0, vacancies: vacCount || 0 });
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

  /* ── Route to correct dashboard ─────────────────────────────── */
  if (profileType === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (profileType === 'general') return <GeneralHomePage />;

  return (
    <div className="px-4 max-w-2xl mx-auto">
      <p className="text-sm text-muted-foreground pt-6 pb-5">Find your exchange partner</p>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { icon: FileText,    value: stats.cvs > 0 ? `${stats.cvs}+` : '—',       label: 'CVs Created',      color: 'text-primary',    bg: 'bg-primary/10'   },
          { icon: Briefcase,   value: stats.vacancies > 0 ? `${stats.vacancies}+` : '—', label: 'Vacancies',  color: 'text-blue-500',   bg: 'bg-blue-50'      },
          { icon: MapPin,      value: '9',                                           label: 'Provinces',        color: 'text-slate-500',  bg: 'bg-slate-100'    },
          { icon: GraduationCap, value: '51',                                        label: 'CAPS Subjects',    color: 'text-emerald-600',bg: 'bg-emerald-50'   },
          { icon: LayoutGrid,  value: '10',                                          label: 'CV Templates',     color: 'text-violet-500', bg: 'bg-violet-50'    },
          { icon: BookOpen,    value: '4',                                           label: 'Tools in One App', color: 'text-amber-500',  bg: 'bg-amber-50'     },
        ] as { icon: React.ElementType; value: string; label: string; color: string; bg: string }[]).map(({ icon: Icon, value, label, color, bg }) => (
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
            <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
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
                  className="flex items-center gap-3 bg-card rounded-2xl border border-border px-4 py-3 hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {ed.avatar_url
                      ? <img src={ed.avatar_url} alt={ed.full_name} className="w-full h-full object-cover" />
                      : <span className="text-sm font-bold text-primary">{ed.full_name[0]?.toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{ed.full_name}</p>

                    {/* Current province — Pro only; free users see nothing */}
                    {isPro && (
                      <p className="text-xs text-muted-foreground truncate">
                        <MapPin className="w-3 h-3 inline mr-0.5" />
                        {ed.current_province} → {ed.preferred_provinces?.join(', ') || 'Any'}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground truncate">
                      {ed.phase} · {ed.subjects?.slice(0, 2).join(', ')}
                    </p>
                  </div>

                  {/* Match % ring — visible to all users */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    {(() => {
                      const match = myProfile ? calculateMatch(myProfile, { phase: ed.phase, current_province: ed.current_province, town: ed.town, subjects: ed.subjects }) : 0;
                      return (
                        <div className="relative w-9 h-9">
                          <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
                            <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5"
                              strokeDasharray={`${(match / 100) * 94.2} 94.2`} strokeLinecap="round" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary leading-none">{match}%</span>
                        </div>
                      );
                    })()}
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
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
