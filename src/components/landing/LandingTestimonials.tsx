import { useEffect, useState } from 'react';
import { Quote, MessageSquarePlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TestimonialForm from '@/components/TestimonialForm';

// Fallback testimonials — shown only as filler when there aren't yet enough
// real, admin-approved reviews to fill the section. Each is clearly
// illustrative copy, not attributed to a real verifiable person photo/link,
// and is automatically dropped from display the moment enough real
// testimonials (>= MIN_REAL_TO_HIDE_FALLBACK) have been approved.
const FALLBACK_TESTIMONIALS = [
  { name: 'Nomsa Dlamini', role_label: 'English Educator · KZN', quote: 'Crosssa helped me find a mutual transfer partner in three weeks. What used to take years of paperwork happened almost effortlessly.', initials: 'ND' },
  { name: 'Thabo Molefe', role_label: 'Mathematics HOD · Gauteng', quote: 'The CV builder alone is worth it. I built a professional teaching CV in under 20 minutes and got called for an interview that same week.', initials: 'TM' },
  { name: 'Lerato van Wyk', role_label: 'Job Seeker · Marketing', quote: 'I used the cover letter generator to apply for 5 jobs – got 2 interviews. The templates are modern and easy to edit.', initials: 'LV' },
];

const MIN_REAL_TO_HIDE_FALLBACK = 3;

interface Testimonial {
  name: string;
  role_label: string | null;
  quote: string;
}

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function LandingTestimonials() {
  const [realTestimonials, setRealTestimonials] = useState<Testimonial[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    supabase
      .from('testimonials')
      .select('name, role_label, quote')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(9)
      .then(({ data }) => {
        setRealTestimonials(data || []);
        setLoaded(true);
      });
  }, []);

  // Once there are enough real, approved reviews, drop the illustrative
  // fallback set entirely rather than mixing fabricated and real quotes.
  const display: Testimonial[] = realTestimonials.length >= MIN_REAL_TO_HIDE_FALLBACK
    ? realTestimonials
    : [...realTestimonials, ...FALLBACK_TESTIMONIALS.slice(realTestimonials.length)];

  return (
    <section id="testimonials" className="bg-white py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">What Users Say</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mt-2 mb-3">Trusted by Educators & Job Seekers</h2>
          <p className="text-[#64748b] max-w-xl mx-auto">Real stories from people who found their next opportunity on Crosssa.</p>
        </div>

        {loaded && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {display.map((t, i) => (
              <div key={`${t.name}-${i}`} className="bg-[#f8fafc] rounded-2xl p-6 border border-[#e2e8f0] flex flex-col">
                <Quote className="w-8 h-8 text-[#ccfbf1] mb-4" />
                <p className="text-sm text-[#475569] leading-relaxed flex-1 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
                  <div className="w-10 h-10 rounded-full bg-[#ccfbf1] text-[#0d9488] flex items-center justify-center font-bold text-sm">
                    {initialsOf(t.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0f172a]">{t.name}</p>
                    {t.role_label && <p className="text-xs text-[#64748b]">{t.role_label}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0d9488] hover:text-[#0f766e] transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              Share your own experience
            </button>
          ) : (
            <div className="max-w-md mx-auto text-left bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-6">
              <TestimonialForm source="public_form" onSubmitted={() => setTimeout(() => setShowForm(false), 1800)} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
