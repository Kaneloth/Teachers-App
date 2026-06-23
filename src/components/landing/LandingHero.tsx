import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, GraduationCap, Briefcase, FileText, Users, Sparkles, Clock } from 'lucide-react';

export default function LandingHero() {
  return (
    <section className="bg-gradient-to-br from-[#f0fdfa] via-white to-[#f0fdf4] py-20 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
        {/* Left side */}
        <div className="flex-1 text-center md:text-left">
          {/* Launch banner */}
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Launch offer · Advanced features free for 6 months
          </div>

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

        {/* Right side - platform feature highlights (no user counts) */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-sm">
            {/* Launch promo card */}
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-4 mb-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800">Limited-Time Launch Offer</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  All advanced search filters, transfer matching, and messaging are <strong>completely free</strong> for the first 6 months. No credit card needed.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-[#e2e8f0] p-6">
              <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-4">What You Get — Free</p>
              <div className="space-y-4">
                <FeatureRow emoji="🎓" label="Transfer matching" desc="Find educators across SA ready to swap schools" />
                <FeatureRow emoji="📄" label="ATS-friendly professional CVs" desc="10 templates, AI-assisted summary" />
                <FeatureRow emoji="✉️" label="Job-specific cover letters" desc="Tailored to each vacancy in seconds" />
                <FeatureRow emoji="🔍" label="Advanced search & filters" desc="Province, subject, phase, radius — all free now" />
                <FeatureRow emoji="💬" label="Direct messaging" desc="Chat with matched educators for free" />
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 bg-[#0d9488] text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-lg">
              🇿🇦 Built for South Africa
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ emoji, label, desc }: { emoji: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#ccfbf1] flex items-center justify-center shrink-0 text-lg">
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0f172a]">{label}</p>
        <p className="text-xs text-[#64748b] leading-tight">{desc}</p>
      </div>
    </div>
  );
}
