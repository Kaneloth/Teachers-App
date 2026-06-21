import { Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import CVTemplateRenderer from './CVTemplateRenderer';

// ── Sample data used for all template previews ────────────────────────────────
// Enough content to show the header, one experience entry, education, and skills
const SAMPLE_DATA = {
  personal: {
    full_name:  'Kanelo Thelejane',
    email:      'kanelo@example.com',
    phone:      '081 352 9905',
    address:    'Johannesburg, Gauteng',
    bio:        'Dedicated educator with 10 years of experience teaching Mathematics and Computer Applications Technology. Passionate about integrating technology into the classroom.',
    photo_url:  undefined,
    id_number:  undefined,
  },
  education: [
    { institution: 'UNISA',              qualification: 'B.Ed (FET Phase)', year: '2014' },
    { institution: 'Pretoria University', qualification: 'Honours in Education', year: '2016' },
  ],
  experience: [
    {
      school: 'Sgodiphola Secondary School',
      role:   'Mathematics Educator',
      from:   '2015',
      to:     'Present',
      description: 'Teaching Mathematics and CAT to Grades 10–12\nCoordinating ICT committee activities\nDeveloping lesson plans aligned to CAPS curriculum',
    },
    {
      school: 'Pretoria High School',
      role:   'Junior Educator',
      from:   '2013',
      to:     '2015',
      description: 'Taught Grade 8 and 9 Mathematics\nSupported learners with extra classes',
    },
  ],
  skills: {
    subjects:    ['Mathematics', 'Computer Applications Technology'],
    soft_skills: ['Classroom Management', 'Curriculum Development', 'Assessment & Moderation'],
    languages:   ['English', 'Setswana'],
  },
  references: [
    { name: 'Mr S Mbele', title: 'Principal', organisation: 'Sgodiphola Secondary', phone: '011 000 0000', email: 'mbele@school.co.za', relationship: 'Direct supervisor' },
  ],
  custom_sections: [],
};

const TEMPLATES = [
  { id: 'classic',      name: 'Classic',      description: 'Clean dark-header layout. Trusted by SA government schools.',       category: 'Corporate' },
  { id: 'modern',       name: 'Modern',       description: 'Teal sidebar with initials avatar. Contemporary two-column.',        category: 'Colourful' },
  { id: 'professional', name: 'Professional', description: 'Green gradient banner. Ideal for HOD & management applications.',    category: 'Corporate' },
  { id: 'minimal',      name: 'Minimal',      description: 'Clean and simple. Lets your content speak for itself.',              category: 'Corporate' },
  { id: 'sidebar',      name: 'Sidebar',      description: 'Blue left sidebar, work history right. Structured and clear.',       category: 'Corporate' },
  { id: 'bold',         name: 'Bold',         description: 'Striking pink/magenta header. Eye-catching design.',                 category: 'Colourful' },
  { id: 'executive',    name: 'Executive',    description: 'Rich burgundy gradient banner. Senior professional feel.',           category: 'Colourful' },
  { id: 'corporate',    name: 'Corporate',    description: 'Dark navy sidebar. Polished and highly structured.',                 category: 'Corporate' },
  { id: 'boxed',        name: 'Boxed',        description: 'Name framed in a border. Grey sidebar details. Clean.',             category: 'Corporate' },
  { id: 'traditional',  name: 'Traditional',  description: 'Left date column, horizontal rules. Classic formal look.',           category: 'Corporate' },
  { id: 'navy',         name: 'Navy',         description: 'Dark navy right sidebar with skill progress bars.',                  category: 'Colourful' },
  { id: 'shaded',       name: 'Shaded',       description: 'Grey shaded section headers. Formal and easy to scan.',              category: 'Corporate' },
  { id: 'teal',         name: 'Teal',         description: 'Bright teal photo header. Left sidebar with progress bars.',         category: 'Colourful' },
  { id: 'crimson',      name: 'Crimson',      description: 'Bold red banner with italic headings. Right skills column.',         category: 'Colourful' },
  { id: 'sage',         name: 'Sage',         description: 'Soft green header card. Chip-style skill badges. Fresh feel.',       category: 'Colourful' },
  { id: 'elegant',      name: 'Elegant',      description: 'Centered serif layout on a soft lavender background. Formal and refined.', category: 'Corporate' },
  { id: 'heritage',     name: 'Heritage',     description: 'Formal centered layout with double-rule headings and a top contact bar.', category: 'Corporate' },
];

const FREE_TEMPLATE = 'classic';

interface Props { selected: string; onChange: (id: string) => void; isFree?: boolean }

export default function CVStepTemplate({ selected, onChange, isFree = false }: Props) {
  const handleSelect = (id: string) => {
    if (isFree && id !== FREE_TEMPLATE) {
      toast.info('Buy any credit pack to unlock all 19 templates.', { duration: 3000 });
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
            Free credits include the <strong>Classic</strong> template. Buy any credit pack to unlock all 19 templates — permanently.
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
              {/* zoom (unlike transform:scale) collapses layout height automatically */}
              <div className="h-36 overflow-hidden bg-white relative">
                <div style={{ zoom: 0.205, pointerEvents: 'none' }}>
                  <CVTemplateRenderer data={previewData as any} forExport={false} watermark={false} />
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
