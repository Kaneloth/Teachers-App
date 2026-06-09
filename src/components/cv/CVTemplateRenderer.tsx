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
  return <div ref={ref} style={{ height }} />;
}

export default function CVTemplateRenderer({ data, forExport = false, watermark = false }: Props) {
  const { template } = data;
  const wrapperStyle: React.CSSProperties = forExport
    ? { width: '794px', minHeight: '1123px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', background: '#fff' }
    : { width: '100%', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.10)', borderRadius: '4px', overflow: 'hidden' };

  const validEdu = (data.education || []).filter(e => e.institution);
  const validExp = (data.experience || []).filter(e => e.school);

  const tmpl =
    template === 'modern'       ? <ModernTemplate       data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'professional' ? <ProfessionalTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'minimal'      ? <MinimalTemplate      data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'sidebar'      ? <SidebarTemplate      data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'bold'         ? <BoldTemplate         data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'executive'    ? <ExecutiveTemplate    data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    template === 'corporate'    ? <CorporateTemplate    data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} /> :
    <ClassicTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;

  return (
    <div style={{ position: 'relative' }}>
      {tmpl}
      {watermark && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '1087px',
          height: '36px',
          background: '#1e2a3a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '11px',
          fontWeight: '500',
          letterSpacing: '0.4px',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px' }}>✦</span>
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>Created FREE at</span>
          <a
            href="https://www.crosssa.co.za"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '700' }}
          >
            www.crosssa.co.za
          </a>
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>— Connecting SA Educators</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px' }}>✦</span>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function renderDescription(desc: string | undefined, color: string, fontSize = '12px'): React.ReactNode {
  if (!desc) return null;
  const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div style={{ margin: '4px 0 0' }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '2px' }}>
          <span style={{ color, marginTop: '2px', flexShrink: 0, fontSize }}>•</span>
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
          content = <p style={{ color: '#374151', margin: 0, fontSize: '12px', lineHeight: '1.6' }}>{s.content}</p>;
        } else if (s.type === 'bullets') {
          const lines = (s.content || '').split('\n').map(l => l.trim()).filter(Boolean);
          content = lines.length ? (
            <div style={{ margin: 0 }}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>{cols.map((col, ci) => <th key={ci} style={{ background: color, color: '#fff', padding: '6px 10px', textAlign: 'left', fontWeight: '700', fontSize: '10px', letterSpacing: '0.5px' }}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? '#f9fafb' : '#fff' }}>
                    {row.map((cell, ci) => <td key={ci} style={{ padding: '6px 10px', color: '#374151', borderBottom: '1px solid #e5e7eb', fontSize: '11px' }}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        return content ? <Section key={idx} title={s.title} color={color} borderColor={borderColor}>{content}</Section> : null;
      })}
    </>
  );
}

function renderReferencesPage(refs: RefEntry[] | undefined, color: string, borderColor?: string, padding = '28px 36px'): React.ReactNode {
  const validRefs = (refs || []).filter(r => r.name);
  if (!validRefs.length) return null;
  return (
    <div className="references-page" style={{ padding, background: '#fff', lineHeight: '1.6', minHeight: '200px' }}>
      <Section title="References" color={color} borderColor={borderColor} icon="📌">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px 28px' }}>
          {validRefs.map((r, i) => (
            <div key={i}>
              <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{r.name}</div>
              {r.title        && <div style={{ color: '#374151', fontSize: '12px' }}>{r.title}</div>}
              {r.organisation && <div style={{ color: '#6b7280', fontSize: '12px' }}>{r.organisation}</div>}
              {r.relationship && <div style={{ color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>{r.relationship}</div>}
              {(r.phone || r.email) && (
                <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '3px' }}>
                  {[r.phone, r.email].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ── Shared UI components ───────────────────────────────────────────────── */
function Section({ title, color, borderColor, icon, children }: { title: string; color?: string; borderColor?: string; icon?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Use grid: icon (auto), text (auto), line (1fr) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto auto 1fr',
        alignItems: 'bottom',
        gap: '8px',
        marginBottom: '8px',
      }}>
        {icon && <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>}
        <span style={{
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: color || '#1e2a3a',
          lineHeight: 1,
        }}>{title}</span>
        <div style={{ height: '1px', background: borderColor || color || '#1e2a3a' }} />
      </div>
      {children}
    </div>
  );
}

function MinimalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#6b7280', marginBottom: '12px' }}>{title}</div>
      {children}
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.55)', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }}>{title}</div>
      {children}
    </div>
  );
}

// ── NEW: Bullet list component for skills/subjects/languages (no bubbles) ──
function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: '4px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
          <span style={{ marginTop: '2px', flexShrink: 0, fontSize: '12px', color: '#374151' }}>•</span>
          <span style={{ fontSize: '12px', lineHeight: '1.5', color: '#374151' }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Classic Template ────────────────────────────────────────────────────── */
function ClassicTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle, position: 'relative' }}>
      <div style={{ background: '#1e2a3a', color: '#fff', padding: '28px 36px 22px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '8px', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />}
        <div>
          <div style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>{personal.full_name || 'Your Name'}</div>
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#a0aec0', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {personal.email && <span>{ICONS.mail} {personal.email}</span>}
            {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
            {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
            {personal.id_number && <span>{ICONS.user} ID: {personal.id_number}</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 36px', lineHeight: '1.6' }}>
        {personal.bio && <Section title="Professional Summary" color="#1e2a3a" icon="📄"><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
        {validEdu.length > 0 && <Section title="Education" color="#1e2a3a" icon={ICONS.graduation}>
          {validEdu.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <div style={{ fontWeight: '600', color: '#111827' }}>{e.qualification}</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
            </div>
          ))}
        </Section>}
        {validExp.length > 0 && <Section title="Teaching Experience" color="#1e2a3a" icon={ICONS.briefcase}>
          {validExp.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: '16px', borderLeft: '3px solid #1e2a3a', paddingLeft: '12px' }}>
              <div style={{ fontWeight: '600', color: '#111827' }}>{e.role}</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
              {renderDescription(e.description, '#374151')}
            </div>
          ))}
        </Section>}
        {(skills?.subjects?.length || skills?.soft_skills?.length) && <Section title="Skills & Subjects" color="#1e2a3a" icon={ICONS.award}>
          {skills.subjects?.length && <div><div style={{ fontWeight: '700', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>Subjects</div><BulletList items={skills.subjects} /></div>}
          {skills.soft_skills?.length && <div style={{ marginTop: '12px' }}><div style={{ fontWeight: '700', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>Skills</div><BulletList items={skills.soft_skills} /></div>}
        </Section>}
        {skills?.languages?.length && <Section title="Languages" color="#1e2a3a" icon={ICONS.languages}>
          <BulletList items={skills.languages} />
        </Section>}
        {renderCustomSections(data.custom_sections, '#1e2a3a')}
      </div>

      <PageBreakSpacer />
      {renderReferencesPage(data.references, '#1e2a3a', undefined, '28px 36px')}
    </div>
  );
}

/* ── Modern Template ────────────────────────────────────────────────────── */
function ModernTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle, display: 'flex', flexDirection: 'column', minHeight: '1123px' }}>
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ background: '#0d9488', color: '#fff', width: '200px', minWidth: '200px', padding: '28px 18px', boxSizing: 'border-box' }}>
          {personal.photo_url ? <img src={personal.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', margin: '0 auto 14px', display: 'block' }} /> : <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '28px', fontWeight: '700', color: '#fff' }}>{(personal.full_name || 'U')[0].toUpperCase()}</div>}
          <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>{personal.full_name || 'Your Name'}</div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginBottom: '20px' }}>Educator</div>
          <SidebarSection title="Contact">
            {personal.email && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.mail} {personal.email}</div>}
            {personal.phone && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.phone} {personal.phone}</div>}
            {personal.address && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.mapPin} {personal.address}</div>}
            {personal.id_number && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.user} ID: {personal.id_number}</div>}
          </SidebarSection>
          {skills?.subjects?.length && <SidebarSection title="Subjects"><BulletList items={skills.subjects} /></SidebarSection>}
          {skills?.languages?.length && <SidebarSection title="Languages"><BulletList items={skills.languages} /></SidebarSection>}
        </div>
        <div style={{ flex: 1, padding: '28px 24px' }}>
          {personal.bio && <Section title="About Me" color="#0d9488"><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
          {validExp.length > 0 && <Section title="Teaching Experience" color="#0d9488" icon={ICONS.briefcase}>
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '16px', borderLeft: '2px solid #0d9488', paddingLeft: '12px' }}>
                <div style={{ fontWeight: '600', color: '#111827' }}>{e.role}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                {renderDescription(e.description, '#374151')}
              </div>
            ))}
          </Section>}
          {validEdu.length > 0 && <Section title="Education" color="#0d9488" icon={ICONS.graduation}>
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: '600', color: '#111827' }}>{e.qualification}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
              </div>
            ))}
          </Section>}
          {skills?.soft_skills?.length && <Section title="Professional Skills" color="#0d9488" icon={ICONS.award}>
            <BulletList items={skills.soft_skills} />
          </Section>}
          {renderCustomSections(data.custom_sections, '#0d9488')}
        </div>
      </div>

      <PageBreakSpacer />
      {renderReferencesPage(data.references, '#0d9488', undefined, '28px 24px')}
    </div>
  );
}

/* ── Professional Template ───────────────────────────────────────────────── */
function ProfessionalTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      <div style={{ background: 'linear-gradient(135deg, #1e4d2b 0%, #2d7a47 100%)', padding: '32px 40px', color: '#fff', display: 'flex', alignItems: 'center', gap: '24px' }}>
        {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />}
        <div>
          <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{personal.full_name || 'Your Name'}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase' }}>Educator</div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>
            {personal.email && <span>{ICONS.mail} {personal.email}</span>}
            {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
            {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
            {personal.id_number && <span>{ICONS.user} ID: {personal.id_number}</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: '28px 40px', lineHeight: '1.65' }}>
        {personal.bio && <Section title="Professional Profile" color="#1e4d2b" borderColor="#2d7a47"><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          <div>
            {validExp.length > 0 && <Section title="Teaching Experience" color="#1e4d2b" borderColor="#2d7a47" icon={ICONS.briefcase}>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{e.role}</div>
                  <div style={{ color: '#2d7a47', fontSize: '12px', fontWeight: '600' }}>{e.school}</div>
                  {(e.from || e.to) && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.from || ''} – {e.to || ''}</div>}
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </Section>}
          </div>
          <div>
            {validEdu.length > 0 && <Section title="Education" color="#1e4d2b" borderColor="#2d7a47" icon={ICONS.graduation}>
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{e.qualification}</div>
                  <div style={{ color: '#2d7a47', fontSize: '12px' }}>{e.institution}</div>
                  {e.year && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.year}</div>}
                </div>
              ))}
            </Section>}
            {skills?.subjects?.length && <Section title="Subjects Taught" color="#1e4d2b" borderColor="#2d7a47" icon={ICONS.bookOpen}>
              <BulletList items={skills.subjects} />
            </Section>}
            {skills?.soft_skills?.length && <Section title="Skills" color="#1e4d2b" borderColor="#2d7a47" icon={ICONS.award}>
              <BulletList items={skills.soft_skills} />
            </Section>}
            {skills?.languages?.length && <Section title="Languages" color="#1e4d2b" borderColor="#2d7a47" icon={ICONS.languages}>
              <BulletList items={skills.languages} />
            </Section>}
          </div>
        </div>
        {renderCustomSections(data.custom_sections, '#1e4d2b', '#2d7a47')}
      </div>

      <PageBreakSpacer />
      {renderReferencesPage(data.references, '#1e4d2b', '#2d7a47', '28px 40px')}
    </div>
  );
}

/* ── Minimal Template ────────────────────────────────────────────────────── */
function MinimalTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      <div style={{ padding: '40px 44px', lineHeight: '1.7' }}>
        <div style={{ borderBottom: '2px solid #111827', paddingBottom: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '76px', height: '76px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: '30px', fontWeight: '300', letterSpacing: '3px', textTransform: 'uppercase', color: '#111827' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {personal.email && <span>{ICONS.mail} {personal.email}</span>}
              {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
              {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
              {personal.id_number && <span>{ICONS.user} ID: {personal.id_number}</span>}
            </div>
          </div>
        </div>
        {personal.bio && <MinimalSection title="Summary"><p style={{ color: '#4b5563', margin: 0, fontSize: '12px' }}>{personal.bio}</p></MinimalSection>}
        {validExp.length > 0 && <MinimalSection title="Experience">
          {validExp.map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
              <div style={{ width: '90px', fontSize: '11px', color: '#9ca3af', paddingTop: '2px' }}>{e.from && e.to ? `${e.from} – ${e.to}` : e.from || e.to || ''}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{e.role}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.school}</div>
                {renderDescription(e.description, '#4b5563')}
              </div>
            </div>
          ))}
        </MinimalSection>}
        {validEdu.length > 0 && <MinimalSection title="Education">
          {validEdu.map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
              <div style={{ width: '90px', fontSize: '11px', color: '#9ca3af', paddingTop: '2px' }}>{e.year || ''}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{e.qualification}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}</div>
              </div>
            </div>
          ))}
        </MinimalSection>}
        {(skills?.subjects?.length || skills?.soft_skills?.length || skills?.languages?.length) && <MinimalSection title="Skills & Languages">
          {skills.subjects?.length && <div><strong>Subjects: </strong><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.subjects.join(' · ')}</span></div>}
          {skills.soft_skills?.length && <div><strong>Skills: </strong><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.soft_skills.join(' · ')}</span></div>}
          {skills.languages?.length && <div><strong>Languages: </strong><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.languages.join(' · ')}</span></div>}
        </MinimalSection>}
        {renderCustomSections(data.custom_sections, '#111827')}
      </div>

      <PageBreakSpacer />
      {renderReferencesPage(data.references, '#111827', undefined, '40px 44px')}
    </div>
  );
}

/* ── Sidebar Template ────────────────────────────────────────────────────── */
function SidebarTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  const sideColor = '#3b5998';
  return (
    <div style={{ ...wrapperStyle, display: 'flex', flexDirection: 'column', minHeight: '1123px' }}>
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ background: sideColor, color: '#fff', width: '210px', minWidth: '210px', padding: '28px 18px', boxSizing: 'border-box' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '26px', fontWeight: '800', color: sideColor }}>{(personal.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div>
          <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: '700', marginBottom: '3px' }}>{personal.full_name || 'Your Name'}</div>
          <div style={{ textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.65)', marginBottom: '20px' }}>Educator</div>
          <SidebarSection title="Contact">
            {personal.email && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.mail} {personal.email}</div>}
            {personal.phone && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.phone} {personal.phone}</div>}
            {personal.address && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.mapPin} {personal.address}</div>}
            {personal.id_number && <div>{ICONS.user} ID: {personal.id_number}</div>}
          </SidebarSection>
          {skills?.subjects?.length && <SidebarSection title="Subjects"><BulletList items={skills.subjects} /></SidebarSection>}
          {skills?.languages?.length && <SidebarSection title="Languages"><BulletList items={skills.languages} /></SidebarSection>}
          {skills?.soft_skills?.length && <SidebarSection title="Skills"><BulletList items={skills.soft_skills} /></SidebarSection>}
        </div>
        <div style={{ flex: 1, padding: '28px 24px' }}>
          {personal.bio && <Section title="About Me" color={sideColor}><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
          {validExp.length > 0 && <Section title="Work History" color={sideColor} icon={ICONS.briefcase}>
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', color: '#111827' }}>{e.role}</div>
                <div style={{ color: sideColor, fontSize: '12px', fontWeight: '600' }}>{e.school}</div>
                {(e.from || e.to) && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.from || ''} – {e.to || ''}</div>}
                {renderDescription(e.description, '#374151')}
              </div>
            ))}
          </Section>}
          {validEdu.length > 0 && <Section title="Education" color={sideColor} icon={ICONS.graduation}>
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: '600', color: '#111827' }}>{e.qualification}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
              </div>
            ))}
          </Section>}
          {renderCustomSections(data.custom_sections, sideColor)}
        </div>
      </div>

      <PageBreakSpacer />
      {renderReferencesPage(data.references, sideColor, undefined, '28px 24px')}
    </div>
  );
}

/* ── Bold Template ───────────────────────────────────────────────────────── */
function BoldTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  const accent = '#c2185b';
  return (
    <div style={wrapperStyle}>
      <div style={{ background: accent, color: '#fff', padding: '28px 32px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '1px' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginTop: '4px', letterSpacing: '2px', textTransform: 'uppercase' }}>Educator</div>
          </div>
        </div>
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.3)', margin: '16px 0 12px' }} />
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>
          {personal.email && <span>{ICONS.mail} {personal.email}</span>}
          {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
          {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
          {personal.id_number && <span>{ICONS.user} ID: {personal.id_number}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', padding: '24px 32px', gap: '28px', lineHeight: '1.6' }}>
        <div style={{ flex: 1 }}>
          {personal.bio && <Section title="Summary" color={accent}><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
          {validExp.length > 0 && <Section title="Experience" color={accent} icon={ICONS.briefcase}>
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', color: '#111827' }}>{e.role}</div>
                <div style={{ color: accent, fontSize: '12px', fontWeight: '600' }}>{e.school}</div>
                {(e.from || e.to) && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.from || ''} – {e.to || ''}</div>}
                {renderDescription(e.description, '#374151')}
              </div>
            ))}
          </Section>}
          {renderCustomSections(data.custom_sections, accent)}
        </div>
        <div style={{ width: '180px', flexShrink: 0 }}>
          {validEdu.length > 0 && <Section title="Education" color={accent} icon={ICONS.graduation}>
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: '600', color: '#111827', fontSize: '12px' }}>{e.qualification}</div>
                <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
              </div>
            ))}
          </Section>}
          {skills?.subjects?.length && <Section title="Subjects" color={accent} icon={ICONS.bookOpen}>
            <BulletList items={skills.subjects} />
          </Section>}
          {skills?.soft_skills?.length && <Section title="Skills" color={accent} icon={ICONS.award}>
            <BulletList items={skills.soft_skills} />
          </Section>}
          {skills?.languages?.length && <Section title="Languages" color={accent} icon={ICONS.languages}>
            <BulletList items={skills.languages} />
          </Section>}
        </div>
      </div>

      <PageBreakSpacer />
      {renderReferencesPage(data.references, accent, undefined, '24px 32px')}
    </div>
  );
}

/* ── Executive Template ──────────────────────────────────────────────────── */
function ExecutiveTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  const accent = '#6b1a1a';
  const light = '#8b2424';
  return (
    <div style={wrapperStyle}>
      <div style={{ background: `linear-gradient(135deg, ${accent} 0%, ${light} 100%)`, color: '#fff', padding: '36px 44px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.35)', flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase' }}>Educator</div>
          </div>
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.25)', margin: '18px 0 14px' }} />
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>
          {personal.email && <span>{ICONS.mail} {personal.email}</span>}
          {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
          {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
          {personal.id_number && <span>{ICONS.user} ID: {personal.id_number}</span>}
        </div>
      </div>
      <div style={{ padding: '28px 44px', lineHeight: '1.65' }}>
        {personal.bio && <Section title="Executive Profile" color={accent}><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 36px' }}>
          <div>
            {validExp.length > 0 && <Section title="Teaching Experience" color={accent} icon={ICONS.briefcase}>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{e.role}</div>
                  <div style={{ color: light, fontSize: '12px', fontWeight: '600' }}>{e.school}</div>
                  {(e.from || e.to) && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.from || ''} – {e.to || ''}</div>}
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </Section>}
            {renderCustomSections(data.custom_sections, accent)}
          </div>
          <div>
            {validEdu.length > 0 && <Section title="Education" color={accent} icon={ICONS.graduation}>
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{e.qualification}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                </div>
              ))}
            </Section>}
            {skills?.subjects?.length && <Section title="Subjects" color={accent} icon={ICONS.bookOpen}>
              <BulletList items={skills.subjects} />
            </Section>}
            {skills?.soft_skills?.length && <Section title="Skills" color={accent} icon={ICONS.award}>
              <BulletList items={skills.soft_skills} />
            </Section>}
            {skills?.languages?.length && <Section title="Languages" color={accent} icon={ICONS.languages}>
              <BulletList items={skills.languages} />
            </Section>}
          </div>
        </div>
      </div>

      <PageBreakSpacer />
      {renderReferencesPage(data.references, accent, undefined, '28px 44px')}
    </div>
  );
}

/* ── Corporate Template ──────────────────────────────────────────────────── */
function CorporateTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  const navy = '#1a2a4a';
  return (
    <div style={{ ...wrapperStyle, display: 'flex', flexDirection: 'column', minHeight: '1123px' }}>
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ background: navy, color: '#fff', width: '210px', minWidth: '210px', padding: '32px 18px', boxSizing: 'border-box' }}>
          <div style={{ width: '76px', height: '76px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '26px', fontWeight: '800', color: '#fff' }}>{(personal.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div>

          <SidebarSection title="Contact">
            {personal.email && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.mail} {personal.email}</div>}
            {personal.phone && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.phone} {personal.phone}</div>}
            {personal.address && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.mapPin} {personal.address}</div>}
            {personal.id_number && <div>{ICONS.user} ID: {personal.id_number}</div>}
          </SidebarSection>
          {skills?.subjects?.length && <SidebarSection title="Subjects"><BulletList items={skills.subjects} /></SidebarSection>}
          {skills?.soft_skills?.length && <SidebarSection title="Skills"><BulletList items={skills.soft_skills} /></SidebarSection>}
          {skills?.languages?.length && <SidebarSection title="Languages"><BulletList items={skills.languages} /></SidebarSection>}
        </div>
        <div style={{ flex: 1, padding: '32px 28px' }}>
          <div style={{ borderBottom: `3px solid ${navy}`, paddingBottom: '10px', marginBottom: '22px' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: navy, letterSpacing: '1px' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ textAlign: 'left', fontSize: '10px', color: '#6b7280', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '22px' }}>Educator</div>
          </div>
          {personal.bio && <Section title="Professional Summary" color={navy}><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
          {validExp.length > 0 && <Section title="Work Experience" color={navy} icon={ICONS.briefcase}>
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', color: '#111827' }}>{e.role}</div>
                <div style={{ color: navy, fontSize: '12px', fontWeight: '600' }}>{e.school}</div>
                {(e.from || e.to) && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.from || ''} – {e.to || ''}</div>}
                {renderDescription(e.description, '#374151')}
              </div>
            ))}
          </Section>}
          {validEdu.length > 0 && <Section title="Education" color={navy} icon={ICONS.graduation}>
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: '600', color: '#111827' }}>{e.qualification}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
              </div>
            ))}
          </Section>}
          {renderCustomSections(data.custom_sections, navy)}
        </div>
      </div>

      <PageBreakSpacer />
      {renderReferencesPage(data.references, navy, undefined, '32px 28px')}
    </div>
  );
}