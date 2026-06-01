import { Check } from 'lucide-react';

const TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean, traditional layout. Preferred by government schools.',
    category: 'Corporate',
    preview: <ClassicPreview />,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Two-column layout with a coloured teal sidebar.',
    category: 'Colourful',
    preview: <ModernPreview />,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Gradient banner layout. Great for HOD applications.',
    category: 'Corporate',
    preview: <ProfessionalPreview />,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple and elegant. Lets your content speak for itself.',
    category: 'Colourful',
    preview: <MinimalPreview />,
  },
];

export default function CVStepTemplate({ selected, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose a layout for your CV:</p>
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`text-left rounded-2xl border overflow-hidden transition-all ${
              selected === t.id
                ? 'border-primary ring-2 ring-primary shadow-md'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            {/* Template mini-preview */}
            <div className="h-32 overflow-hidden bg-white relative">
              <div style={{ transform: 'scale(0.32)', transformOrigin: 'top left', width: '312%', pointerEvents: 'none' }}>
                {t.preview}
              </div>
              <div className={`absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                t.category === 'Corporate' ? 'bg-slate-100 text-slate-600' : 'bg-teal-50 text-teal-700'
              }`}>{t.category}</div>
              {selected === t.id && (
                <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="font-semibold text-sm text-foreground">{t.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Tiny static preview thumbnails ── */
function ClassicPreview() {
  return (
    <div style={{ width: '210mm', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#1e2a3a', color: '#fff', padding: '18px 24px' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '2px' }}>EDUCATOR NAME</div>
        <div style={{ fontSize: '8px', color: '#a0aec0', marginTop: '4px' }}>email@example.com  ·  071 000 0000  ·  Gauteng</div>
      </div>
      <div style={{ padding: '12px 24px' }}>
        {['PROFESSIONAL SUMMARY', 'EDUCATION', 'EXPERIENCE', 'SKILLS'].map(s => (
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
        {['Contact', 'Subjects', 'Languages'].map(s => (
          <div key={s} style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '5px', fontWeight: '700', letterSpacing: '1px', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.2)', marginBottom: '2px' }}>{s.toUpperCase()}</div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', marginBottom: '2px' }} />
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', width: '60%' }} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: '12px 10px' }}>
        {['ABOUT ME', 'EXPERIENCE', 'EDUCATION', 'SKILLS'].map(s => (
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
        <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.75)', marginTop: '6px' }}>email@example.com  ·  071 000 0000</div>
      </div>
      <div style={{ padding: '10px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        {['EXPERIENCE', 'EDUCATION', 'SUBJECTS', 'SKILLS'].map(s => (
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
        <div style={{ fontSize: '7px', color: '#9ca3af', marginTop: '4px' }}>email@example.com  ·  071 000 0000  ·  Gauteng</div>
      </div>
      {['SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS'].map(s => (
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