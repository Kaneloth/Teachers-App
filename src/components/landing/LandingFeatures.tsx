import { Search, FileText, MessageCircle, Briefcase, ShieldCheck, Star } from 'lucide-react';

const FEATURES = [
  { icon: Search, title: 'Find Teaching Vacancies', desc: 'Browse hundreds of live teaching posts across all 9 provinces, filtered by phase, subject, and district.', color: 'bg-[#ccfbf1] text-[#0d9488]' },
  { icon: FileText, title: 'Build a Professional CV', desc: 'Create a CAPS-aligned teaching CV in minutes using our guided builder and professional templates.', color: 'bg-[#fef3c7] text-amber-600' },
  { icon: MessageCircle, title: 'Connect with Peers', desc: 'Message other educators directly. Explore mutual transfer opportunities and build your network.', color: 'bg-[#dbeafe] text-blue-600' },
  { icon: Briefcase, title: 'Manage Transfers', desc: 'Indicate availability for transfer, set preferences, and get matched with educators in your target area.', color: 'bg-[#f3e8ff] text-purple-600' },
  { icon: ShieldCheck, title: 'SACE Verification', desc: 'Verify your SACE registration directly on the platform for credibility when applying to posts.', color: 'bg-[#dcfce7] text-green-700' },
  { icon: Star, title: 'Smart Matching', desc: 'Our algorithm surfaces the most relevant vacancies and peer connections based on your profile.', color: 'bg-[#ffe4e6] text-rose-600' },
];

export default function LandingFeatures() {
  return (
    <section id="features" className="bg-white py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">What We Offer</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mt-2 mb-3">Everything an Educator Needs</h2>
          <p className="text-[#64748b] max-w-xl mx-auto">One platform purpose-built for South African teachers — from first post to principal.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="bg-[#f8fafc] rounded-2xl p-6 border border-[#e2e8f0] hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0f172a] mb-2">{title}</h3>
              <p className="text-sm text-[#64748b] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
