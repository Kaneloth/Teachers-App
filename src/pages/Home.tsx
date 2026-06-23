import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, FileText, Briefcase, BookOpen, LayoutGrid, GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
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

      const [{ count: cvCount }, { count: vacCount }] = await Promise.all([
        supabase
          .from('credit_ledger')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'cv_usage'),
        supabase
          .from('vacancies')
          .select('*', { count: 'exact', head: true }),
      ]);

      setStats({ cvs: cvCount || 0, vacancies: vacCount || 0 });
      setLoading(false);
    };
    fetchData();
  }, []);


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


    </div>
  );
}
