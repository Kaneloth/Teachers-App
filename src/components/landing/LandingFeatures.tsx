import { Search, FileText, MessageCircle, Briefcase, ShieldCheck, Users, MapPin, PenTool } from 'lucide-react';

const FEATURES = [
  // Educator‑specific
  { icon: Users, title: 'Find Transfer Matches', desc: 'Connect with educators in your target province who want to exchange schools. Smart filtering by phase, subject, and district.', color: 'bg-[#ccfbf1] text-[#0d9488]' },
  { icon: MessageCircle, title: 'Peer Messaging', desc: 'Chat directly with matched educators to discuss transfer opportunities, documents, and timelines.', color: 'bg-[#dbeafe] text-blue-600' },
  { icon: MapPin, title: 'Province‑Based Search', desc: 'Find educators willing to transfer to or from your preferred province. Filter by district, phase, and subject.', color: 'bg-[#f3e8ff] text-purple-600' },
  // General / job seeker
  { icon: FileText, title: 'Professional CV Builder', desc: 'Create a polished CV using our AI‑assisted builder – choose from 17 templates, tailored for any industry.', color: 'bg-[#fef3c7] text-amber-600' },
  { icon: PenTool, title: 'Cover Letter Generator', desc: 'Input job descriptions – AI writes tailored cover letters that match your CV and the role.', color: 'bg-[#ffe4e6] text-rose-600' },
  { icon: Briefcase, title: 'Vacancy Aggregator', desc: 'Browse teaching and non‑teaching jobs from the DBE, Adzuna, and direct employer posts.', color: 'bg-[#dcfce7] text-green-700' },
];

export default function LandingFeatures() {
  return (
    <section id="features" className="bg-white py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">Two Experiences, One App</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mt-2 mb-3">Built for Teachers &amp; Job Seekers</h2>
          <p className="text-[#64748b] max-w-2xl mx-auto">
            Whether you're an educator looking to transfer schools or a professional needing a modern CV – Crosssa gives you the tools to succeed.
          </p>
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
        <div className="mt-8 text-center text-sm text-[#64748b]">
          <span className="inline-flex items-center gap-2 bg-[#f0fdfa] px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4 text-[#0d9488]" /> SACE‑verified educators · Search &amp; matching always free
          </span>
        </div>
      </div>
    </section>
  );
}