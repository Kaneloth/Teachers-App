import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';

export default function LandingHero() {
  return (
    <section className="bg-gradient-to-br from-[#f0fdfa] via-white to-[#f0fdf4] py-20 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
        {/* Text */}
        <div className="flex-1 text-center md:text-left">
          <span className="inline-block text-xs font-semibold text-[#0d9488] bg-[#ccfbf1] px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
            For South African Educators
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#0f172a] leading-tight mb-5">
            The App Built for<br />
            <span className="text-[#0d9488]">SA Educators.</span>
          </h1>
          <p className="text-lg text-[#475569] mb-6 max-w-lg mx-auto md:mx-0">
            Find vacancies, connect with peers, build your CV, and manage transfers — all from your phone. EduCross is your career in your pocket.
          </p>
          {/* App store nudge */}
          <div className="flex items-center gap-2 justify-center md:justify-start mb-6">
            <span className="text-xs bg-[#0f172a] text-white px-3 py-1 rounded-full font-semibold">📱 Free App</span>
            <span className="text-xs text-[#64748b]">Works on Android, iOS & browser</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start mb-8">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-[#0d9488] text-white font-bold px-8 py-3.5 rounded-xl hover:bg-[#0f766e] transition-colors shadow-md text-base"
            >
              Get the App Free <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 border border-[#0d9488] text-[#0d9488] font-semibold px-7 py-3 rounded-xl hover:bg-[#f0fdfa] transition-colors"
            >
              See How It Works
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start text-sm text-[#64748b]">
            {['SACE-Aware Platform', 'Free to Join', 'Trusted by Educators'].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#0d9488]" /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Illustration card */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-sm">
            <div className="bg-white rounded-3xl shadow-xl border border-[#e2e8f0] p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[#f1f5f9]">
                <div className="w-10 h-10 rounded-full bg-[#ccfbf1] flex items-center justify-center text-[#0d9488] font-bold text-sm">TP</div>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">Thabo Pretorius</p>
                  <p className="text-xs text-[#64748b]">Mathematics Educator · FET Phase</p>
                </div>
                <span className="ml-auto text-xs text-[#0d9488] bg-[#f0fdfa] px-2 py-0.5 rounded-full font-medium">Active</span>
              </div>
              {[
                { label: 'New Vacancy Match', desc: 'Maths Teacher · Gauteng · Post L1', time: '2m ago', dot: 'bg-[#0d9488]' },
                { label: 'CV Generated', desc: 'Professional template ready to send', time: '1h ago', dot: 'bg-amber-400' },
                { label: 'Connection Request', desc: 'Nomsa Dlamini wants to connect', time: '3h ago', dot: 'bg-blue-400' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0f172a]">{item.label}</p>
                    <p className="text-xs text-[#64748b]">{item.desc}</p>
                  </div>
                  <span className="text-[10px] text-[#94a3b8]">{item.time}</span>
                </div>
              ))}
            </div>
            {/* Floating badge */}
            <div className="absolute -bottom-4 -right-4 bg-[#0d9488] text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-lg">
              1,200+ Educators Joined
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}