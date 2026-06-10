import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Footer, PageNumber, BorderStyle, WidthType, ShadingType,
  Table, TableRow, TableCell, VerticalAlign, Header
} from 'docx';

interface CVData {
  personal: {
    full_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    bio?: string;
    photo_url?: string;
    id_number?: string;
  };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects?: string[]; soft_skills?: string[]; languages?: string[] };
  references?: { name: string; title: string; organisation: string; phone: string; email: string; relationship: string }[];
  custom_sections?: any[];
  template: string;
}

function bulletPoints(lines: string[], indentLevel = 0): Paragraph[] {
  return lines.map(line => new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun(line.trim())],
    indent: indentLevel ? { left: 720 } : undefined,
  }));
}

// ----------------------------------------------------------------------
// Classic Template (dark header, left border on experience, etc.)
function buildClassic(data: CVData, user?: { id: string; email: string }) {
  const { personal, education, experience, skills, references } = data;
  const children: any[] = [];

  // Header: dark background, white name and contact line
  children.push(
    new Paragraph({
      children: [new TextRun({ text: personal.full_name || 'Your Name', bold: true, size: 32, color: 'FFFFFF' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      shading: { fill: '1e2a3a', type: ShadingType.CLEAR },
    }),
  );
  const contactParts = [personal.email, personal.phone, personal.address].filter(Boolean);
  if (contactParts.length) {
    children.push(new Paragraph({
      children: contactParts.map((part, idx) => new TextRun({ text: (idx > 0 ? ' | ' : '') + part, color: 'FFFFFF' })),
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      shading: { fill: '1e2a3a', type: ShadingType.CLEAR },
    }));
  }

  // Professional Summary
  if (personal.bio) {
    children.push(
      new Paragraph({ text: 'Professional Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }),
      new Paragraph(personal.bio),
    );
  }

  // Education
  const validEdu = education.filter(e => e.institution);
  if (validEdu.length) {
    children.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }));
    for (const edu of validEdu) {
      children.push(
        new Paragraph({ text: edu.qualification, bold: true, spacing: { after: 0 } }),
        new Paragraph(`${edu.institution} · ${edu.year}`, { spacing: { after: 100 } }),
      );
    }
  }

  // Experience
  const validExp = experience.filter(e => e.school);
  if (validExp.length) {
    children.push(new Paragraph({ text: 'Teaching Experience', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }));
    for (const exp of validExp) {
      children.push(
        new Paragraph({ text: exp.role, bold: true, spacing: { after: 0 } }),
        new Paragraph(`${exp.school} · ${exp.from || ''} – ${exp.to || ''}`, { spacing: { after: 60 } }),
      );
      const descLines = exp.description.split('\n').filter(l => l.trim());
      if (descLines.length) children.push(...bulletPoints(descLines));
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    }
  }

  // Skills & Subjects
  const skillItems: any[] = [];
  if (skills.subjects?.length) {
    skillItems.push(new Paragraph({ text: 'Subjects', bold: true, spacing: { after: 40 } }));
    skillItems.push(...bulletPoints(skills.subjects));
  }
  if (skills.soft_skills?.length) {
    skillItems.push(new Paragraph({ text: 'Professional Skills', bold: true, spacing: { before: 80, after: 40 } }));
    skillItems.push(...bulletPoints(skills.soft_skills));
  }
  if (skills.languages?.length) {
    skillItems.push(new Paragraph({ text: 'Languages', bold: true, spacing: { before: 80, after: 40 } }));
    skillItems.push(...bulletPoints(skills.languages));
  }
  if (skillItems.length) {
    children.push(new Paragraph({ text: 'Skills & Subjects', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }));
    children.push(...skillItems);
  }

  // References (new page)
  const validRefs = (references || []).filter(r => r.name);
  if (validRefs.length) {
    children.push(new Paragraph({ pageBreakBefore: true, text: '' }));
    children.push(new Paragraph({ text: 'References', heading: HeadingLevel.HEADING_2, spacing: { before: 0, after: 80 } }));
    for (const ref of validRefs) {
      children.push(
        new Paragraph({ text: ref.name, bold: true, spacing: { after: 0 } }),
        new Paragraph([ref.title, ref.organisation].filter(Boolean).join(' · ')),
        new Paragraph(`Phone: ${ref.phone} · Email: ${ref.email}`),
        ref.relationship ? new Paragraph(ref.relationship) : null,
        new Paragraph({ text: '' }),
      ).filter(Boolean);
    }
  }

  return children;
}

// ----------------------------------------------------------------------
// Modern Template (teal accent, sidebar-less, clean)
function buildModern(data: CVData, user?: { id: string; email: string }) {
  const { personal, education, experience, skills, references } = data;
  const accent = '0d9488'; // teal
  const children: any[] = [];

  // Header with teal background
  children.push(
    new Paragraph({
      children: [new TextRun({ text: personal.full_name || 'Your Name', bold: true, size: 32, color: 'FFFFFF' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      shading: { fill: accent, type: ShadingType.CLEAR },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Educator', color: 'FFFFFF', italics: true, size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      shading: { fill: accent, type: ShadingType.CLEAR },
    }),
  );
  const contactParts = [personal.email, personal.phone, personal.address].filter(Boolean);
  if (contactParts.length) {
    children.push(new Paragraph({
      children: contactParts.map((part, idx) => new TextRun({ text: (idx > 0 ? ' | ' : '') + part, color: 'FFFFFF' })),
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      shading: { fill: accent, type: ShadingType.CLEAR },
    }));
  }

  // About Me (bio)
  if (personal.bio) {
    children.push(
      new Paragraph({ text: 'About Me', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }),
      new Paragraph(personal.bio),
    );
  }

  // Experience
  const validExp = experience.filter(e => e.school);
  if (validExp.length) {
    children.push(new Paragraph({ text: 'Teaching Experience', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }));
    for (const exp of validExp) {
      children.push(
        new Paragraph({ text: exp.role, bold: true, spacing: { after: 0 } }),
        new Paragraph(`${exp.school} · ${exp.from || ''} – ${exp.to || ''}`, { spacing: { after: 60 } }),
      );
      const descLines = exp.description.split('\n').filter(l => l.trim());
      if (descLines.length) children.push(...bulletPoints(descLines));
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    }
  }

  // Education
  const validEdu = education.filter(e => e.institution);
  if (validEdu.length) {
    children.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }));
    for (const edu of validEdu) {
      children.push(
        new Paragraph({ text: edu.qualification, bold: true, spacing: { after: 0 } }),
        new Paragraph(`${edu.institution} · ${edu.year}`, { spacing: { after: 100 } }),
      );
    }
  }

  // Skills
  const skillItems: any[] = [];
  if (skills.subjects?.length) {
    skillItems.push(new Paragraph({ text: 'Subjects', bold: true, spacing: { after: 40 } }));
    skillItems.push(...bulletPoints(skills.subjects));
  }
  if (skills.soft_skills?.length) {
    skillItems.push(new Paragraph({ text: 'Professional Skills', bold: true, spacing: { before: 80, after: 40 } }));
    skillItems.push(...bulletPoints(skills.soft_skills));
  }
  if (skills.languages?.length) {
    skillItems.push(new Paragraph({ text: 'Languages', bold: true, spacing: { before: 80, after: 40 } }));
    skillItems.push(...bulletPoints(skills.languages));
  }
  if (skillItems.length) {
    children.push(new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }));
    children.push(...skillItems);
  }

  // References
  const validRefs = (references || []).filter(r => r.name);
  if (validRefs.length) {
    children.push(new Paragraph({ pageBreakBefore: true, text: '' }));
    children.push(new Paragraph({ text: 'References', heading: HeadingLevel.HEADING_2, spacing: { before: 0, after: 80 } }));
    for (const ref of validRefs) {
      children.push(
        new Paragraph({ text: ref.name, bold: true, spacing: { after: 0 } }),
        new Paragraph([ref.title, ref.organisation].filter(Boolean).join(' · ')),
        new Paragraph(`Phone: ${ref.phone} · Email: ${ref.email}`),
        ref.relationship ? new Paragraph(ref.relationship) : null,
        new Paragraph({ text: '' }),
      ).filter(Boolean);
    }
  }

  return children;
}

// ----------------------------------------------------------------------
// Sidebar Template (two‑column table with coloured left panel)
function buildSidebar(data: CVData, user?: { id: string; email: string }) {
  const { personal, education, experience, skills, references } = data;
  const sidebarColor = '3b5998'; // blue

  // Left column content
  const leftCol: Paragraph[] = [];

  // Initials circle (approximated with text)
  const initials = (personal.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  leftCol.push(new Paragraph({
    text: initials,
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    bold: true,
    size: 28,
  }));
  leftCol.push(new Paragraph({
    text: personal.full_name || 'Your Name',
    alignment: AlignmentType.CENTER,
    spacing: { after: 20 },
  }));
  leftCol.push(new Paragraph({ text: 'Educator', alignment: AlignmentType.CENTER, spacing: { after: 160 } }));

  // Contact
  const contactLines = [];
  if (personal.email) contactLines.push(`✉️ ${personal.email}`);
  if (personal.phone) contactLines.push(`📞 ${personal.phone}`);
  if (personal.address) contactLines.push(`📍 ${personal.address}`);
  contactLines.forEach(line => leftCol.push(new Paragraph(line)));
  leftCol.push(new Paragraph({ text: '' }));

  if (skills.subjects?.length) {
    leftCol.push(new Paragraph({ text: 'Subjects', bold: true, spacing: { after: 40 } }));
    skills.subjects.forEach(s => leftCol.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(s)] })));
    leftCol.push(new Paragraph({ text: '' }));
  }
  if (skills.languages?.length) {
    leftCol.push(new Paragraph({ text: 'Languages', bold: true, spacing: { after: 40 } }));
    skills.languages.forEach(l => leftCol.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(l)] })));
    leftCol.push(new Paragraph({ text: '' }));
  }
  if (skills.soft_skills?.length) {
    leftCol.push(new Paragraph({ text: 'Skills', bold: true, spacing: { after: 40 } }));
    skills.soft_skills.forEach(s => leftCol.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(s)] })));
    leftCol.push(new Paragraph({ text: '' }));
  }

  // Right column content
  const rightCol: Paragraph[] = [];

  if (personal.bio) {
    rightCol.push(new Paragraph({ text: 'About Me', heading: HeadingLevel.HEADING_2, spacing: { after: 80 } }));
    rightCol.push(new Paragraph(personal.bio));
  }

  const validExp = experience.filter(e => e.school);
  if (validExp.length) {
    rightCol.push(new Paragraph({ text: 'Work History', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const exp of validExp) {
      rightCol.push(new Paragraph({ text: exp.role, bold: true, spacing: { after: 0 } }));
      rightCol.push(new Paragraph(`${exp.school} · ${exp.from || ''} – ${exp.to || ''}`, { spacing: { after: 60 } }));
      const descLines = exp.description.split('\n').filter(l => l.trim());
      if (descLines.length) rightCol.push(...bulletPoints(descLines));
      rightCol.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    }
  }

  const validEdu = education.filter(e => e.institution);
  if (validEdu.length) {
    rightCol.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const edu of validEdu) {
      rightCol.push(new Paragraph({ text: edu.qualification, bold: true, spacing: { after: 0 } }));
      rightCol.push(new Paragraph(`${edu.institution} · ${edu.year}`, { spacing: { after: 100 } }));
    }
  }

  // Build two‑column table
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: leftCol,
            shading: { fill: sidebarColor, type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.TOP,
            width: { size: 30, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: rightCol,
            verticalAlign: VerticalAlign.TOP,
            width: { size: 70, type: WidthType.PERCENTAGE },
          }),
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
      children.push(
        new Paragraph({ text: ref.name, bold: true, spacing: { after: 0 } }),
        new Paragraph([ref.title, ref.organisation].filter(Boolean).join(' · ')),
        new Paragraph(`Phone: ${ref.phone} · Email: ${ref.email}`),
        ref.relationship ? new Paragraph(ref.relationship) : null,
        new Paragraph({ text: '' }),
      ).filter(Boolean);
    }
  }

  return children;
}

// ----------------------------------------------------------------------
// Main export
export async function generateDocxBlob(data: CVData, user?: { id: string; email: string }): Promise<Blob> {
  let children: any[];
  switch (data.template) {
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

  // Footer (abuse prevention)
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
    styles: {
      default: { document: { run: { font: "Calibri", size: 24 } } },
    },
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