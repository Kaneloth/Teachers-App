// src/lib/generateDocxBlob.ts
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Footer, PageNumber, SectionType } from 'docx';

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
  skills: {
    subjects?: string[];
    soft_skills?: string[];
    languages?: string[];
  };
  references?: { name: string; title: string; organisation: string; phone: string; email: string; relationship: string }[];
  custom_sections?: { title: string; type: 'text' | 'bullets' | 'table'; content?: string; columns?: string[]; rows?: string[][] }[];
  template: string;
}

// Helper: convert a multiline description into bullet points
function bulletPoints(lines: string[]): Paragraph[] {
  return lines.map(line => new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun(line.trim())],
  }));
}

export async function generateDocxBlob(data: CVData, user?: { id: string; email: string }): Promise<Blob> {
  const { personal, education, experience, skills, references, custom_sections } = data;

  const children: any[] = [];

  // ---- Header: Name + Contact ----
  children.push(
    new Paragraph({
      text: personal.full_name || 'Your Name',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun(personal.email || ''),
        new TextRun(personal.phone ? ` | ${personal.phone}` : ''),
        new TextRun(personal.address ? ` | ${personal.address}` : ''),
      ].filter(t => t.text),
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );

  // ---- Professional Summary ----
  if (personal.bio) {
    children.push(
      new Paragraph({ text: 'Professional Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }),
      new Paragraph(personal.bio)
    );
  }

  // ---- Experience ----
  const validExp = experience.filter(e => e.school);
  if (validExp.length) {
    children.push(new Paragraph({ text: 'Teaching Experience', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const exp of validExp) {
      children.push(
        new Paragraph({ text: exp.role, bold: true, spacing: { after: 0 } }),
        new Paragraph(`${exp.school} · ${exp.from || ''} – ${exp.to || ''}`)
      );
      const descLines = exp.description.split('\n').filter(l => l.trim());
      if (descLines.length) children.push(...bulletPoints(descLines));
      children.push(new Paragraph({ text: '' })); // spacer
    }
  }

  // ---- Education ----
  const validEdu = education.filter(e => e.institution);
  if (validEdu.length) {
    children.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    for (const edu of validEdu) {
      children.push(
        new Paragraph({ text: edu.qualification, bold: true, spacing: { after: 0 } }),
        new Paragraph(`${edu.institution} · ${edu.year}`)
      );
    }
  }

  // ---- Skills ----
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

  // ---- Custom sections ----
  if (custom_sections) {
    for (const sec of custom_sections) {
      if (!sec.title) continue;
      children.push(new Paragraph({ text: sec.title, heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
      if (sec.type === 'text' && sec.content) {
        children.push(new Paragraph(sec.content));
      } else if (sec.type === 'bullets' && sec.content) {
        const lines = sec.content.split('\n').filter(l => l.trim());
        children.push(...bulletPoints(lines));
      }
      // Table handling omitted for brevity – add if needed
    }
  }

  // ---- References (new page) ----
  const validRefs = (references || []).filter(r => r.name);
  if (validRefs.length) {
    children.push(new Paragraph({ pageBreakBefore: true, text: '' }));
    children.push(new Paragraph({ text: 'References', heading: HeadingLevel.HEADING_2, spacing: { before: 0, after: 80 } }));
    for (const ref of validRefs) {
      children.push(
        new Paragraph({ text: ref.name, bold: true, spacing: { after: 0 } }),
        new Paragraph([ref.title, ref.organisation].filter(Boolean).join(' · ')),
        new Paragraph(`Phone: ${ref.phone} · Email: ${ref.email}`),
        ref.relationship && new Paragraph(ref.relationship),
        new Paragraph({ text: '' })
      );
    }
  }

  // ---- Abuse Prevention: Footer (every page) ----
  const footer = new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated by Crosssa – www.crosssa.co.za${user ? ` (User: ${user.email})` : ''}`,
            size: 18, // 9pt
            color: '999999',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
    ],
  });

  // ---- Hidden document property (visible in Word → Info) ----
  const customProperties = [];
  if (user) {
    customProperties.push(
      { name: 'GeneratedBy', value: user.id },
      { name: 'GeneratedAt', value: new Date().toISOString() }
    );
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 24 } } },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
      footers: { default: footer },
    }],
    customProperties,
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}