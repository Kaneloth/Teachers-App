import { useEffect, useRef, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import CVTemplateRenderer from './CVTemplateRenderer';

// A4 page proportions (210mm × 297mm) — the thumbnail box below is locked to
// this aspect ratio so it reads as "a little page" rather than an arbitrary
// rectangle. The renderer itself is always laid out at 794px wide (A4 at
// ~96dpi), so PAGE_WIDTH_PX is the reference we scale that 794px down to
// fit whatever the box's actual rendered width turns out to be.
const PAGE_WIDTH_PX = 794;

// ── Sample data used for all template previews ────────────────────────────────
// Enough content to show the header, one experience entry, education, and skills
const SAMPLE_DATA = {
  personal: {
    full_name:  'Name Surname',
    email:      'name.surname@example.com',
    phone:      '081 000 0000',
    address:    'Johannesburg, Gauteng',
    bio:        'Dedicated professional with 10 years of experience in project coordination and team leadership. Committed to delivering results and continuously improving processes.',
    photo_url:  undefined,
    id_number:  undefined,
  },
  education: [
    { institution: 'University Name', qualification: "Bachelor's Degree", year: '2014' },
    { institution: 'College Name',    qualification: 'Postgraduate Diploma', year: '2016' },
  ],
  experience: [
    {
      school: 'Company Name (Pty) Ltd',
      role:   'Senior Coordinator',
      from:   '2015',
      to:     'Present',
      description: 'Managing day-to-day operations and coordinating cross-functional teams\nDeveloping and implementing process improvements\nBuilding strong relationships with clients and stakeholders',
    },
    {
      school: 'Previous Company Name',
      role:   'Junior Coordinator',
      from:   '2013',
      to:     '2015',
      description: 'Supported daily operations and administrative tasks\nAssisted senior staff with project planning',
    },
  ],
  skills: {
    subjects:    ['Project Management', 'Data Analysis'],
    soft_skills: ['Communication', 'Leadership', 'Problem Solving'],
    languages:   ['English', 'Afrikaans'],
  },
  references: [
    { name: 'Reference Name', title: 'Manager', organisation: 'Company Name', phone: '081 000 0000', email: 'reference@example.com', relationship: 'Direct supervisor' },
  ],
  custom_sections: [],
};

const TEMPLATES = [
  { id: 'classic',      name: 'Classic',      description: 'Clean dark-header layout. Professional and easy to scan.' },
  { id: 'minimal',      name: 'Minimal',      description: 'Clean and simple. Lets your content speak for itself.' },
  { id: 'bold',         name: 'Bold',         description: 'Striking pink/magenta header. Eye-catching design.' },
  { id: 'traditional',  name: 'Traditional',  description: 'Left date column, horizontal rules. Classic formal look.' },
  { id: 'shaded',       name: 'Shaded',       description: 'Grey shaded section headers. Formal and easy to scan.' },
  { id: 'crimson',      name: 'Crimson',      description: 'Bold centered red banner. Clean single-column layout, easy to scan.' },
  { id: 'sage',         name: 'Sage',         description: 'Soft green header card. Chip-style skill badges. Fresh feel.' },
  { id: 'elegant',      name: 'Elegant',      description: 'Centered serif layout on a soft blue background. Formal and refined.' },
  { id: 'heritage',     name: 'Heritage',     description: 'Formal centered layout with double-rule headings and a top contact bar.' },
  { id: 'casual',       name: 'Casual',       description: 'Same cream & circles design as Playful but single-column. Great for longer CVs.' },
  { id: 'skyline',      name: 'Skyline',      description: 'Gray sidebar cut by a diagonal blue accent, photo up top, dotted timeline for education and experience.' },
  { id: 'azure',        name: 'Azure',        description: 'Light-blue corner accent behind a circular photo, thin uppercase name, two-column body for a clean professional look.' },
  { id: 'dove',         name: 'Dove',         description: 'Soft blue-gray banner and matching rounded sidebar card beneath a circular photo. Calm, professional two-column layout.' },
];

const FREE_TEMPLATE = 'classic';

interface Props { selected: string; onChange: (id: string) => void; isFree?: boolean; isEducator?: boolean }

export default function CVStepTemplate({ selected, onChange, isFree = false, isEducator = true }: Props) {
  const handleSelect = (id: string) => {
    if (isFree && id !== FREE_TEMPLATE) {
      toast.info('Top up to unlock all 13 templates.', { duration: 3000 });
      return;
    }
    onChange(id);
  };

  // ── Self-measuring scale ──────────────────────────────────────────────
  // The thumbnail box is a true A4 rectangle (aspect-ratio locked below) and
  // fills whatever width the grid gives it. We measure that real rendered
  // width once (and again on resize) and scale the 794px-wide renderer down
  // to match exactly — rather than the old fixed 0.205 factor, which was
  // tuned for a specific fixed pixel size. A bigger box (now that the badge
  // row is gone and the box itself grew) means a scale factor closer to 1,
  // which is what actually fixes the blurriness: less down-scaling leaves
  // more real pixels for the browser to anti-alias text with.
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.32);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setScale(width / PAGE_WIDTH_PX);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose a layout for your CV. Previews show exactly how your CV will look when printed.</p>
      {isFree && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
            Free credits include the <strong>Classic</strong> template. Top up to unlock all 13 templates — permanently.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map((t, i) => {
          const isLocked   = isFree && t.id !== FREE_TEMPLATE;
          const isSelected = selected === t.id;
          const previewData = { ...SAMPLE_DATA, template: t.id };

          return (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              className={`text-left rounded-2xl border overflow-hidden transition-all ${
                isSelected
                  ? 'border-primary ring-2 ring-primary shadow-md'
                  : isLocked
                  ? 'border-border bg-card opacity-60 cursor-not-allowed'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              {/* ── Live preview thumbnail — a real A4-shaped page ── */}
              {/* aspect-ratio 210/297 = A4's own proportions, so the box
                  itself already reads as "a little page" — no badge or
                  caption needed to explain what it is. Only the first card
                  carries the measuring ref; every card shares one grid
                  column width, so one measurement is enough for all of them. */}
              <div
                ref={i === 0 ? boxRef : undefined}
                className="relative bg-white overflow-hidden"
                style={{ aspectRatio: '210 / 297' }}
              >
                <div
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    width: PAGE_WIDTH_PX,
                    pointerEvents: 'none',
                    willChange: 'transform',
                  }}
                >
                  <CVTemplateRenderer data={previewData as any} forExport={false} watermark={false} cvType={isEducator ? 'educator' : 'general'} thumbnail />
                </div>

                {/* Selected checkmark */}
                {isSelected && !isLocked && (
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 shadow">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                {/* Lock overlay */}
                {isLocked && (
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center z-10">
                    <div className="bg-white/90 rounded-lg px-2 py-1 flex items-center gap-1 shadow-sm">
                      <Lock className="w-3 h-3 text-slate-600" />
                      <span className="text-[10px] font-semibold text-slate-700">Top up to unlock</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Name + description ── */}
              <div className="p-2.5">
                <p className="font-semibold text-sm text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug break-words">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
