import { Link } from 'react-router-dom';
import { 
  GraduationCap, Briefcase, Users, Heart, ShieldCheck, 
  TrendingUp, Lightbulb, Globe, ArrowRight, CheckCircle, MessageCircle, Eye
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#f0fdfa] via-white to-[#f0fdf4] py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold text-[#0d9488] bg-[#ccfbf1] px-3 py-1 rounded-full mb-4 tracking-wide uppercase">Our Story</span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#0f172a] mb-6">
            Built by an Educator, for Educators & Job Seekers
          </h1>
          <p className="text-lg text-[#475569] max-w-3xl mx-auto">
            Crosssa was born from a real struggle: trying to find a cross‑transfer match as an educator. 
            I built this platform to solve that problem – and to give every job seeker access to professional career tools, without the high price tag.
          </p>
        </div>
      </section>

      {/* The Founder's Story */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">From the founder</span>
              <h2 className="text-3xl font-extrabold text-[#0f172a] mt-2 mb-4">I'm an educator, just like you</h2>
              <p className="text-[#475569] mb-4">
                The idea for Crosssa came when I needed to find a transfer match myself. I realised how 
                difficult, slow, and opaque the process is – educators have no direct way to find someone 
                willing to exchange schools. So I decided to build a platform where educators can sign up, 
                see each other, and message directly when they match.
              </p>
              <p className="text-[#475569] mb-4">
                Along the way, I saw that many job seekers (including unemployed educators) struggle to 
                create professional CVs and cover letters. That's why I added career tools that anyone can 
                use – to help you take your career to the next level, whatever that level may be.
              </p>
              <p className="text-[#475569]">
                Crosssa is my solo project, built from my own experience. No boardrooms, no investors 
                pushing for profit – just an educator who believes that finding your next opportunity should 
                be transparent, direct, and affordable.
              </p>
            </div>
            <div className="bg-[#f8fafc] rounded-2xl p-6 border border-[#e2e8f0]">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ccfbf1] flex items-center justify-center text-[#0d9488] font-bold">✓</div>
                  <div>
                    <p className="font-semibold text-[#0f172a]">Direct peer matching</p>
                    <p className="text-sm text-[#64748b]">See other educators and message them directly – no middlemen, no "wait and hope".</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ccfbf1] flex items-center justify-center text-[#0d9488] font-bold">✓</div>
                  <div>
                    <p className="font-semibold text-[#0f172a]">Professional career tools</p>
                    <p className="text-sm text-[#64748b]">CV builder and cover letter generator – simple, fast, and high quality.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ccfbf1] flex items-center justify-center text-[#0d9488] font-bold">✓</div>
                  <div>
                    <p className="font-semibold text-[#0f172a]">Free tier + fair pricing</p>
                    <p className="text-sm text-[#64748b]">No large upfront fees. Free credits to start, and reasonable prices for extra features.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Crosssa Different */}
      <section className="bg-[#f0fdfa] py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mb-4">What Makes Crosssa Different?</h2>
            <p className="text-[#64748b] max-w-2xl mx-auto">
              Other platforms ask you to pay a large fee and then wait. We do things differently.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-[#ccfbf1]">
              <div className="w-10 h-10 rounded-xl bg-[#ccfbf1] flex items-center justify-center mb-4">
                <Eye className="w-5 h-5 text-[#0d9488]" />
              </div>
              <h3 className="text-base font-bold text-[#0f172a] mb-2">Total Transparency</h3>
              <p className="text-sm text-[#64748b]">You see other users directly. You choose who to message. No hidden queues, no "we'll notify you when we find a match".</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#ccfbf1]">
              <div className="w-10 h-10 rounded-xl bg-[#ccfbf1] flex items-center justify-center mb-4">
                <MessageCircle className="w-5 h-5 text-[#0d9488]" />
              </div>
              <h3 className="text-base font-bold text-[#0f172a] mb-2">Direct Messaging</h3>
              <p className="text-sm text-[#64748b]">Found an educator who wants to transfer to your province? Message them today. No waiting for an intermediary.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#ccfbf1]">
              <div className="w-10 h-10 rounded-xl bg-[#ccfbf1] flex items-center justify-center mb-4">
                <Heart className="w-5 h-5 text-[#0d9488]" />
              </div>
              <h3 className="text-base font-bold text-[#0f172a] mb-2">Fair Pricing for SA</h3>
              <p className="text-sm text-[#64748b]">We understand our economic reality. Free tier, free credits for new users, and reasonable prices – no one should pay a fortune for a good CV.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Solution (Direct from your words) */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">The Problem</span>
              <h2 className="text-3xl font-extrabold text-[#0f172a] mt-2 mb-4">Educators struggle to find transfer matches</h2>
              <ul className="space-y-3">
                {[
                  'No central platform to find willing exchange partners',
                  'Expensive "pay‑and‑wait" services with no transparency',
                  'Job seekers forced to pay high fees for basic CV templates'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-[#0d9488] mt-0.5">✗</span>
                    <span className="text-[#475569]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">Our Solution</span>
              <h2 className="text-3xl font-extrabold text-[#0f172a] mt-2 mb-4">Direct, transparent, and affordable</h2>
              <ul className="space-y-3">
                {[
                  'See other educators and message them directly',
                  'Create a professional CV & cover letter in minutes',
                  'Free tier + free credits to start – no upfront payment',
                  'Reasonable prices that respect South African realities'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#0d9488] shrink-0 mt-0.5" />
                    <span className="text-[#475569]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Our Commitment to Affordability */}
      <section className="bg-[#f0fdfa] py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-[#0f172a] mb-4">Pricing That Makes Sense</h2>
          <p className="text-lg text-[#475569] mb-6">
            Crosssa is not completely free – but we built it to be accessible to everyone.  
            Every new user receives <strong>free credits</strong> to explore the platform.  
            Our paid plans are priced reasonably because we know that a person seeking a job shouldn't have to pay a fortune to get a good CV.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-[#0d9488] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0f766e] transition-colors"
            >
              Start with Free Credits <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 border border-[#0d9488] text-[#0d9488] font-semibold px-6 py-3 rounded-xl hover:bg-[#f0fdfa] transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto bg-[#0d9488] rounded-3xl p-8 md:p-12 text-center text-white">
          <h2 className="text-3xl font-extrabold mb-3">Ready to Take the Next Step?</h2>
          <p className="text-white/80 text-lg mb-6 max-w-xl mx-auto">
            Join a community where educators help educators – and job seekers get the tools they need to succeed.
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