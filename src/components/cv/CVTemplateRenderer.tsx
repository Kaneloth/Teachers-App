interface CustomSection {
  title: string;
  type: 'text' | 'bullets' | 'table';
  content?: string;
  columns?: string[];
  rows?: string[][];
}

interface CVData {
  personal: { full_name?: string; email?: string; phone?: string; address?: string; bio?: string; photo_url?: string; id_number?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects?: string[]; soft_skills?: string[]; languages?: string[] };
  references?: { name: string; title: string; organisation: string; phone: string; email: string; relationship: string }[];
  custom_sections?: CustomSection[];
  template: string;
}

interface Props { data: CVData; forExport?: boolean }

export default function CVTemplateRenderer({ data, forExport = false }: Props) {
  const { template } = data;
  const wrapperStyle: React.CSSProperties = forExport
    ? { width: '794px', minHeight: '1123px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', background: '#fff' }
    : { width: '100%', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.10)', borderRadius: '4px', overflow: 'hidden' };

  const validEdu = (data.education || []).filter(e => e.institution);
  const validExp = (data.experience || []).filter(e => e.school);

  if (template === 'modern')       return <ModernTemplate       data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;
  if (template === 'professional') return <ProfessionalTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;
  if (template === 'minimal')      return <MinimalTemplate      data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;
  return <ClassicTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;
}

/** Renders as a bullet list when description contains newlines, plain text otherwise. */
function renderDescription(desc: string | undefined, color: string, fontSize = '12px'): React.ReactNode {
  if (!desc) return null;
  const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return <div style={{ color, fontSize, marginTop: '3px' }}>{desc}</div>;
  }
  return (
    <ul style={{ margin: '3px 0 0', padding: '0 0 0 14px', color, fontSize, lineHeight: '1.6' }}>
      {lines.map((line, i) => <li key={i} style={{ marginBottom: '1px' }}>{line}</li>)}
    </ul>
  );
}

/** Renders all custom sections (text / bullets / table) at the bottom of a template. */
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
            <ul style={{ margin: 0, padding: '0 0 0 14px', color: '#374151', fontSize: '12px', lineHeight: '1.6' }}>
              {lines.map((line, i) => <li key={i} style={{ marginBottom: '1px' }}>{line}</li>)}
            </ul>
          ) : null;
        } else {
          const validRows = (s.rows || []).filter(r => r.some(c => c.trim()));
          content = (s.columns?.length && validRows.length) ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>{s.columns.map((col, ci) => <th key={ci} style={{ background: color, color: '#fff', padding: '5px 8px', textAlign: 'left', fontWeight: '700', fontSize: '10px', letterSpacing: '0.5px' }}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {validRows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? '#f9fafb' : '#fff' }}>
                    {row.map((cell, ci) => <td key={ci} style={{ padding: '4px 8px', color: '#374151', borderBottom: '1px solid #e5e7eb', fontSize: '11px' }}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null;
        }
        return content ? <Section key={idx} title={s.title} color={color} borderColor={borderColor}>{content}</Section> : null;
      })}
    </>
  );
}

function ClassicTemplate({ data, wrapperStyle, validEdu, validExp }: { data: CVData; wrapperStyle: React.CSSProperties; validEdu: CVData['education']; validExp: CVData['experience'] }) {
  const { personal, skills } = data;
  return (
    <>
      <div style={wrapperStyle}>
        <div style={{ background: '#1e2a3a', color: '#fff', padding: '28px 36px 22px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '8px', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#a0aec0', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {personal.email      && <span>✉ {personal.email}</span>}
              {personal.phone      && <span>✆ {personal.phone}</span>}
              {personal.address    && <span>⌂ {personal.address}</span>}
              {personal.id_number  && <span>ID: {personal.id_number}</span>}
            </div>
          </div>
        </div>
        <div style={{ padding: '24px 36px', lineHeight: '1.6' }}>
          {personal.bio && <Section title="Professional Summary" color="#1e2a3a"><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
          {validEdu.length > 0 && (
            <Section title="Education" color="#1e2a3a">
              {validEdu.map((e, i) => (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{e.qualification}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                </div>
              ))}
            </Section>
          )}
          {validExp.length > 0 && (
            <Section title="Teaching Experience" color="#1e2a3a">
              {validExp.map((e, i) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{e.role}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </Section>
          )}
          {(skills?.subjects?.length || skills?.soft_skills?.length) ? (
            <Section title="Skills & Subjects" color="#1e2a3a">
              {skills.subjects?.length    ? <SkillRow label="Subjects" items={skills.subjects}   /> : null}
              {skills.soft_skills?.length ? <SkillRow label="Skills"   items={skills.soft_skills} /> : null}
            </Section>
          ) : null}
          {skills?.languages?.length ? <Section title="Languages" color="#1e2a3a"><SkillRow items={skills.languages} /></Section> : null}
          {renderCustomSections(data.custom_sections, '#1e2a3a')}
        </div>
      </div>
      {renderReferencesPage(data.references, '#1e2a3a', undefined, '28px 36px')}
    </>
  );
}

function ModernTemplate({ data, wrapperStyle, validEdu, validExp }: { data: CVData; wrapperStyle: React.CSSProperties; validEdu: CVData['education']; validExp: CVData['experience'] }) {
  const { personal, skills } = data;
  const sidebar: React.CSSProperties = { background: '#0d9488', color: '#fff', width: '200px', minWidth: '200px', padding: '28px 18px', boxSizing: 'border-box' };
  const main: React.CSSProperties    = { flex: 1, padding: '28px 24px', boxSizing: 'border-box' };
  return (
    <>
      <div style={{ ...wrapperStyle, display: 'flex', minHeight: '1123px' }}>
        <div style={sidebar}>
          {personal.photo_url
            ? <img src={personal.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', margin: '0 auto 14px', display: 'block' }} />
            : <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '28px', fontWeight: '700', color: '#fff' }}>{(personal.full_name || 'U')[0].toUpperCase()}</div>}
          <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>{personal.full_name || 'Your Name'}</div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginBottom: '20px' }}>Educator</div>
          <SidebarSection title="Contact">
            {personal.email     && <SidebarItem label="Email"    value={personal.email} />}
            {personal.phone     && <SidebarItem label="Phone"    value={personal.phone} />}
            {personal.address   && <SidebarItem label="Location" value={personal.address} />}
            {personal.id_number && <SidebarItem label="ID"       value={personal.id_number} />}
          </SidebarSection>
          {skills?.subjects?.length  ? <SidebarSection title="Subjects">{skills.subjects.map((s, i)  => <div key={i} style={{ fontSize: '11px', marginBottom: '3px', color: 'rgba(255,255,255,0.9)' }}>• {s}</div>)}</SidebarSection>  : null}
          {skills?.languages?.length ? <SidebarSection title="Languages">{skills.languages.map((l, i) => <div key={i} style={{ fontSize: '11px', marginBottom: '3px', color: 'rgba(255,255,255,0.9)' }}>• {l}</div>)}</SidebarSection> : null}
        </div>
        <div style={main}>
          {personal.bio && <Section title="About Me" color="#0d9488"><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
          {validExp.length > 0 && (
            <Section title="Teaching Experience" color="#0d9488">
              {validExp.map((e, i) => (
                <div key={i} style={{ marginBottom: '12px', borderLeft: '2px solid #0d9488', paddingLeft: '10px' }}>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{e.role}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                  {renderDescription(e.description, '#374151')}
                </div>
              ))}
            </Section>
          )}
          {validEdu.length > 0 && (
            <Section title="Education" color="#0d9488">
              {validEdu.map((e, i) => (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{e.qualification}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                </div>
              ))}
            </Section>
          )}
          {skills?.soft_skills?.length ? (
            <Section title="Professional Skills" color="#0d9488">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {skills.soft_skills.map((s, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#f0fdf4', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', lineHeight: 'normal' }}>{s}</span>
                ))}
              </div>
            </Section>
          ) : null}
          {renderCustomSections(data.custom_sections, '#0d9488')}
        </div>
      </div>
      {renderReferencesPage(data.references, '#0d9488', undefined, '28px 24px')}
    </>
  );
}

function ProfessionalTemplate({ data, wrapperStyle, validEdu, validExp }: { data: CVData; wrapperStyle: React.CSSProperties; validEdu: CVData['education']; validExp: CVData['experience'] }) {
  const { personal, skills } = data;
  return (
    <>
      <div style={wrapperStyle}>
        <div style={{ background: 'linear-gradient(135deg, #1e4d2b 0%, #2d7a47 100%)', padding: '32px 40px', color: '#fff', display: 'flex', alignItems: 'center', gap: '24px' }}>
          {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase' }}>Educator</div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>
              {personal.email     && <span>✉ {personal.email}</span>}
              {personal.phone     && <span>✆ {personal.phone}</span>}
              {personal.address   && <span>⌂ {personal.address}</span>}
              {personal.id_number && <span>ID: {personal.id_number}</span>}
            </div>
          </div>
        </div>
        <div style={{ padding: '28px 40px', lineHeight: '1.65' }}>
          {personal.bio && <Section title="Professional Profile" color="#1e4d2b" borderColor="#2d7a47"><p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p></Section>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            <div>
              {validExp.length > 0 && (
                <Section title="Teaching Experience" color="#1e4d2b" borderColor="#2d7a47">
                  {validExp.map((e, i) => (
                    <div key={i} style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{e.role}</div>
                      <div style={{ color: '#2d7a47', fontSize: '12px', fontWeight: '600' }}>{e.school}</div>
                      {(e.from || e.to) && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.from || ''} – {e.to || ''}</div>}
                      {renderDescription(e.description, '#374151')}
                    </div>
                  ))}
                </Section>
              )}
            </div>
            <div>
              {validEdu.length > 0 && (
                <Section title="Education" color="#1e4d2b" borderColor="#2d7a47">
                  {validEdu.map((e, i) => (
                    <div key={i} style={{ marginBottom: '10px' }}>
                      <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{e.qualification}</div>
                      <div style={{ color: '#2d7a47', fontSize: '12px' }}>{e.institution}</div>
                      {e.year && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.year}</div>}
                    </div>
                  ))}
                </Section>
              )}
              {skills?.subjects?.length ? (
                <Section title="Subjects Taught" color="#1e4d2b" borderColor="#2d7a47">
                  {skills.subjects.map((s, i) => <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '2px' }}>• {s}</div>)}
                </Section>
              ) : null}
              {skills?.soft_skills?.length ? (
                <Section title="Skills" color="#1e4d2b" borderColor="#2d7a47">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {skills.soft_skills.map((s, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#f0fdf4', color: '#1e4d2b', border: '1px solid #bbf7d0', borderRadius: '3px', padding: '4px 10px', fontSize: '11px', lineHeight: 'normal' }}>{s}</span>
                    ))}
                  </div>
                </Section>
              ) : null}
              {skills?.languages?.length ? (
                <Section title="Languages" color="#1e4d2b" borderColor="#2d7a47">
                  {skills.languages.map((l, i) => <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '2px' }}>• {l}</div>)}
                </Section>
              ) : null}
            </div>
          </div>
          {renderCustomSections(data.custom_sections, '#1e4d2b', '#2d7a47')}
        </div>
      </div>
      {renderReferencesPage(data.references, '#1e4d2b', '#2d7a47', '28px 40px')}
    </>
  );
}

function MinimalTemplate({ data, wrapperStyle, validEdu, validExp }: { data: CVData; wrapperStyle: React.CSSProperties; validEdu: CVData['education']; validExp: CVData['experience'] }) {
  const { personal, skills } = data;
  const validRefs = (data.references || []).filter(r => r.name);
  return (
    <>
      <div style={wrapperStyle}>
        <div style={{ padding: '40px 44px', lineHeight: '1.7' }}>
          <div style={{ borderBottom: '2px solid #111827', paddingBottom: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            {personal.photo_url && <img src={personal.photo_url} alt="Profile" style={{ width: '76px', height: '76px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: '30px', fontWeight: '300', letterSpacing: '3px', textTransform: 'uppercase', color: '#111827' }}>{personal.full_name || 'Your Name'}</div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {personal.email     && <span>{personal.email}</span>}
                {personal.phone     && <span>{personal.phone}</span>}
                {personal.address   && <span>{personal.address}</span>}
                {personal.id_number && <span>ID: {personal.id_number}</span>}
              </div>
            </div>
          </div>
          {personal.bio && <MinimalSection title="Summary"><p style={{ color: '#4b5563', margin: 0, fontSize: '12px' }}>{personal.bio}</p></MinimalSection>}
          {validExp.length > 0 && (
            <MinimalSection title="Experience">
              {validExp.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                  <div style={{ width: '90px', fontSize: '11px', color: '#9ca3af', paddingTop: '2px' }}>{e.from && e.to ? `${e.from} – ${e.to}` : e.from || e.to || ''}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{e.role}</div>
                    <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.school}</div>
                    {renderDescription(e.description, '#4b5563')}
                  </div>
                </div>
              ))}
            </MinimalSection>
          )}
          {validEdu.length > 0 && (
            <MinimalSection title="Education">
              {validEdu.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                  <div style={{ width: '90px', fontSize: '11px', color: '#9ca3af', paddingTop: '2px' }}>{e.year || ''}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{e.qualification}</div>
                    <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}</div>
                  </div>
                </div>
              ))}
            </MinimalSection>
          )}
          {(skills?.subjects?.length || skills?.soft_skills?.length || skills?.languages?.length) ? (
            <MinimalSection title="Skills & Languages">
              {skills.subjects?.length    ? <div style={{ marginBottom: '4px' }}><span style={{ fontWeight: '600', fontSize: '12px', color: '#374151' }}>Subjects: </span><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.subjects.join(' · ')}</span></div>    : null}
              {skills.soft_skills?.length ? <div style={{ marginBottom: '4px' }}><span style={{ fontWeight: '600', fontSize: '12px', color: '#374151' }}>Skills: </span><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.soft_skills.join(' · ')}</span></div> : null}
              {skills.languages?.length   ? <div><span style={{ fontWeight: '600', fontSize: '12px', color: '#374151' }}>Languages: </span><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.languages.join(' · ')}</span></div>                            : null}
            </MinimalSection>
          ) : null}
          {renderCustomSections(data.custom_sections, '#111827')}
        </div>
      </div>
      {/* Minimal-style references on a separate last page */}
      {validRefs.length > 0 && (
        <div style={{ pageBreakBefore: 'always', padding: '40px 44px', background: '#fff', lineHeight: '1.7' }}>
          <MinimalSection title="References">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px 28px' }}>
              {validRefs.map((r, i) => (
                <div key={i}>
                  <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{r.name}</div>
                  {r.title        && <div style={{ color: '#4b5563', fontSize: '12px' }}>{r.title}</div>}
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
          </MinimalSection>
        </div>
      )}
    </>
  );
}

function Section({ title, color, borderColor, children }: { title: string; color?: string; borderColor?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: color || '#111' }}>{title}</span>
        <div style={{ flex: 1, height: '1px', background: borderColor || color || '#e5e7eb', marginLeft: '4px' }} />
      </div>
      {children}
    </div>
  );
}

/** References always appear on a separate last page (pageBreakBefore: always). */
function renderReferencesPage(
  refs: CVData['references'],
  color: string,
  borderColor?: string,
  padding = '28px 36px'
): React.ReactNode {
  const validRefs = (refs || []).filter(r => r.name);
  if (!validRefs.length) return null;
  return (
    <div style={{ pageBreakBefore: 'always', padding, background: '#fff', lineHeight: '1.6' }}>
      <Section title="References" color={color} borderColor={borderColor}>
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

function MinimalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#9ca3af', marginBottom: '10px' }}>{title}</div>
      {children}
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.5)', marginBottom: '7px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }}>{title}</div>
      {children}
    </div>
  );
}

function SidebarItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function SkillRow({ label, items }: { label?: string; items: string[] }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      {label && <span style={{ fontWeight: '600', fontSize: '12px', color: '#374151' }}>{label}: </span>}
      <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', verticalAlign: 'middle' }}>
        {items.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#f3f4f6', color: '#374151', borderRadius: '3px', padding: '4px 10px', fontSize: '11px', border: '1px solid #e5e7eb', lineHeight: 'normal' }}>{s}</span>
        ))}
      </div>
    </div>
  );
}
