function SidebarTemplate({ data, wrapperStyle, validEdu, validExp }: any) {
  const { personal, skills } = data;
  const sideColor = '#3b5998';

  // Main content (without sidebar) for pages after the first
  const mainContentOnly = (
    <div style={{ padding: '28px 36px' }}>
      {personal.bio && (
        <Section title="About Me" color={sideColor}>
          <p style={{ color: '#374151', margin: 0, textAlign: 'justify' }}>{personal.bio}</p>
        </Section>
      )}
      {validExp.length > 0 && (
        <Section title="Work History" color={sideColor} icon={ICONS.briefcase}>
          {validExp.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '700', color: '#111827' }}>{e.role}</div>
              <div style={{ color: sideColor, fontSize: '12px', fontWeight: '600' }}>{e.school}</div>
              {(e.from || e.to) && <div style={{ color: '#6b7280', fontSize: '11px' }}>{e.from || ''} – {e.to || ''}</div>}
              {renderDescription(e.description, '#374151', '12px', true)}
            </div>
          ))}
        </Section>
      )}
      {validEdu.length > 0 && (
        <Section title="Education" color={sideColor} icon={ICONS.graduation}>
          {validEdu.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: '600', color: '#111827' }}>{e.qualification}</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
            </div>
          ))}
        </Section>
      )}
      {renderCustomSections(data.custom_sections, sideColor, undefined, true)}
    </div>
  );

  // First page: sidebar + first part of main content (it will flow naturally)
  const firstPage = (
    <div style={{ display: 'flex', minHeight: '1123px' }}>
      <div style={{ background: sideColor, color: '#fff', width: '210px', minWidth: '210px', padding: '28px 18px', boxSizing: 'border-box' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '26px', fontWeight: '800', color: sideColor }}>
          {(personal.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
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
      <div style={{ flex: 1 }}>
        {mainContentOnly}
      </div>
    </div>
  );

  const referencesPage = renderReferencesPage(data.references, sideColor, undefined, '28px 36px', true);

  if (forExport) {
    return (
      <>
        <div className="cv-page">{firstPage}</div>
        {/* Subsequent pages: only main content (no sidebar) */}
        <div className="cv-page">{mainContentOnly}</div>
        {referencesPage && <div className="cv-page">{referencesPage}</div>}
      </>
    );
  }
  return <div style={wrapperStyle}>{firstPage}</div>;
}