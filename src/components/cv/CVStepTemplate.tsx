import { Check, Lock } from 'lucide-react';
import { ReactNode } from 'react';
import { toast } from 'sonner';

interface Template { id: string; name: string; description: string; category: string; preview: ReactNode }

const FREE_TEMPLATE = 'classic';

const TEMPLATES: Template[] = [
  { id: 'classic',      name: 'Classic',      description: 'Clean, traditional layout. Preferred by government schools.',      category: 'Corporate',   preview: <ClassicPreview /> },
  { id: 'modern',       name: 'Modern',       description: 'Two-column layout with a coloured teal sidebar.',                  category: 'Colourful',   preview: <ModernPreview /> },
  { id: 'professional', name: 'Professional', description: 'Gradient banner layout. Great for HOD applications.',              category: 'Corporate',   preview: <ProfessionalPreview /> },
  { id: 'minimal',      name: 'Minimal',      description: 'Simple and elegant. Lets your content speak for itself.',          category: 'Colourful',   preview: <MinimalPreview /> },
  { id: 'sidebar',      name: 'Sidebar',      description: 'Avatar initials, contact left, work history right. Blue & white.', category: 'Corporate',   preview: <SidebarPreview /> },
  { id: 'bold',         name: 'Bold',         description: 'Striking pink header. Eye-catching two-column design.',            category: 'Colourful',   preview: <BoldPreview /> },
  { id: 'executive',    name: 'Executive',    description: 'Rich burgundy banner with icon-accented contact details.',         category: 'Colourful',   preview: <ExecutivePreview /> },
  { id: 'corporate',    name: 'Corporate',    description: 'Navy sidebar, white content. Polished and structured.',            category: 'Corporate',   preview: <CorporatePreview /> },
  { id: 'stylish',      name: 'Stylish',      description: 'Coral accent, dot-rating skills, left dates. Contemporary feel.',    category: 'Colourful',   preview: <StylishPreview /> },
  { id: 'boxed',        name: 'Boxed',        description: 'Name in a box, grey sidebar details. Clean and structured.',          category: 'Corporate',   preview: <BoxedPreview /> },
  { id: 'traditional',  name: 'Traditional',  description: 'Left-date column, horizontal rules. Classic professional look.',      category: 'Corporate',   preview: <TraditionalPreview /> },
  { id: 'navy',         name: 'Navy',         description: 'Dark navy right sidebar, skill bars, photo. Bold and modern.',        category: 'Colourful',   preview: <NavyPreview /> },
  { id: 'timeline',     name: 'Timeline',     description: 'Dot timeline for experience, centred header, left mini sidebar.',     category: 'Colourful',   preview: <TimelinePreview /> },
  { id: 'shaded',       name: 'Shaded',       description: 'Grey shaded section headers, dot-leader skill ratings.',              category: 'Corporate',   preview: <ShadedPreview /> },
  { id: 'teal',         name: 'Teal',         description: 'Bright teal photo header, left sidebar with progress bars.',          category: 'Colourful',   preview: <TealPreview /> },
  { id: 'crimson',      name: 'Crimson',      description: 'Bold red banner, italic headings, right skills column.',              category: 'Colourful',   preview: <CrimsonPreview /> },
  { id: 'sage',         name: 'Sage',         description: 'Soft green header card, chip-style skills. Fresh and friendly.',      category: 'Colourful',   preview: <SagePreview /> },
];

interface Props { selected: string; onChange: (id: string) => void; isFree?: boolean }

export default function CVStepTemplate({ selected, onChange, isFree = false }: Props) {
  const handleSelect = (id: string) => {
    if (isFree && id !== FREE_TEMPLATE) {
      toast.info('Upgrade to Pro to unlock all 17 templates.', { duration: 3000 });
      return;
    }
    onChange(id);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose a layout for your CV:</p>
      {isFree && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
            Free plan includes the <strong>Classic</strong> template. Upgrade to Pro to unlock all 17 templates.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map(t => {
          const isLocked = isFree && t.id !== FREE_TEMPLATE;
          const isSelected = selected === t.id;
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
              <div className="h-32 overflow-hidden bg-white relative">
                <div style={{ transform: 'scale(0.32)', transformOrigin: 'top left', width: '312%', pointerEvents: 'none' }}>
                  {t.preview}
                </div>
                <div className={`absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded ${t.category === 'Corporate' ? 'bg-slate-100 text-slate-600' : 'bg-teal-50 text-teal-700'}`}>
                  {t.category}
                </div>
                {isSelected && !isLocked && (
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                {isLocked && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="bg-white/90 rounded-lg px-2 py-1 flex items-center gap-1 shadow-sm">
                      <Lock className="w-3 h-3 text-slate-600" />
                      <span className="text-[10px] font-semibold text-slate-700">R99 Upgrade</span>
                    </div>
                  </div>
                )}
              </div>
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

/* ─── Existing previews (unchanged) ────────────────────────────────────────── */

function ClassicPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#1e2a3a', color: '#fff', padding: '18px 24px' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '2px' }}>EDUCATOR NAME</div>
        <div style={{ fontSize: '8px', color: '#a0aec0', marginTop: '4px' }}>email@example.com · 071 000 0000 · Gauteng</div>
      </div>
      <div style={{ padding: '12px 24px' }}>
        {['PROFESSIONAL SUMMARY','EDUCATION','EXPERIENCE','SKILLS'].map(s => (
          <div key={s} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '7px', fontWeight: '700', letterSpacing: '1px', color: '#1e2a3a', borderBottom: '1px solid #1e2a3a', paddingBottom: '2px', marginBottom: '4px' }}>{s}</div>
            <div style={{ height: '5px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '3px', width: '90%' }} />
            <div style={{ height: '5px', background: '#f3f4f6', borderRadius: '2px', width: '70%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ModernPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', display: 'flex', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '58px', background: '#0d9488', padding: '12px 8px', color: '#fff' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>E</div>
        <div style={{ fontSize: '6px', fontWeight: '700', textAlign: 'center', marginBottom: '8px' }}>Name</div>
        {['Contact','Subjects','Languages'].map(s => (
          <div key={s} style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '5px', fontWeight: '700', letterSpacing: '1px', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.2)', marginBottom: '2px' }}>{s.toUpperCase()}</div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', marginBottom: '2px' }} />
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', width: '60%' }} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: '12px 10px' }}>
        {['ABOUT ME','EXPERIENCE','EDUCATION','SKILLS'].map(s => (
          <div key={s} style={{ marginBottom: '7px' }}>
            <div style={{ fontSize: '6px', fontWeight: '700', letterSpacing: '1px', color: '#0d9488', borderBottom: '1px solid #0d9488', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
            <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '2px', width: '90%' }} />
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', width: '65%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfessionalPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e4d2b,#2d7a47)', color: '#fff', padding: '16px 24px' }}>
        <div style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '2px' }}>EDUCATOR NAME</div>
        <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.6)', letterSpacing: '2px', marginTop: '3px' }}>EDUCATOR</div>
        <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.75)', marginTop: '6px' }}>email@example.com · 071 000 0000</div>
      </div>
      <div style={{ padding: '10px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        {['EXPERIENCE','EDUCATION','SUBJECTS','SKILLS'].map(s => (
          <div key={s} style={{ marginBottom: '7px' }}>
            <div style={{ fontSize: '6px', fontWeight: '700', color: '#1e4d2b', letterSpacing: '1px', borderBottom: '1px solid #2d7a47', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
            <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '2px' }} />
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', width: '75%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MinimalPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif', padding: '20px 24px' }}>
      <div style={{ borderBottom: '2px solid #111827', paddingBottom: '10px', marginBottom: '12px' }}>
        <div style={{ fontSize: '16px', fontWeight: '300', letterSpacing: '3px', textTransform: 'uppercase' }}>EDUCATOR NAME</div>
        <div style={{ fontSize: '7px', color: '#9ca3af', marginTop: '4px' }}>email@example.com · 071 000 0000 · Gauteng</div>
      </div>
      {['SUMMARY','EXPERIENCE','EDUCATION','SKILLS'].map(s => (
        <div key={s} style={{ marginBottom: '8px', display: 'flex', gap: '10px' }}>
          <div style={{ fontSize: '6px', fontWeight: '700', letterSpacing: '2px', color: '#9ca3af', width: '48px', paddingTop: '2px' }}>{s}</div>
          <div style={{ flex: 1 }}>
            <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '2px' }} />
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', width: '75%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── New previews ──────────────────────────────────────────────────────────── */

/* Template 5 — Sidebar (blue-grey left panel, avatar initials, right content) */
function SidebarPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', display: 'flex', fontFamily: 'Arial, sans-serif', minHeight: '140px' }}>
      {/* Left panel */}
      <div style={{ width: '64px', background: '#3b5998', padding: '14px 8px', color: '#fff', flexShrink: 0 }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b5998', fontSize: '13px', fontWeight: '800' }}>JS</div>
        {['CONTACT','SKILLS'].map(s => (
          <div key={s} style={{ marginBottom: '7px' }}>
            <div style={{ fontSize: '5px', fontWeight: '800', letterSpacing: '1px', color: 'rgba(255,255,255,0.55)', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
            <div style={{ height: '3.5px', background: 'rgba(255,255,255,0.35)', borderRadius: '2px', marginBottom: '2px' }} />
            <div style={{ height: '3.5px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', width: '70%', marginBottom: '2px' }} />
            <div style={{ height: '3.5px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', width: '55%' }} />
          </div>
        ))}
      </div>
      {/* Right content */}
      <div style={{ flex: 1, padding: '14px 12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a2e' }}>John Smith</div>
        <div style={{ fontSize: '7px', color: '#3b5998', fontWeight: '600', marginBottom: '8px' }}>Senior Sales Associate</div>
        {['WORK HISTORY','EDUCATION'].map(s => (
          <div key={s} style={{ marginBottom: '7px' }}>
            <div style={{ fontSize: '6px', fontWeight: '700', letterSpacing: '1px', color: '#3b5998', borderBottom: '1.5px solid #3b5998', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
            <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '2px', width: '95%' }} />
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', width: '80%', marginBottom: '2px' }} />
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', width: '60%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Template 6 — Bold (pink/magenta header, two-column body) */
function BoldPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#c2185b', color: '#fff', padding: '14px 22px 10px' }}>
        <div style={{ fontSize: '16px', fontWeight: '800' }}>John Smith</div>
        <div style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.8)', marginTop: '3px' }}>Senior Sales Associate</div>
      </div>
      {/* Pink divider bar */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg,#e91e8c,#f8bbd0)' }} />
      {/* Two-column body */}
      <div style={{ display: 'flex', padding: '10px 22px', gap: '16px' }}>
        {/* Left */}
        <div style={{ width: '70px', flexShrink: 0 }}>
          {['CONTACT','SKILLS'].map(s => (
            <div key={s} style={{ marginBottom: '7px' }}>
              <div style={{ fontSize: '5.5px', fontWeight: '800', letterSpacing: '1px', color: '#c2185b', borderBottom: '1px solid #f48fb1', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
              <div style={{ height: '3.5px', background: '#fce4ec', borderRadius: '2px', marginBottom: '2px' }} />
              <div style={{ height: '3.5px', background: '#fce4ec', borderRadius: '2px', width: '70%', marginBottom: '2px' }} />
              <div style={{ height: '3.5px', background: '#fce4ec', borderRadius: '2px', width: '55%' }} />
            </div>
          ))}
        </div>
        {/* Right */}
        <div style={{ flex: 1 }}>
          {['WORK HISTORY','EDUCATION'].map(s => (
            <div key={s} style={{ marginBottom: '7px' }}>
              <div style={{ fontSize: '6px', fontWeight: '700', letterSpacing: '1px', color: '#c2185b', borderBottom: '1px solid #f48fb1', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
              <div style={{ height: '4px', background: '#fce4ec', borderRadius: '2px', marginBottom: '2px', width: '95%' }} />
              <div style={{ height: '4px', background: '#fce4ec', borderRadius: '2px', width: '75%', marginBottom: '2px' }} />
              <div style={{ height: '4px', background: '#fce4ec', borderRadius: '2px', width: '55%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Template 7 — Executive (burgundy/red header, icon-accented contact row, clean sections) */
function ExecutivePreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#7b1829', color: '#fff', padding: '14px 22px' }}>
        <div style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.5px' }}>John Smith</div>
        <div style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.75)', marginTop: '3px' }}>Senior Sales Associate</div>
      </div>
      {/* Contact icon row */}
      <div style={{ background: '#a01e30', padding: '5px 22px', display: 'flex', gap: '14px' }}>
        {['📍 Address','📞 Phone','✉ Email'].map(c => (
          <div key={c} style={{ fontSize: '5.5px', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '3px' }}>{c}</div>
        ))}
      </div>
      {/* Body — two column */}
      <div style={{ display: 'flex', padding: '10px 22px', gap: '16px' }}>
        <div style={{ flex: 1.6 }}>
          {['WORK HISTORY','EDUCATION'].map(s => (
            <div key={s} style={{ marginBottom: '7px' }}>
              <div style={{ fontSize: '6px', fontWeight: '700', letterSpacing: '1px', color: '#7b1829', borderBottom: '1.5px solid #7b1829', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
              <div style={{ height: '4px', background: '#fde8ea', borderRadius: '2px', marginBottom: '2px', width: '95%' }} />
              <div style={{ height: '4px', background: '#fde8ea', borderRadius: '2px', width: '75%', marginBottom: '2px' }} />
              <div style={{ height: '4px', background: '#fde8ea', borderRadius: '2px', width: '55%' }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {['SKILLS','LANGUAGES'].map(s => (
            <div key={s} style={{ marginBottom: '7px' }}>
              <div style={{ fontSize: '6px', fontWeight: '700', letterSpacing: '1px', color: '#7b1829', borderBottom: '1.5px solid #7b1829', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
              <div style={{ height: '3.5px', background: '#fde8ea', borderRadius: '2px', marginBottom: '2px' }} />
              <div style={{ height: '3.5px', background: '#fde8ea', borderRadius: '2px', width: '70%', marginBottom: '2px' }} />
              <div style={{ height: '3.5px', background: '#fde8ea', borderRadius: '2px', width: '50%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Template 8 — Corporate (dark navy left sidebar, white right area, very structured) */
function CorporatePreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', display: 'flex', fontFamily: 'Arial, sans-serif', minHeight: '140px' }}>
      {/* Dark navy sidebar */}
      <div style={{ width: '72px', background: '#0f2044', padding: '14px 10px', color: '#fff', flexShrink: 0 }}>
        <div style={{ fontSize: '8px', fontWeight: '800', color: '#fff', marginBottom: '2px', lineHeight: 1.2 }}>John{'\n'}Smith</div>
        <div style={{ fontSize: '5.5px', color: '#7eaadc', marginBottom: '10px' }}>Sales Associate</div>
        {['CONTACT','SKILLS','LANGUAGES'].map(s => (
          <div key={s} style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '5px', fontWeight: '800', letterSpacing: '1px', color: '#7eaadc', borderBottom: '1px solid rgba(126,170,220,0.3)', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginBottom: '2px' }} />
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.13)', borderRadius: '2px', width: '70%', marginBottom: '2px' }} />
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', width: '50%' }} />
          </div>
        ))}
      </div>
      {/* White content area */}
      <div style={{ flex: 1, padding: '14px 12px' }}>
        <div style={{ height: '3px', background: '#0f2044', marginBottom: '8px', width: '100%' }} />
        {['WORK HISTORY','EDUCATION'].map(s => (
          <div key={s} style={{ marginBottom: '7px' }}>
            <div style={{ fontSize: '6px', fontWeight: '800', letterSpacing: '1.5px', color: '#0f2044', marginBottom: '3px' }}>{s}</div>
            <div style={{ height: '4px', background: '#e8edf5', borderRadius: '2px', marginBottom: '2px', width: '95%' }} />
            <div style={{ height: '4px', background: '#f1f4f9', borderRadius: '2px', width: '80%', marginBottom: '2px' }} />
            <div style={{ height: '4px', background: '#f1f4f9', borderRadius: '2px', width: '60%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── New template previews ─────────────────────────────────────────────────── */

function StylishPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ padding: '12px 18px 8px', borderBottom: '2px solid #e05c6b', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e05c6b', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#111' }}>Ashley Lopez</div>
          <div style={{ fontSize: '6px', color: '#e05c6b' }}>Cook · New York</div>
        </div>
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, padding: '8px 12px' }}>
          {['Profile','Employment History','Education'].map(s => (
            <div key={s} style={{ marginBottom: '7px' }}>
              <div style={{ fontSize: '6px', fontWeight: '700', color: '#e05c6b', textTransform: 'uppercase', marginBottom: '3px' }}>{s}</div>
              <div style={{ height: '4px', background: '#fde8ea', borderRadius: '2px', marginBottom: '2px', width: '90%' }} />
              <div style={{ height: '4px', background: '#fde8ea', borderRadius: '2px', width: '70%' }} />
            </div>
          ))}
        </div>
        <div style={{ width: '52px', padding: '8px 6px', background: '#fafafa', borderLeft: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: '5.5px', fontWeight: '700', color: '#e05c6b', marginBottom: '6px' }}>SKILLS</div>
          {['Skill 1','Skill 2','Skill 3'].map(s => (
            <div key={s} style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '5px', color: '#374151', marginBottom: '2px' }}>{s}</div>
              <div style={{ display: 'flex', gap: '1px' }}>{[...Array(10)].map((_, j) => <div key={j} style={{ width: '3px', height: '3px', borderRadius: '50%', background: j < 7 ? '#e05c6b' : '#e5e7eb' }} />)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoxedPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', display: 'flex', fontFamily: 'Arial, sans-serif', minHeight: '130px' }}>
      <div style={{ width: '65px', background: '#f8f8f8', padding: '12px 8px', borderRight: '1px solid #e5e7eb', flexShrink: 0 }}>
        <div style={{ fontSize: '5.5px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', borderBottom: '1px solid #374151', paddingBottom: '3px', marginBottom: '6px' }}>DETAILS</div>
        {['Address','Phone','Email'].map(s => (
          <div key={s} style={{ marginBottom: '5px' }}>
            <div style={{ fontSize: '4.5px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '1px' }}>{s}</div>
            <div style={{ height: '3px', background: '#e5e7eb', borderRadius: '1px', width: '80%' }} />
          </div>
        ))}
        <div style={{ fontSize: '5.5px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', borderBottom: '1px solid #374151', paddingBottom: '3px', marginBottom: '6px', marginTop: '8px' }}>SKILLS</div>
        {[...Array(3)].map((_, i) => <div key={i} style={{ display: 'flex', gap: '1.5px', marginBottom: '4px' }}>{[...Array(5)].map((_, j) => <div key={j} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#374151' }} />)}</div>)}
      </div>
      <div style={{ flex: 1, padding: '12px 10px' }}>
        <div style={{ border: '1.5px solid #374151', padding: '6px 10px', marginBottom: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px', color: '#111' }}>MAX LEEWOOD</div>
          <div style={{ fontSize: '5px', color: '#6b7280', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>DRIVER</div>
        </div>
        {['PROFILE','EMPLOYMENT HISTORY','EDUCATION'].map(s => (
          <div key={s} style={{ marginBottom: '7px' }}>
            <div style={{ fontSize: '5.5px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', borderBottom: '1px solid #374151', paddingBottom: '2px', marginBottom: '3px' }}>{s}</div>
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', marginBottom: '2px', width: '95%' }} />
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', width: '75%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TraditionalPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Georgia, serif', padding: '14px 22px' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#111', letterSpacing: '1px' }}>LESLIE PHILOBERTO</div>
        <div style={{ fontSize: '6px', color: '#6b7280', marginTop: '3px' }}>Los Angeles · (213) 543-8899 · email@example.com</div>
      </div>
      {['PROFILE','EMPLOYMENT HISTORY','EDUCATION','SKILLS'].map(s => (
        <div key={s} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '58px', flexShrink: 0, fontSize: '5px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '1px', paddingTop: '2px' }}>{s}</div>
          <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '8px' }}>
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', marginBottom: '2px', width: '90%' }} />
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', width: '65%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NavyPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', display: 'flex', fontFamily: 'Arial, sans-serif', minHeight: '130px' }}>
      <div style={{ flex: 1, padding: '14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e5e7eb', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#111' }}>Neil Burrows</div>
            <div style={{ fontSize: '5.5px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1.5px' }}>CIVIL ENGINEER</div>
          </div>
        </div>
        <div style={{ height: '2px', background: '#1a2a4a', marginBottom: '8px' }} />
        {['Profile','Employment History','Education'].map(s => (
          <div key={s} style={{ marginBottom: '7px' }}>
            <div style={{ fontSize: '6px', fontWeight: '700', color: '#111', marginBottom: '3px' }}>{s}</div>
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', marginBottom: '2px', width: '90%' }} />
            <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', width: '70%' }} />
          </div>
        ))}
      </div>
      <div style={{ width: '55px', background: '#1a2a4a', padding: '14px 8px', flexShrink: 0 }}>
        {['Details','Skills','Languages'].map(s => (
          <div key={s} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '4.5px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '2px', marginBottom: '4px' }}>{s}</div>
            {[...Array(2)].map((_, i) => (
              <div key={i} style={{ marginBottom: '4px' }}>
                <div style={{ height: '2.5px', background: 'rgba(255,255,255,0.15)', borderRadius: '1px', marginBottom: '2px' }}>
                  <div style={{ width: '70%', height: '100%', background: '#60a5fa', borderRadius: '1px' }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelinePreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', display: 'flex', fontFamily: 'Arial, sans-serif', minHeight: '130px' }}>
      <div style={{ width: '55px', padding: '12px 8px', borderRight: '1px solid #e5e7eb', flexShrink: 0 }}>
        <div style={{ fontSize: '5.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#374151', marginBottom: '6px' }}>• SKILLS •</div>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ marginBottom: '6px' }}>
            <div style={{ height: '3px', background: '#e5e7eb', marginBottom: '2px' }}><div style={{ width: '75%', height: '100%', background: '#374151' }} /></div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: '10px 12px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e5e7eb', margin: '0 auto 4px' }} />
          <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px', color: '#111' }}>JIM RYAN</div>
          <div style={{ height: '1.5px', background: '#e5e7eb', margin: '4px 0' }} />
        </div>
        {['PROFILE','EMPLOYMENT HISTORY','EDUCATION'].map(s => (
          <div key={s} style={{ display: 'flex', gap: '6px', marginBottom: '7px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#374151', flexShrink: 0 }} />
              <div style={{ width: '1.5px', flex: 1, background: '#e5e7eb', marginTop: '2px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '5.5px', fontWeight: '700', textTransform: 'uppercase', color: '#374151', marginBottom: '2px' }}>{s}</div>
              <div style={{ height: '3.5px', background: '#f3f4f6', borderRadius: '2px', width: '90%', marginBottom: '1.5px' }} />
              <div style={{ height: '3.5px', background: '#f3f4f6', borderRadius: '2px', width: '65%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShadedPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif', padding: '0' }}>
      <div style={{ textAlign: 'center', padding: '12px 22px 8px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '3px', color: '#111' }}>TONY SANDERS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '6px', color: '#6b7280', marginTop: '5px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '3px 0' }}>
          <span>Phone</span><span>Email</span>
        </div>
      </div>
      <div style={{ padding: '4px 22px' }}>
        {['PROFILE','EMPLOYMENT HISTORY','EDUCATION','SKILLS'].map(s => (
          <div key={s} style={{ marginBottom: '7px' }}>
            <div style={{ background: '#f3f4f6', padding: '3px 6px', marginBottom: '4px', fontSize: '5.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#374151' }}>{s}</div>
            <div style={{ height: '3.5px', background: '#f9fafb', borderRadius: '2px', marginBottom: '1.5px', width: '90%' }} />
            <div style={{ height: '3.5px', background: '#f9fafb', borderRadius: '2px', width: '70%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TealPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#06b6d4', display: 'flex', alignItems: 'stretch', minHeight: '40px' }}>
        <div style={{ width: '36px', background: 'rgba(0,0,0,0.1)', flexShrink: 0 }} />
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#111' }}>Herman Walton</div>
          <div style={{ fontSize: '5.5px', color: '#1e293b', marginTop: '2px' }}>Student · New York</div>
        </div>
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ width: '62px', padding: '8px', borderRight: '1px solid #f1f5f9', flexShrink: 0 }}>
          {['Skills','Languages'].map(s => (
            <div key={s} style={{ marginBottom: '7px' }}>
              <div style={{ fontSize: '5.5px', fontWeight: '700', color: '#374151', borderBottom: '2px solid #06b6d4', paddingBottom: '2px', marginBottom: '4px' }}>{s}</div>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ marginBottom: '3px' }}>
                  <div style={{ height: '2.5px', background: '#e2e8f0' }}><div style={{ width: '75%', height: '100%', background: '#06b6d4' }} /></div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '8px 10px' }}>
          {['Profile','Employment History','Education'].map(s => (
            <div key={s} style={{ marginBottom: '7px' }}>
              <div style={{ fontSize: '6px', fontWeight: '700', color: '#111', marginBottom: '3px' }}>{s}</div>
              <div style={{ height: '3.5px', background: '#f3f4f6', borderRadius: '2px', marginBottom: '2px', width: '90%' }} />
              <div style={{ height: '3.5px', background: '#f3f4f6', borderRadius: '2px', width: '65%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CrimsonPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#c0392b', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff', fontStyle: 'italic' }}>Vince Murray</div>
          <div style={{ fontSize: '5.5px', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>ADMINISTRATIVE ASSISTANT</div>
        </div>
      </div>
      <div style={{ display: 'flex', padding: '8px 16px', gap: '14px' }}>
        <div style={{ flex: 1 }}>
          {['Profile','Employment History','Education'].map(s => (
            <div key={s} style={{ marginBottom: '7px' }}>
              <div style={{ fontSize: '6px', fontWeight: '700', color: '#111', borderBottom: '1.5px solid #c0392b', paddingBottom: '2px', marginBottom: '3px', fontStyle: 'italic' }}>{s}</div>
              <div style={{ height: '3.5px', background: '#fde8e8', borderRadius: '2px', marginBottom: '2px', width: '90%' }} />
              <div style={{ height: '3.5px', background: '#fde8e8', borderRadius: '2px', width: '70%' }} />
            </div>
          ))}
        </div>
        <div style={{ width: '50px', flexShrink: 0 }}>
          <div style={{ fontSize: '6px', fontWeight: '700', color: '#111', borderBottom: '1.5px solid #c0392b', paddingBottom: '2px', marginBottom: '6px', fontStyle: 'italic' }}>Skills</div>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ marginBottom: '5px' }}>
              <div style={{ height: '3px', background: '#fee2e2' }}><div style={{ width: '75%', height: '100%', background: '#c0392b' }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SagePreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif', padding: '12px 16px' }}>
      <div style={{ background: '#e8f0e8', borderRadius: '6px', padding: '12px 16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a2e1a' }}>Kane Jones</div>
        <div style={{ textAlign: 'right', fontSize: '5.5px', color: '#374151', lineHeight: '1.8' }}>
          <div>email@example.com</div><div>(512) 701-9215</div>
        </div>
      </div>
      {['Career Experience','Education'].map(s => (
        <div key={s} style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#7fa37f', marginBottom: '4px' }}>{s}</div>
          <div style={{ height: '3.5px', background: '#f3f4f6', borderRadius: '2px', marginBottom: '2px', width: '90%' }} />
          <div style={{ height: '3.5px', background: '#f3f4f6', borderRadius: '2px', width: '65%' }} />
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
        {['Skill 1','Skill 2','Skill 3','Skill 4'].map(s => (
          <span key={s} style={{ background: '#e8f0e8', color: '#374151', padding: '2px 8px', borderRadius: '12px', fontSize: '5.5px' }}>{s}</span>
        ))}
      </div>
    </div>
  );
}
