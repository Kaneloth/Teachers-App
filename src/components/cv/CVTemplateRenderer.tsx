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
  personal: { full_name?: string; email?: string; phone?: string; address?: string; bio?: string; photo_url?: string; id_number?: string; job_title?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects?: string[]; soft_skills?: string[]; languages?: string[] };
  references?: RefEntry[];
  custom_sections?: CustomSection[];
  template: string;
  // Section titles hidden from the rendered CV — data stays intact
  // elsewhere (e.g. data.skills), this just controls what actually draws.
  // Keys: 'skills' | 'references' | 'custom:<title>'.
  hidden_sections?: string[];
}

interface Props { data: CVData; forExport?: boolean; watermark?: boolean; cvType?: 'educator' | 'general'; thumbnail?: boolean }

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

export default function CVTemplateRenderer({ data, forExport = false, watermark = false, cvType, thumbnail = false }: Props) {
  const { template } = data;
  const TEMPLATE_FONTS: Record<string, string> = {
    'classic': "'Inter', Arial, Helvetica, sans-serif",
    'minimal': "'Trebuchet MS', Arial, sans-serif",
    'bold': "'Arial Black', Arial, sans-serif",
    'stylish': "Arial, Helvetica, sans-serif",
    'timeline': "'Trebuchet MS', Arial, sans-serif",
    'shaded': "Arial, Helvetica, sans-serif",
    'sage': "'Segoe UI', Arial, sans-serif",
    'traditional': "Georgia, 'Times New Roman', serif",
    'crimson': "Georgia, 'Times New Roman', serif",
    'elegant': "Georgia, 'Times New Roman', serif",
    'heritage': "Georgia, 'Times New Roman', serif",
    'casual':   "'Arial', Helvetica, sans-serif",
    'skyline':  "'Segoe UI', Arial, sans-serif",
    'azure':    "'Segoe UI', Arial, sans-serif",
    'dove':     "'Segoe UI', Arial, sans-serif",
    'panel':    "Arial, Helvetica, sans-serif",
    'terracotta': "Arial, Helvetica, sans-serif",
    'monogram': "Arial, Helvetica, sans-serif",
  };
  const templateFont = TEMPLATE_FONTS[template] || 'Arial, Helvetica, sans-serif';

  const wrapperStyle: React.CSSProperties = forExport
    ? { width: '794px', fontFamily: templateFont, fontSize: '13px', background: '#fff' }
    : { width: '100%', fontFamily: templateFont, fontSize: '13px', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.10)', borderRadius: '4px', overflow: 'hidden' };

  const validEdu = (data.education || []).filter(e => e.institution);
  const validExp = (data.experience || []).filter(e => e.school);
  // For general users, 'subjects' holds Key Skills — don't label them as educator subjects
  const isEducatorCV = cvType === 'educator' || cvType === undefined;
  const skillsLabel  = 'Key Skills';
  const subjectsLabel = 'Key Skills';

  const expLabel = 'Work Experience';
  const hidden = new Set(data.hidden_sections || []);
  const T = { data, wrapperStyle, validEdu, validExp, watermark, skillsLabel, subjectsLabel, expLabel, isEducatorCV, thumbnail, hidden };
  const tmpl =
    template === 'minimal'      ? <MinimalTemplate      {...T} /> :
    template === 'bold'         ? <BoldTemplate         {...T} /> :
    template === 'stylish'      ? <StylishTemplate      {...T} /> :
    template === 'traditional'  ? <TraditionalTemplate  {...T} /> :
    template === 'timeline'     ? <TimelineTemplate     {...T} /> :
    template === 'shaded'       ? <ShadedTemplate       {...T} /> :
    template === 'crimson'      ? <CrimsonTemplate      {...T} /> :
    template === 'sage'         ? <SageTemplate         {...T} /> :
    template === 'elegant'      ? <ElegantTemplate      {...T} /> :
    template === 'heritage'     ? <HeritageTemplate     {...T} /> :
    template === 'casual'       ? <CasualTemplate       {...T} /> :
    template === 'skyline'      ? <SkylineTemplate      {...T} /> :
    template === 'azure'        ? <AzureTemplate        {...T} /> :
    template === 'dove'         ? <DoveTemplate         {...T} /> :
    template === 'panel'        ? <PanelTemplate        {...T} /> :
    template === 'terracotta'   ? <TerracottaTemplate   {...T} /> :
    template === 'monogram'     ? <MonogramTemplate     {...T} /> :
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

function renderCustomSections(sections: CustomSection[] | undefined, color: string, borderColor?: string, hidden?: Set<string>): React.ReactNode {
  if (!sections?.length) return null;
  return (
    <>
      {sections.filter(s => s.title && !hidden?.has(`custom:${s.title}`)).map((s, idx) => {
        let content: React.ReactNode = null;
        if (s.type === 'text') {
          content = (s.content && s.content.trim())
            ? <p style={{ color: '#374151', margin: 0, fontSize: '12px', lineHeight: '1.6' }}>{s.content}</p>
            : null;
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
  hidden?: Set<string>,
): React.ReactNode {
  if (hidden?.has('references')) return null;
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
// Matches cvExport.ts's sectionHeading(...,'tag-underline',...) exactly:
// icon + title sit on one row, then a full-width divider line renders on
// its OWN row directly below — as opposed to the shared Section component
// above, which matches the 'bar' heading style cvExport.ts uses for
// Classic/Modern/etc (line filling the remaining space BESIDE the title,
// same row). Bold and Crimson's real PDF output uses 'tag-underline', so
// they use this component instead of Section — using Section for them
// was the bug: the preview showed the divider beside the title when the
// actual download always puts it below.
function TagUnderlineSection({ title, color, icon, children }: { title: string; color: string; icon?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
        {icon && <span style={{ fontSize: '12px', lineHeight: 1 }}>{icon}</span>}
        <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color }}>{title}</span>
      </div>
      <div style={{ height: '1px', background: color, marginBottom: '10px' }} />
      {children}
    </div>
  );
}

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
function ClassicTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
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
                <div style={{ fontWeight: '600', color: '#111827', wordBreak: 'break-word' }}>{e.qualification}</div>
                <div style={{ color: '#6b7280', fontSize: '12px', wordBreak: 'break-word' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
              </div>
            ))}
          </Section>}
          {validExp.length > 0 && <Section title={expLabel} color="#1e2a3a" icon={ICONS.briefcase}>
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '16px', borderLeft: '3px solid #1e2a3a', paddingLeft: '12px' }}>
                <div style={{ fontWeight: '600', color: '#111827', wordBreak: 'break-word' }}>{e.role}</div>
                <div style={{ color: '#6b7280', fontSize: '12px', wordBreak: 'break-word' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                {renderDescription(e.description, '#374151')}
              </div>
            ))}
          </Section>}
          {!hidden?.has('skills') && (skills?.subjects?.length || skills?.soft_skills?.length) && <Section title="Skills & Subjects" color="#1e2a3a" icon={ICONS.award}>
            {skills.subjects?.length && <div><div style={{ fontWeight: '700', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>Subjects</div><BulletList items={skills.subjects} /></div>}
            {skills.soft_skills?.length && <div style={{ marginTop: '12px' }}><div style={{ fontWeight: '700', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>Skills</div><BulletList items={skills.soft_skills} /></div>}
          </Section>}
          {!hidden?.has('skills') && skills?.languages?.length && <Section title="Languages" color="#1e2a3a" icon={ICONS.languages}>
            <BulletList items={skills.languages} />
          </Section>}
          {renderCustomSections(data.custom_sections, '#1e2a3a', undefined, hidden)}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#1e2a3a', watermark, undefined, '28px 36px', hidden)}
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
function MinimalTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
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
          <div style={{ borderBottom: '2px solid #111827', paddingBottom: '16px', marginBottom: '34px', textAlign: 'center' }}>
            {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '68px', height: '68px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb', margin: '0 auto 12px', display: 'block' }} />}
            <div style={{ fontSize: '30px', fontWeight: '300', letterSpacing: '3px', textTransform: 'uppercase', color: '#111827' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
              {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
              {personal.email && <span>{ICONS.mail} {personal.email}</span>}
            </div>
          </div>
          {personal.bio && <MinimalSection title="Summary"><p style={{ color: '#4b5563', margin: 0, fontSize: '12px' }}>{personal.bio}</p></MinimalSection>}
          {validExp.length > 0 && <MinimalSection title="Experience">
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
                <div style={{ width: '90px', flexShrink: 0, fontSize: '11px', color: '#9ca3af', paddingTop: '2px' }}>{e.from && e.to ? `${e.from} – ${e.to}` : e.from || e.to || ''}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px', wordBreak: 'break-word' }}>{e.role}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px', wordBreak: 'break-word' }}>{e.school}</div>
                  {renderDescription(e.description, '#4b5563')}
                </div>
              </div>
            ))}
          </MinimalSection>}
          {validEdu.length > 0 && <MinimalSection title="Education">
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                <div style={{ width: '90px', flexShrink: 0, fontSize: '11px', color: '#9ca3af', paddingTop: '2px' }}>{e.year || ''}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px', wordBreak: 'break-word' }}>{e.qualification}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px', wordBreak: 'break-word' }}>{e.institution}</div>
                </div>
              </div>
            ))}
          </MinimalSection>}
          {!hidden?.has('skills') && (skills?.subjects?.length || skills?.soft_skills?.length || skills?.languages?.length) && <MinimalSection title="Skills & Languages">
            {skills.subjects?.length && <div><strong>{subjectsLabel}: </strong><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.subjects.join(' · ')}</span></div>}
            {skills.soft_skills?.length && <div><strong>Skills: </strong><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.soft_skills.join(' · ')}</span></div>}
            {skills.languages?.length && <div><strong>Languages: </strong><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.languages.join(' · ')}</span></div>}
          </MinimalSection>}
          {renderCustomSections(data.custom_sections, '#111827', undefined, hidden)}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#111827', watermark, undefined, '40px 44px', hidden)}
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
// Matches the "Key Skills / Professional Skills / Languages" 2-column
// bullet grid cvExport.ts's drawBold/drawCrimson actually render — a CSS
// grid with 2 columns naturally interleaves items the same way that PDF
// code's manual col1/col2 splitting does (item 0→col1 row0, item 1→col2
// row0, item 2→col1 row1, ...), so no manual splitting is needed here.
function SkillGroupsTwoCol({ groups, accent }: { groups: [string, string[]][]; accent: string }) {
  return (
    <>
      {groups.map(([label, items], gi) => (
        <div key={label} style={{ marginBottom: gi < groups.length - 1 ? '14px' : 0 }}>
          <div style={{ fontWeight: 700, fontSize: '12px', color: accent, marginBottom: '6px' }}>{label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '16px', rowGap: '5px' }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: accent, flexShrink: 0 }} />
                <span style={{ wordBreak: 'break-word' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function BoldTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience', isEducatorCV = true, hidden }: any) {
  const { personal, skills } = data;
  const accent = '#c2185b';
  const boldSkillGroups: [string, string[]][] = [
    [subjectsLabel, skills?.subjects || []],
    ['Professional Skills', skills?.soft_skills || []],
    ['Languages', skills?.languages || []],
  ].filter(([, items]) => items.length > 0) as [string, string[]][];
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
        {/* Header — matches drawBold: full-width banner, photo circle +
            name/title left-aligned (uppercase name), divider, single-line
            icon contact row. */}
        <div style={{ background: accent, color: '#fff', padding: '20px 32px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginTop: '4px' }}>{personal.job_title || validExp[0]?.role || 'Professional'}</div>
          </div>
        </div>
        <div style={{ background: accent, padding: '0 32px 16px' }}>
          <div style={{ height: '22px' }} />
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '10.5px', color: 'rgba(255,255,255,0.9)' }}>
            {personal.email && <span>{ICONS.mail} {personal.email}</span>}
            {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
            {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
          </div>
        </div>

        {/* Single-column body — matches drawBold's section order exactly:
            Summary → Experience → Education → Skills (2-col bullet grid). */}
        <div style={{ padding: '20px 32px', lineHeight: '1.6' }}>
          {personal.bio && <TagUnderlineSection title="Professional Summary" color={accent} icon="📄"><p style={{ color: '#374151', margin: 0, fontSize: '12px' }}>{personal.bio}</p></TagUnderlineSection>}

          {validExp.length > 0 && <TagUnderlineSection title={expLabel} color={accent} icon={ICONS.briefcase}>
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '700', color: '#111827', fontSize: '13px', wordBreak: 'break-word' }}>{e.role}</span>
                  {(e.from || e.to) && <span style={{ color: '#9ca3af', fontSize: '10px', whiteSpace: 'nowrap' }}>{e.from || ''} – {e.to || ''}</span>}
                </div>
                {e.school && <div style={{ color: accent, fontSize: '11.5px', fontWeight: '600', wordBreak: 'break-word' }}>{e.school}</div>}
                {renderDescription(e.description, '#374151')}
              </div>
            ))}
          </TagUnderlineSection>}

          {validEdu.length > 0 && <TagUnderlineSection title="Education" color={accent} icon={ICONS.graduation}>
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ fontWeight: '600', color: '#111827', fontSize: '12.5px', wordBreak: 'break-word' }}>{e.qualification}</div>
                <div style={{ color: '#6b7280', fontSize: '11px', wordBreak: 'break-word' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
              </div>
            ))}
          </TagUnderlineSection>}

          {!hidden?.has('skills') && boldSkillGroups.length > 0 && <TagUnderlineSection title="Skills" color={accent} icon={ICONS.award}>
            <SkillGroupsTwoCol groups={boldSkillGroups} accent={accent} />
          </TagUnderlineSection>}

          {renderCustomSections(data.custom_sections, accent, undefined, hidden)}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, accent, watermark, undefined, '24px 32px', hidden)}
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
function TraditionalTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative', padding: '36px 44px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '1px solid #d1d5db', paddingBottom: '16px', marginBottom: '28px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', letterSpacing: '1px', fontFamily: "Georgia, 'Times New Roman', serif" }}>{personal.full_name || 'Your Name'}</div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px', display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
            {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
            {personal.email && <span>{ICONS.mail} {personal.email}</span>}
          </div>
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
                <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', wordBreak: 'break-word' }}>{e.role}{e.school ? `, ${e.school}` : ''}</div>
                  {e.school && <div style={{ fontSize: '11px', color: '#6b7280', wordBreak: 'break-word' }}>{e.school}</div>}
                  {renderDescription(e.description, '#374151')}
                </div>
              </div>
            ))}
          </div>
        )}
        {validEdu.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
              <div style={{ width: '110px', flexShrink: 0, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#374151', fontFamily: "Georgia, 'Times New Roman', serif" }}>EDUCATION</div>
              <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '2px' }} />
            </div>
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
                <div style={{ width: '110px', flexShrink: 0, fontSize: '10px', color: '#6b7280' }}>{e.year}</div>
                <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827', wordBreak: 'break-word' }}>{e.qualification}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', wordBreak: 'break-word' }}>{e.institution}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!hidden?.has('skills') && (skills?.soft_skills?.length || skills?.subjects?.length || skills?.languages?.length) && (
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ width: '110px', flexShrink: 0, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#374151', fontFamily: "Georgia, 'Times New Roman', serif" }}>SKILLS</div>
            <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
              {([
                ['Key Skills', skills?.subjects || []],
                ['Professional Skills', skills?.soft_skills || []],
                ['Languages', skills?.languages || []],
              ] as [string, string[]][]).filter(([, items]) => items.length > 0).map(([label, items], i) => (
                <div key={label} style={{ fontSize: '12px', color: '#374151', marginTop: i > 0 ? '6px' : 0 }}>
                  <strong>{label}: </strong>{items.join(' · ')}
                </div>
              ))}
            </div>
          </div>
        )}
        {renderCustomSections(data.custom_sections, '#374151', undefined, hidden)}
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#374151', watermark, undefined, undefined, hidden)}
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
function ShadedTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative', padding: '0' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '28px 44px 16px' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '3px', color: '#111827' }}>{personal.full_name || 'YOUR NAME'}</div>
          {(personal.job_title || validExp[0]?.role) && (
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{personal.job_title || validExp[0]?.role}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', fontSize: '11px', color: '#4b5563', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', flexWrap: 'wrap' }}>
            {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
            {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
            {personal.email && <span>{ICONS.mail} {personal.email}</span>}
          </div>
        </div>
        <div style={{ padding: '10px 44px 28px' }}>
          {personal.bio && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ background: '#f3f4f6', padding: '6px 10px', marginBottom: '18px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>PROFILE</div>
              <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0, textAlign: 'center' }}>{personal.bio}</p>
            </div>
          )}
          {validExp.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ background: '#f3f4f6', padding: '6px 10px', marginBottom: '18px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>EMPLOYMENT HISTORY</div>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{
                      flexShrink: 0, width: '15px', height: '15px', borderRadius: '50%',
                      background: '#374151', color: '#fff', fontSize: '9px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: '1px',
                    }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: '10px' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#111827', wordBreak: 'break-word' }}>{e.role}{e.school ? `, ${e.school}` : ''}</span>
                        <span style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</span>
                      </div>
                      {renderDescription(e.description, '#374151')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {validEdu.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ background: '#f3f4f6', padding: '6px 10px', marginBottom: '18px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>EDUCATION</div>
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
                  <span style={{
                    flexShrink: 0, width: '15px', height: '15px', borderRadius: '50%',
                    background: '#374151', color: '#fff', fontSize: '9px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: '1px',
                  }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: '10px' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827', wordBreak: 'break-word' }}>{e.qualification}</div>
                      <div style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{e.year}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', wordBreak: 'break-word' }}>{e.institution}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!hidden?.has('skills') && (() => {
            const shadedSkillGroups = [
              { label: 'Key Skills',          items: skills?.subjects    || [] },
              { label: 'Professional Skills', items: skills?.soft_skills || [] },
              { label: 'Languages',           items: skills?.languages   || [] },
            ].filter(g => g.items.length > 0);
            if (!shadedSkillGroups.length) return null;
            return (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ background: '#f3f4f6', padding: '6px 10px', marginBottom: '18px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#374151' }}>SKILLS</div>
                {shadedSkillGroups.map((group, gi) => (
                  <div key={group.label} style={{ marginBottom: gi < shadedSkillGroups.length - 1 ? '8px' : 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#374151', marginBottom: '3px' }}>
                      {group.label}
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.7', color: '#374151' }}>
                      {group.items.join('  ·  ')}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}
          {renderCustomSections(data.custom_sections, '#374151', undefined, hidden)}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#374151', watermark, undefined, undefined, hidden)}
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
function CrimsonTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience', isEducatorCV = true, hidden }: any) {
  const { personal, skills } = data;
  const crimson = '#c0392b';
  const crimSkillGroups: [string, string[]][] = [
    [subjectsLabel, skills?.subjects || []],
    ['Professional Skills', skills?.soft_skills || []],
    ['Languages', skills?.languages || []],
  ].filter(([, items]) => items.length > 0) as [string, string[]][];
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative' }}>
        {/* Header — matches drawCrimson: centered, photo circle (if any)
            above the name. */}
        <div style={{ background: crimson, padding: '18px 32px 14px', textAlign: 'center' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', margin: '0 auto 10px', display: 'block' }} />}
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>{personal.full_name || 'Your Name'}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', marginTop: '3px' }}>{personal.job_title || validExp[0]?.role || 'Professional'}</div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }} />
        {/* Contact strip — centered, icon-based, matches drawCrimson */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', padding: '8px 32px', borderBottom: '1px solid #e5e7eb', fontSize: '10.5px', color: '#6b7280', flexWrap: 'wrap' }}>
          {personal.email && <span>{ICONS.mail} {personal.email}</span>}
          {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
          {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
        </div>

        {/* Single-column body — matches drawCrimson's section order:
            Summary → Experience → Education → Skills (2-col bullet grid,
            not the progress-bar sidebar this used to show). */}
        <div style={{ padding: '20px 32px', lineHeight: '1.6' }}>
          {personal.bio && <TagUnderlineSection title="Professional Summary" color={crimson} icon="📄"><p style={{ color: '#374151', margin: 0, fontSize: '12px' }}>{personal.bio}</p></TagUnderlineSection>}

          {validExp.length > 0 && <TagUnderlineSection title={expLabel} color={crimson} icon={ICONS.briefcase}>
            {validExp.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '14px' }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827', wordBreak: 'break-word' }}>{e.role}{e.school ? `, ${e.school}` : ''}</div>
                {(e.from || e.to) && <div style={{ fontSize: '10.5px', color: '#9ca3af', fontStyle: 'italic', margin: '2px 0 4px' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</div>}
                {renderDescription(e.description, crimson)}
              </div>
            ))}
          </TagUnderlineSection>}

          {validEdu.length > 0 && <TagUnderlineSection title="Education" color={crimson} icon={ICONS.graduation}>
            {validEdu.map((e: any, i: number) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#111827', wordBreak: 'break-word' }}>{e.qualification}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', wordBreak: 'break-word' }}>{[e.institution, e.year].filter(Boolean).join(' · ')}</div>
              </div>
            ))}
          </TagUnderlineSection>}

          {!hidden?.has('skills') && crimSkillGroups.length > 0 && <TagUnderlineSection title="Skills" color={crimson} icon={ICONS.award}>
            <SkillGroupsTwoCol groups={crimSkillGroups} accent={crimson} />
          </TagUnderlineSection>}

          {renderCustomSections(data.custom_sections, crimson, undefined, hidden)}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, crimson, watermark, undefined, undefined, hidden)}
    </div>
  );
}

/* ── Sage Template (Image 16 — green header, clean minimal) ──────────────── */
function SageTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience', isEducatorCV = true, hidden }: any) {
  const { personal, skills } = data;
  const sage = '#7fa37f';
  const sageBg = '#e8f0e8';
  return (
    <div style={{ ...wrapperStyle }}>
      <div className="cv-content-page" style={{ width: '794px', boxSizing: 'border-box', background: '#fff', position: 'relative' }}>
        {/* Green header */}
        <div style={{ background: sageBg, padding: '24px 36px', borderRadius: '8px', margin: '20px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a2e1a' }}>{personal.full_name || 'Your Name'}</div>
              <div style={{ fontSize: '13px', color: '#4b6c4b', marginTop: '2px' }}>{personal.job_title || validExp[0]?.role || 'Professional'}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#374151', maxWidth: '260px' }}>
              {personal.email && <div style={{ wordBreak: 'break-word' }}>{ICONS.mail} {personal.email}</div>}
              {personal.phone && <div>{ICONS.phone} {personal.phone}</div>}
              {personal.address && <div style={{ wordBreak: 'break-word' }}>{ICONS.mapPin} {personal.address}</div>}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 36px 28px' }}>
          {personal.bio && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: sage, marginBottom: '8px' }}>Professional Summary</div>
              <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
            </div>
          )}
          {validExp.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: sage, marginBottom: '12px' }}>Career Experience</div>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '10px' }}>
                    <div style={{ fontSize: '13px', color: sage, wordBreak: 'break-word' }}>{e.role}{e.school ? `, ${e.school}` : ''}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{[e.from, e.to].filter(Boolean).join(' — ')}</div>
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
                  <div style={{ fontSize: '13px', color: sage, wordBreak: 'break-word' }}>{e.qualification}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', wordBreak: 'break-word' }}>{[e.institution, e.year].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
          {!hidden?.has('skills') && (() => {
            const sageSkillGroups = [
              { label: subjectsLabel,          items: skills?.subjects    || [] },
              { label: 'Professional Skills',  items: skills?.soft_skills || [] },
              { label: 'Languages',            items: skills?.languages   || [] },
            ].filter(g => g.items.length > 0);
            if (!sageSkillGroups.length) return null;
            return (
              <div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: sage, marginBottom: '10px' }}>Skills & Languages</div>
                {sageSkillGroups.map((group, gi) => (
                  <div key={group.label} style={{ marginBottom: gi < sageSkillGroups.length - 1 ? '12px' : 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: sage, marginBottom: '6px' }}>{group.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {group.items.map((s: string, i: number) => (
                        <span key={i} style={{ background: sageBg, color: '#374151', padding: '4px 12px', borderRadius: '20px', fontSize: '11px' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {renderCustomSections(data.custom_sections, sage, undefined, hidden)}
        </div>
        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, sage, watermark, undefined, undefined, hidden)}
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '22px 0 20px' }}>
      <div style={{ flex: 1, height: '1px', background: ELEGANT_LINE }} />
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '14px', fontWeight: 700, color: ELEGANT_INK, whiteSpace: 'nowrap' }}>
        {title}
      </span>
      <div style={{ flex: 1, height: '1px', background: ELEGANT_LINE }} />
    </div>
  );
}

function ElegantTemplate({ data, wrapperStyle, validEdu, validExp, watermark, expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  // Subtitle uses the user's chosen job title if set, otherwise falls back
  // to the most recent role — users can type multiple roles separated by
  // "/" (e.g. "ICT Coordinator / Educator").
  const subtitle = personal.job_title || validExp[0]?.role || '';
  const contactParts = [
    personal.address,
    personal.phone,
    personal.email,
    personal.id_number ? `ID: ${personal.id_number}` : null,
  ].filter(Boolean);

  const elegantSkillGroups = [
    { label: 'Key Skills',          items: skills?.subjects    || [] },
    { label: 'Professional Skills', items: skills?.soft_skills || [] },
    { label: 'Languages',           items: skills?.languages   || [] },
  ].filter(g => g.items.length > 0);

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
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <img src={personal.photo_url} alt="Profile" style={{ display: 'block', margin: '0 auto', width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${ELEGANT_LINE}` }} />
            </div>
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
            <div style={{ marginTop: '10px', fontSize: '11px', color: ELEGANT_MUTED, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', columnGap: '10px', rowGap: '4px' }}>
              {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
              {personal.phone && <span>{ICONS.phone} {personal.phone}</span>}
              {personal.email && <span>{ICONS.mail} {personal.email}</span>}
              {personal.id_number && <span>{ICONS.user} ID: {personal.id_number}</span>}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: ELEGANT_INK, wordBreak: 'break-word' }}>{e.role}</span>
                  {(e.from || e.to) && (
                    <span style={{ fontSize: '11px', color: ELEGANT_MUTED, whiteSpace: 'nowrap' }}>
                      {[e.from, e.to].filter(Boolean).join(' – ')}
                    </span>
                  )}
                </div>
                {e.school && <div style={{ fontSize: '12px', color: ELEGANT_MUTED, marginTop: '2px', wordBreak: 'break-word' }}>{e.school}</div>}
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
              <div key={i} style={{ textAlign: 'center', fontSize: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', columnGap: '6px', rowGap: '2px' }}>
                <span style={{ fontWeight: 700, color: ELEGANT_INK, wordBreak: 'break-word' }}>{e.qualification}</span>
                {e.institution && <><span style={{ color: ELEGANT_LINE }}>|</span><span style={{ color: ELEGANT_MUTED, wordBreak: 'break-word' }}>{e.institution}</span></>}
                {e.year && <><span style={{ color: ELEGANT_LINE }}>|</span><span style={{ color: ELEGANT_MUTED }}>{e.year}</span></>}
              </div>
            ))}
          </>
        )}

        {/* Skills and Attributes — grouped by category */}
        {!hidden?.has('skills') && elegantSkillGroups.length > 0 && (
          <>
            <ElegantHeading title="Skills and Attributes" />
            {elegantSkillGroups.map((group, gi) => (
              <div key={group.label} style={{ marginBottom: gi < elegantSkillGroups.length - 1 ? '10px' : 0 }}>
                <div style={{
                  fontSize: '11px', fontWeight: 700, fontStyle: 'italic',
                  color: ELEGANT_INK, marginBottom: '4px',
                }}>
                  {group.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '24px', rowGap: '4px' }}>
                  {group.items.map((s: string, i: number) => (
                    <div key={i} style={{ fontSize: '12px', color: ELEGANT_BODY, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: ELEGANT_MUTED, flexShrink: 0 }}>•</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {renderCustomSections(data.custom_sections, ELEGANT_INK, ELEGANT_LINE, hidden)}

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, ELEGANT_INK, watermark, ELEGANT_LINE, undefined, hidden)}
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
    <div style={{ textAlign: 'center', margin: '26px 0 22px' }}>
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '14px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: HERITAGE_INK }}>
        {title}
      </span>
      <div style={{ height: '2px', borderTop: `1px solid ${HERITAGE_RULE}`, borderBottom: `1px solid ${HERITAGE_RULE}`, marginTop: '7px' }} />
    </div>
  );
}

function HeritageTemplate({ data, wrapperStyle, validEdu, validExp, watermark, expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  const subtitle = personal.job_title || validExp[0]?.role || '';
  const contactParts = [
    personal.address,
    personal.email,
    personal.phone,
    personal.id_number ? `ID: ${personal.id_number}` : null,
  ].filter(Boolean);
  const heritageIcons: [string, string][] = [
    [ICONS.mapPin, personal.address], [ICONS.mail, personal.email], [ICONS.phone, personal.phone],
    ...(personal.id_number ? [[ICONS.user, `ID: ${personal.id_number}`] as [string,string]] : []),
  ].filter(([,v]) => !!v) as [string,string][];

  const heritageSkillGroups = [
    { label: 'Key Skills',          items: skills?.subjects    || [] },
    { label: 'Professional Skills', items: skills?.soft_skills || [] },
    { label: 'Languages',           items: skills?.languages   || [] },
  ].filter(g => g.items.length > 0);

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
        {/* Photo (if any) — sits above everything else, including the top rule */}
        {personal.photo_url && (
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <img src={personal.photo_url} alt="Profile" style={{ display: 'block', margin: '0 auto', width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${HERITAGE_RULE}` }} />
          </div>
        )}

        {/* Top double rule + centered contact */}
        <div style={{ height: '2px', borderTop: `1px solid ${HERITAGE_RULE}`, borderBottom: `1px solid ${HERITAGE_RULE}` }} />
        {contactParts.length > 0 && (
          <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', color: HERITAGE_MUTED, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', columnGap: '14px', rowGap: '4px' }}>
            {heritageIcons.map(([icon, text], i) => <span key={i}>{icon} {text}</span>)}
          </div>
        )}

        {/* Name + subtitle */}
        <div style={{ textAlign: 'center', marginTop: '14px' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: HERITAGE_INK, wordBreak: 'break-word' }}>{e.role}</span>
                  {(e.from || e.to) && (
                    <span style={{ fontWeight: 700, fontSize: '11px', color: HERITAGE_INK, whiteSpace: 'nowrap' }}>
                      {[e.from, e.to].filter(Boolean).join(' — ')}
                    </span>
                  )}
                </div>
                {e.school && <div style={{ fontSize: '11px', color: HERITAGE_MUTED, marginTop: '2px', wordBreak: 'break-word' }}>{e.school}</div>}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: HERITAGE_INK, wordBreak: 'break-word' }}>{e.qualification}</span>
                  {e.year && <span style={{ fontWeight: 700, fontSize: '11px', color: HERITAGE_INK, whiteSpace: 'nowrap' }}>{e.year}</span>}
                </div>
                {e.institution && <div style={{ fontSize: '11px', color: HERITAGE_MUTED, marginTop: '2px', wordBreak: 'break-word' }}>{e.institution}</div>}
              </div>
            ))}
          </>
        )}

        {/* Skills and Attributes — grouped, inline "Name (description)" */}
        {!hidden?.has('skills') && heritageSkillGroups.length > 0 && (
          <>
            <HeritageHeading title="Skills and Attributes" />
            {heritageSkillGroups.map((group, gi) => (
              <div key={group.label} style={{ marginBottom: gi < heritageSkillGroups.length - 1 ? '8px' : 0 }}>
                <div style={{
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.5px', color: HERITAGE_INK, marginBottom: '3px',
                }}>
                  {group.label}
                </div>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.8', color: HERITAGE_BODY }}>
                  {group.items.map((s: string, i: number) => {
                    const [name, desc] = String(s).split('|').map(x => x.trim());
                    return (
                      <span key={i}>
                        {name}
                        {desc && <> (<span style={{ color: HERITAGE_MUTED }}>{desc}</span>)</>}
                        {i < group.items.length - 1 ? ', ' : '.'}
                      </span>
                    );
                  })}
                </p>
              </div>
            ))}
          </>
        )}

        {renderCustomSections(data.custom_sections, HERITAGE_INK, HERITAGE_RULE, hidden)}

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, HERITAGE_INK, watermark, HERITAGE_RULE, undefined, hidden)}
    </div>
  );
}

/* ── Playful Template ───────────────────────────────────────────────────────
 * Cream background, large bold stacked name left, contact top-right,
 * decorative color-blotch circles (yellow + teal), full-width About Me,
 * two-column Experience/Education body, 3-column bullet Skills grid.
 * Mirrors the "Peyton Davis" design reference.
 */
const PL_BG       = '#f5f0e8';   // warm cream background
const PL_INK      = '#111111';   // near-black — name, headings, body
const PL_MUTED    = '#555555';   // gray — contact info, dates, meta
const PL_YELLOW   = '#f0c040';   // mustard yellow circles
const PL_TEAL     = '#4ab8b8';   // teal circles

function PlayfulHeading({ title, icon }: { title: string; icon?: string }) {
  return (
    <div style={{ marginBottom: '18px', marginTop: '16px' }}>
      {/* Title row: icon + text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        {icon && <span style={{ fontSize: '13px', lineHeight: 1 }}>{icon}</span>}
        <span style={{
          fontSize: '13px', fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '1.5px', color: PL_INK,
        }}>
          {title}
        </span>
      </div>
      {/* Full-width underline — same 1px weight as all other section lines */}
      <div style={{ height: '1px', background: PL_INK, width: '100%' }} />
    </div>
  );
}

function PlayfulTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience' }: any) {
  const { personal, skills } = data;

  const allSkills = [
    ...(skills?.subjects    || []),
    ...(skills?.soft_skills || []),
    ...(skills?.languages   || []),
  ];

  return (
    <div style={{ ...wrapperStyle, background: PL_BG }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          background: PL_BG,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Arial', Helvetica, sans-serif",
          color: PL_INK,
        }}
      >
        {/* ── Decorative circles ── */}
        {/* Large yellow blob — top left */}
        <div style={{
          position: 'absolute', top: '-30px', left: '-30px',
          width: '130px', height: '130px', borderRadius: '50%',
          background: PL_YELLOW, opacity: 0.85, zIndex: 0,
        }} />
        {/* Small teal dot — below name, left */}
        <div style={{
          position: 'absolute', top: '110px', left: '18px',
          width: '22px', height: '22px', borderRadius: '50%',
          background: PL_TEAL, opacity: 0.9, zIndex: 0,
        }} />
        {/* Large yellow blob — bottom right */}
        <div style={{
          position: 'absolute', bottom: '-40px', right: '-40px',
          width: '160px', height: '160px', borderRadius: '50%',
          background: PL_YELLOW, opacity: 0.75, zIndex: 0,
        }} />
        {/* Teal blob — bottom right, offset */}
        <div style={{
          position: 'absolute', bottom: '10px', right: '80px',
          width: '80px', height: '80px', borderRadius: '50%',
          background: PL_TEAL, opacity: 0.55, zIndex: 0,
        }} />

        {/* ── Header ── */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '44px 48px 20px 56px',
        }}>
          {/* Name — large, bold, stacked on two lines */}
          <div>
            {(() => {
              const parts = (personal.full_name || 'Your Name').trim().split(' ');
              const last  = parts.length > 1 ? parts.pop() : '';
              const first = parts.join(' ');
              return (
                <>
                  <div style={{ fontSize: '46px', fontWeight: 900, lineHeight: 1.05, color: PL_INK, letterSpacing: '-0.5px' }}>
                    {first || last}
                  </div>
                  {last && first && (
                    <div style={{ fontSize: '46px', fontWeight: 900, lineHeight: 1.05, color: PL_INK, letterSpacing: '-0.5px' }}>
                      {last}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Contact — top right, small gray */}
          <div style={{ textAlign: 'right', fontSize: '10.5px', color: PL_MUTED, lineHeight: '1.8', marginTop: '6px', minWidth: '180px' }}>
            {personal.address && <div>{personal.address}</div>}
            {personal.phone   && <div>{personal.phone}</div>}
            {personal.email   && <div>{personal.email}</div>}
            {personal.id_number && <div>ID: {personal.id_number}</div>}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ position: 'relative', zIndex: 1, padding: '0 48px 48px 56px' }}>

          {/* About Me — full width */}
          {personal.bio && (
            <div style={{ marginBottom: '28px' }}>
              <PlayfulHeading title="About Me" icon="📄" />
              <p style={{ fontSize: '12px', color: '#333', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
            </div>
          )}

          {/* Two-column: Experience (left) + Education (right)
               Use align-items: flex-start so the grid does NOT stretch the
               shorter column to match the taller one — that was causing the
               white-space gap when experience had many more entries. */}
          {(validExp.length > 0 || validEdu.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px', marginBottom: '28px', alignItems: 'flex-start' }}>
              {/* Experience column */}
              <div>
                {validExp.length > 0 && (
                  <>
                    <PlayfulHeading title={expLabel} icon="💼" />
                    {validExp.map((e: any, i: number) => (
                      <div key={i} style={{ marginBottom: '16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: PL_INK }}>
                          {e.role}{e.school ? ` / ${e.school}` : ''}
                        </div>
                        {(e.from || e.to) && (
                          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: PL_MUTED, marginBottom: '4px', letterSpacing: '0.3px' }}>
                            {[e.from, e.to].filter(Boolean).join(' – ')}
                          </div>
                        )}
                        {renderDescription(e.description, PL_INK, '11px')}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Education column — starts at the same top as Experience,
                   does NOT stretch to fill. */}
              <div>
                {validEdu.length > 0 && (
                  <>
                    <PlayfulHeading title="Education" icon="🎓" />
                    {validEdu.map((e: any, i: number) => (
                      <div key={i} style={{ marginBottom: '16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: PL_INK }}>
                          {e.qualification}
                        </div>
                        {(e.institution || e.year) && (
                          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: PL_MUTED, letterSpacing: '0.3px', marginBottom: '2px' }}>
                            {[e.institution, e.year].filter(Boolean).join(', ')}
                          </div>
                        )}
                        {e.description && (
                          <p style={{ fontSize: '11px', color: '#444', lineHeight: '1.6', margin: '4px 0 0' }}>{e.description}</p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Skills — categorised, 2-column bullet layout */}
          {allSkills.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <PlayfulHeading title="Skills" icon="⚙️" />
              {([
                { label: 'Key Skills',          items: skills?.subjects    || [] },
                { label: 'Professional Skills', items: skills?.soft_skills || [] },
                { label: 'Languages',           items: skills?.languages   || [] },
              ] as { label: string; items: string[] }[])
                .filter(g => g.items.length > 0)
                .map((group, gi) => (
                  <div key={gi} style={{ marginBottom: '10px' }}>
                    <div style={{ fontWeight: 700, fontSize: '10.5px', textTransform: 'uppercase', color: PL_INK, marginBottom: '4px', letterSpacing: '0.5px' }}>
                      {group.label}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
                      {[
                        group.items.filter((_: string, i: number) => i % 2 === 0),
                        group.items.filter((_: string, i: number) => i % 2 === 1),
                      ].map((col, ci) => (
                        <div key={ci}>
                          {col.map((s: string, si: number) => (
                            <div key={si} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '3px' }}>
                              <span style={{ color: PL_INK, fontSize: '11px', marginTop: '1px', flexShrink: 0 }}>•</span>
                              <span style={{ fontSize: '11.5px', color: '#333', lineHeight: '1.5' }}>{s}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {renderCustomSections(data.custom_sections, PL_INK)}
        </div>

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      <div style={{ background: PL_BG }}>{renderReferencesPage(data.references, PL_INK, watermark)}</div>
    </div>
  );
}

/* ── Casual Template ────────────────────────────────────────────────────────
 * Identical look to Playful (cream bg, large stacked name, colour-blob
 * circles, categorised skills) but fully single-column — no side-by-side
 * Experience/Education grid. Sections flow top-to-bottom:
 * About Me → Experience → Education → Skills → Custom → References.
 */
function CasualTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', subjectsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;

  const allSkills = [
    ...(skills?.subjects    || []),
    ...(skills?.soft_skills || []),
    ...(skills?.languages   || []),
  ];

  const skillGroups = [
    { label: 'Key Skills',          items: skills?.subjects    || [] },
    { label: 'Professional Skills', items: skills?.soft_skills || [] },
    { label: 'Languages',           items: skills?.languages   || [] },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{ ...wrapperStyle, background: PL_BG }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          background: PL_BG,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Arial', Helvetica, sans-serif",
          color: PL_INK,
        }}
      >
        {/* ── Decorative circles (same as Playful) ── */}
        <div style={{ position: 'absolute', top: '-30px', left: '-30px', width: '130px', height: '130px', borderRadius: '50%', background: PL_YELLOW, opacity: 0.85, zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '110px', left: '18px', width: '22px', height: '22px', borderRadius: '50%', background: PL_TEAL, opacity: 0.9, zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: PL_YELLOW, opacity: 0.75, zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: '10px', right: '80px', width: '80px', height: '80px', borderRadius: '50%', background: PL_TEAL, opacity: 0.55, zIndex: 0 }} />

        {/* ── Header: stacked name left, contact right ── */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '44px 48px 20px 56px' }}>
          <div>
            {(() => {
              const parts = (personal.full_name || 'Your Name').trim().split(' ');
              const last  = parts.length > 1 ? parts.pop() : '';
              const first = parts.join(' ');
              return (
                <>
                  <div style={{ fontSize: '46px', fontWeight: 900, lineHeight: 1.05, color: PL_INK, letterSpacing: '-0.5px' }}>{first || last}</div>
                  {last && first && <div style={{ fontSize: '46px', fontWeight: 900, lineHeight: 1.05, color: PL_INK, letterSpacing: '-0.5px' }}>{last}</div>}
                </>
              );
            })()}
          </div>
          <div style={{ textAlign: 'right', fontSize: '10.5px', color: PL_MUTED, lineHeight: '1.8', marginTop: '6px', minWidth: '180px' }}>
            {personal.address   && <div>{ICONS.mapPin} {personal.address}</div>}
            {personal.phone     && <div>{ICONS.phone} {personal.phone}</div>}
            {personal.email     && <div>{ICONS.mail} {personal.email}</div>}
            {personal.id_number && <div>{ICONS.user} ID: {personal.id_number}</div>}
          </div>
        </div>

        {/* ── Body: single column ── */}
        <div style={{ position: 'relative', zIndex: 1, padding: '0 48px 48px 56px' }}>

          {/* About Me */}
          {personal.bio && (
            <div style={{ marginBottom: '28px' }}>
              <PlayfulHeading title="About Me" icon="📄" />
              <p style={{ fontSize: '12px', color: '#333', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
            </div>
          )}

          {/* Experience — full width, single column */}
          {validExp.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <PlayfulHeading title={expLabel} icon="💼" />
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: PL_INK, wordBreak: 'break-word' }}>
                    {e.role}{e.school ? ` / ${e.school}` : ''}
                  </div>
                  {(e.from || e.to) && (
                    <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: PL_MUTED, marginBottom: '4px', letterSpacing: '0.3px' }}>
                      {[e.from, e.to].filter(Boolean).join(' – ')}
                    </div>
                  )}
                  {renderDescription(e.description, PL_INK, '11px')}
                </div>
              ))}
            </div>
          )}

          {/* Education — full width, single column */}
          {validEdu.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <PlayfulHeading title="Education" icon="🎓" />
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px', color: PL_INK, wordBreak: 'break-word' }}>
                    {e.qualification}
                  </div>
                  {(e.institution || e.year) && (
                    <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: PL_MUTED, letterSpacing: '0.3px', marginBottom: '2px' }}>
                      {[e.institution, e.year].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {e.description && (
                    <p style={{ fontSize: '11px', color: '#444', lineHeight: '1.6', margin: '4px 0 0' }}>{e.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Skills — categorised, 2-column bullet layout per category */}
          {!hidden?.has('skills') && allSkills.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <PlayfulHeading title="Skills" icon="⚙️" />
              {skillGroups.map((group, gi) => (
                <div key={gi} style={{ marginBottom: '10px' }}>
                  <div style={{ fontWeight: 700, fontSize: '10.5px', textTransform: 'uppercase', color: PL_INK, marginBottom: '4px', letterSpacing: '0.5px' }}>
                    {group.label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
                    {[
                      group.items.filter((_: string, i: number) => i % 2 === 0),
                      group.items.filter((_: string, i: number) => i % 2 === 1),
                    ].map((col, ci) => (
                      <div key={ci}>
                        {col.map((s: string, si: number) => (
                          <div key={si} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '3px' }}>
                            <span style={{ color: PL_INK, fontSize: '11px', marginTop: '1px', flexShrink: 0 }}>•</span>
                            <span style={{ fontSize: '11.5px', color: '#333', lineHeight: '1.5' }}>{s}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {renderCustomSections(data.custom_sections, PL_INK, undefined, hidden)}
        </div>

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      <div style={{ background: PL_BG }}>{renderReferencesPage(data.references, PL_INK, watermark, undefined, undefined, hidden)}</div>
    </div>
  );
}

/* ── Skyline Template ────────────────────────────────────────────────────── */
// Two-column: a light-gray sidebar (photo, name, Contact / About Me / Skills)
// cut by a diagonal blue accent wedge in the top-left corner, with
// Education/Experience in the main column as a dotted timeline — a
// deliberate re-attempt at a sidebar-style layout (see the dead
// SidebarTemplate/drawSidebar above for the page-1-only-sidebar /
// page-2+-horizontal-strip pattern this style previously needed to avoid
// leaving an unused white strip on pages after the first; this template's
// cvExport.ts counterpart, drawSkyline, follows that same pattern).
// A dedicated sidebar-section label for Skyline, NOT the shared
// `SidebarSection` component above. `SidebarSection` was built for the old
// dead SidebarTemplate's solid dark-blue sidebar — it renders its title in
// white text at 55% opacity, which is illegible (reads as "missing"/
// "merged into the background") on Skyline's light-gray sidebar. Confirmed
// by rendering both versions and sampling actual pixel colors — the white
// labels were genuinely near-invisible, not just hard to see in a casual
// screenshot.
function SkylineSidebarLabel({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: accent, marginBottom: '8px', borderBottom: '1px solid #d7deea', paddingBottom: '4px' }}>{title}</div>
      {children}
    </div>
  );
}

function SkylineTimelineItem({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div style={{ position: 'relative', paddingLeft: '16px', borderLeft: `2px solid ${accent}33`, marginBottom: '16px' }}>
      <span style={{ position: 'absolute', left: '-5px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: accent, border: '2px solid #fff' }} />
      {children}
    </div>
  );
}

function SkylineTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  const accent = '#3e63b0';
  const sidebarBg = '#f4f5f7';
  const allSkills = [...(skills?.subjects || []), ...(skills?.soft_skills || [])];

  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          // The gray sidebar fill lives HERE, as a background-image gradient
          // on the outer container, not as `background` on the sidebar
          // column div below. A flex child's own background only ever
          // covers ITS content height — if Education/Experience in the main
          // column run longer than Contact/About Me/Skills in the sidebar
          // (very common), relying on flex "stretch" to make the sidebar
          // div tall enough left the gray cut short partway down the page,
          // with the taller column's lower content sitting on bare white.
          // A background-image gradient painted on the parent instead always
          // covers the parent's FULL actual height (which is simply
          // whichever column ends up taller) — so the gray sidebar never
          // runs out no matter which side is longer. This is the standard
          // "equal-height columns" CSS technique, used instead of debugging
          // flex stretch across this app's various preview wrappers.
          background: `linear-gradient(to right, ${sidebarBg} 0, ${sidebarBg} 240px, #fff 240px, #fff 100%)`,
          position: 'relative',
          display: 'flex',
        }}
      >
        {/* ── Sidebar ── */}
        {/* No `background` here anymore — the parent's gradient above
            already paints this column's full-height gray; this div is now
            purely for layout (width) and for positioning the diagonal
            wedge/content on top of that gray. */}
        <div style={{ width: '240px', minWidth: '240px', position: 'relative', overflow: 'hidden' }}>
          {/* Diagonal accent wedge */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '340px', height: '300px', background: accent, clipPath: 'polygon(0 0, 100% 0, 0 65%)' }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '34px 20px 0' }}>
            {personal.photo_url ? (
              <img src={personal.photo_url} alt="" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }} />
            ) : (
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#fff', border: '4px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '34px', fontWeight: 800, color: accent }}>
                {(personal.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ fontSize: '21px', fontWeight: 800, color: accent, marginTop: '16px', lineHeight: '1.2', wordBreak: 'break-word' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{personal.job_title || validExp[0]?.role || 'Professional'}</div>
          </div>
          <div style={{ position: 'relative', zIndex: 1, padding: '26px 20px 28px' }}>
            {(personal.phone || personal.email || personal.address) && (
              <SkylineSidebarLabel title="Contact" accent={accent}>
                {personal.phone   && <div style={{ marginBottom: '6px', fontSize: '11px', color: '#374151' }}>{ICONS.phone} {personal.phone}</div>}
                {personal.email   && <div style={{ marginBottom: '6px', fontSize: '11px', color: '#374151', wordBreak: 'break-word' }}>{ICONS.mail} {personal.email}</div>}
                {personal.address && <div style={{ fontSize: '11px', color: '#374151', wordBreak: 'break-word' }}>{ICONS.mapPin} {personal.address}</div>}
              </SkylineSidebarLabel>
            )}
            {personal.bio && (
              <SkylineSidebarLabel title="About Me" accent={accent}>
                <p style={{ fontSize: '11px', color: '#374151', lineHeight: '1.6', margin: 0 }}>{personal.bio}</p>
              </SkylineSidebarLabel>
            )}
            {!hidden?.has('skills') && allSkills.length > 0 && (
              <SkylineSidebarLabel title={skillsLabel} accent={accent}>
                {allSkills.map((s: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '5px', fontSize: '11px', color: '#374151' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: accent, marginTop: '4px', flexShrink: 0 }} />
                    {s}
                  </div>
                ))}
              </SkylineSidebarLabel>
            )}
            {skills?.languages?.length > 0 && (
              <SkylineSidebarLabel title="Languages" accent={accent}><BulletList items={skills.languages} /></SkylineSidebarLabel>
            )}
          </div>
        </div>

        {/* ── Main column ── */}
        <div style={{ flex: 1, padding: '34px 30px 28px', minWidth: 0 }}>
          {validEdu.length > 0 && (
            <Section title="Education" color={accent} icon={ICONS.graduation}>
              {validEdu.map((e: any, i: number) => (
                <SkylineTimelineItem key={i} accent={accent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '10px' }}>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '13px', wordBreak: 'break-word' }}>{e.qualification}</div>
                    {e.year && <div style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{e.year}</div>}
                  </div>
                  <div style={{ fontSize: '12px', color: accent, fontStyle: 'italic', wordBreak: 'break-word' }}>{e.institution}</div>
                </SkylineTimelineItem>
              ))}
            </Section>
          )}
          {validExp.length > 0 && (
            <Section title={expLabel} color={accent} icon={ICONS.briefcase}>
              {validExp.map((e: any, i: number) => (
                <SkylineTimelineItem key={i} accent={accent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '10px' }}>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '13px', wordBreak: 'break-word' }}>{e.role}</div>
                    {(e.from || e.to) && <div style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{[e.from, e.to].filter(Boolean).join(' – ')}</div>}
                  </div>
                  <div style={{ fontSize: '12px', color: accent, fontStyle: 'italic', wordBreak: 'break-word' }}>{e.school}</div>
                  {renderDescription(e.description, accent)}
                </SkylineTimelineItem>
              ))}
            </Section>
          )}
          {renderCustomSections(data.custom_sections, accent, undefined, hidden)}
        </div>

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, accent, watermark, undefined, undefined, hidden)}
    </div>
  );
}

/* ── Azure Template ──────────────────────────────────────────────────────
   Light-blue corner swatch behind a circular photo, thin uppercase name,
   and a genuine two-column body (not a shaded sidebar) — a narrower left
   column for Summary/Education/Skills/Language, a wider right column for
   Experience. A slim dark bar closes off the bottom of every page. */
function AzureTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  const accent = '#2f6fad';
  const banner = '#bfe0f5';
  const allSkills = [...(skills?.subjects || []), ...(skills?.soft_skills || [])];
  const jobTitle = (personal.job_title || validExp[0]?.role || 'Professional').trim();

  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        {/* Decorative corner swatch, sitting behind the header */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '230px', height: '46px', background: banner }} />
        {/* Closing bar at the very bottom of the page */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '6px', background: '#1f2937' }} />

        <div style={{ position: 'relative', padding: '84px 40px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {personal.photo_url ? (
              <img src={personal.photo_url} alt="" style={{ width: '104px', height: '104px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '104px', height: '104px', borderRadius: '50%', background: '#fff', border: '4px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '28px', fontWeight: 800, color: accent }}>
                {(personal.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '30px', fontWeight: 300, letterSpacing: '3px', textTransform: 'uppercase', color: '#1f2937', wordBreak: 'break-word' }}>{personal.full_name || 'Your Name'}</div>
              <div style={{ fontSize: '14px', color: '#6b7280', letterSpacing: '1px', marginTop: '4px' }}>{jobTitle}</div>
              <div style={{ display: 'flex', gap: '18px', marginTop: '12px', fontSize: '11px', color: '#374151', flexWrap: 'wrap' }}>
                {personal.phone   && <span>{ICONS.phone} {personal.phone}</span>}
                {personal.email   && <span>{ICONS.mail} {personal.email}</span>}
                {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: '#e5e7eb', margin: '22px 40px 0' }} />

        <div style={{ display: 'flex', gap: '36px', padding: '24px 40px 30px' }}>
          {/* Left column — narrower: Summary / Education / Skills / Language */}
          <div style={{ width: '36%', minWidth: 0 }}>
            {personal.bio && (
              <Section title="Summary" color={accent}>
                <p style={{ fontSize: '11.5px', color: '#374151', lineHeight: '1.6', margin: 0 }}>{personal.bio}</p>
              </Section>
            )}
            {validEdu.length > 0 && (
              <Section title="Education" color={accent}>
                {validEdu.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: '14px' }}>
                    {e.year && <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151' }}>{e.year}</div>}
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '12px', wordBreak: 'break-word' }}>{e.qualification}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', wordBreak: 'break-word' }}>{e.institution}</div>
                  </div>
                ))}
              </Section>
            )}
            {!hidden?.has('skills') && allSkills.length > 0 && (
              <Section title={skillsLabel} color={accent}>
                <BulletList items={allSkills} />
              </Section>
            )}
            {skills?.languages?.length > 0 && (
              <Section title="Language" color={accent}>
                <BulletList items={skills.languages} />
              </Section>
            )}
          </div>

          {/* Right column — wider: Experience */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {validExp.length > 0 && (
              <Section title={expLabel} color={accent}>
                {validExp.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: '13px', wordBreak: 'break-word' }}>{e.role}</div>
                      {(e.from || e.to) && <div style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{[e.from, e.to].filter(Boolean).join(' – ')}</div>}
                    </div>
                    <div style={{ fontSize: '12px', color: accent, wordBreak: 'break-word' }}>{e.school}</div>
                    {renderDescription(e.description, accent)}
                  </div>
                ))}
              </Section>
            )}
            {renderCustomSections(data.custom_sections, accent, undefined, hidden)}
          </div>
        </div>

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, accent, watermark, undefined, '28px 40px', hidden)}
    </div>
  );
}

/* ── Dove Sidebar Label ──────────────────────────────────────────────────
   Built for Dove's own light blue-gray sidebar (not reused from the dark
   solid-sidebar SidebarSection component) — that mismatch is exactly what
   made Skyline's sidebar labels render invisible, so every light-sidebar
   template gets its own label styled for ITS background. */
function DoveSidebarLabel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1f2937', marginBottom: '10px', borderBottom: '1.5px solid rgba(31,41,55,0.22)', paddingBottom: '6px' }}>{title}</div>
      {children}
    </div>
  );
}

/* ── Dove Template ───────────────────────────────────────────────────────
   Soft blue-gray banner behind a circular photo at top, with a matching
   blue-gray sidebar "card" beneath it for Contact/Education/Skills/
   Language, and a plain white main column for About Me/Work Experience.
   The sidebar's background is a separate absolutely-positioned div pinned
   to the body's full height (top-0/bottom-0 inside a position:relative
   parent) rather than its own flex-child background — the same
   "stretch to the tallest column" fix proven on Skyline, just without
   needing a gradient since only one column needs a tint here. */
function DoveTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  const accent = '#3c5a7a';
  const bannerBg = '#cfdbe8';
  // The banner is shorter than it first looks and stops well above where
  // the sidebar card begins (plain white in between, per the earlier fix),
  // and now wraps partway around the photo circle instead of leaving a gap
  // before it — its left edge sits at the photo's own horizontal center,
  // so the photo's right half appears to sit "on" the banner while its own
  // white border ring is what actually separates the two colors, not a gap
  // of page background.
  const BANNER_TOP = 68, BANNER_H = 174;
  const PHOTO_D = 196, PHOTO_L = 54, PHOTO_T = 56;
  const BANNER_LEFT = PHOTO_L + PHOTO_D / 2; // wraps around the photo's right half
  const HEADER_BOX_H = BANNER_TOP + BANNER_H; // 242 — banner's own bottom edge
  const SIDEBAR_GAP = 53; // white space between banner bottom and sidebar top
  const SIDEBAR_W = 270;
  const SIDEBAR_RADIUS = 36; // rounded top corners on the sidebar card
  const SIDEBAR_PAD_TOP = 40; // top padding inside the sidebar card (also aligns "About Me" to the sidebar's first line)
  const allSkills = [...(skills?.subjects || []), ...(skills?.soft_skills || [])];

  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
        }}
      >
        {/* Header: banner + photo. The photo's bottom intentionally
            overflows past this box's own height (HEADER_BOX_H), which is
            fine — nothing is painted over that overflow until the sidebar
            card further down, and the gap is sized so it never reaches it. */}
        <div style={{ position: 'relative', height: `${HEADER_BOX_H}px` }}>
          <div style={{ position: 'absolute', top: `${BANNER_TOP}px`, left: `${BANNER_LEFT}px`, right: 0, height: `${BANNER_H}px`, background: bannerBg }} />
          {personal.photo_url ? (
            <img src={personal.photo_url} alt="" style={{ position: 'absolute', left: `${PHOTO_L}px`, top: `${PHOTO_T}px`, width: `${PHOTO_D}px`, height: `${PHOTO_D}px`, borderRadius: '50%', objectFit: 'cover', border: '6px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }} />
          ) : (
            <div style={{ position: 'absolute', left: `${PHOTO_L}px`, top: `${PHOTO_T}px`, width: `${PHOTO_D}px`, height: `${PHOTO_D}px`, borderRadius: '50%', background: '#fff', border: '6px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '46px', fontWeight: 800, color: accent }}>
              {(personal.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          {/* Name/title centered vertically within the banner's own height,
              independent of the banner's (now photo-overlapping) left
              edge — anchored instead to clear the photo on the right. */}
          <div style={{ position: 'absolute', left: `${PHOTO_L + PHOTO_D + 24}px`, top: `${BANNER_TOP}px`, height: `${BANNER_H}px`, right: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '1px', color: '#1f2937', wordBreak: 'break-word' }}>{(personal.full_name || 'Your Name').toUpperCase()}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: accent, marginTop: '8px' }}>{personal.job_title || validExp[0]?.role || 'Professional'}</div>
          </div>
        </div>

        {/* Body: sidebar card + main column. The sidebar background is
            inset from this box's own top by SIDEBAR_GAP, not flush with
            it — that's what keeps it from touching the banner above. */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: `${SIDEBAR_GAP}px`, bottom: 0, left: 0, width: `${SIDEBAR_W}px`, background: bannerBg, borderRadius: `${SIDEBAR_RADIUS}px ${SIDEBAR_RADIUS}px 0 0` }} />
          <div style={{ display: 'flex' }}>
            <div style={{ width: `${SIDEBAR_W}px`, minWidth: `${SIDEBAR_W}px`, position: 'relative', zIndex: 1, padding: `${SIDEBAR_GAP + SIDEBAR_PAD_TOP}px 24px 28px` }}>
              {(personal.phone || personal.email || personal.address) && (
                <div style={{ marginBottom: '18px' }}>
                  {personal.phone   && <div style={{ marginBottom: '8px', fontSize: '11.5px', color: '#1f2937' }}>{ICONS.phone} {personal.phone}</div>}
                  {personal.email   && <div style={{ marginBottom: '8px', fontSize: '11.5px', color: '#1f2937', wordBreak: 'break-word' }}>{ICONS.mail} {personal.email}</div>}
                  {personal.address && <div style={{ fontSize: '11.5px', color: '#1f2937', wordBreak: 'break-word' }}>{ICONS.mapPin} {personal.address}</div>}
                </div>
              )}
              {validEdu.length > 0 && (
                <DoveSidebarLabel title="Education">
                  {validEdu.map((e: any, i: number) => (
                    <div key={i} style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', color: '#1f2937', wordBreak: 'break-word' }}>{e.qualification}</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f2937', wordBreak: 'break-word' }}>{e.institution}</div>
                      {e.year && <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>{e.year}</div>}
                    </div>
                  ))}
                </DoveSidebarLabel>
              )}
              {!hidden?.has('skills') && allSkills.length > 0 && (
                <DoveSidebarLabel title={skillsLabel}><BulletList items={allSkills} /></DoveSidebarLabel>
              )}
              {skills?.languages?.length > 0 && (
                <DoveSidebarLabel title="Language"><BulletList items={skills.languages} /></DoveSidebarLabel>
              )}
            </div>

            <div style={{ flex: 1, padding: `${SIDEBAR_GAP + SIDEBAR_PAD_TOP}px 36px 28px`, minWidth: 0 }}>
              {personal.bio && (
                <Section title="About Me" color="#1f2937" borderColor="#d1d5db">
                  <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.6', margin: 0 }}>{personal.bio}</p>
                </Section>
              )}
              {validExp.length > 0 && (
                <Section title={expLabel} color="#1f2937" borderColor="#d1d5db">
                  {validExp.map((e: any, i: number) => (
                    <div key={i} style={{ marginBottom: '18px' }}>
                      {(e.from || e.to) && <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>{[e.from, e.to].filter(Boolean).join(' – ')}</div>}
                      {e.school && <div style={{ fontSize: '12px', color: '#6b7280' }}>{e.school}</div>}
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginTop: '2px', wordBreak: 'break-word' }}>{e.role}</div>
                      {renderDescription(e.description, accent)}
                    </div>
                  ))}
                </Section>
              )}
              {renderCustomSections(data.custom_sections, '#1f2937', '#d1d5db', hidden)}
            </div>
          </div>
        </div>

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, '#1f2937', watermark, '#d1d5db', '28px 40px', hidden)}
    </div>
  );
}

/* ── Panel ───────────────────────────────────────────────────────────────── */
const PANEL_BAND_BG = '#f3f4f6';
const PANEL_INK = '#111827';

function PanelBand({ title }: { title: string }) {
  return (
    <div style={{ background: PANEL_BAND_BG, padding: '10px 40px', textAlign: 'center' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px', color: PANEL_INK }}>{title}</span>
    </div>
  );
}

function PanelRow({ when, heading, subheading, description }: { when?: string; heading: React.ReactNode; subheading?: string; description?: string }) {
  return (
    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
      <div style={{ width: '100px', flexShrink: 0, fontSize: '11.5px', color: '#374151' }}>{when}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: PANEL_INK, wordBreak: 'break-word' }}>
          {heading}{subheading ? ` | ${subheading}` : ''}
        </div>
        {description && <div style={{ fontSize: '11.5px', color: '#4b5563', lineHeight: '1.6', marginTop: '4px' }}>{description}</div>}
      </div>
    </div>
  );
}

function PanelTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  const allSkills = [...(skills?.subjects || []), ...(skills?.soft_skills || [])];
  const jobTitle = (personal.job_title || validExp[0]?.role || 'Professional').trim();

  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
        }}
      >
        {/* Header */}
        <div style={{ padding: '34px 40px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            {personal.photo_url ? (
              <img src={personal.photo_url} alt="" style={{ width: '104px', height: '104px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '104px', height: '104px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '28px', fontWeight: 800, color: '#6b7280' }}>
                {(personal.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '30px', fontWeight: 800, color: PANEL_INK, wordBreak: 'break-word' }}>{personal.full_name || 'Your Name'}</div>
              <div style={{ fontSize: '14px', color: '#4b5563', marginTop: '2px' }}>{jobTitle}</div>
              <div style={{ width: '42px', height: '2px', background: PANEL_INK, margin: '10px 0' }} />
              <div style={{ display: 'flex', gap: '20px', fontSize: '11.5px', color: '#374151', flexWrap: 'wrap' }}>
                {personal.phone   && <span>{ICONS.phone} {personal.phone}</span>}
                {personal.email   && <span>{ICONS.mail} {personal.email}</span>}
                {personal.address && <span>{ICONS.mapPin} {personal.address}</span>}
              </div>
            </div>
          </div>
        </div>

        {personal.bio && (
          <>
            <PanelBand title="About Me" />
            <div style={{ padding: '18px 40px' }}>
              <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
            </div>
          </>
        )}

        {validEdu.length > 0 && (
          <>
            <PanelBand title="Education" />
            <div style={{ padding: '18px 40px 4px' }}>
              {validEdu.map((e: any, i: number) => (
                <PanelRow key={i} when={e.year} heading={e.institution} subheading={e.qualification} description={undefined} />
              ))}
            </div>
          </>
        )}

        {validExp.length > 0 && (
          <>
            <PanelBand title={expLabel} />
            <div style={{ padding: '18px 40px 4px' }}>
              {validExp.map((e: any, i: number) => (
                <PanelRow key={i} when={[e.from, e.to].filter(Boolean).join(' - ')} heading={e.school} subheading={e.role} description={e.description} />
              ))}
            </div>
          </>
        )}

        {!hidden?.has('skills') && (allSkills.length > 0 || skills?.languages?.length > 0) && (
          <>
            <PanelBand title={skillsLabel} />
            <div style={{ padding: '18px 40px 24px' }}>
              {allSkills.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '24px', rowGap: '9px', marginBottom: skills?.languages?.length ? '16px' : 0 }}>
                  {allSkills.map((s: string, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#374151' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: PANEL_INK, flexShrink: 0 }} />
                      {s}
                    </div>
                  ))}
                </div>
              )}
              {skills?.languages?.length > 0 && (
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', marginBottom: '6px' }}>Language</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '24px', rowGap: '9px' }}>
                    {skills.languages.map((l: string, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#374151' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: PANEL_INK, flexShrink: 0 }} />
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ padding: '0 40px 28px' }}>
          {renderCustomSections(data.custom_sections, PANEL_INK, '#e5e7eb', hidden)}
        </div>

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, PANEL_INK, watermark, '#e5e7eb', '28px 40px', hidden)}
    </div>
  );
}

/* ── Terracotta ──────────────────────────────────────────────────────────── */
const TERRACOTTA_ACCENT = '#d35400';
const TERRACOTTA_INK = '#1f2937';

function TerracottaSkillCol({ label, items, accent }: { label: string; items: string[]; accent: string }) {
  if (!items.length) return null;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: TERRACOTTA_INK, marginBottom: '8px' }}>{label}</div>
      {items.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', fontSize: '11.5px', color: '#374151', marginBottom: '5px' }}>
          <span style={{ color: accent }}>•</span>{s}
        </div>
      ))}
    </div>
  );
}

function TerracottaTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  const accent = TERRACOTTA_ACCENT;
  const jobTitle = (personal.job_title || validExp[0]?.role || 'Professional').trim();
  const nameParts = (personal.full_name || 'Your Name').trim().split(' ');
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  const skillGroups: [string, string[]][] = [
    ['Hard Skills', skills?.subjects || []],
    ['Technical Skills', skills?.soft_skills || []],
    ['Languages', skills?.languages || []],
  ].filter(([, items]) => items.length > 0) as [string, string[]][];

  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
        }}
      >
        {/* Header: two-tone name + job title on the left, a boxed contact
            card (light-gray, terracotta bottom border) on the right, then a
            full-width terracotta rule beneath everything. */}
        <div style={{ padding: '32px 40px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '30px', fontWeight: 800, color: TERRACOTTA_INK, wordBreak: 'break-word' }}>
                {firstName}{lastName ? <> <span style={{ color: accent }}>{lastName}</span></> : null}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: TERRACOTTA_INK, marginTop: '4px' }}>{jobTitle}</div>
            </div>
            {(personal.address || personal.phone || personal.email) && (
              <div style={{ background: '#f3f4f6', borderBottom: `4px solid ${accent}`, padding: '14px 18px', minWidth: '220px', flexShrink: 0 }}>
                {personal.address && <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#374151', marginBottom: '5px' }}><span>•</span>{personal.address}</div>}
                {personal.phone   && <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#374151', marginBottom: '5px' }}><span>•</span>{personal.phone}</div>}
                {personal.email   && <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#374151', wordBreak: 'break-word' }}><span>•</span>{personal.email}</div>}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '22px 40px 28px' }}>
          {personal.bio && (
            <div style={{ marginBottom: '26px' }}>
              <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
            </div>
          )}

          {validExp.length > 0 && (
            <Section title={expLabel} color={accent} borderColor={accent}>
              {validExp.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '16px' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: TERRACOTTA_INK, fontSize: '9px', marginTop: '4px', flexShrink: 0 }}>▶</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '12.5px', color: TERRACOTTA_INK, wordBreak: 'break-word' }}>{e.role}{e.school ? ` | ${e.school}` : ''}</span>
                        {(e.from || e.to) && <span style={{ fontSize: '11px', color: accent, fontWeight: 600, whiteSpace: 'nowrap' }}>{[e.from, e.to].filter(Boolean).join(' – ')}</span>}
                      </div>
                      {renderDescription(e.description, accent)}
                    </div>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {validEdu.length > 0 && (
            <Section title="Education" color={accent} borderColor={accent}>
              {validEdu.map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: i < validEdu.length - 1 ? '14px' : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '12.5px', color: TERRACOTTA_INK, wordBreak: 'break-word' }}>{e.qualification}</span>
                    {e.year && <span style={{ fontSize: '11px', color: accent, fontWeight: 600, whiteSpace: 'nowrap' }}>{e.year}</span>}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#4b5563', marginTop: '2px', wordBreak: 'break-word' }}>{e.institution}</div>
                </div>
              ))}
            </Section>
          )}

          {!hidden?.has('skills') && skillGroups.length > 0 && (
            <Section title={skillsLabel} color={accent} borderColor={accent}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${skillGroups.length}, 1fr)`, columnGap: '28px' }}>
                {skillGroups.map(([label, items]) => <TerracottaSkillCol key={label} label={label} items={items} accent={accent} />)}
              </div>
            </Section>
          )}

          {renderCustomSections(data.custom_sections, accent, accent, hidden)}
        </div>

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, accent, watermark, accent, '28px 40px', hidden)}
    </div>
  );
}

/* ── Monogram ────────────────────────────────────────────────────────────── */
const MONOGRAM_GRAY = '#f5f5f5';
const MONOGRAM_INK = '#262626';
const MONOGRAM_SIDEBAR_W = 294;

function MonogramLabel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '22px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', color: MONOGRAM_INK, marginBottom: '12px' }}>{title}</div>
      {children}
    </div>
  );
}

// A single continuous divider band — same gray as the sidebar itself, so
// it reads as part of the same palette — spanning the full page width,
// with thin WHITE hairlines at the top, the exact center, and the bottom.
// Those hairlines are real full-width lines (not just empty/transparent
// gaps that would let the sidebar's own background show through), so the
// divider stays visually distinct from the sidebar immediately above and
// below it instead of blending into one unbroken gray block, while the
// center line gives it a layered "double divider" look. All three lines
// run edge-to-edge across both the sidebar and the main column, because
// this div itself spans the full page width independent of either column.
function MonogramDividerBar() {
  return (
    <div style={{ position: 'relative', height: '38px', background: MONOGRAM_GRAY }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: '#ffffff' }} />
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#ffffff', transform: 'translateY(-50%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: '#ffffff' }} />
    </div>
  );
}

function MonogramTemplate({ data, wrapperStyle, validEdu, validExp, watermark, skillsLabel = 'Key Skills', expLabel = 'Work Experience', hidden }: any) {
  const { personal, skills } = data;
  const jobTitle = (personal.job_title || validExp[0]?.role || 'Professional').trim();
  const initials = (personal.full_name || 'Your Name').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const allSkills = [...(skills?.subjects || []), ...(skills?.soft_skills || [])];

  return (
    <div style={{ ...wrapperStyle }}>
      <div
        className="cv-content-page"
        style={{
          width: '794px',
          minHeight: forExportMinHeight(wrapperStyle),
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
        }}
      >
        {/* The sidebar's gray background is ONE absolutely-positioned div
            spanning the full page height (top:0 to bottom:0), drawn once
            behind everything else in this x-range — not three separate
            stacked divs (header cell / gap bar / content cell) of the same
            color. Three abutting same-color shapes can show a hairline
            seam at their shared edges depending on the renderer (this is
            what produced the "two separate bars" artifact); one continuous
            shape makes that impossible. */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${MONOGRAM_SIDEBAR_W}px`, background: MONOGRAM_GRAY }} />

          {/* Header row: monogram circle (left) + name/title (right) */}
          <div style={{ display: 'flex', position: 'relative' }}>
            <div style={{ width: `${MONOGRAM_SIDEBAR_W}px`, minWidth: `${MONOGRAM_SIDEBAR_W}px`, padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '110px', height: '110px', borderRadius: '50%', border: `1.5px solid ${MONOGRAM_INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {personal.photo_url
                  ? <img src={personal.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '2px', color: MONOGRAM_INK }}>{initials}</span>}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 800, color: MONOGRAM_INK, wordBreak: 'break-word' }}>{personal.full_name || 'Your Name'}</div>
              <div style={{ fontSize: '18px', color: '#4b5563', marginTop: '6px' }}>{jobTitle}</div>
            </div>
          </div>

          {/* Full-width divider ribbon — edge-to-edge across both the
              sidebar and the main column, independent of either container. */}
          <MonogramDividerBar />

          {/* Content row — extra top padding gives Contact/Summary some
              breathing room below the divider bars instead of sitting
              flush against them. */}
          <div style={{ display: 'flex', position: 'relative' }}>
          <div style={{ width: `${MONOGRAM_SIDEBAR_W}px`, minWidth: `${MONOGRAM_SIDEBAR_W}px`, padding: '28px 36px 36px' }}>
            {(personal.phone || personal.email || personal.address) && (
              <MonogramLabel title="Contact">
                {personal.phone   && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#374151', marginBottom: '10px' }}>{ICONS.phone}{personal.phone}</div>}
                {personal.email   && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#374151', marginBottom: '10px', wordBreak: 'break-word' }}>{ICONS.mail}{personal.email}</div>}
                {personal.address && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#374151', wordBreak: 'break-word' }}>{ICONS.mapPin}{personal.address}</div>}
              </MonogramLabel>
            )}
            {!hidden?.has('skills') && allSkills.length > 0 && (
              <MonogramLabel title={skillsLabel}><BulletList items={allSkills} /></MonogramLabel>
            )}
            {validEdu.length > 0 && (
              <MonogramLabel title="Education">
                {validEdu.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < validEdu.length - 1 ? '14px' : 0 }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: MONOGRAM_INK, textTransform: 'uppercase', wordBreak: 'break-word' }}>{e.institution}</div>
                    {e.year && <div style={{ fontSize: '11px', fontWeight: 700, color: MONOGRAM_INK, marginTop: '2px' }}>{e.year}</div>}
                    <div style={{ fontSize: '11.5px', color: '#4b5563', marginTop: '2px', wordBreak: 'break-word' }}>{e.qualification}</div>
                  </div>
                ))}
              </MonogramLabel>
            )}
            {skills?.languages?.length > 0 && (
              <MonogramLabel title="Language"><BulletList items={skills.languages} /></MonogramLabel>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, padding: '28px 40px 36px' }}>
            {personal.bio && (
              <MonogramLabel title="Summary">
                <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{personal.bio}</p>
              </MonogramLabel>
            )}
            {validExp.length > 0 && (
              <MonogramLabel title={expLabel}>
                {validExp.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < validExp.length - 1 ? '18px' : 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: MONOGRAM_INK, textTransform: 'uppercase', wordBreak: 'break-word' }}>{e.role}</div>
                    {e.school && <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#4b5563', marginTop: '2px', wordBreak: 'break-word' }}>{e.school}</div>}
                    {(e.from || e.to) && <div style={{ fontSize: '11px', fontWeight: 700, color: '#4b5563', marginTop: '2px' }}>{[e.from, e.to].filter(Boolean).join(' - ')}</div>}
                    {renderDescription(e.description, MONOGRAM_INK)}
                  </div>
                ))}
              </MonogramLabel>
            )}
            {renderCustomSections(data.custom_sections, MONOGRAM_INK, '#d1d5db', hidden)}
          </div>
          </div>
        </div>

        {watermark && !data.references?.filter((r: any) => r.name).length && <WatermarkBar />}
      </div>
      {renderReferencesPage(data.references, MONOGRAM_INK, watermark, '#d1d5db', '28px 40px', hidden)}
    </div>
  );
}
