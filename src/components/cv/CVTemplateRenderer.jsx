/**
 * CVTemplateRenderer
 * Renders an A4-style HTML/CSS CV. Used for both on-screen preview and html2canvas PDF export.
 * Pass forExport=true to use absolute pixel sizing for accurate PDF rendering.
 */

export default function CVTemplateRenderer({ data, forExport = false }) {
  const { personal, education, experience, skills, template } = data;

  const wrapperStyle = forExport
    ? { width: '794px', minHeight: '1123px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', background: '#fff' }
    : { width: '100%', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.10)', borderRadius: '4px', overflow: 'hidden' };

  const validEdu = (education || []).filter(e => e.institution);
  const validExp = (experience || []).filter(e => e.school);

  if (template === 'modern') return <ModernTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;
  if (template === 'professional') return <ProfessionalTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;
  if (template === 'minimal') return <MinimalTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;
  return <ClassicTemplate data={data} wrapperStyle={wrapperStyle} validEdu={validEdu} validExp={validExp} />;
}

/* ─────────────────────────────────────────────
   CLASSIC  – Black header, clean serif feel
───────────────────────────────────────────── */
function ClassicTemplate({ data, wrapperStyle, validEdu, validExp }) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      {/* Header */}
      <div style={{ background: '#1e2a3a', color: '#fff', padding: '28px 36px 22px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        {personal.photo_url && (
          <img src={personal.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '8px', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
        )}
        <div>
          <div style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {personal.full_name || 'Your Name'}
          </div>
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#a0aec0', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {personal.email && <span>✉ {personal.email}</span>}
            {personal.phone && <span>✆ {personal.phone}</span>}
            {personal.address && <span>⌂ {personal.address}</span>}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 36px', lineHeight: '1.6' }}>
        {personal.bio && (
          <Section title="Professional Summary" color="#1e2a3a">
            <p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p>
          </Section>
        )}

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
                {e.description && <div style={{ color: '#374151', fontSize: '12px', marginTop: '3px' }}>{e.description}</div>}
              </div>
            ))}
          </Section>
        )}

        {(skills?.subjects?.length > 0 || skills?.soft_skills?.length > 0) && (
          <Section title="Skills & Subjects" color="#1e2a3a">
            {skills.subjects?.length > 0 && <SkillRow label="Subjects" items={skills.subjects} color="#1e2a3a" />}
            {skills.soft_skills?.length > 0 && <SkillRow label="Skills" items={skills.soft_skills} color="#1e2a3a" />}
          </Section>
        )}

        {skills?.languages?.length > 0 && (
          <Section title="Languages" color="#1e2a3a">
            <SkillRow items={skills.languages} color="#1e2a3a" />
          </Section>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODERN – Two-column with teal sidebar
───────────────────────────────────────────── */
function ModernTemplate({ data, wrapperStyle, validEdu, validExp }) {
  const { personal, skills } = data;
  const sidebar = { background: '#0d9488', color: '#fff', width: '200px', minWidth: '200px', padding: '28px 18px', boxSizing: 'border-box' };
  const main = { flex: 1, padding: '28px 24px', boxSizing: 'border-box' };

  return (
    <div style={{ ...wrapperStyle, display: 'flex', minHeight: '1123px' }}>
      {/* Sidebar */}
      <div style={sidebar}>
        {personal.photo_url ? (
          <img src={personal.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', margin: '0 auto 14px', display: 'block' }} />
        ) : (
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '28px', fontWeight: '700', color: '#fff' }}>
            {(personal.full_name || 'U')[0].toUpperCase()}
          </div>
        )}
        <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>{personal.full_name || 'Your Name'}</div>
        <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginBottom: '20px' }}>Educator</div>

        <SidebarSection title="Contact">
          {personal.email && <SidebarItem label="Email" value={personal.email} />}
          {personal.phone && <SidebarItem label="Phone" value={personal.phone} />}
          {personal.address && <SidebarItem label="Location" value={personal.address} />}
        </SidebarSection>

        {skills?.subjects?.length > 0 && (
          <SidebarSection title="Subjects">
            {skills.subjects.map((s, i) => <div key={i} style={{ fontSize: '11px', marginBottom: '3px', color: 'rgba(255,255,255,0.9)' }}>• {s}</div>)}
          </SidebarSection>
        )}

        {skills?.languages?.length > 0 && (
          <SidebarSection title="Languages">
            {skills.languages.map((l, i) => <div key={i} style={{ fontSize: '11px', marginBottom: '3px', color: 'rgba(255,255,255,0.9)' }}>• {l}</div>)}
          </SidebarSection>
        )}
      </div>

      {/* Main */}
      <div style={main}>
        {personal.bio && (
          <Section title="About Me" color="#0d9488">
            <p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p>
          </Section>
        )}

        {validExp.length > 0 && (
          <Section title="Teaching Experience" color="#0d9488">
            {validExp.map((e, i) => (
              <div key={i} style={{ marginBottom: '12px', borderLeft: '2px solid #0d9488', paddingLeft: '10px' }}>
                <div style={{ fontWeight: '600', color: '#111827' }}>{e.role}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.school}{(e.from || e.to) ? ` · ${e.from || ''} – ${e.to || ''}` : ''}</div>
                {e.description && <div style={{ color: '#374151', fontSize: '12px', marginTop: '3px' }}>{e.description}</div>}
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

        {skills?.soft_skills?.length > 0 && (
          <Section title="Professional Skills" color="#0d9488">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {skills.soft_skills.map((s, i) => (
                <span key={i} style={{ background: '#f0fdf4', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: '4px', padding: '2px 8px', fontSize: '11px' }}>{s}</span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PROFESSIONAL – Banner + elegant layout
───────────────────────────────────────────── */
function ProfessionalTemplate({ data, wrapperStyle, validEdu, validExp }) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      {/* Top banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e4d2b 0%, #2d7a47 100%)', padding: '32px 40px', color: '#fff', display: 'flex', alignItems: 'center', gap: '24px' }}>
        {personal.photo_url && (
          <img src={personal.photo_url} alt="Profile" style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />
        )}
        <div>
          <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{personal.full_name || 'Your Name'}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase' }}>Educator</div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>
            {personal.email && <span>✉ {personal.email}</span>}
            {personal.phone && <span>✆ {personal.phone}</span>}
            {personal.address && <span>⌂ {personal.address}</span>}
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 40px', lineHeight: '1.65' }}>
        {personal.bio && (
          <Section title="Professional Profile" color="#1e4d2b" borderColor="#2d7a47">
            <p style={{ color: '#374151', margin: 0 }}>{personal.bio}</p>
          </Section>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          <div>
            {validExp.length > 0 && (
              <Section title="Teaching Experience" color="#1e4d2b" borderColor="#2d7a47">
                {validExp.map((e, i) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{e.role}</div>
                    <div style={{ color: '#2d7a47', fontSize: '12px', fontWeight: '600' }}>{e.school}</div>
                    {(e.from || e.to) && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.from || ''} – {e.to || ''}</div>}
                    {e.description && <div style={{ color: '#374151', fontSize: '12px', marginTop: '3px' }}>{e.description}</div>}
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

            {skills?.subjects?.length > 0 && (
              <Section title="Subjects Taught" color="#1e4d2b" borderColor="#2d7a47">
                {skills.subjects.map((s, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '2px' }}>• {s}</div>
                ))}
              </Section>
            )}

            {skills?.soft_skills?.length > 0 && (
              <Section title="Skills" color="#1e4d2b" borderColor="#2d7a47">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {skills.soft_skills.map((s, i) => (
                    <span key={i} style={{ background: '#f0fdf4', color: '#1e4d2b', border: '1px solid #bbf7d0', borderRadius: '3px', padding: '1px 7px', fontSize: '11px' }}>{s}</span>
                  ))}
                </div>
              </Section>
            )}

            {skills?.languages?.length > 0 && (
              <Section title="Languages" color="#1e4d2b" borderColor="#2d7a47">
                {skills.languages.map((l, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '2px' }}>• {l}</div>
                ))}
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MINIMAL – Simple, elegant, whitespace-heavy
───────────────────────────────────────────── */
function MinimalTemplate({ data, wrapperStyle, validEdu, validExp }) {
  const { personal, skills } = data;
  return (
    <div style={wrapperStyle}>
      <div style={{ padding: '40px 44px', lineHeight: '1.7' }}>
        {/* Header */}
        <div style={{ borderBottom: '2px solid #111827', paddingBottom: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          {personal.photo_url && (
            <img src={personal.photo_url} alt="Profile" style={{ width: '76px', height: '76px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontSize: '30px', fontWeight: '300', letterSpacing: '3px', textTransform: 'uppercase', color: '#111827' }}>{personal.full_name || 'Your Name'}</div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {personal.email && <span>{personal.email}</span>}
              {personal.phone && <span>{personal.phone}</span>}
              {personal.address && <span>{personal.address}</span>}
            </div>
          </div>
        </div>

        {personal.bio && (
          <MinimalSection title="Summary">
            <p style={{ color: '#4b5563', margin: 0, fontSize: '12px' }}>{personal.bio}</p>
          </MinimalSection>
        )}

        {validExp.length > 0 && (
          <MinimalSection title="Experience">
            {validExp.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                <div style={{ width: '90px', fontSize: '11px', color: '#9ca3af', paddingTop: '2px', shrink: 0 }}>
                  {e.from && e.to ? `${e.from} – ${e.to}` : e.from || e.to || ''}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{e.role}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.school}</div>
                  {e.description && <div style={{ color: '#4b5563', fontSize: '12px', marginTop: '2px' }}>{e.description}</div>}
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

        {(skills?.subjects?.length > 0 || skills?.soft_skills?.length > 0 || skills?.languages?.length > 0) && (
          <MinimalSection title="Skills & Languages">
            {skills.subjects?.length > 0 && (
              <div style={{ marginBottom: '4px' }}><span style={{ fontWeight: '600', fontSize: '12px', color: '#374151' }}>Subjects: </span><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.subjects.join(' · ')}</span></div>
            )}
            {skills.soft_skills?.length > 0 && (
              <div style={{ marginBottom: '4px' }}><span style={{ fontWeight: '600', fontSize: '12px', color: '#374151' }}>Skills: </span><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.soft_skills.join(' · ')}</span></div>
            )}
            {skills.languages?.length > 0 && (
              <div><span style={{ fontWeight: '600', fontSize: '12px', color: '#374151' }}>Languages: </span><span style={{ color: '#4b5563', fontSize: '12px' }}>{skills.languages.join(' · ')}</span></div>
            )}
          </MinimalSection>
        )}
      </div>
    </div>
  );
}

/* ─── Shared helper sub-components ─── */
function Section({ title, color, borderColor, children }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: color || '#111' }} />
        <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: color || '#111' }}>{title}</span>
        <div style={{ flex: 1, height: '1px', background: borderColor || color || '#e5e7eb', marginLeft: '4px' }} />
      </div>
      {children}
    </div>
  );
}

function MinimalSection({ title, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', color: '#9ca3af', marginBottom: '10px' }}>{title}</div>
      {children}
    </div>
  );
}

function SidebarSection({ title, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.5)', marginBottom: '7px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }}>{title}</div>
      {children}
    </div>
  );
}

function SidebarItem({ label, value }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function SkillRow({ label, items, color }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      {label && <span style={{ fontWeight: '600', fontSize: '12px', color: '#374151' }}>{label}: </span>}
      <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}>
        {items.map((s, i) => (
          <span key={i} style={{ background: '#f3f4f6', color: '#374151', borderRadius: '3px', padding: '1px 7px', fontSize: '11px', border: '1px solid #e5e7eb' }}>{s}</span>
        ))}
      </div>
    </div>
  );
}