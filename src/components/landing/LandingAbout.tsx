// src/components/landing/LandingAbout.tsx
import { CheckCircle, Eye, MessageCircle, Heart } from 'lucide-react';

export default function LandingAbout() {
  return (
    <section id="about" className="bg-white py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">Our Story</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mt-2 mb-4">
            Built by an Educator, for Educators & Job Seekers
          </h2>
         <p className="text-lg text-[#475569] max-w-3xl mx-auto">
  Crosssa was born from a real struggle: trying to find a cross‑transfer match as an educator. 
  We built this platform to solve that problem – and soon realised we could also offer professional career tools to every job seeker, without the high price tag. 
  Crosssa is a proud product of{' '}
  <a 
    href="https://skootlink.co.za" 
    target="_blank" 
    rel="noopener noreferrer" 
    className="text-[#0d9488] hover:underline font-medium"
  >
    Skootlink (Pty) Ltd 
  </a> <span> – </span>
    a registered South African company that also operates a platform for vehicle‑owner to driver rentals in the gig economy.
</p>
        </div>

        
        <div className="text-center mb-14">
          <h3 className="text-3xl font-extrabold text-[#0f172a] mb-4">What Makes Crosssa Different?</h3>
          <p className="text-[#64748b] max-w-2xl mx-auto">
            Other platforms ask you to pay a large fee and then wait. We do things differently.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <div className="bg-[#f8fafc] rounded-2xl p-6 border border-[#ccfbf1]">
            <div className="w-10 h-10 rounded-xl bg-[#ccfbf1] flex items-center justify-center mb-4">
              <Eye className="w-5 h-5 text-[#0d9488]" />
            </div>
            <h3 className="text-base font-bold text-[#0f172a] mb-2">Total Transparency</h3>
            <p className="text-sm text-[#64748b]">You see other users directly. You choose who to message. No hidden queues, no "we'll notify you when we find a match".</p>
          </div>
          <div className="bg-[#f8fafc] rounded-2xl p-6 border border-[#ccfbf1]">
            <div className="w-10 h-10 rounded-xl bg-[#ccfbf1] flex items-center justify-center mb-4">
              <MessageCircle className="w-5 h-5 text-[#0d9488]" />
            </div>
            <h3 className="text-base font-bold text-[#0f172a] mb-2">Direct Messaging</h3>
            <p className="text-sm text-[#64748b]">Found an educator who wants to transfer to your province? Message them today. No waiting for an intermediary.</p>
          </div>
          <div className="bg-[#f8fafc] rounded-2xl p-6 border border-[#ccfbf1]">
            <div className="w-10 h-10 rounded-xl bg-[#ccfbf1] flex items-center justify-center mb-4">
              <Heart className="w-5 h-5 text-[#0d9488]" />
            </div>
            <h3 className="text-base font-bold text-[#0f172a] mb-2">Fair Approach for SA</h3>
            <p className="text-sm text-[#64748b]">We understand our economic reality. Find matches for free, and only pay when you're ready to start chatting. Affordable CV tools with no fortune required.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">The Problem</span>
            <h3 className="text-3xl font-extrabold text-[#0f172a] mt-2 mb-4">Educators struggle to find transfer matches</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3"><span className="text-[#0d9488] mt-0.5">✗</span><span className="text-[#475569]">No central platform to find willing exchange partners</span></li>
              <li className="flex items-start gap-3"><span className="text-[#0d9488] mt-0.5">✗</span><span className="text-[#475569]">Expensive "pay‑and‑wait" services with no transparency</span></li>
              <li className="flex items-start gap-3"><span className="text-[#0d9488] mt-0.5">✗</span><span className="text-[#475569]">Job seekers forced to pay high fees for basic CV templates</span></li>
            </ul>
          </div>
          <div>
            <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">Our Solution</span>
            <h3 className="text-3xl font-extrabold text-[#0f172a] mt-2 mb-4">Direct, transparent, and accessible</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-[#0d9488] shrink-0 mt-0.5" /><span className="text-[#475569]">See other educators and message them directly</span></li>
              <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-[#0d9488] shrink-0 mt-0.5" /><span className="text-[#475569]">Create a professional CV & cover letter in minutes</span></li>
              <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-[#0d9488] shrink-0 mt-0.5" /><span className="text-[#475569]">Free search and matching – only pay when you're ready to connect</span></li>
              <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-[#0d9488] shrink-0 mt-0.5" /><span className="text-[#475569]">Affordable options that respect South African realities</span></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}