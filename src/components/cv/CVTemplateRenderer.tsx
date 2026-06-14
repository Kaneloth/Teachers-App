import { ReactNode } from 'react';

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

interface Props { data: CVData; forExport?: boolean; watermark?: boolean; cvType?: 'educator' | 'general' }

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
 * FIX: Replaced broken JS PageBreakSpacer with proper `.cv-page` div wrappers.
 *
 * The old PageBreakSpacer used offsetParent traversal which fails when the
 * container is positioned off-screen (left: -9999px) — offsetParent is null,
 * so the measured top was always 0 and the spacer height was always 0.
 *
 * The new approach wraps each logical A4 page in a `cv-page` div with a fixed
 * height of 1123px. cvExport.ts already knows to use these divs for slicing.
 * References get their own cv-page div on a fresh page.
 *
 * Page 1 wrapper — exactly one A4 page tall. Content that fits inside is safe.
 */
const A4_PAGE_H_PX = 1123;

export default function CVTemplateRenderer({ data, forExport = false, watermark = false, cvType }: Props) {
  const { template } = data;
  const TEMPLATE_FONTS: Record<string, string> = {
    'classic': "'Inter', Arial, Helvetica, sans-serif",
    'modern': "'Inter', Arial, Helvetica, sans-serif",
    'professional': "Arial, Helvetica, sans-serif",
    'minimal': "'Trebuchet MS', Arial, sans-serif",
    'sidebar': "Arial, Helvetica, sans-serif",
    'bold': "'Arial Black', Arial, sans-serif",
    'corporate': "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif",
    'stylish': "Arial, Helvetica, sans-serif",
    'boxed': "Arial, Helvetica, sans-serif",
    'navy': "Arial, Helvetica, sans-serif",
    'timeline': "'Trebuchet MS', Arial, sans-serif",
    'shaded': "Arial, Helvetica, sans-serif",
    'teal': "Arial, Helvetica, sans-serif",
    'sage': "'Segoe UI', Arial, sans-serif",
    'executive': "Georgia, 'Times New Roman', serif",
    'traditional': "Georgia, 'Times New Roman', serif",
    'crimson': "Georgia, 'Times New Roman', serif",
    'elegant': "Georgia, 'Times New Roman', serif",
    'heritage': "Georgia, 'Times New Roman', serif",
  };
  const templateFont = TEMPLATE_FONTS[template] || 'Arial, Helvetica, sans-serif';

  const wrapperStyle: React.CSSProperties = forExport
    ? { width: '794px', fontFamily: templateFont, fontSize: '13px', background: '#fff' }
    : { width: '100%', fontFamily: templateFont, fontSize: '13px', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.10)', borderRadius: '4px', overflow: 'hidden' };

  const validEdu = (data.education || []).filter(e => e.institution);
  const validExp = (data.experience || []).filter(e => e.school);
  // For general users, 'subjects' holds Key Skills — don't label them as educator subjects
  const isEducatorCV = cvType === 'educator' || cvType === undefined;
  const skillsLabel  = isEducatorCV ? 'Subjects Taught' : 'Key Skills';
  const subjectsLabel = isEducatorCV ? 'Subjects' : 'Key Skills';

  const expLabel = isEducatorCV ? 'Teaching Experience' : 'Work Experience';
  const T = { data, wrapperStyle, validEdu, validExp, watermark, skillsLabel, subjectsLabel, expLabel };
  const tmpl =
    template === 'modern'       ? <ModernTemplate       {...T} /> :
    template === 'professional' ? <ProfessionalTemplate {...T} /> :
    template === 'minimal'      ? <MinimalTemplate      {...T} /> :
    template === 'sidebar'      ? <SidebarTemplate      {...T} /> :
    template === 'bold'         ? <BoldTemplate         {...T} /> :
    template === 'executive'    ? <ExecutiveTemplate    {...T} /> :
    template === 'corporate'    ? <CorporateTemplate    {...T} /> :
    template === 'stylish'      ? <StylishTemplate      {...T} /> :
    template === 'boxed'        ? <BoxedTemplate        {...T} /> :
    template === 'traditional'  ? <TraditionalTemplate  {...T} /> :
    template === 'navy'         ? <NavyTemplate         {...T} /> :
    template === 'timeline'     ? <TimelineTemplate     {...T} /> :
    template === 'shaded'       ? <ShadedTemplate       {...T} /> :
    template === 'teal'         ? <TealTemplate         {...T} /> :
    template === 'crimson'      ? <CrimsonTemplate      {...T} /> :
    template === 'sage'         ? <SageTemplate         {...T} /> :
    template === 'elegant'      ? <ElegantTemplate      {...T} /> :
    template === 'heritage'     ? <HeritageTemplate     {...T} /> :
    <ClassicTemplate {...T} />;

  return <>{tmpl}</>;
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

/**
 * FIX: renderReferencesPage now uses className="cv-page" so cvExport.ts
 * correctly treats it as a separate page slice. Previously it used
 * className="references-page" which the exporter ignored — falling back to
 * the content-aware slicer that could cut right through reference cards.
 *
 * Also adds the watermark INSIDE the references page so it appears at the
 * bottom of that page, not floating at a hardcoded pixel offset.
 */
function renderReferencesPage(
  refs: RefEntry[] | undefined,
  color: string,
  watermark: boolean,
  borderColor?: string,
  padding = '28px 36px',
): React.ReactNode {
  const validRefs = (refs || []).filter(r => r.name);
  if (!validRefs.length) return null;
  return (
    <div
      className="cv-page"
      style={{
        width: '794px',
        minHeight: `${A4_PAGE_H_PX}px`,
        boxSizing: 'border-box',
        background: '#fff',
        position: 'relative',
        padding,
        lineHeight: '1.6',
      }}
    >
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

      {/* Watermark anchored to the bottom of THIS page */}
      {watermark && <WatermarkBar />}
    </div>
  );
}

/**
 * FIX: Watermark is now a component that sits at the bottom of whichever
 * page it is rendered in, using absolute positioning within a relative parent.
 * Previously it was absolutely positioned on the outer wrapper at top:1087px
 * which only worked for single-page CVs.
 */
function WatermarkBar() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
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
  );
}

/* ── Shared UI components ───────────────────────────────────────────────── */
function Section({ title, color, borderColor, icon, children, titleStyle }: { title: string; color?: string; borderColor?: string; icon?: string; children: React.ReactNode; titleStyle?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: '32px', overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', lineHeight: 1 }}>
        {icon && (
          <span style={{
            fontSize: '14px',
            lineHeight: 1,
            display: 'inline-block',
            verticalAlign: 'middle',
            position: 'relative',
            top: '-5px',
          }}>
            {icon}
          </span>
        )}
        <span style={{
          fontSize: '15px',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          color: color || '#111',
          lineHeight: 1,
          display: 'inline-block',
          ...titleStyle,
        }}>
          {title}
        </span>
        <div style={{ flex: 1, height: '1px', background: borderColor || color || '#e5e7eb', marginLeft: '6px' }} />
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
function ClassicTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      {/* PAGE 1 */}
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
        }}
      >
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
          {validExp.length > 0 && <Section title={expLabel} color="#1e2a3a" icon={ICONS.briefcase}>
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
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#1e2a3a', watermark, undefined, '28px 36px')}
    </div>
  );
}

/* ── Modern Template ────────────────────────────────────────────────────── */
function ModernTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      {/* PAGE 1 */}
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
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
            {skills?.subjects?.length && <SidebarSection title={subjectsLabel}><BulletList items={skills.subjects} /></SidebarSection>}
            {skills?.languages?.length && <SidebarSection title="Languages"><BulletList items={skills.languages} /></SidebarSection>}
          </div>
          <div style={{ flex: 1, padding: '28px 24px' }}>
            {personal.bio && <Section title="About Me" color="#0d9488"><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
            {validExp.length > 0 && <Section title={expLabel} color="#0d9488" icon={ICONS.briefcase}>
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
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#0d9488', watermark, undefined, '28px 24px')}
    </div>
  );
}

/* ── Professional Template ───────────────────────────────────────────────── */
function ProfessionalTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
        }}
      >
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
              {validExp.length > 0 && <Section title={expLabel} color="#1e4d2b" borderColor="#2d7a47" icon={ICONS.briefcase}>
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
              {skills?.subjects?.length && <Section title={skillsLabel} color="#1e4d2b" borderColor="#2d7a47" icon={ICONS.bookOpen}>
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
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#1e4d2b', watermark, '#2d7a47', '28px 40px')}
    </div>
  );
}

/* ── Minimal Template ────────────────────────────────────────────────────── */
function MinimalTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
        }}
      >
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
            {skills.subjects?.length && <div><strong>{subjectsLabel}: </strong><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.subjects.join(' · ')}</span></div>}
            {skills.soft_skills?.length && <div><strong>Skills: </strong><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.soft_skills.join(' · ')}</span></div>}
            {skills.languages?.length && <div><strong>Languages: </strong><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.languages.join(' · ')}</span></div>}
          </MinimalSection>}
          {renderCustomSections(data.custom_sections, '#111827')}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#111827', watermark, undefined, '40px 44px')}
    </div>
  );
}

/* ── Sidebar Template ────────────────────────────────────────────────────── */
function SidebarTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const sideColor = '#3b5998';
  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
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
            {skills?.subjects?.length && <SidebarSection title={subjectsLabel}><BulletList items={skills.subjects} /></SidebarSection>}
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
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, sideColor, watermark, undefined, '28px 24px')}
    </div>
  );
}

/* ── Bold Template ───────────────────────────────────────────────────────── */
function BoldTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const accent = '#c2185b';
  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
        }}
      >
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
            {skills?.subjects?.length && <Section title={subjectsLabel} color={accent} icon={ICONS.bookOpen}>
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
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, accent, watermark, undefined, '24px 32px')}
    </div>
  );
}

/* ── Executive Template ──────────────────────────────────────────────────── */
function ExecutiveTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const accent = '#6b1a1a';
  const light = '#8b2424';
  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
        }}
      >
        <div style={{ background: `linear-gradient(135deg, ${accent} 0%, ${light} 100%)`, color: '#fff', padding: '36px 44px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.35)', flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', fontStyle: 'italic' }}>{personal.full_name || 'Your Name'}</div>
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
          {personal.bio && <Section title="Executive Profile" color={accent} titleStyle={{ fontStyle: "italic", letterSpacing: "1px", textTransform: "uppercase" }}><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 36px' }}>
            <div>
              {validExp.length > 0 && <Section title={expLabel} color={accent} icon={ICONS.briefcase} titleStyle={{ fontStyle: "italic", letterSpacing: "1px" }}>
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
              {validEdu.length > 0 && <Section title="Education" color={accent} icon={ICONS.graduation} titleStyle={{ fontStyle: "italic", letterSpacing: "1px" }}>
                {validEdu.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{e.qualification}</div>
                    <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                  </div>
                ))}
              </Section>}
              {skills?.subjects?.length && <Section title={subjectsLabel} color={accent} icon={ICONS.bookOpen}>
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
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, accent, watermark, undefined, '28px 44px')}
    </div>
  );
}

/* ── Corporate Template ──────────────────────────────────────────────────── */
function CorporateTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const navy = '#1a2a4a';
  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ background: navy, color: '#fff', width: '210px', minWidth: '210px', padding: '32px 18px', boxSizing: 'border-box' }}>
            <div style={{ width: '76px', height: '76px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '26px', fontWeight: '800', color: '#fff' }}>{(personal.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div>
            <SidebarSection title="Contact">
              {personal.email && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.mail} {personal.email}</div>}
              {personal.phone && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.phone} {personal.phone}</div>}
              {personal.address && <div style={{ marginBottom: '6px', fontSize: '11px' }}>{ICONS.mapPin} {personal.address}</div>}
              {personal.id_number && <div>{ICONS.user} ID: {personal.id_number}</div>}
            </SidebarSection>
            {skills?.subjects?.length && <SidebarSection title={subjectsLabel}><BulletList items={skills.subjects} /></SidebarSection>}
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
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, navy, watermark, undefined, '32px 28px')}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NEW TEMPLATES — Added from design references
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Stylish Template (Image 1 — pink/coral, photo left, skills right) ───── */
function StylishTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const accent = '#e05c6b';
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative' }}>
        {/* Header */}
        <div style={{ padding: '28px 36px 20px', display: 'flex', alignItems: 'center', gap: '20px', borderBottom: `2px solid ${accent}` }}>
          {personal.photo_url && <img src={personal.photo_url} alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ fontSize: '13px', color: accent, fontWeight: '600', marginTop: '2px' }}>{personal.address || ''}</div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: '#6b7280', flexWrap: 'wrap' }}>
              {personal.address && <span>📍 {personal.address}</span>}
              {personal.email && <span>{personal.email}</span>}
              {personal.phone && <span>{personal.phone}</span>}
            </div>
          </div>
        </div>
        {/* Two-column body */}
        <div style={{ display: 'flex', padding: '0' }}>
          {/* Left content */}
          <div style={{ flex: 1, padding: '24px 28px' }}>
            {personal.bio && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: accent, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Profile</div>
                <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
              </div>
            )}
            {validExp.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: accent, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Employment History</div>
                {validExp.map((e: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '18px' }}>
                    <div style={{ width: '100px', flexShrink: 0, fontSize: '10px', color: accent, lineHeight: '1.5', paddingTop: '2px' }}>{[e.from, e.to].filter(Boolean).join(' — ')}<br />{e.school}</div>
                    <div style={{ flex: 1, borderLeft: `2px solid #f3f4f6`, paddingLeft: '14px' }}>
                      <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{e.role}</div>
                      {renderDescription(e.description, accent)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {validEdu.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: accent, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Education</div>
                {validEdu.map((e: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                    <div style={{ width: '100px', flexShrink: 0, fontSize: '10px', color: accent }}>{e.year}</div>
                    <div style={{ flex: 1, borderLeft: `2px solid #f3f4f6`, paddingLeft: '14px' }}>
                      <div style={{ fontWeight: '600', fontSize: '12px', color: '#111827' }}>{e.qualification}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{e.institution}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {renderCustomSections(data.custom_sections, accent)}
          </div>
          {/* Right sidebar — skills */}
          <div style={{ width: '200px', flexShrink: 0, padding: '24px 20px', borderLeft: '1px solid #f3f4f6', background: '#fafafa' }}>
            {(skills?.soft_skills?.length || skills?.subjects?.length) && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: accent, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Skills</div>
                {[...(skills.subjects || []), ...(skills.soft_skills || [])].map((s: string, i: number) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#374151', marginBottom: '3px' }}>{s}</div>
                    <div style={{ display: 'flex', gap: '2px' }}>{[...Array(10)].map((_, j) => <div key={j} style={{ width: '8px', height: '8px', borderRadius: '50%', background: j < 7 ? accent : '#e5e7eb' }} />)}</div>
                  </div>
                ))}
              </div>
            )}
            {skills?.languages?.length && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: accent, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Languages</div>
                {skills.languages.map((l: string, i: number) => <div key={i} style={{ fontSize: '11px', color: '#374151', marginBottom: '4px' }}>{l}</div>)}
              </div>
            )}
          </div>
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, accent, watermark)}
    </div>
  );
}

/* ── Boxed Template (Image 2/8 — boxed name, grey left sidebar) ──────────── */
function BoxedTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative', display: 'flex' }}>
        {/* Left sidebar */}
        <div style={{ width: '200px', flexShrink: 0, background: '#f8f8f8', padding: '32px 20px', borderRight: '1px solid #e5e7eb' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#374151', borderBottom: '1.5px solid #374151', paddingBottom: '6px', marginBottom: '12px' }}>DETAILS</div>
            {personal.address && <><div style={{ fontSize: '9px', fontWeight: '700', color: '#374151', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>ADDRESS</div><div style={{ fontSize: '11px', color: '#4b5563', marginBottom: '10px', lineHeight: '1.5' }}>{personal.address}</div></>}
            {personal.phone && <><div style={{ fontSize: '9px', fontWeight: '700', color: '#374151', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>PHONE</div><div style={{ fontSize: '11px', color: '#4b5563', marginBottom: '10px' }}>{personal.phone}</div></>}
            {personal.email && <><div style={{ fontSize: '9px', fontWeight: '700', color: '#374151', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>EMAIL</div><div style={{ fontSize: '11px', color: '#4b5563', marginBottom: '10px', wordBreak: 'break-all' }}>{personal.email}</div></>}
          </div>
          {(skills?.soft_skills?.length || skills?.subjects?.length) && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#374151', borderBottom: '1.5px solid #374151', paddingBottom: '6px', marginBottom: '12px' }}>SKILLS</div>
              {[...(skills.subjects || []), ...(skills.soft_skills || [])].map((s: string, i: number) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#374151', marginBottom: '3px' }}>{s}</div>
                  <div style={{ display: 'flex', gap: '2px' }}>{[...Array(5)].map((_, j) => <div key={j} style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#374151' }} />)}</div>
                </div>
              ))}
            </div>
          )}
          {skills?.languages?.length && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#374151', borderBottom: '1.5px solid #374151', paddingBottom: '6px', marginBottom: '12px' }}>LANGUAGES</div>
              {skills.languages.map((l: string, i: number) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#374151', marginBottom: '3px' }}>{l}</div>
                  <div style={{ display: 'flex', gap: '2px' }}>{[...Array(5)].map((_, j) => <div key={j} style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#374151' }} />)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Right content */}
        <div style={{ flex: 1, padding: '32px 28px' }}>
          {/* Boxed name */}
          <div style={{ border: '1.5px solid #374151', padding: '20px 28px', marginBottom: '28px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '3px', textTransform: 'uppercase', color: '#111827' }}>{personal.full_name || 'YOUR NAME'}</div>
            {personal.address && <div style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280', marginTop: '6px' }}>{personal.address}</div>}
          </div>
          {personal.bio && <div style={{ marginBottom: '24px' }}><div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #374151', paddingBottom: '4px', marginBottom: '10px', color: '#374151' }}>PROFILE</div><p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p></div>}
          {validExp.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #374151', paddingBottom: '4px', marginBottom: '12px', color: '#374151' }}>EMPLOYMENT HISTORY</div>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.role}{e.school ? `, ${e.school}` : ''}</div>
                    <div style={{ fontSize: '10px', color: '#6b7280', flexShrink: 0, marginLeft: '8px' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</div>
                  </div>
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </div>
          )}
          {validEdu.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #374151', paddingBottom: '4px', marginBottom: '12px', color: '#374151' }}>EDUCATION</div>
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.qualification}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                </div>
              ))}
            </div>
          )}
          {renderCustomSections(data.custom_sections, '#374151')}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#374151', watermark)}
    </div>
  );
}

/* ── Traditional Template (Image 5 — classical, left date col, serif feel) ── */
function TraditionalTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative', padding: '36px 44px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '1px solid #d1d5db', paddingBottom: '16px', marginBottom: '24px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', letterSpacing: '1px', fontFamily: "Georgia, 'Times New Roman', serif" }}>{personal.full_name || 'Your Name'}</div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>{[personal.address, personal.phone, personal.email].filter(Boolean).join('   ·   ')}</div>
        </div>
        {/* Sections with left-date layout */}
        {personal.bio && (
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ width: '110px', flexShrink: 0, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#374151', fontFamily: "Georgia, 'Times New Roman', serif", paddingTop: '2px' }}>PROFILE</div>
            <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
              <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
            </div>
          </div>
        )}
        {validExp.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
              <div style={{ width: '110px', flexShrink: 0, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#374151', fontFamily: "Georgia, 'Times New Roman', serif" }}>EMPLOYMENT<br />HISTORY</div>
              <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '2px' }} />
            </div>
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '20px', marginBottom: '18px' }}>
                <div style={{ width: '110px', flexShrink: 0, fontSize: '10px', color: '#6b7280', lineHeight: '1.5' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</div>
                <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>{e.role}{e.school ? `, ${e.school}` : ''}</div>
                  {e.school && <div style={{ fontSize: '11px', color: '#6b7280' }}>{e.school}</div>}
                  {renderDescription(e.description, '#374151')}
                </div>
              </div>
            ))}
          </div>
        )}
        {validEdu.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '4px' }}>
              <div style={{ width: '110px', flexShrink: 0, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#374151', fontFamily: "Georgia, 'Times New Roman', serif" }}>EDUCATION</div>
              <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '2px' }} />
            </div>
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
                <div style={{ width: '110px', flexShrink: 0, fontSize: '10px', color: '#6b7280' }}>{e.year}</div>
                <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.qualification}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{e.institution}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {(skills?.soft_skills?.length || skills?.subjects?.length || skills?.languages?.length) && (
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ width: '110px', flexShrink: 0, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#374151', fontFamily: "Georgia, 'Times New Roman', serif" }}>SKILLS</div>
            <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
                {[...(skills.subjects || []), ...(skills.soft_skills || [])].map((s: string, i: number) => (
                  <div key={i} style={{ fontSize: '12px', color: '#374151' }}>{s}</div>
                ))}
              </div>
              {skills?.languages?.length && <div style={{ marginTop: '8px', fontSize: '12px', color: '#374151' }}><strong>Languages: </strong>{skills.languages.join(' · ')}</div>}
            </div>
          </div>
        )}
        {renderCustomSections(data.custom_sections, '#374151')}
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#374151', watermark)}
    </div>
  );
}

/* ── Navy Template (Image 6 — dark navy right sidebar) ───────────────────── */
function NavyTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const navy = '#1a2a4a';
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative', display: 'flex' }}>
        {/* Left content */}
        <div style={{ flex: 1, padding: '32px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '6px' }}>
            {personal.photo_url && <img src={personal.photo_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>{personal.full_name || 'Your Name'}</div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', color: '#6b7280', marginTop: '3px' }}>Educator</div>
            </div>
          </div>
          <div style={{ height: '2px', background: navy, marginBottom: '20px' }} />
          {personal.bio && <div style={{ marginBottom: '20px' }}><div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', marginBottom: '8px' }}>Profile</div><p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p></div>}
          {validExp.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', marginBottom: '12px' }}>Employment History</div>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '18px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.role}{e.school ? `, ${e.school}` : ''}</div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', margin: '3px 0 6px' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</div>
                  {renderDescription(e.description, navy)}
                </div>
              ))}
            </div>
          )}
          {validEdu.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', marginBottom: '12px' }}>Education</div>
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '14px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.qualification}</div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', margin: '2px 0' }}>{[e.institution, e.year].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
          {renderCustomSections(data.custom_sections, navy)}
        </div>
        {/* Right dark sidebar */}
        <div style={{ width: '190px', flexShrink: 0, background: navy, color: '#fff', padding: '32px 18px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '6px', marginBottom: '10px' }}>Details</div>
            {personal.address && <div style={{ fontSize: '11px', color: '#d1d5db', marginBottom: '6px', lineHeight: '1.5' }}>{personal.address}</div>}
            {personal.phone && <div style={{ fontSize: '11px', color: '#d1d5db', marginBottom: '4px' }}>{personal.phone}</div>}
            {personal.email && <div style={{ fontSize: '10px', color: '#d1d5db', wordBreak: 'break-all' }}>{personal.email}</div>}
          </div>
          {(skills?.soft_skills?.length || skills?.subjects?.length) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '6px', marginBottom: '10px' }}>Skills</div>
              {[...(skills.subjects || []), ...(skills.soft_skills || [])].map((s: string, i: number) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#e5e7eb', marginBottom: '3px' }}>{s}</div>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }}><div style={{ width: '70%', height: '100%', background: '#60a5fa', borderRadius: '2px' }} /></div>
                </div>
              ))}
            </div>
          )}
          {skills?.languages?.length && (
            <div>
              <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '6px', marginBottom: '10px' }}>Languages</div>
              {skills.languages.map((l: string, i: number) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#e5e7eb', marginBottom: '3px' }}>{l}</div>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }}><div style={{ width: '80%', height: '100%', background: '#60a5fa', borderRadius: '2px' }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, navy, watermark)}
    </div>
  );
}

/* ── Timeline Template (Image 7 — centered header, timeline dots) ─────────── */
function TimelineTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative', display: 'flex' }}>
        {/* Left mini sidebar */}
        <div style={{ width: '170px', flexShrink: 0, padding: '28px 16px', borderRight: '1px solid #e5e7eb' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151', marginBottom: '8px' }}>• DETAILS •</div>
            {personal.address && <div style={{ fontSize: '11px', color: '#4b5563', marginBottom: '6px', lineHeight: '1.5' }}>{personal.address}</div>}
            {personal.phone && <div style={{ fontSize: '11px', color: '#4b5563', marginBottom: '4px' }}>{personal.phone}</div>}
            {personal.email && <div style={{ fontSize: '10px', color: '#4b5563', wordBreak: 'break-all', marginBottom: '4px' }}>{personal.email}</div>}
          </div>
          {(skills?.soft_skills?.length || skills?.subjects?.length) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151', marginBottom: '8px' }}>• SKILLS •</div>
              {[...(skills.subjects || []), ...(skills.soft_skills || [])].map((s: string, i: number) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#374151', textAlign: 'center', marginBottom: '3px' }}>{s}</div>
                  <div style={{ height: '2px', background: '#e5e7eb' }}><div style={{ width: '75%', height: '100%', background: '#374151' }} /></div>
                </div>
              ))}
            </div>
          )}
          {skills?.languages?.length && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151', marginBottom: '8px' }}>• LANGUAGES •</div>
              {skills.languages.map((l: string, i: number) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#374151', textAlign: 'center', marginBottom: '3px' }}>{l}</div>
                  <div style={{ height: '2px', background: '#e5e7eb' }}><div style={{ width: '80%', height: '100%', background: '#374151' }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Right content */}
        <div style={{ flex: 1, padding: '28px 24px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            {personal.photo_url && <img src={personal.photo_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 10px', display: 'block' }} />}
            <div style={{ fontSize: '22px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px', color: '#111827' }}>{personal.full_name || 'YOUR NAME'}</div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '3px', color: '#6b7280', marginTop: '4px' }}>
              {[personal.address, personal.phone].filter(Boolean).join('  📍  ')}
            </div>
            <div style={{ height: '2px', background: '#e5e7eb', margin: '12px 0' }} />
          </div>
          {personal.bio && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><span style={{ fontSize: '14px' }}>👤</span><div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>PROFILE</div></div>
              <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '12px' }}>
                <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
              </div>
            </div>
          )}
          {validExp.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><span style={{ fontSize: '14px' }}>💼</span><div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>EMPLOYMENT HISTORY</div></div>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '16px', flexShrink: 0, paddingTop: '3px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#374151', flexShrink: 0 }} />
                    <div style={{ width: '2px', flex: 1, background: '#e5e7eb', marginTop: '3px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.role}{e.school ? ` at ${e.school}` : ''}</div>
                    <div style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 4px' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</div>
                    {renderDescription(e.description, '#374151')}
                  </div>
                </div>
              ))}
            </div>
          )}
          {validEdu.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><span style={{ fontSize: '14px' }}>🎓</span><div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>EDUCATION</div></div>
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d1d5db', flexShrink: 0, marginTop: '3px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.qualification}</div>
                    <div style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0' }}>{[e.institution, e.year].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {renderCustomSections(data.custom_sections, '#374151')}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#374151', watermark)}
    </div>
  );
}

/* ── Shaded Template (Image 9 — shaded section headers, dot leader lines) ─── */
function ShadedTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative', padding: '0' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '28px 44px 16px' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '3px', color: '#111827' }}>{personal.full_name || 'YOUR NAME'}</div>
          {personal.address && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{personal.address}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4b5563', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
            {personal.phone && <span>{personal.phone}</span>}
            {personal.email && <span>{personal.email}</span>}
          </div>
        </div>
        <div style={{ padding: '8px 44px 28px' }}>
          {personal.bio && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#f3f4f6', padding: '6px 10px', marginBottom: '10px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>PROFILE</div>
              <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0, textAlign: 'center' }}>{personal.bio}</p>
            </div>
          )}
          {validExp.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#f3f4f6', padding: '6px 10px', marginBottom: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>EMPLOYMENT HISTORY</div>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ color: '#6b7280', fontSize: '13px' }}>❖</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.role}{e.school ? `, ${e.school}` : ''}</span>
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</span>
                      </div>
                    </div>
                  </div>
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </div>
          )}
          {validEdu.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#f3f4f6', padding: '6px 10px', marginBottom: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>EDUCATION</div>
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>❖</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.qualification}</div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>{e.year}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>{e.institution}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(skills?.soft_skills?.length || skills?.subjects?.length) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#f3f4f6', padding: '6px 10px', marginBottom: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>SKILLS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[...(skills.subjects || []), ...(skills.soft_skills || [])].map((s: string, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px', color: '#374151' }}>
                    <span>{s}</span>
                    <span style={{ flex: 1, borderBottom: '1.5px dotted #d1d5db', margin: '0 6px', minWidth: '20px' }} />
                    <span style={{ fontWeight: '700', fontSize: '11px' }}>Expert</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {renderCustomSections(data.custom_sections, '#374151')}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#374151', watermark)}
    </div>
  );
}

/* ── Teal Template (Image 10 — teal header with photo, left sidebar) ─────── */
function TealTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const teal = '#06b6d4';
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative' }}>
        {/* Teal header */}
        <div style={{ background: teal, padding: '0', display: 'flex', alignItems: 'stretch', minHeight: '120px' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="" style={{ width: '120px', objectFit: 'cover', flexShrink: 0 }} />}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: '700', color: '#111827' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>Educator</div>
            <div style={{ fontSize: '11px', color: '#1e293b', marginTop: '8px' }}>
              {personal.address && <div>{personal.address}</div>}
              {personal.phone && <span style={{ marginRight: '16px' }}>{personal.phone}</span>}
              {personal.email && <span>{personal.email}</span>}
            </div>
          </div>
        </div>
        {/* Two-col body */}
        <div style={{ display: 'flex' }}>
          {/* Left sidebar */}
          <div style={{ width: '200px', flexShrink: 0, padding: '24px 18px', borderRight: '1px solid #f1f5f9' }}>
            {(skills?.soft_skills?.length || skills?.subjects?.length) && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '10px', borderBottom: `2px solid ${teal}`, paddingBottom: '4px' }}>Skills</div>
                {[...(skills.subjects || []), ...(skills.soft_skills || [])].map((s: string, i: number) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#374151', marginBottom: '3px' }}>{s}</div>
                    <div style={{ height: '2px', background: '#e2e8f0' }}><div style={{ width: '75%', height: '100%', background: teal }} /></div>
                  </div>
                ))}
              </div>
            )}
            {skills?.languages?.length && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '10px', borderBottom: `2px solid ${teal}`, paddingBottom: '4px' }}>Languages</div>
                {skills.languages.map((l: string, i: number) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#374151', marginBottom: '3px' }}>{l}</div>
                    <div style={{ height: '2px', background: '#e2e8f0' }}><div style={{ width: '80%', height: '100%', background: teal }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Right content */}
          <div style={{ flex: 1, padding: '24px 24px' }}>
            {personal.bio && <div style={{ marginBottom: '20px' }}><div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', marginBottom: '8px' }}>Profile</div><p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p></div>}
            {validExp.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', marginBottom: '12px' }}>Employment History</div>
                {validExp.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: '16px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.role}{e.school ? `, ${e.school}` : ''}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 6px' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</div>
                    {renderDescription(e.description, teal)}
                  </div>
                ))}
              </div>
            )}
            {validEdu.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', marginBottom: '12px' }}>Education</div>
                {validEdu.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.qualification}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{[e.institution, e.year].filter(Boolean).join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}
            {renderCustomSections(data.custom_sections, teal)}
          </div>
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, teal, watermark)}
    </div>
  );
}

/* ── Crimson Template (Image 13 — bold red banner header) ────────────────── */
function CrimsonTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const crimson = '#c0392b';
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative' }}>
        {/* Red header banner */}
        <div style={{ background: crimson, padding: '20px 32px', display: 'flex', alignItems: 'center', gap: '18px' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#fff', fontStyle: 'italic' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.75)', marginTop: '3px' }}>Educator</div>
          </div>
        </div>
        {/* Contact strip */}
        <div style={{ display: 'flex', gap: '24px', padding: '8px 32px', borderBottom: '1px solid #e5e7eb', fontSize: '10px', color: '#6b7280' }}>
          {personal.email && <span>✉ {personal.email}</span>}
          {personal.address && <span>📍 {personal.address}</span>}
          {personal.phone && <span>📞 {personal.phone}</span>}
        </div>
        {/* Two-col body */}
        <div style={{ display: 'flex', padding: '20px 32px', gap: '28px' }}>
          {/* Left content */}
          <div style={{ flex: 1 }}>
            {personal.bio && <div style={{ marginBottom: '20px' }}><div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', borderBottom: `2px solid ${crimson}`, paddingBottom: '4px', marginBottom: '8px', fontStyle: 'italic' }}>Profile</div><p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p></div>}
            {validExp.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', borderBottom: `2px solid ${crimson}`, paddingBottom: '4px', marginBottom: '12px', fontStyle: 'italic' }}>Employment History</div>
                {validExp.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: '16px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.role}{e.school ? `, ${e.school}` : ''}</div>
                    <div style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 4px', fontStyle: 'italic' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</div>
                    {renderDescription(e.description, crimson)}
                  </div>
                ))}
              </div>
            )}
            {validEdu.length > 0 && (
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', borderBottom: `2px solid ${crimson}`, paddingBottom: '4px', marginBottom: '12px', fontStyle: 'italic' }}>Education</div>
                {validEdu.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{e.qualification}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{[e.institution, e.year].filter(Boolean).join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Right skills col */}
          <div style={{ width: '170px', flexShrink: 0 }}>
            {(skills?.soft_skills?.length || skills?.subjects?.length) && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', borderBottom: `2px solid ${crimson}`, paddingBottom: '4px', marginBottom: '10px', fontStyle: 'italic' }}>Skills</div>
                {[...(skills.subjects || []), ...(skills.soft_skills || [])].map((s: string, i: number) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#374151', marginBottom: '3px' }}>{s}</div>
                    <div style={{ height: '3px', background: '#fee2e2' }}><div style={{ width: '75%', height: '100%', background: crimson }} /></div>
                  </div>
                ))}
              </div>
            )}
            {skills?.languages?.length && (
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', borderBottom: `2px solid ${crimson}`, paddingBottom: '4px', marginBottom: '10px', fontStyle: 'italic' }}>Languages</div>
                {skills.languages.map((l: string, i: number) => <div key={i} style={{ fontSize: '11px', color: '#374151', marginBottom: '4px' }}>{l}</div>)}
              </div>
            )}
          </div>
        </div>
        {renderCustomSections(data.custom_sections, crimson)}
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, crimson, watermark)}
    </div>
  );
}

/* ── Sage Template (Image 16 — green header, clean minimal) ──────────────── */
function SageTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const sage = '#7fa37f';
  const sageBg = '#e8f0e8';
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative' }}>
        {/* Green header */}
        <div style={{ background: sageBg, padding: '24px 36px', borderRadius: '8px', margin: '20px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a2e1a' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#374151' }}>
              {personal.email && <div>{personal.email}</div>}
              {personal.phone && <div>{personal.phone}</div>}
              {personal.address && <div>{personal.address}</div>}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 36px 28px' }}>
          {personal.bio && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#4a6c4a', marginBottom: '4px' }}>Educator</div>
              <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
            </div>
          )}
          {validExp.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: sage, marginBottom: '12px' }}>Career Experience</div>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: '13px', color: sage }}>{e.role}{e.school ? `, ${e.school}` : ''}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</div>
                  </div>
                  {renderDescription(e.description, sage)}
                </div>
              ))}
            </div>
          )}
          {validEdu.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: sage, marginBottom: '12px' }}>Education</div>
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', color: sage }}>{e.qualification}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{[e.institution, e.year].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
          {(skills?.soft_skills?.length || skills?.subjects?.length || skills?.languages?.length) && (
            <div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: sage, marginBottom: '10px' }}>Skills & Languages</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[...(skills.subjects || []), ...(skills.soft_skills || []), ...(skills.languages || [])].map((s: string, i: number) => (
                  <span key={i} style={{ background: sageBg, color: '#374151', padding: '4px 12px', borderRadius: '20px', fontSize: '11px' }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {renderCustomSections(data.custom_sections, sage)}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, sage, watermark)}
    </div>
  );
}

/* ── Elegant Template ───────────────────────────────────────────────────── */
// Centered, formal layout on a soft lavender-blue background. Serif
// typography throughout, with section headings flanked by horizontal
// divider lines extending to the page margins.
const ELEGANT_BG     = '#EAF0FB';
const ELEGANT_INK    = '#1e293b';   // slate-800 — headings, names
const ELEGANT_MUTED  = '#64748b';   // slate-500 — meta info, dates
const ELEGANT_BODY   = '#374151';   // slate-700 — body text
const ELEGANT_LINE   = '#cbd5e1';   // slate-300 — divider lines

function ElegantHeading({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '22px 0 14px' }}>
      <div style={{ flex: 1, height: '1px', background: ELEGANT_LINE }} />
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '14px', fontWeight: 700, color: ELEGANT_INK, whiteSpace: 'nowrap' }}>
        {title}
      </span>
      <div style={{ flex: 1, height: '1px', background: ELEGANT_LINE }} />
    </div>
  );
}

function ElegantTemplate({ data, wrapperStyle, validEdu, validExp, watermark, expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  // Subtitle is drawn from the most recent role — users can type multiple
  // roles separated by "/" (e.g. "ICT Coordinator / Educator").
  const subtitle = validExp[0]?.role || '';
  const contactParts = [
    personal.address,
    personal.phone,
    personal.email,
    personal.id_number ? `ID: ${personal.id_number}` : null,
  ].filter(Boolean);

  const allSkills = [
    ...(skills?.subjects || []),
    ...(skills?.soft_skills || []),
    ...(skills?.languages || []),
  ];

  return (
    <div style={{ ...wrapperStyle, background: ELEGANT_BG }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          position: 'relative',
          background: ELEGANT_BG,
          padding: '40px 56px',
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: ELEGANT_BODY,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          {personal.photo_url && (
            <img src={personal.photo_url} alt="Profile" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${ELEGANT_LINE}`, marginBottom: '10px' }} />
          )}
          <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: ELEGANT_INK }}>
            {personal.full_name || 'Your Name'}
          </div>
          {subtitle && (
            <div style={{ marginTop: '6px', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: ELEGANT_MUTED }}>
              {subtitle}
            </div>
          )}
          {contactParts.length > 0 && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: ELEGANT_MUTED }}>
              {contactParts.join('   |   ')}
            </div>
          )}
        </div>

        {/* Professional Summary */}
        {personal.bio && (
          <>
            <ElegantHeading title="Professional summary" />
            <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.7', color: ELEGANT_BODY }}>{personal.bio}</p>
          </>
        )}

        {/* Work Experience */}
        {validExp.length > 0 && (
          <>
            <ElegantHeading title={expLabel} />
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: ELEGANT_INK }}>{e.role}</span>
                  {(e.from || e.to) && (
                    <span style={{ fontSize: '11px', color: ELEGANT_MUTED, whiteSpace: 'nowrap' }}>
                      {[e.from, e.to].filter(Boolean).join(' – ')}
                    </span>
                  )}
                </div>
                {e.school && <div style={{ fontSize: '12px', color: ELEGANT_MUTED, marginTop: '2px' }}>{e.school}</div>}
                {renderDescription(e.description, ELEGANT_INK)}
              </div>
            ))}
          </>
        )}

        {/* Education */}
        {validEdu.length > 0 && (
          <>
            <ElegantHeading title="Education" />
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: ELEGANT_INK }}>{e.qualification}</span>
                {e.institution && <><span style={{ color: ELEGANT_LINE }}> {' | '} </span><span style={{ color: ELEGANT_MUTED }}>{e.institution}</span></>}
                {e.year && <><span style={{ color: ELEGANT_LINE }}> {' | '} </span><span style={{ color: ELEGANT_MUTED }}>{e.year}</span></>}
              </div>
            ))}
          </>
        )}

        {/* Skills and Attributes */}
        {allSkills.length > 0 && (
          <>
            <ElegantHeading title="Skills and Attributes" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '24px', rowGap: '4px' }}>
              {allSkills.map((s, i) => (
                <div key={i} style={{ fontSize: '12px', color: ELEGANT_BODY, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ color: ELEGANT_MUTED, flexShrink: 0 }}>•</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {renderCustomSections(data.custom_sections, ELEGANT_INK, ELEGANT_LINE)}

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, ELEGANT_INK, watermark, ELEGANT_LINE)}
    </div>
  );
}

// Matches the A4_PAGE_H_PX convention used by other full-page templates so
// the page-slicer in cvExport.ts treats this as one logical page.
function forExportMinHeight(wrapperStyle: React.CSSProperties): string {
  return wrapperStyle.width === '794px' ? `${A4_PAGE_H_PX}px` : 'auto';
}

/* ── Heritage Template ──────────────────────────────────────────────────── */
// Formal centered layout on a soft lavender background. Contact info sits
// inside a double rule at the very top, the name is title-case, the most
// recent role is shown as an italic subtitle, and every section heading is
// uppercase with a double rule beneath it. Skills render as an inline
// "Name (description)" list with italicised descriptions.
const HERITAGE_BG    = '#EAF0FB';
const HERITAGE_INK   = '#1e293b';   // slate-800 — name, headings
const HERITAGE_MUTED = '#64748b';   // slate-500 — meta info, dates
const HERITAGE_BODY  = '#374151';   // slate-700 — body text
const HERITAGE_RULE  = '#334155';   // slate-700 — double rules

function HeritageHeading({ title }: { title: string }) {
  return (
    <div style={{ textAlign: 'center', margin: '26px 0 16px' }}>
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '14px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: HERITAGE_INK }}>
        {title}
      </span>
      <div style={{ height: '2px', borderTop: `1px solid ${HERITAGE_RULE}`, borderBottom: `1px solid ${HERITAGE_RULE}`, marginTop: '7px' }} />
    </div>
  );
}

function HeritageTemplate({ data, wrapperStyle, validEdu, validExp, watermark, expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;
  const subtitle = validExp[0]?.role || '';
  const contactParts = [
    personal.address,
    personal.email,
    personal.phone,
    personal.id_number ? `ID: ${personal.id_number}` : null,
  ].filter(Boolean);

  const allSkills = [
    ...(skills?.subjects || []),
    ...(skills?.soft_skills || []),
    ...(skills?.languages || []),
  ];

  return (
    <div style={{ ...wrapperStyle, background: HERITAGE_BG }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          position: 'relative',
          background: HERITAGE_BG,
          padding: '36px 56px',
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: HERITAGE_BODY,
        }}
      >
        {/* Top double rule + centered contact */}
        <div style={{ height: '3px', borderTop: `1px solid ${HERITAGE_RULE}`, borderBottom: `1px solid ${HERITAGE_RULE}` }} />
        {contactParts.length > 0 && (
          <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', color: HERITAGE_MUTED }}>
            {contactParts.join('   •   ')}
          </div>
        )}

        {/* Name + subtitle */}
        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          {personal.photo_url && (
            <img src={personal.photo_url} alt="Profile" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${HERITAGE_RULE}`, marginBottom: '8px' }} />
          )}
          <div style={{ fontSize: '28px', fontWeight: 700, color: HERITAGE_INK }}>
            {personal.full_name || 'Your Name'}
          </div>
          {subtitle && (
            <div style={{ marginTop: '4px', fontSize: '12px', color: HERITAGE_MUTED }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Professional Summary */}
        {personal.bio && (
          <>
            <HeritageHeading title="Professional summary" />
            <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.7', color: HERITAGE_BODY }}>{personal.bio}</p>
          </>
        )}

        {/* Work Experience */}
        {validExp.length > 0 && (
          <>
            <HeritageHeading title={expLabel} />
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: HERITAGE_INK }}>{e.role}</span>
                  {(e.from || e.to) && (
                    <span style={{ fontWeight: 700, fontSize: '11px', color: HERITAGE_INK, whiteSpace: 'nowrap' }}>
                      {[e.from, e.to].filter(Boolean).join(' — ')}
                    </span>
                  )}
                </div>
                {e.school && <div style={{ fontSize: '11px', color: HERITAGE_MUTED, marginTop: '2px' }}>{e.school}</div>}
                {renderDescription(e.description, HERITAGE_INK)}
              </div>
            ))}
          </>
        )}

        {/* Education */}
        {validEdu.length > 0 && (
          <>
            <HeritageHeading title="Education" />
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: HERITAGE_INK }}>{e.qualification}</span>
                  {e.year && <span style={{ fontWeight: 700, fontSize: '11px', color: HERITAGE_INK, whiteSpace: 'nowrap' }}>{e.year}</span>}
                </div>
                {e.institution && <div style={{ fontSize: '11px', color: HERITAGE_MUTED, marginTop: '2px' }}>{e.institution}</div>}
              </div>
            ))}
          </>
        )}

        {/* Skills and Attributes — inline "Name (description)" */}
        {allSkills.length > 0 && (
          <>
            <HeritageHeading title="Skills and Attributes" />
            <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.8', color: HERITAGE_BODY }}>
              {allSkills.map((s, i) => {
                const [name, desc] = String(s).split('|').map(x => x.trim());
                return (
                  <span key={i}>
                    {name}
                    {desc && <> (<span style={{ color: HERITAGE_MUTED }}>{desc}</span>)</>}
                    {i < allSkills.length - 1 ? ', ' : '.'}
                  </span>
                );
              })}
            </p>
          </>
        )}

        {renderCustomSections(data.custom_sections, HERITAGE_INK, HERITAGE_RULE)}

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, HERITAGE_INK, watermark, HERITAGE_RULE)}
    </div>
  );
}
