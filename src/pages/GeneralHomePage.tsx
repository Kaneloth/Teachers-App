import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, FileText, User, Bell, Briefcase,
  MapPin, Clock, ChevronRight, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface RecentJob {
  id: string;
  title: string;
  institution?: string;
  province?: string;
  job_category?: string;
  created_at: string;
}

const QUICK_ACTIONS = [
  { icon: Search,   label: 'Find Jobs',  href: '/vacancies',  bg: 'bg-blue-50',   text: 'text-blue-600'   },
  { icon: FileText, label: 'CV Builder', href: '/cv-builder', bg: 'bg-teal-50',   text: 'text-teal-600'   },
  { icon: User,     label: 'My Profile', href: '/profile',    bg: 'bg-slate-50',  text: 'text-slate-600'  },
  { icon: Bell,     label: 'Job Alerts', href: null,          bg: 'bg-amber-50',  text: 'text-amber-600'  },
] as const;

export default function GeneralHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [cvCount,     setCvCount]     = useState(0);
  const [isPro,       setIsPro]       = useState(false);
  const [recentJobs,  setRecentJobs]  = useState<RecentJob[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!user) return;

    setCvCount((user.user_metadata?.cv_count as number) ?? 0);

    const plan = user.user_metadata?.subscription_plan as string | undefined;
    const end  = user.user_metadata?.subscription_end  as string | undefined;
    if (plan && plan !== 'free' && end && new Date(end) > new Date()) setIsPro(true);

    supabase
      .from('educators')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.full_name ?? user.email?.split('@')[0] ?? '');
      });

    supabase
      .from('vacancies')
      .select('id, title, institution, province, job_category, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setRecentJobs(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const handleJobAlerts = () => {
    toast.info('Job Alerts coming soon — browse and save job searches in the meantime.');
    navigate('/vacancies');
  };

  const firstName = displayName.split(' ')[0];

  return (
    <div className="px-4 max-w-2xl mx-auto pb-6">

      {/* ── Welcome Banner ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 mb-5 bg-primary rounded-2xl p-5 text-white"
      >
        <p className="text-[10px] font-semibold text-white/55 uppercase tracking-widest mb-1">Welcome back</p>
        <h1 className="text-xl font-bold mb-1">
          {firstName ? `Hi, ${firstName}!` : 'Welcome!'}
        </h1>
        <p className="text-sm text-white/80">Discover your next career opportunity.</p>
      </motion.div>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Quick Actions</p>
      <div className="grid grid-cols-2 gap-3 mb-7">
        {QUICK_ACTIONS.map(({ icon: Icon, label, href, bg, text }, i) => {
          const inner = (
            <>
              <div className="w-11 h-11 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
                <Icon className={`w-5 h-5 ${text}`} strokeWidth={1.75} />
              </div>
              <span className={`text-sm font-semibold ${text}`}>{label}</span>
            </>
          );
          const cls = `flex flex-col items-center gap-2.5 ${bg} rounded-2xl border border-border p-5 hover:shadow-sm transition-all w-full`;

          return (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }}
            >
              {href
                ? <Link to={href} className={cls}>{inner}</Link>
                : <button onClick={handleJobAlerts} className={cls}>{inner}</button>
              }
            </motion.div>
          );
        })}
      </div>

      {/* ── Latest Jobs ───────────────────────────────────────── */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Latest Jobs</p>
          <Link to="/vacancies" className="text-xs text-primary font-medium flex items-center gap-0.5">
            See all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No jobs listed yet.</div>
        ) : (
          <div className="space-y-2">
            {recentJobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to="/vacancies"
                  className="flex items-center gap-3 bg-card rounded-2xl border border-border px-4 py-3 hover:shadow-sm transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{job.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {job.province && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />{job.province}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── CV Status ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="bg-card rounded-2xl border border-border p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="w-4 h-4 text-teal-600" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-foreground">
              {cvCount === 0
                ? 'Build your first CV'
                : `You've created ${cvCount} CV${cvCount !== 1 ? 's' : ''}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPro
                ? 'Premium templates unlocked — stand out from the crowd!'
                : 'Upgrade to premium templates and stand out (R99/yr).'}
            </p>
            <Link to="/cv-builder">
              <Button size="sm" className="mt-2.5 h-7 text-xs rounded-xl px-3 gap-1">
                <Sparkles className="w-3 h-3" />
                {cvCount === 0 ? 'Create CV' : isPro ? 'Open CV Builder' : 'Upgrade Templates'}
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
