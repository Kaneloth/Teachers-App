import { Quote } from 'lucide-react';

const TESTIMONIALS = [
  { name: 'Nomsa Dlamini', role: 'English Educator · KwaZulu-Natal', quote: 'EduCross helped me find a mutual transfer partner in three weeks. What used to take years of paperwork happened almost effortlessly.', initials: 'ND' },
  { name: 'Thabo Molefe', role: 'Mathematics HOD · Gauteng', quote: 'The CV builder alone is worth it. I built a professional teaching CV in under 20 minutes and got called for an interview that same week.', initials: 'TM' },
  { name: 'Lerato van Wyk', role: 'Foundation Phase Teacher · Western Cape', quote: "I love that I can see real vacancies from the DBE and other sources in one place. No more browsing ten different websites.", initials: 'LV' },
];

export default function LandingTestimonials() {
  return (
    <section id="testimonials" className="bg-white py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">What Educators Say</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mt-2 mb-3">Trusted by Teachers Across SA</h2>
          <p className="text-[#64748b] max-w-xl mx-auto">Real stories from educators who found their next opportunity on EduCross.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ name, role, quote, initials }) => (
            <div key={name} className="bg-[#f8fafc] rounded-2xl p-6 border border-[#e2e8f0] flex flex-col">
              <Quote className="w-8 h-8 text-[#ccfbf1] mb-4" />
              <p className="text-sm text-[#475569] leading-relaxed flex-1 italic">"{quote}"</p>
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
                <div className="w-10 h-10 rounded-full bg-[#ccfbf1] text-[#0d9488] flex items-center justify-center font-bold text-sm">{initials}</div>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">{name}</p>
                  <p className="text-xs text-[#64748b]">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
