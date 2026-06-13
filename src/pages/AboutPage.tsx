import { Link } from 'react-router-dom';
import { 
  GraduationCap, Briefcase, Users, Heart, ShieldCheck, 
  TrendingUp, Lightbulb, Globe, ArrowRight, CheckCircle 
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#f0fdfa] via-white to-[#f0fdf4] py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold text-[#0d9488] bg-[#ccfbf1] px-3 py-1 rounded-full mb-4 tracking-wide uppercase">Our Story</span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#0f172a] mb-6">
            Empowering South African Educators & Job Seekers
          </h1>
          <p className="text-lg text-[#475569] max-w-3xl mx-auto">
            Crosssa was born from a simple idea: to connect teachers who want to transfer schools and give every job seeker access to professional career tools – all in one place, completely free.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          <div className="bg-[#f8fafc] rounded-2xl p-8 border border-[#e2e8f0]">
            <div className="w-12 h-12 rounded-xl bg-[#ccfbf1] flex items-center justify-center mb-5">
              <GraduationCap className="w-6 h-6 text-[#0d9488]" />
            </div>
            <h2 className="text-2xl font-bold text-[#0f172a] mb-3">Our Mission</h2>
            <p className="text-[#475569] leading-relaxed">
              To simplify the process of school transfers for South African educators while providing modern, AI‑powered career tools for all job seekers. We believe that finding your next opportunity should be straightforward, transparent, and accessible to everyone.
            </p>
          </div>
          <div className="bg-[#f8fafc] rounded-2xl p-8 border border-[#e2e8f0]">
            <div className="w-12 h-12 rounded-xl bg-[#ccfbf1] flex items-center justify-center mb-5">
              <Globe className="w-6 h-6 text-[#0d9488]" />
            </div>
            <h2 className="text-2xl font-bold text-[#0f172a] mb-3">Our Vision</h2>
            <p className="text-[#475569] leading-relaxed">
              A South Africa where every educator can find their ideal transfer match without endless paperwork, and every job seeker can present their best self with a professionally crafted CV – for free.
            </p>
          </div>
        </div>
      </section>

      {/* Why Crosssa - Core Values / What We Offer */}
      <section className="bg-[#f0fdfa] py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mb-4">Why Crosssa?</h2>
            <p className="text-[#64748b] max-w-2xl mx-auto">
              We’re not just another job platform. We’re a community-driven ecosystem built for South African realities.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Peer‑to‑Peer Transfers', desc: 'Connect directly with educators who want to exchange schools – no middlemen, no delays.' },
              { icon: TrendingUp, title: 'AI Career Tools', desc: 'Generate tailored CVs and cover letters using AI that understands South African job markets.' },
              { icon: ShieldCheck, title: 'Verification & Trust', desc: 'SACE verification and identity checks build confidence among educators and employers.' },
              { icon: Briefcase, title: 'Live Vacancies', desc: 'Aggregated teaching and non‑teaching jobs from the DBE, Adzuna, and direct employers.' },
              { icon: Lightbulb, title: 'Free to Start', desc: 'No credit card required. Use core features forever without paying a cent.' },
              { icon: Heart, title: 'Built Locally', desc: 'Designed by South Africans for South Africans – understanding your challenges and needs.' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-[#ccfbf1] hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-[#ccfbf1] flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-[#0d9488]" />
                </div>
                <h3 className="text-base font-bold text-[#0f172a] mb-2">{item.title}</h3>
                <p className="text-sm text-[#64748b] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Problem We Solve */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">The Challenge</span>
              <h2 className="text-3xl font-extrabold text-[#0f172a] mt-2 mb-4">Transferring schools shouldn't be a maze</h2>
              <p className="text-[#475569] mb-4">
                For years, educators have struggled with opaque transfer processes, limited visibility of open positions, and no easy way to find a willing exchange partner. Meanwhile, job seekers face outdated CV templates and expensive career services.
              </p>
              <p className="text-[#475569]">
                Crosssa breaks down these barriers by combining a peer‑to‑peer transfer network with professional AI career tools – all free for basic use.
              </p>
            </div>
            <div className="bg-[#f8fafc] rounded-2xl p-6 border border-[#e2e8f0]">
              <div className="space-y-4">
                {[
                  'No centralised transfer platform',
                  'Time‑consuming manual search for matches',
                  'Expensive CV writing services',
                  'Limited visibility of vacancies'
                ].map((problem, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-[#0d9488] text-lg">✗</span>
                    <span className="text-sm text-[#475569]">{problem}</span>
                  </div>
                ))}
                <div className="border-t border-[#e2e8f0] pt-4 mt-2 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#0d9488] shrink-0 mt-0.5" />
                  <span className="text-sm font-semibold text-[#0f172a]">Crosssa solves all of them – for free.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team (placeholder - you can replace with real names/photos later) */}
      <section className="bg-[#f0fdfa] py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mb-3">Built by Educators, for Educators</h2>
          <p className="text-[#64748b] max-w-2xl mx-auto mb-12">
            Our team combines education experience, technology expertise, and a deep passion for improving career mobility in South Africa.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { name: 'Kanelo Thelejane', role: 'Founder & Lead Developer', bio: 'Former educator turned full‑stack developer. Experienced the transfer struggle first‑hand.' },
              { name: 'Thabo Molefe', role: 'Education Advisor', bio: '20+ years in SA education system, former principal and district official.' },
              { name: 'Nomsa Dlamini', role: 'Product & Community', bio: 'Passionate about connecting educators and building supportive communities.' },
            ].map((member, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 border border-[#ccfbf1]">
                <div className="w-20 h-20 rounded-full bg-[#ccfbf1] flex items-center justify-center mx-auto mb-4 text-[#0d9488] font-bold text-2xl">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="text-lg font-bold text-[#0f172a]">{member.name}</h3>
                <p className="text-xs text-[#0d9488] font-semibold mb-2">{member.role}</p>
                <p className="text-sm text-[#64748b]">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto bg-[#0d9488] rounded-3xl p-8 md:p-12 text-center text-white">
          <h2 className="text-3xl font-extrabold mb-3">Join the Community</h2>
          <p className="text-white/80 text-lg mb-6 max-w-xl mx-auto">
            Be part of the movement that’s transforming education careers in South Africa. Sign up today – it’s free.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 bg-white text-[#0d9488] font-bold px-8 py-3 rounded-xl hover:bg-[#f0fdfa] transition-colors shadow-md"
          >
            Create Free Account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}