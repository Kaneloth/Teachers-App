import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Footer, PageNumber, SectionType, BorderStyle, WidthType, ShadingType } from 'docx';

interface CVData {
  personal: { full_name?: string; email?: string; phone?: string; address?: string; bio?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects?: string[]; soft_skills?: string[]; languages?: string[] };
  references?: { name: string; title: string; organisation: string; phone: string; email: string; relationship: string }[];
  template: string;
}

function bulletPoints(lines: string[], indent = false): Paragraph[] {
  return lines.map(line => new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun(line.trim())],
    indent: indent ? { left: 720 } : undefined,
  }));
}

// ----- Classic Template (dark header, simple sans‑serif) -----
function buildClassic(data: CVData, user?: { id: string; email: string }) {
  const { personal, education, experience, skills, references } = data;
  const children: any[] = [];

  // Header: dark background
  children.push(
    new Paragraph({
      children: [new TextRun({ text: personal.full_name || 'Your Name', bold: true, size: 32, color: 'FFFFFF' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      shading: { fill: '1e2a3a', type: ShadingType.CLEAR },
      style: { paragraph: { backgroundColor: '1e2a3a' } },
    }),
  );
  const contactParts = [personal.email, personal.phone, personal.address].filter(Boolean);
  if (contactParts.length) {
    children.push(new Paragraph({
      children: contactParts.map((part, idx) => new TextRun({ text: (idx > 0 ? ' | ' : '') + part, color: 'FFFFFF' })),
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }));
  }

  // Bio
  if (personal.bio) {
    children.push(new Paragraph({ text: 'Professional Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }));
    children.push(new Paragraph(personal.bio));
  }

  // Experience
  const validExp = experience.filter(e => e.school);
  if (validExp.length) {
    children.push(new Paragraph({ text: 'Teaching Experience', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const exp of validExp) {
      children.push(new Paragraph({ text: exp.role, bold: true, spacing: { after: 0 } }));
      children.push(new Paragraph(`${exp.school} · ${exp.from || ''} – ${exp.to || ''}`));
      const descLines = exp.description.split('\n').filter(l => l.trim());
      if (descLines.length) children.push(...bulletPoints(descLines));
      children.push(new Paragraph({ text: '' }));
    }
  }

  // Education
  const validEdu = education.filter(e => e.institution);
  if (validEdu.length) {
    children.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const edu of validEdu) {
      children.push(new Paragraph({ text: edu.qualification, bold: true, spacing: { after: 0 } }));
      children.push(new Paragraph(`${edu.institution} · ${edu.year}`));
    }
  }

  // Skills
  const skillsChildren: any[] = [];
  if (skills.subjects?.length) {
    skillsChildren.push(new Paragraph({ text: 'Subjects', bold: true, spacing: { after: 40 } }));
    skillsChildren.push(...bulletPoints(skills.subjects));
  }
  if (skills.soft_skills?.length) {
    skillsChildren.push(new Paragraph({ text: 'Professional Skills', bold: true, spacing: { before: 80, after: 40 } }));
    skillsChildren.push(...bulletPoints(skills.soft_skills));
  }
  if (skills.languages?.length) {
    skillsChildren.push(new Paragraph({ text: 'Languages', bold: true, spacing: { before: 80, after: 40 } }));
    skillsChildren.push(...bulletPoints(skills.languages));
  }
  if (skillsChildren.length) {
    children.push(new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    children.push(...skillsChildren);
  }

  // References (new page)
  const validRefs = (references || []).filter(r => r.name);
  if (validRefs.length) {
    children.push(new Paragraph({ pageBreakBefore: true, text: '' }));
    children.push(new Paragraph({ text: 'References', heading: HeadingLevel.HEADING_2, spacing: { before: 0, after: 80 } }));
    for (const ref of validRefs) {
      children.push(new Paragraph({ text: ref.name, bold: true, spacing: { after: 0 } }));
      children.push(new Paragraph([ref.title, ref.organisation].filter(Boolean).join(' · ')));
      children.push(new Paragraph(`Phone: ${ref.phone} · Email: ${ref.email}`));
      if (ref.relationship) children.push(new Paragraph(ref.relationship));
      children.push(new Paragraph({ text: '' }));
    }
  }

  return children;
}

// ----- Modern Template (teal accent, sidebar removed – simplified two‑column?) -----
function buildModern(data: CVData, user?: { id: string; email: string }) {
  const { personal, education, experience, skills, references } = data;
  const accent = '0d9488'; // teal
  const children: any[] = [];

  // Header: teal background, white text
  children.push(
    new Paragraph({
      children: [new TextRun({ text: personal.full_name || 'Your Name', bold: true, size: 32, color: 'FFFFFF' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      shading: { fill: accent, type: ShadingType.CLEAR },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Educator', color: 'FFFFFF', italics: true, size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
  );
  const contactParts = [personal.email, personal.phone, personal.address].filter(Boolean);
  if (contactParts.length) {
    children.push(new Paragraph({
      children: contactParts.map((part, idx) => new TextRun({ text: (idx > 0 ? ' | ' : '') + part, color: 'FFFFFF' })),
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }));
  }

  if (personal.bio) {
    children.push(new Paragraph({ text: 'About Me', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }));
    children.push(new Paragraph(personal.bio));
  }

  // Experience
  const validExp = experience.filter(e => e.school);
  if (validExp.length) {
    children.push(new Paragraph({ text: 'Teaching Experience', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const exp of validExp) {
      children.push(
        new Paragraph({ text: exp.role, bold: true, spacing: { after: 0 } }),
        new Paragraph(`${exp.school} · ${exp.from || ''} – ${exp.to || ''}`),
      );
      const descLines = exp.description.split('\n').filter(l => l.trim());
      if (descLines.length) children.push(...bulletPoints(descLines));
      children.push(new Paragraph({ text: '' }));
    }
  }

  // Education
  const validEdu = education.filter(e => e.institution);
  if (validEdu.length) {
    children.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const edu of validEdu) {
      children.push(new Paragraph({ text: edu.qualification, bold: true, spacing: { after: 0 } }));
      children.push(new Paragraph(`${edu.institution} · ${edu.year}`));
    }
  }

  // Skills (subjects, soft, languages)
  const skillsChildren: any[] = [];
  if (skills.subjects?.length) {
    skillsChildren.push(new Paragraph({ text: 'Subjects', bold: true, spacing: { after: 40 } }));
    skillsChildren.push(...bulletPoints(skills.subjects));
  }
  if (skills.soft_skills?.length) {
    skillsChildren.push(new Paragraph({ text: 'Professional Skills', bold: true, spacing: { before: 80, after: 40 } }));
    skillsChildren.push(...bulletPoints(skills.soft_skills));
  }
  if (skills.languages?.length) {
    skillsChildren.push(new Paragraph({ text: 'Languages', bold: true, spacing: { before: 80, after: 40 } }));
    skillsChildren.push(...bulletPoints(skills.languages));
  }
  if (skillsChildren.length) {
    children.push(new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    children.push(...skillsChildren);
  }

  // References
  const validRefs = (references || []).filter(r => r.name);
  if (validRefs.length) {
    children.push(new Paragraph({ pageBreakBefore: true, text: '' }));
    children.push(new Paragraph({ text: 'References', heading: HeadingLevel.HEADING_2, spacing: { before: 0, after: 80 } }));
    for (const ref of validRefs) {
      children.push(new Paragraph({ text: ref.name, bold: true, spacing: { after: 0 } }));
      children.push(new Paragraph([ref.title, ref.organisation].filter(Boolean).join(' · ')));
      children.push(new Paragraph(`Phone: ${ref.phone} · Email: ${ref.email}`));
      if (ref.relationship) children.push(new Paragraph(ref.relationship));
      children.push(new Paragraph({ text: '' }));
    }
  }

  return children;
}

// ----- Sidebar Template (two‑column with left sidebar) -----
function buildSidebar(data: CVData, user?: { id: string; email: string }) {
  const { personal, education, experience, skills, references } = data;
  const sidebarColor = '3b5998'; // blue
  // We need a two‑column layout: left column (sidebar) and right column (main)
  // The docx library supports tables for layout. We'll use a two‑cell table.
  const sidebarContent: Paragraph[] = [];
  const mainContent: Paragraph[] = [];

  // Left column: initials, contact, subjects, languages, soft skills
  const initials = (personal.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  sidebarContent.push(
    new Paragraph({ text: initials, alignment: AlignmentType.CENTER, spacing: { after: 80 }, bold: true, size: 28 }),
    new Paragraph({ text: personal.full_name || 'Your Name', alignment: AlignmentType.CENTER, spacing: { after: 20 } }),
    new Paragraph({ text: 'Educator', alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
  );
  // Contact
  const contact: string[] = [];
  if (personal.email) contact.push(`✉️ ${personal.email}`);
  if (personal.phone) contact.push(`📞 ${personal.phone}`);
  if (personal.address) contact.push(`📍 ${personal.address}`);
  contact.forEach(line => sidebarContent.push(new Paragraph(line)));
  sidebarContent.push(new Paragraph({ text: '' }));

  if (skills.subjects?.length) {
    sidebarContent.push(new Paragraph({ text: 'Subjects', bold: true, spacing: { after: 40 } }));
    skills.subjects.forEach(s => sidebarContent.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(s)] })));
    sidebarContent.push(new Paragraph({ text: '' }));
  }
  if (skills.languages?.length) {
    sidebarContent.push(new Paragraph({ text: 'Languages', bold: true, spacing: { after: 40 } }));
    skills.languages.forEach(l => sidebarContent.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(l)] })));
    sidebarContent.push(new Paragraph({ text: '' }));
  }
  if (skills.soft_skills?.length) {
    sidebarContent.push(new Paragraph({ text: 'Skills', bold: true, spacing: { after: 40 } }));
    skills.soft_skills.forEach(s => sidebarContent.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(s)] })));
    sidebarContent.push(new Paragraph({ text: '' }));
  }

  // Right column: bio, experience, education
  if (personal.bio) {
    mainContent.push(new Paragraph({ text: 'About Me', heading: HeadingLevel.HEADING_2, spacing: { after: 80 } }));
    mainContent.push(new Paragraph(personal.bio));
  }
  const validExp = experience.filter(e => e.school);
  if (validExp.length) {
    mainContent.push(new Paragraph({ text: 'Work History', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const exp of validExp) {
      mainContent.push(new Paragraph({ text: exp.role, bold: true, spacing: { after: 0 } }));
      mainContent.push(new Paragraph(`${exp.school} · ${exp.from || ''} – ${exp.to || ''}`));
      const descLines = exp.description.split('\n').filter(l => l.trim());
      if (descLines.length) mainContent.push(...bulletPoints(descLines, false));
      mainContent.push(new Paragraph({ text: '' }));
    }
  }
  const validEdu = education.filter(e => e.institution);
  if (validEdu.length) {
    mainContent.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const edu of validEdu) {
      mainContent.push(new Paragraph({ text: edu.qualification, bold: true, spacing: { after: 0 } }));
      mainContent.push(new Paragraph(`${edu.institution} · ${edu.year}`));
    }
  }

  // Build a table with two columns: width 30% / 70%
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: sidebarContent, shading: { fill: sidebarColor, type: ShadingType.CLEAR }, verticalAlign: 'top' }),
          new TableCell({ children: mainContent, verticalAlign: 'top' }),
        ],
      }),
    ],
  });

  const children: any[] = [table];

  // References (new page, full width)
  const validRefs = (references || []).filter(r => r.name);
  if (validRefs.length) {
    children.push(new Paragraph({ pageBreakBefore: true, text: '' }));
    children.push(new Paragraph({ text: 'References', heading: HeadingLevel.HEADING_2, spacing: { before: 0, after: 80 } }));
    for (const ref of validRefs) {
      children.push(new Paragraph({ text: ref.name, bold: true, spacing: { after: 0 } }));
      children.push(new Paragraph([ref.title, ref.organisation].filter(Boolean).join(' · ')));
      children.push(new Paragraph(`Phone: ${ref.phone} · Email: ${ref.email}`));
      if (ref.relationship) children.push(new Paragraph(ref.relationship));
      children.push(new Paragraph({ text: '' }));
    }
  }

  return children;
}

// ----- Main export function (chooses template) -----
export async function generateDocxBlob(data: CVData, user?: { id: string; email: string }): Promise<Blob> {
  let children: any[];
  const template = data.template || 'classic';

  switch (template) {
    case 'modern':
      children = buildModern(data, user);
      break;
    case 'sidebar':
      children = buildSidebar(data, user);
      break;
    case 'classic':
    default:
      children = buildClassic(data, user);
      break;
  }

  // Footer (abuse prevention) – same for all templates
  const footer = new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated by Crosssa – www.crosssa.co.za${user ? ` (User: ${user.email})` : ''}`,
            size: 18,
            color: '999999',
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 24 } } } },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children,
      footers: { default: footer },
    }],
    customProperties: user ? [
      { name: 'GeneratedBy', value: user.id },
      { name: 'GeneratedAt', value: new Date().toISOString() },
    ] : [],
  });

  return await Packer.toBlob(doc);
}