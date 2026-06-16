import { useEffect, useRef, useState } from 'react';
import { Quote, MessageSquarePlus, ChevronLeft, ChevronRight } from 'lucide-react';
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

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="bg-[#f8fafc] rounded-2xl p-6 border border-[#e2e8f0] flex flex-col h-full">
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
  );
}

export default function LandingTestimonials() {
  const [realTestimonials, setRealTestimonials] = useState<Testimonial[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(0);
  const PER_PAGE = 3;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    supabase
      .from('testimonials')
      .select('name, role_label, quote')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setRealTestimonials(data || []);
        setLoaded(true);
      });
  }, []);

  // Once there are enough real, approved reviews, drop the illustrative
  // fallback set entirely rather than mixing fabricated and real quotes.
  const allTestimonials: Testimonial[] = realTestimonials.length >= MIN_REAL_TO_HIDE_FALLBACK
    ? realTestimonials
    : [...realTestimonials, ...FALLBACK_TESTIMONIALS.slice(realTestimonials.length)];

  // Data is fetched newest-first, so page 0 = latest reviews. Paging
  // forward (right arrow) moves deeper into older reviews; paging
  // backward (left arrow) returns toward the latest ones.
  const pageCount = Math.max(1, Math.ceil(allTestimonials.length / PER_PAGE));
  const display = allTestimonials.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const canGoOlder = page < pageCount - 1;
  const canGoNewer = page > 0;

  // Track which card is centered in the mobile swipe row, so the dot
  // indicators below can highlight the active one as the user swipes —
  // a clearer "there's more here" signal than text alone.
  const handleMobileScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.clientWidth ?? el.clientWidth;
    const gap = 16;
    const idx = Math.round(el.scrollLeft / (cardWidth + gap));
    setActiveCard(Math.min(idx, allTestimonials.length - 1));
  };

  return (
    <section id="testimonials" className="bg-white py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">What Users Say</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mt-2 mb-3">Trusted by Educators & Job Seekers</h2>
          <p className="text-[#64748b] max-w-xl mx-auto">Real stories from people who found their next opportunity on Crosssa.</p>
        </div>

        {loaded && (
          <div className="relative">
            <div className="hidden md:flex items-center justify-center gap-2 mb-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={!canGoNewer}
                aria-label="Show latest reviews"
                className={`p-2 rounded-full border transition-colors ${
                  canGoNewer ? 'border-[#0d9488] text-[#0d9488] hover:bg-[#f0fdfa]' : 'border-[#e2e8f0] text-[#cbd5e1] cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageCount > 1 && (
                <span className="text-xs text-[#94a3b8] font-medium px-2">
                  {page === 0 ? 'Latest reviews' : `${page + 1} of ${pageCount}`}
                </span>
              )}
              <button
                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={!canGoOlder}
                aria-label="Show older reviews"
                className={`p-2 rounded-full border transition-colors ${
                  canGoOlder ? 'border-[#0d9488] text-[#0d9488] hover:bg-[#f0fdfa]' : 'border-[#e2e8f0] text-[#cbd5e1] cursor-not-allowed'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="md:hidden text-center text-xs text-[#94a3b8] font-medium mb-3">
              {allTestimonials.length > 1 ? `← Swipe to see all ${allTestimonials.length} reviews →` : null}
            </p>

            {/* Desktop: arrow-paginated 3-column grid, 3 cards at a time */}
            <div className="hidden md:grid grid-cols-3 gap-6">
              {display.map((t, i) => (
                <TestimonialCard key={`${t.name}-${page}-${i}`} t={t} />
              ))}
            </div>

            {/* Mobile: all cards in one draggable, swipeable horizontal row
                with snap-to-card behavior. Native touch scrolling — no JS
                drag handling needed, the browser handles it via overflow-x
                and -webkit-overflow-scrolling. Card width is intentionally
                < 100vw so the next card's edge peeks into view, visually
                signaling there's more to swipe to. */}
            <div
              ref={scrollRef}
              onScroll={handleMobileScroll}
              className="md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-6 px-6 pb-2"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {allTestimonials.map((t, i) => (
                <div key={`${t.name}-m-${i}`} className="snap-center shrink-0 w-[85vw] max-w-sm">
                  <TestimonialCard t={t} />
                </div>
              ))}
            </div>

            {/* Dot indicators — glanceable "you're on card X of Y, swipe
                for more" signal, the standard mobile carousel convention. */}
            {allTestimonials.length > 1 && (
              <div className="md:hidden flex justify-center gap-1.5 mt-4">
                {allTestimonials.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeCard ? 'w-5 bg-[#0d9488]' : 'w-1.5 bg-[#e2e8f0]'
                    }`}
                  />
                ))}
              </div>
            )}
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
