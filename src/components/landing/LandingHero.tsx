import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, GraduationCap, Briefcase, FileText, Users } from 'lucide-react';

interface Stats {
  users: number;
  cvs: number;
  vacancies: number;
}

function formatCount(n: number): string {
  // Round down to the nearest clean number people round to in marketing
  // copy (e.g. 1,247 -> "1,200+") rather than showing an oddly precise
  // figure — still strictly true ("+") and avoids implying false precision.
  if (n >= 1000) return `${Math.floor(n / 100) * 100}+`;
  if (n >= 100)  return `${Math.floor(n / 10) * 10}+`;
  return `${n}`;
}

export default function LandingHero() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/.netlify/functions/landing-stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {}); // fail silently — card just omits the live numbers
  }, []);

  return (
    <section className="bg-gradient-to-br from-[#f0fdfa] via-white to-[#f0fdf4] py-20 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
        {/* Left side */}
        <div className="flex-1 text-center md:text-left">
          <span className="inline-block text-xs font-semibold text-[#0d9488] bg-[#ccfbf1] px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
            One Platform, Two Paths
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#0f172a] leading-tight mb-5">
            For Educators Seeking a Cross Transfer Match <span className="text-[#0d9488]">&</span><br />
            Job Seekers in South Africa
          </h1>
          <p className="text-lg text-[#475569] mb-6 max-w-lg mx-auto md:mx-0">
            Teachers: find transfer matches, chat with peers, and manage your career.<br />
            Job seekers: build CVs, write cover letters, and discover vacancies – all in one app.
          </p>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start mb-8">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-[#0d9488] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0f766e] transition-colors shadow-md"
            >
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 border border-[#0d9488] text-[#0d9488] font-semibold px-6 py-3 rounded-xl hover:bg-[#f0fdfa] transition-colors"
            >
              See How It Works
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start text-sm text-[#64748b]">
            <span className="flex items-center gap-1.5"><GraduationCap className="w-4 h-4 text-[#0d9488]" /> Educator Transfer Hub</span>
            <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-[#0d9488]" /> Job Seeker Tools</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-[#0d9488]" /> Free to Join</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 bg-[#f0fdfa] border border-[#99f6e4] text-[#0d9488] text-sm font-semibold px-4 py-2 rounded-full">
            <CheckCircle className="w-4 h-4 shrink-0" />
            No subscriptions · No hidden costs · Pay only for what you use
          </div>
        </div>

        {/* Right side - real stats card (no fabricated names or activity —
            every number here is a live count from the database) */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-sm">
            <div className="bg-white rounded-3xl shadow-xl border border-[#e2e8f0] p-6">
              <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-4">Real Numbers, No Fakes</p>
              <div className="space-y-4">
                <StatRow icon={Users}    label="Educators & Job Seekers" value={stats ? formatCount(stats.users) : '—'} />
                <StatRow icon={FileText} label="CVs Created"             value={stats ? formatCount(stats.cvs) : '—'} />
                <StatRow icon={Briefcase} label="Vacancies Listed"       value={stats ? formatCount(stats.vacancies) : '—'} />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-[#0d9488] text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-lg">
              {stats ? formatCount(stats.users) : '...'} Educators & Job Seekers Joined
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#ccfbf1] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#0d9488]" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-[#64748b]">{label}</p>
      </div>
      <p className="text-xl font-extrabold text-[#0f172a]">{value}</p>
    </div>
  );
}
