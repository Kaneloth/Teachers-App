import { Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import CVTemplateRenderer from './CVTemplateRenderer';

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
  { id: 'classic',      name: 'Classic',      description: 'Clean dark-header layout. Professional and easy to scan.',       category: 'Corporate' },
  { id: 'minimal',      name: 'Minimal',      description: 'Clean and simple. Lets your content speak for itself.',              category: 'Corporate' },
  { id: 'bold',         name: 'Bold',         description: 'Striking pink/magenta header. Eye-catching design.',                 category: 'Colourful' },
  { id: 'traditional',  name: 'Traditional',  description: 'Left date column, horizontal rules. Classic formal look.',           category: 'Corporate' },
  { id: 'shaded',       name: 'Shaded',       description: 'Grey shaded section headers. Formal and easy to scan.',              category: 'Corporate' },
  { id: 'crimson',      name: 'Crimson',      description: 'Bold centered red banner. Clean single-column layout, easy to scan.', category: 'Colourful' },
  { id: 'sage',         name: 'Sage',         description: 'Soft green header card. Chip-style skill badges. Fresh feel.',       category: 'Colourful' },
  { id: 'elegant',      name: 'Elegant',      description: 'Centered serif layout on a soft blue background. Formal and refined.', category: 'Corporate' },
  { id: 'heritage',     name: 'Heritage',     description: 'Formal centered layout with double-rule headings and a top contact bar.', category: 'Corporate' },
  { id: 'casual',       name: 'Casual',       description: 'Same cream & circles design as Playful but single-column. Great for longer CVs.', category: 'Colourful' },
];

const FREE_TEMPLATE = 'classic';

interface Props { selected: string; onChange: (id: string) => void; isFree?: boolean; isEducator?: boolean }

export default function CVStepTemplate({ selected, onChange, isFree = false, isEducator = true }: Props) {
  const handleSelect = (id: string) => {
    if (isFree && id !== FREE_TEMPLATE) {
      toast.info('Buy any credit pack to unlock all 10 templates.', { duration: 3000 });
      return;
    }
    onChange(id);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose a layout for your CV. Previews show exactly how your CV will look when printed.</p>
      {isFree && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
            Free credits include the <strong>Classic</strong> template. Buy any credit pack to unlock all 10 templates — permanently.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map(t => {
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
              {/* ── Live preview thumbnail ── */}
              {/* transform:scale (not zoom) — zoom was rounding this
                  template's hairline dividers up to a full, disproportionately
                  thick pixel at this extreme 0.205 scale-down, even after
                  switching those dividers to border-based hairlines.
                  transform:scale renders via GPU sub-pixel anti-aliasing
                  instead, which handles thin lines more faithfully. Safe to
                  use here since the outer h-36 overflow-hidden box clips
                  regardless of the transformed element's own layout size —
                  we don't need zoom's "auto-collapses height" behavior in
                  this fixed-size, already-clipped thumbnail. */}
              <div className="h-36 overflow-hidden bg-white relative">
                <div style={{ transform: 'scale(0.205)', transformOrigin: 'top left', width: '794px', pointerEvents: 'none' }}>
                  <CVTemplateRenderer data={previewData as any} forExport={false} watermark={false} cvType={isEducator ? 'educator' : 'general'} thumbnail />
                </div>

                {/* Category badge */}
                <div className={`absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded z-10 ${
                  t.category === 'Corporate'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-teal-50 text-teal-700'
                }`}>
                  {t.category}
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
                      <span className="text-[10px] font-semibold text-slate-700">Buy credits to unlock</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Name + description ── */}
              <div className="p-3">
                <p className="font-semibold text-sm text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
