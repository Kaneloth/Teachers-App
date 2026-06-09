import { ReactNode, useState, useLayoutEffect, useRef } from 'react';

interface CustomSection {
  title: string;
  type: 'text' | 'bullets' | 'table';
  content?: string;
  columns?: string[];
  rows?: string[][];
}

interface RefEntry {
  name: string;
  title: string;
  organisation: string;
  phone: string;
  email: string;
  relationship: string;
}

interface CVData {
  personal: { full_name?: string; email?: string; phone?: string; address?: string; bio?: string; photo_url?: string; id_number?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects?: string[]; soft_skills?: string[]; languages?: string[] };
  references?: RefEntry[];
  custom_sections?: CustomSection[];
  template: string;
}

interface Props { data: CVData; forExport?: boolean; watermark?: boolean }

// Unicode emojis – render perfectly in html2canvas
const ICONS = {
  briefcase: '💼',
  graduation: '🎓',
  user: '👤',
  mail: '✉️',
  phone: '📞',
  mapPin: '📍',
  award: '🏅',
  bookOpen: '📖',
  languages: '🌐',
};

// ── FIXED: Use verticalAlign 'middle' instead of 'baseline' ──
// html2canvas renders baseline-aligned inline-blocks shifted upward
const BUBBLE_BASE: React.CSSProperties = {
  display: 'inline-block',
  borderRadius: '4px',
  padding: '5px 12px',
  fontSize: '11px',
  lineHeight: '14px',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  margin: '0 6px 6px 0',
};

// ── FIXED: Removed 'gap' — html2canvas ignores flex gap ──
// margin spacing is handled on BUBBLE_BASE instead
const BUBBLE_WRAP: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
};

/**
 * Pushes whatever follows it to the start of the next A4 page (1123 px).
 * Measures real DOM offsetTop after layout — works with html2canvas-based PDF
 * export. `pageBreakBefore: always` is a CSS print directive that html2canvas
 * ignores entirely, so this JS approach is required.
 */
const A4_PAGE_H = 1123;

function PageBreakSpacer() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    let el: HTMLElement = ref.current;
    let top = 0;
    while (el.offsetParent) {
      top += el.offsetTop;
      el = el.offsetParent as HTMLElement;
    }
    top += el.offsetTop;
    const rem = top % A4_PAGE_H;
    setHeight(rem === 0 ? 0 : A4_PAGE_H - rem);
  }, []);
  return <div ref__={ref} style={{ height }} />;
}

export default function CVTemplateRenderer({ data, forExport = false, watermark = false }: Props) {
  const { template } = data;
  const wrapperStyle: React.CSSProperties = forExport
    ? { width: '794px', minHeight: '1123px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', background: '#fff' }
    : { width: '100%', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.10)', borderRadius: '4px', overflow: 'hidden' };

  const validEdu = (data.education || []).filter(e => e.institution);
  const validExp = (data.experience || []).filter(e => e.school);

  const tmpl =
    template === 'modern' ? <ModernTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'professional' ? <ProfessionalTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'minimal' ? <MinimalTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'sidebar' ? <SidebarTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'bold' ? <BoldTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'executive' ? <ExecutiveTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'corporate' ? <CorporateTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    <ClassicTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;

  return (
    <div style={wrapperStyle}>
      {tmpl}
      {watermark && (
        <div style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: '#9ca3af' }}>
          ✦Created FREE at <a href__="https://www.crosssa.co.za/" style={{ color: '#9ca3af' }}>www.crosssa.co.za</a> — Connecting SA Educators✦
        </div>
      )}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

// ── FIXED: Use flex divs instead of <ul><li> — html2canvas misaligns list markers ──
function renderDescription(desc: string | undefined, color: string, fontSize = '12px'): React.ReactNode {
  if (!desc) return null;
  const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div style={{ margin: '4px 0 0' }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '2px' }}>
          <span style={{ color, fontSize, marginRight: '6px', lineHeight: '1.5', flexShrink: 0 }}>•</span>
          <span style={{ fontSize, lineHeight: '1.5', color: '#374151' }}>{line}</span>
        </div>
      ))}
    </div>
  );
}


function renderCustomSections(sections: CustomSection[] | undefined, color: string, borderColor?: string): React.ReactNode {
  if (!sections?.length) return null;
  return (
    <>
      {sections.filter(s => s.title).map((s, idx) => {
        let content: React.ReactNode = null;
        if (s.type === 'text') {
          content = <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{s.content}</div>;
        } else if (s.type === 'bullets') {
          const lines = (s.content || '').split('\n').map(l => l.trim()).filter(Boolean);
          content = lines.length ? (
            <div style={{ margin: '4px 0 0' }}>
              {lines.map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ color, marginTop: '2px', flexShrink: 0, fontSize: '12px' }}>•</span>
                  <span style={{ fontSize: '12px', lineHeight: '1.5', color: '#374151' }}>{line}</span>
                </div>
              ))}
            </div>
          ) : null;
        } else if (s.type === 'table') {
          const cols = s.columns || [];
          const rows = s.rows || [];
          if (!cols.length || !rows.length) return null;
          content = (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '4px' }}>
              <thead>
                <tr>
                  {cols.map((col, ci) => <th key={ci} style={{ border: '1px solid #e5e7eb', padding: '6px 10px', textAlign: 'left', background: '#f9fafb', color: '#374151' }}>{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => <td key={ci} style={{ border: '1px solid #e5e7eb', padding: '6px 10px', color: '#4b5563' }}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        return content ? (
          <Section key={idx} title={s.title} color={color} borderColor={borderColor}>
            {content}
          </Section>
        ) : null;
      })}
    </>
  );
}

function renderReferencesPage(refs: RefEntry[] | undefined, color: string, borderColor?: string, padding = '28px 36px'): React.ReactNode {
  const validRefs = (refs || []).filter(r => r.name);
  if (!validRefs.length) return null;
  return (
    <div className="references-page" style={{ padding }}>
      <Section title="References" color={color} borderColor={borderColor} icon={ICONS.award}>
        {validRefs.map((r, i) => (
          <div key={i} style={{ marginBottom: i < validRefs.length - 1 ? '20px' : 0 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color }}>{r.name}</div>
            {r.title && <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px' }}>{r.title}</div>}
            {r.organisation && <div style={{ fontSize: '12px', color: '#6b7280' }}>{r.organisation}</div>}
            {r.relationship && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{r.relationship}</div>}
            {(r.phone || r.email) && (
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                {[r.phone, r.email].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        ))}
      </Section>
    </div>
  );
}

/* ── Shared UI components ───────────────────────────────────────────────── */

function Section({ title, color, borderColor, icon, children }: { title: string; color?: string; borderColor?: string; icon?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: borderColor ? `2px solid ${borderColor}` : `1px solid ${color || '#1e2a3a'}`, paddingBottom: '6px' }}>
        {icon && <span style={{ fontSize: '16px' }}>{icon}</span>}
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: color || '#1e2a3a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MinimalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>{title}</h3>
      {children}
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }}>{title}</h3>
      {children}
    </div>
  );
}

function SkillRow({ label, items }: { label?: string; items: string[] }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      {label && <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{label}</div>}
      <div style={BUBBLE_WRAP}>
        {items.map((s, i) => (
          <span key={i} style={{ ...BUBBLE_BASE, background: '#f3f4f6', color: '#374151' }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Classic Template ────────────────────────────────────────────────────── */

function ClassicTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      <div style={{ padding: '28px 36px' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1e2a3a', paddingBottom: '16px', marginBottom: '20px' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', marginBottom: '8px' }} />}
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e2a3a', margin: '4px 0' }}>{personal.full_name || 'Your Name'}</h1>
          <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {personal.email && <span>{ICONS.mail} {personal.email}</span>}
            {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
            {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
            {personal.id_number && <span>{ICONS.user} ID: {personal.id_number}</span>}
          </div>
        </div>

        {personal.bio && (
          <Section title="Professional Summary" color="#1e2a3a" icon={ICONS.user}>
            <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{personal.bio}</div>
          </Section>
        )}

        {validEdu.length > 0 && (
          <Section title="Education" color="#1e2a3a" icon={ICONS.graduation}>
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: i < validEdu.length - 1 ? '12px' : 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e2a3a' }}>{e.qualification}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
              </div>
            ))}
          </Section>
        )}

        {validExp.length > 0 && (
          <Section title="Experience" color="#1e2a3a" icon={ICONS.briefcase}>
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '14px' : 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e2a3a' }}>{e.role}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                {renderDescription(e.description, '#374151')}
              </div>
            ))}
          </Section>
        )}

        {(skills?.subjects?.length || skills?.soft_skills?.length) && (
          <Section title="Skills" color="#1e2a3a" icon={ICONS.award}>
            {skills.subjects?.length && <SkillRow label="Subjects" items={skills.subjects} />}
            {skills.soft_skills?.length && <SkillRow label="Soft Skills" items={skills.soft_skills} />}
          </Section>
        )}

        {skills?.languages?.length && <SkillRow label="Languages" items={skills.languages} />}

        {renderCustomSections(data.custom_sections, '#1e2a3a')}

        <PageBreakSpacer />
        {renderReferencesPage(data.references, '#1e2a3a', undefined, '28px 36px')}
      </div>
    </div>
  );
}

/* ── Modern Template ────────────────────────────────────────────────────── */

function ModernTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      {/* Header with teal banner */}
      <div style={{ background: '#0d9488', padding: '24px 32px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        {personal.photo_url ? (
          <img src={personal.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)' }} />
        ) : (
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#fff', fontWeight: 700 }}>
            {(personal.full_name || 'U')[0].toUpperCase()}
          </div>
        )}
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: 0 }}>{personal.full_name || 'Your Name'}</h1>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>Educator</div>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Left sidebar */}
        <div style={{ width: '220px', background: '#f0fdfa', padding: '20px', flexShrink: 0 }}>
          <div style={{ fontSize: '12px', marginBottom: '20px' }}>
            {personal.email && <div style={{ marginBottom: '6px' }}><span>{ICONS.mail}</span> <span style={{ color: '#374151' }}>{personal.email}</span></div>}
            {personal.phone && <div style={{ marginBottom: '6px' }}><span>{ICONS.phone}</span> <span style={{ color: '#374151' }}>{personal.phone}</span></div>}
            {personal.address && <div style={{ marginBottom: '6px' }}><span>{ICONS.mapPin}</span> <span style={{ color: '#374151' }}>{personal.address}</span></div>}
            {personal.id_number && <div style={{ marginBottom: '6px' }}><span>{ICONS.user}</span> <span style={{ color: '#374151' }}>ID: {personal.id_number}</span></div>}
          </div>

          {skills?.subjects?.length && (
            <SidebarSection title="Subjects">
              {skills.subjects.map((s: string, i: number) => <div key={i} style={{ fontSize: '11px', color: '#374151', marginBottom: '4px' }}>• {s}</div>)}
            </SidebarSection>
          )}
          {skills?.languages?.length && (
            <SidebarSection title="Languages">
              {skills.languages.map((l: string, i: number) => <div key={i} style={{ fontSize: '11px', color: '#374151', marginBottom: '4px' }}>• {l}</div>)}
            </SidebarSection>
          )}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, padding: '20px 28px' }}>
          {personal.bio && (
            <MinimalSection title="About Me">
              <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{personal.bio}</div>
            </MinimalSection>
          )}

          {validExp.length > 0 && (
            <MinimalSection title="Experience">
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '14px' : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0d9488' }}>{e.role}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </MinimalSection>
          )}

          {validEdu.length > 0 && (
            <MinimalSection title="Education">
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '10px' : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0d9488' }}>{e.qualification}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                </div>
              ))}
            </MinimalSection>
          )}

          {skills?.soft_skills?.length && (
            <MinimalSection title="Soft Skills">
              <div style={BUBBLE_WRAP}>
                {skills.soft_skills.map((s: string, i: number) => (
                  <span key={i} style={{ ...BUBBLE_BASE, background: '#e6fffa', color: '#0d9488' }}>{s}</span>
                ))}
              </div>
            </MinimalSection>
          )}

          {renderCustomSections(data.custom_sections, '#0d9488')}

          <PageBreakSpacer />
          {renderReferencesPage(data.references, '#0d9488', undefined, '28px 24px')}
        </div>
      </div>
    </div>
  );
}

/* ── Professional Template ───────────────────────────────────────────────── */

function ProfessionalTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      {/* Gradient header */}
      <div style={{ background: 'linear-gradient(135deg, #1e4d2b, #2d7a47)', padding: '28px 36px', textAlign: 'center' }}>
        {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px', border: '3px solid rgba(255,255,255,0.3)' }} />}
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#fff', margin: 0 }}>{personal.full_name || 'Your Name'}</h1>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>Educator</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
          {personal.email && <span>{ICONS.mail} {personal.email}</span>}
          {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
          {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
          {personal.id_number && <span>{ICONS.user} ID: {personal.id_number}</span>}
        </div>
      </div>

      <div style={{ padding: '24px 36px' }}>
        {personal.bio && (
          <Section title="Professional Summary" color="#1e4d2b" borderColor="#2d7a47">
            <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{personal.bio}</div>
          </Section>
        )}

        <div style={{ display: 'flex', gap: '28px' }}>
          {/* Left column */}
          <div style={{ flex: 1 }}>
            {validExp.length > 0 && (
              <Section title="Experience" color="#1e4d2b" borderColor="#2d7a47" icon={ICONS.briefcase}>
                {validExp.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '14px' : 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e4d2b' }}>{e.role}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{e.school}</div>
                    {(e.from || e.to) && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{e.from || ''} – {e.to || ''}</div>}
                    {renderDescription(e.description, '#374151')}
                  </div>
                ))}
              </Section>
            )}
          </div>

          {/* Right column */}
          <div style={{ flex: 1 }}>
            {validEdu.length > 0 && (
              <Section title="Education" color="#1e4d2b" borderColor="#2d7a47" icon={ICONS.graduation}>
                {validEdu.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '12px' : 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e4d2b' }}>{e.qualification}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.institution}</div>
                    {e.year && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{e.year}</div>}
                  </div>
                ))}
              </Section>
            )}

            {skills?.subjects?.length && (
              <Section title="Subjects" color="#1e4d2b" borderColor="#2d7a47">
                {skills.subjects.map((s: string, i: number) => <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '3px' }}>• {s}</div>)}
              </Section>
            )}

            {skills?.soft_skills?.length && (
              <div style={{ marginBottom: '18px' }}>
                <div style={BUBBLE_WRAP}>
                  {skills.soft_skills.map((s: string, i: number) => (
                    <span key={i} style={{ ...BUBBLE_BASE, background: '#ecfdf5', color: '#1e4d2b' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {skills?.languages?.length && (
              <Section title="Languages" color="#1e4d2b" borderColor="#2d7a47">
                {skills.languages.map((l: string, i: number) => <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '3px' }}>• {l}</div>)}
              </Section>
            )}
          </div>
        </div>

        {renderCustomSections(data.custom_sections, '#1e4d2b', '#2d7a47')}

        <PageBreakSpacer />
        {renderReferencesPage(data.references, '#1e4d2b', '#2d7a47', '28px 40px')}
      </div>
    </div>
  );
}

/* ── Minimal Template ────────────────────────────────────────────────────── */

function MinimalTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      <div style={{ padding: '32px 40px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>{personal.full_name || 'Your Name'}</h1>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {personal.email && <span>{personal.email}</span>}
            {personal.phone && <span>{personal.phone}</span>}
            {personal.address && <span>{personal.address}</span>}
          </div>
        </div>

        {personal.bio && (
          <MinimalSection title="Summary">
            <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{personal.bio}</div>
          </MinimalSection>
        )}

        {validExp.length > 0 && (
          <MinimalSection title="Experience">
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '14px' : 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{e.role}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                {renderDescription(e.description, '#374151')}
              </div>
            ))}
          </MinimalSection>
        )}

        {validEdu.length > 0 && (
          <MinimalSection title="Education">
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '10px' : 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{e.qualification}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
              </div>
            ))}
          </MinimalSection>
        )}

        {(skills?.subjects?.length || skills?.soft_skills?.length) && (
          <MinimalSection title="Skills">
            {skills.subjects?.length && <SkillRow label="Subjects" items={skills.subjects} />}
            {skills.soft_skills?.length && <SkillRow label="Soft Skills" items={skills.soft_skills} />}
          </MinimalSection>
        )}

        {skills?.languages?.length && <SkillRow label="Languages" items={skills.languages} />}

        {renderCustomSections(data.custom_sections, '#111827')}

        <PageBreakSpacer />
        {renderReferencesPage(data.references, '#111827', undefined, '28px 40px')}
      </div>
    </div>
  );
}

/* ── Sidebar Template ───────────────────────────────────────────────────── */

function SidebarTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  const initials = (personal.full_name || 'J S').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={wrapperStyle}>
      <div style={{ display: 'flex' }}>
        {/* Left sidebar – blue-grey */}
        <div style={{ width: '220px', background: '#1e3a5f', padding: '20px', flexShrink: 0 }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#fff', fontWeight: 700 }}>
              {initials}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            {personal.email && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '6px' }}>{ICONS.mail} {personal.email}</div>}
            {personal.phone && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '6px' }}>{ICONS.phone} {personal.phone}</div>}
            {personal.address && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '6px' }}>{ICONS.mapPin} {personal.address}</div>}
          </div>

          <SidebarSection title="Skills">
            {skills?.subjects?.map((s: string, i: number) => <div key={i} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>• {s}</div>)}
            {skills?.languages?.length && (
              <>
                <div style={{ marginTop: '8px' }} />
                {skills.languages.map((l: string, i: number) => <div key={i} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>• {l}</div>)}
              </>
            )}
          </SidebarSection>
        </div>

        {/* Right content */}
        <div style={{ flex: 1, padding: '20px 28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e3a5f', margin: '0 0 2px' }}>{personal.full_name || 'John Smith'}</h1>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>Senior Sales Associate</div>

          {personal.bio && (
            <MinimalSection title="Professional Summary">
              <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{personal.bio}</div>
            </MinimalSection>
          )}

          {validExp.length > 0 && (
            <MinimalSection title="Work History">
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '14px' : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e3a5f' }}>{e.role}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </MinimalSection>
          )}

          {validEdu.length > 0 && (
            <MinimalSection title="Education">
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '10px' : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e3a5f' }}>{e.qualification}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                </div>
              ))}
            </MinimalSection>
          )}

          {renderCustomSections(data.custom_sections, '#1e3a5f')}

          <PageBreakSpacer />
          {renderReferencesPage(data.references, '#1e3a5f', undefined, '28px 24px')}
        </div>
      </div>
    </div>
  );
}

/* ── Bold Template ──────────────────────────────────────────────────────── */

function BoldTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      {/* Pink header */}
      <div style={{ background: '#be185d', padding: '24px 32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: 0 }}>{personal.full_name || 'John Smith'}</h1>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>Senior Sales Associate</div>
        {/* Pink divider bar */}
        <div style={{ height: '4px', background: '#ec4899', margin: '12px 0 0', width: '60px' }} />
      </div>

      <div style={{ display: 'flex' }}>
        {/* Left column */}
        <div style={{ width: '200px', background: '#fdf2f8', padding: '20px', flexShrink: 0 }}>
          <div style={{ marginBottom: '20px', fontSize: '12px' }}>
            {personal.email && <div style={{ marginBottom: '6px', color: '#be185d' }}>{ICONS.mail} <span style={{ color: '#4b5563' }}>{personal.email}</span></div>}
            {personal.phone && <div style={{ marginBottom: '6px', color: '#be185d' }}>{ICONS.phone} <span style={{ color: '#4b5563' }}>{personal.phone}</span></div>}
            {personal.address && <div style={{ marginBottom: '6px', color: '#be185d' }}>{ICONS.mapPin} <span style={{ color: '#4b5563' }}>{personal.address}</span></div>}
          </div>

          <SidebarSection title="Skills">
            {skills?.subjects?.map((s: string, i: number) => <div key={i} style={{ fontSize: '11px', color: '#4b5563', marginBottom: '4px' }}>• {s}</div>)}
          </SidebarSection>
        </div>

        {/* Right column */}
        <div style={{ flex: 1, padding: '20px 28px' }}>
          {personal.bio && (
            <MinimalSection title="Professional Summary">
              <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{personal.bio}</div>
            </MinimalSection>
          )}

          {validExp.length > 0 && (
            <MinimalSection title="Work History">
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '14px' : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#be185d' }}>{e.role}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </MinimalSection>
          )}

          {validEdu.length > 0 && (
            <MinimalSection title="Education">
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '10px' : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#be185d' }}>{e.qualification}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                </div>
              ))}
            </MinimalSection>
          )}

          {renderCustomSections(data.custom_sections, '#be185d')}

          <PageBreakSpacer />
          {renderReferencesPage(data.references, '#be185d', undefined, '28px 24px')}
        </div>
      </div>
    </div>
  );
}

/* ── Executive Template ─────────────────────────────────────────────────── */

function ExecutiveTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      {/* Burgundy header */}
      <div style={{ background: '#7f1d1d', padding: '28px 36px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#fff', margin: 0 }}>{personal.full_name || 'John Smith'}</h1>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>Senior Sales Associate</div>
        {/* Contact icon row */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
          {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
          {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
          {personal.email && <span>{ICONS.mail} {personal.email}</span>}
        </div>
      </div>

      <div style={{ padding: '24px 36px' }}>
        <div style={{ display: 'flex', gap: '28px' }}>
          {/* Left */}
          <div style={{ flex: 1 }}>
            {personal.bio && (
              <Section title="Professional Summary" color="#7f1d1d" borderColor="#991b1b">
                <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{personal.bio}</div>
              </Section>
            )}

            {validExp.length > 0 && (
              <Section title="Work History" color="#7f1d1d" borderColor="#991b1b" icon={ICONS.briefcase}>
                {validExp.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '14px' : 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#7f1d1d' }}>{e.role}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                    {renderDescription(e.description, '#374151')}
                  </div>
                ))}
              </Section>
            )}

            {validEdu.length > 0 && (
              <Section title="Education" color="#7f1d1d" borderColor="#991b1b" icon={ICONS.graduation}>
                {validEdu.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '10px' : 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#7f1d1d' }}>{e.qualification}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                  </div>
                ))}
              </Section>
            )}
          </div>

          {/* Right */}
          <div style={{ flex: 1 }}>
            {skills?.subjects?.length && (
              <Section title="Skills" color="#7f1d1d" borderColor="#991b1b" icon={ICONS.award}>
                {skills.subjects.map((s: string, i: number) => <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '3px' }}>• {s}</div>)}
              </Section>
            )}
            {skills?.soft_skills?.length && (
              <div style={{ marginBottom: '18px' }}>
                <div style={BUBBLE_WRAP}>
                  {skills.soft_skills.map((s: string, i: number) => (
                    <span key={i} style={{ ...BUBBLE_BASE, background: '#fef2f2', color: '#7f1d1d' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {skills?.languages?.length && (
              <Section title="Languages" color="#7f1d1d" borderColor="#991b1b" icon={ICONS.languages}>
                {skills.languages.map((l: string, i: number) => <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '3px' }}>• {l}</div>)}
              </Section>
            )}
          </div>
        </div>

        {renderCustomSections(data.custom_sections, '#7f1d1d', '#991b1b')}

        <PageBreakSpacer />
        {renderReferencesPage(data.references, '#7f1d1d', '#991b1b', '28px 40px')}
      </div>
    </div>
  );
}

/* ── Corporate Template ─────────────────────────────────────────────────── */

function CorporateTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      <div style={{ display: 'flex' }}>
        {/* Dark navy sidebar */}
        <div style={{ width: '220px', background: '#0f172a', padding: '20px', flexShrink: 0 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: '0 0 2px', lineHeight: '1.2' }}>
            {personal.full_name?.split(' ').map((n: string, i: number) => <span key={i}>{n}<br /></span>) || 'John\nSmith'}
          </h2>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px', marginBottom: '20px' }}>Sales Associate</div>

          <div style={{ marginBottom: '20px' }}>
            {personal.email && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>{ICONS.mail} {personal.email}</div>}
            {personal.phone && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>{ICONS.phone} {personal.phone}</div>}
            {personal.address && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>{ICONS.mapPin} {personal.address}</div>}
          </div>

          <SidebarSection title="Skills">
            {skills?.subjects?.map((s: string, i: number) => <div key={i} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• {s}</div>)}
          </SidebarSection>

          <SidebarSection title="Languages">
            {skills?.languages?.map((l: string, i: number) => <div key={i} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>• {l}</div>)}
          </SidebarSection>
        </div>

        {/* White content area */}
        <div style={{ flex: 1, padding: '20px 28px' }}>
          {personal.bio && (
            <MinimalSection title="Professional Summary">
              <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{personal.bio}</div>
            </MinimalSection>
          )}

          {validExp.length > 0 && (
            <MinimalSection title="Work History">
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '14px' : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{e.role}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </MinimalSection>
          )}

          {validEdu.length > 0 && (
            <MinimalSection title="Education">
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '10px' : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{e.qualification}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                </div>
              ))}
            </MinimalSection>
          )}

          {skills?.soft_skills?.length && (
            <div style={{ marginBottom: '18px' }}>
              <div style={BUBBLE_WRAP}>
                {skills.soft_skills.map((s: string, i: number) => (
                  <span key={i} style={{ ...BUBBLE_BASE, background: '#f1f5f9', color: '#0f172a' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {renderCustomSections(data.custom_sections, '#0f172a')}

          <PageBreakSpacer />
          {renderReferencesPage(data.references, '#0f172a', undefined, '28px 24px')}
        </div>
      </div>
    </div>
  );
}

