/**
 * CV PDF Export — jsPDF direct drawing (Option B)
 *
 * Draws the CV entirely in jsPDF — no html2canvas, no DOM rendering, no
 * pixel slicing. Text, rectangles, and lines are placed at exact coordinates.
 * Page breaks are handled by tracking the current Y position and calling
 * pdf.addPage() when content would overflow.
 *
 * Supports all 8 templates by reading the template name from data.template
 * and applying the correct colours/layout.
 */

import type { jsPDF as JsPDFType } from 'jspdf';

// ── Page constants (all in mm, jsPDF default unit) ────────────────────────
const PW   = 210;   // A4 width  mm
const PH   = 297;   // A4 height mm
const ML   = 14;    // margin left  (content area)
const MR   = 14;    // margin right
const MT   = 14;    // margin top
const MB   = 14;    // margin bottom

// Sidebar templates: left column width
const SIDEBAR_W = 46;  // mm

// Fonts
const FONT_REGULAR = 'helvetica';

// ── Template colour palettes ──────────────────────────────────────────────
interface Palette {
  sidebar: boolean;       // true = two-column with coloured left sidebar
  headerBg: string;       // header rectangle fill  e.g. '#1e2a3a'
  headerText: string;     // header text colour     e.g. '#ffffff'
  accent: string;         // section title colour
  sidebarBg?: string;     // sidebar bg (sidebar templates only)
  sidebarText?: string;
}

function getPalette(template: string): Palette {
  switch (template) {
    case 'modern':       return { sidebar: true,  headerBg: '#0d9488', headerText: '#fff', accent: '#0d9488', sidebarBg: '#0d9488', sidebarText: '#fff' };
    case 'sidebar':      return { sidebar: true,  headerBg: '#3b5998', headerText: '#fff', accent: '#3b5998', sidebarBg: '#3b5998', sidebarText: '#fff' };
    case 'corporate':    return { sidebar: true,  headerBg: '#1a2a4a', headerText: '#fff', accent: '#1a2a4a', sidebarBg: '#1a2a4a', sidebarText: '#fff' };
    case 'professional': return { sidebar: false, headerBg: '#1e4d2b', headerText: '#fff', accent: '#1e4d2b' };
    case 'minimal':      return { sidebar: false, headerBg: '#ffffff', headerText: '#111827', accent: '#111827' };
    case 'bold':         return { sidebar: false, headerBg: '#c2185b', headerText: '#fff', accent: '#c2185b' };
    case 'executive':    return { sidebar: false, headerBg: '#6b1a1a', headerText: '#fff', accent: '#6b1a1a' };
    default:             return { sidebar: false, headerBg: '#1e2a3a', headerText: '#fff', accent: '#1e2a3a' }; // classic
  }
}

// ── Colour helpers ────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setFill(pdf: JsPDFType, hex: string) {
  pdf.setFillColor(...hexToRgb(hex));
}
function setTextColor(pdf: JsPDFType, hex: string) {
  pdf.setTextColor(...hexToRgb(hex));
}
function setDrawColor(pdf: JsPDFType, hex: string) {
  pdf.setDrawColor(...hexToRgb(hex));
}

// ── Text wrapping helper ──────────────────────────────────────────────────
/**
 * Draws wrapped text, returns the Y position after the last line.
 * Automatically adds a new page if content would overflow.
 * `maxW` is the available width in mm.
 */
function drawWrappedText(
  pdf: JsPDFType,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  bottomLimit: number,
  onNewPage: (pdf: JsPDFType) => number,  // called when a new page is needed, returns new Y start
): number {
  const lines = pdf.splitTextToSize(text, maxW) as string[];
  for (const line of lines) {
    if (y + lineH > bottomLimit) {
      y = onNewPage(pdf);
    }
    pdf.text(line, x, y);
    y += lineH;
  }
  return y;
}

// ── Section heading ───────────────────────────────────────────────────────
function drawSectionHeading(
  pdf: JsPDFType,
  title: string,
  x: number,
  y: number,
  maxW: number,
  accent: string,
  bottomLimit: number,
  onNewPage: (pdf: JsPDFType) => number,
): number {
  if (y + 8 > bottomLimit) y = onNewPage(pdf);

  setTextColor(pdf, accent);
  pdf.setFont(FONT_REGULAR, 'bold');
  pdf.setFontSize(9);
  pdf.text(title.toUpperCase(), x, y);

  // Underline
  setDrawColor(pdf, accent);
  pdf.setLineWidth(0.4);
  const titleW = pdf.getTextWidth(title.toUpperCase());
  pdf.line(x + titleW + 2, y - 0.5, x + maxW, y - 0.5);

  return y + 6;
}

// ── Bullet point ──────────────────────────────────────────────────────────
function drawBullet(
  pdf: JsPDFType,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  bottomLimit: number,
  onNewPage: (pdf: JsPDFType) => number,
): number {
  const bulletX  = x + 2;
  const textX    = x + 5;
  const textMaxW = maxW - 5;

  pdf.setFont(FONT_REGULAR, 'normal');
  pdf.setFontSize(8.5);
  setTextColor(pdf, '#374151');

  const lines = pdf.splitTextToSize(text, textMaxW) as string[];
  for (let i = 0; i < lines.length; i++) {
    if (y + lineH > bottomLimit) y = onNewPage(pdf);
    if (i === 0) {
      setTextColor(pdf, '#374151');
      pdf.text('•', bulletX, y);
    }
    setTextColor(pdf, '#374151');
    pdf.text(lines[i], textX, y);
    y += lineH;
  }
  return y;
}

// ── Main export function ──────────────────────────────────────────────────
export async function exportElementAsPDF(
  _container: HTMLElement,
  filename: string,
  cvData?: Record<string, unknown>,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  // cvData is passed from CVStepReview — contains all CV fields
  if (!cvData) throw new Error('cvData required for direct PDF export');

  const data     = cvData as any;
  const personal = data.personal || {};
  const education = (data.education || []).filter((e: any) => e.institution);
  const experience = (data.experience || []).filter((e: any) => e.school);
  const skills   = data.skills || {};
  const refs     = (data.references || []).filter((r: any) => r.name);
  const customs  = (data.custom_sections || []).filter((s: any) => s.title);
  const palette  = getPalette(data.template || 'classic');
  const isSidebar = palette.sidebar;

  const pdf = new jsPDF({ format: 'a4', unit: 'mm', compress: true });

  // ── Layout geometry ───────────────────────────────────────────────────
  const contentX     = isSidebar ? ML + SIDEBAR_W + 6 : ML;
  const contentMaxW  = isSidebar ? PW - MR - ML - SIDEBAR_W - 6 : PW - ML - MR;
  const bottomLimit  = PH - MB;
  const lineH        = 4.8;   // mm between text baselines

  // ── Sidebar state (for sidebar templates) ────────────────────────────
  // The sidebar only appears on page 1. On page 2+ it's a plain white column.
  let onPage1 = true;

  // ── New page handler ─────────────────────────────────────────────────
  // Called when content overflows. Returns new Y starting position.
  function onNewPage(p: JsPDFType): number {
    p.addPage();
    onPage1 = false;

    // On page 2+ draw a thin accent left border if sidebar template
    if (isSidebar) {
      setFill(p, palette.sidebarBg!);
      p.rect(0, 0, ML + SIDEBAR_W + 3, PH, 'F');
    }

    return MT;
  }

  // ── HEADER ─────────────────────────────────────────────────────────────
  let headerH = 0;

  if (isSidebar) {
    // Sidebar templates: draw the full-height sidebar first, then name in content area
    setFill(pdf, palette.sidebarBg!);
    pdf.rect(0, 0, ML + SIDEBAR_W + 3, PH, 'F');

    // Sidebar content
    let sy = MT + 6;
    const sx = ML;
    const smaxW = SIDEBAR_W - 2;

    // Avatar initials circle
    const initials = (personal.full_name || 'U')
      .split(' ').map((n: string) => n[0] || '').join('').slice(0, 2).toUpperCase();
    pdf.setFillColor(200, 200, 200);
    pdf.setFillColor(200, 200, 200);
    pdf.circle(sx + smaxW / 2, sy + 8, 8, 'F');
    setTextColor(pdf, palette.sidebarBg!);
    pdf.setFont(FONT_REGULAR, 'bold');
    pdf.setFontSize(10);
    const iW = pdf.getTextWidth(initials);
    pdf.text(initials, sx + smaxW / 2 - iW / 2, sy + 9.5);

    sy += 20;

    // Name
    setTextColor(pdf, '#ffffff');
    pdf.setFont(FONT_REGULAR, 'bold');
    pdf.setFontSize(9);
    const nameLines = pdf.splitTextToSize(personal.full_name || 'Your Name', smaxW) as string[];
    for (const l of nameLines) {
      pdf.text(l, sx, sy);
      sy += 4.5;
    }
    sy += 2;

    // Contact section
    pdf.setFont(FONT_REGULAR, 'normal');
    pdf.setFontSize(7.5);
    // Section label
    setTextColor(pdf, 'rgba(255,255,255,0.6)');
    pdf.setTextColor(180, 230, 225);
    pdf.setFont(FONT_REGULAR, 'bold');
    pdf.setFontSize(7);
    pdf.text('CONTACT', sx, sy); sy += 3.5;
    pdf.setLineWidth(0.2); pdf.setDrawColor(200, 200, 200);
    pdf.line(sx, sy, sx + smaxW, sy); sy += 2.5;

    pdf.setFont(FONT_REGULAR, 'normal');
    pdf.setFontSize(7.5);
    setTextColor(pdf, '#e0f2f1');
    if (personal.email) {
      const el = pdf.splitTextToSize(personal.email, smaxW) as string[];
      for (const l of el) { pdf.text(l, sx, sy); sy += 3.8; }
      sy += 1;
    }
    if (personal.phone) {
      const pl = pdf.splitTextToSize(personal.phone, smaxW) as string[];
      for (const l of pl) { pdf.text(l, sx, sy); sy += 3.8; }
      sy += 1;
    }
    if (personal.address) {
      const al = pdf.splitTextToSize(personal.address, smaxW) as string[];
      for (const l of al) { pdf.text(l, sx, sy); sy += 3.8; }
      sy += 1;
    }
    if (personal.id_number) { pdf.text(`ID: ${personal.id_number}`, sx, sy); sy += 4; }
    sy += 2;

    // Subjects
    if (skills.subjects?.length) {
      pdf.setFont(FONT_REGULAR, 'bold'); pdf.setFontSize(7); pdf.setTextColor(180, 230, 225);
      pdf.text('SUBJECTS', sx, sy); sy += 3.5;
      pdf.setLineWidth(0.2); pdf.line(sx, sy, sx + smaxW, sy); sy += 2.5;
      pdf.setFont(FONT_REGULAR, 'normal'); pdf.setFontSize(7.5); setTextColor(pdf, '#e0f2f1');
      for (const s of skills.subjects) {
        const sl = pdf.splitTextToSize(`• ${s}`, smaxW) as string[];
        for (const l of sl) { pdf.text(l, sx, sy); sy += 3.8; }
      }
      sy += 2;
    }

    // Languages
    if (skills.languages?.length) {
      pdf.setFont(FONT_REGULAR, 'bold'); pdf.setFontSize(7); pdf.setTextColor(180, 230, 225);
      pdf.text('LANGUAGES', sx, sy); sy += 3.5;
      pdf.setLineWidth(0.2); pdf.line(sx, sy, sx + smaxW, sy); sy += 2.5;
      pdf.setFont(FONT_REGULAR, 'normal'); pdf.setFontSize(7.5); setTextColor(pdf, '#e0f2f1');
      for (const s of skills.languages) { pdf.text(`• ${s}`, sx, sy); sy += 3.8; }
      sy += 2;
    }

    // Skills
    if (skills.soft_skills?.length) {
      pdf.setFont(FONT_REGULAR, 'bold'); pdf.setFontSize(7); pdf.setTextColor(180, 230, 225);
      pdf.text('SKILLS', sx, sy); sy += 3.5;
      pdf.setLineWidth(0.2); pdf.line(sx, sy, sx + smaxW, sy); sy += 2.5;
      pdf.setFont(FONT_REGULAR, 'normal'); pdf.setFontSize(7.5); setTextColor(pdf, '#e0f2f1');
      for (const s of skills.soft_skills) {
        const sl = pdf.splitTextToSize(`• ${s}`, smaxW) as string[];
        for (const l of sl) { pdf.text(l, sx, sy); sy += 3.8; }
      }
    }

    // Name + title bar at top of content area
    let cy = MT + 8;
    setTextColor(pdf, palette.accent);
    pdf.setFont(FONT_REGULAR, 'bold');
    pdf.setFontSize(15);
    pdf.text(personal.full_name || 'Your Name', contentX, cy);
    cy += 6;
    setTextColor(pdf, '#6b7280');
    pdf.setFont(FONT_REGULAR, 'normal');
    pdf.setFontSize(8);
    pdf.text('EDUCATOR', contentX, cy);
    cy += 2;
    setDrawColor(pdf, palette.accent);
    pdf.setLineWidth(0.4);
    pdf.line(contentX, cy, PW - MR, cy);
    headerH = cy + 4 - MT;

  } else {
    // Non-sidebar: coloured header banner — tall enough for name + 2-line contact
    const hh = 30;
    setFill(pdf, palette.headerBg);
    pdf.rect(0, 0, PW, hh, 'F');

    setTextColor(pdf, palette.headerText);
    pdf.setFont(FONT_REGULAR, 'bold');
    pdf.setFontSize(16);
    pdf.text((personal.full_name || 'Your Name').toUpperCase(), ML, 12);

    pdf.setFont(FONT_REGULAR, 'normal');
    pdf.setFontSize(7.5);
    // Join contact details with separator, wrap if too long
    const contactParts = [
      personal.email,
      personal.phone,
      personal.address,
      personal.id_number && `ID: ${personal.id_number}`,
    ].filter(Boolean) as string[];
    const contactStr = contactParts.join('   |   ');
    if (contactStr) {
      setTextColor(pdf, palette.headerText);
      const cLines = pdf.splitTextToSize(contactStr, PW - ML - MR) as string[];
      const startY = cLines.length > 1 ? hh - 9 : hh - 5;
      cLines.forEach((cl: string, i: number) => pdf.text(cl, ML, startY + i * 4));
    }

    headerH = hh + 4;
  }

  // ── Content drawing state ─────────────────────────────────────────────
  let y = MT + headerH;

  // ── Professional Summary / Bio ────────────────────────────────────────
  if (personal.bio) {
    y = drawSectionHeading(pdf, 'Professional Summary', contentX, y, contentMaxW, palette.accent, bottomLimit, onNewPage);
    pdf.setFont(FONT_REGULAR, 'normal');
    pdf.setFontSize(8.5);
    setTextColor(pdf, '#374151');
    y = drawWrappedText(pdf, personal.bio, contentX, y, contentMaxW, lineH, bottomLimit, onNewPage);
    y += 5;
  }

  // ── Experience ────────────────────────────────────────────────────────
  if (experience.length > 0) {
    y = drawSectionHeading(pdf, 'Work Experience', contentX, y, contentMaxW, palette.accent, bottomLimit, onNewPage);

    for (const exp of experience) {
      if (y + 14 > bottomLimit) y = onNewPage(pdf);

      // Role title
      pdf.setFont(FONT_REGULAR, 'bold');
      pdf.setFontSize(9);
      setTextColor(pdf, '#111827');
      pdf.text(exp.role || '', contentX, y);
      y += lineH;

      // School + dates on same line
      pdf.setFont(FONT_REGULAR, 'normal');
      pdf.setFontSize(8);
      setTextColor(pdf, palette.accent);
      const dateStr = [exp.from, exp.to].filter(Boolean).join(' – ');
      const schoolText = exp.school || '';
      pdf.text(schoolText, contentX, y);
      if (dateStr) {
        setTextColor(pdf, '#6b7280');
        const schoolW = pdf.getTextWidth(schoolText);
        pdf.text(`  ·  ${dateStr}`, contentX + schoolW, y);
      }
      y += lineH;

      // Description bullets
      if (exp.description) {
        const bullets = exp.description.split('\n').map((l: string) => l.trim()).filter(Boolean);
        for (const bullet of bullets) {
          y = drawBullet(pdf, bullet, contentX, y, contentMaxW, lineH, bottomLimit, onNewPage);
        }
      }
      y += 3;
    }
    y += 2;
  }

  // ── Education ─────────────────────────────────────────────────────────
  if (education.length > 0) {
    y = drawSectionHeading(pdf, 'Education', contentX, y, contentMaxW, palette.accent, bottomLimit, onNewPage);

    for (const edu of education) {
      if (y + 10 > bottomLimit) y = onNewPage(pdf);

      pdf.setFont(FONT_REGULAR, 'bold');
      pdf.setFontSize(9);
      setTextColor(pdf, '#111827');
      pdf.text(edu.qualification || '', contentX, y);
      y += lineH;

      pdf.setFont(FONT_REGULAR, 'normal');
      pdf.setFontSize(8);
      setTextColor(pdf, '#6b7280');
      pdf.text([edu.institution, edu.year].filter(Boolean).join('  ·  '), contentX, y);
      y += lineH + 2;
    }
    y += 2;
  }

  // ── Skills (non-sidebar templates only) ──────────────────────────────
  if (!isSidebar) {
    const hasSubjects   = skills.subjects?.length;
    const hasSoft       = skills.soft_skills?.length;
    const hasLanguages  = skills.languages?.length;

    if (hasSubjects || hasSoft || hasLanguages) {
      y = drawSectionHeading(pdf, 'Skills & Languages', contentX, y, contentMaxW, palette.accent, bottomLimit, onNewPage);

      if (hasSubjects) {
        pdf.setFont(FONT_REGULAR, 'bold'); pdf.setFontSize(8.5); setTextColor(pdf, '#374151');
        pdf.text('Subjects: ', contentX, y);
        const labelW = pdf.getTextWidth('Subjects: ');
        pdf.setFont(FONT_REGULAR, 'normal');
        y = drawWrappedText(pdf, skills.subjects.join(' · '), contentX + labelW, y, contentMaxW - labelW, lineH, bottomLimit, onNewPage);
        y += 2;
      }
      if (hasSoft) {
        pdf.setFont(FONT_REGULAR, 'bold'); pdf.setFontSize(8.5); setTextColor(pdf, '#374151');
        pdf.text('Skills: ', contentX, y);
        const labelW = pdf.getTextWidth('Skills: ');
        pdf.setFont(FONT_REGULAR, 'normal');
        y = drawWrappedText(pdf, skills.soft_skills.join(' · '), contentX + labelW, y, contentMaxW - labelW, lineH, bottomLimit, onNewPage);
        y += 2;
      }
      if (hasLanguages) {
        pdf.setFont(FONT_REGULAR, 'bold'); pdf.setFontSize(8.5); setTextColor(pdf, '#374151');
        pdf.text('Languages: ', contentX, y);
        const labelW = pdf.getTextWidth('Languages: ');
        pdf.setFont(FONT_REGULAR, 'normal');
        y = drawWrappedText(pdf, skills.languages.join(' · '), contentX + labelW, y, contentMaxW - labelW, lineH, bottomLimit, onNewPage);
        y += 2;
      }
      y += 3;
    }
  }

  // ── Custom sections ───────────────────────────────────────────────────
  for (const section of customs) {
    y = drawSectionHeading(pdf, section.title, contentX, y, contentMaxW, palette.accent, bottomLimit, onNewPage);

    if (section.type === 'text' && section.content) {
      pdf.setFont(FONT_REGULAR, 'normal'); pdf.setFontSize(8.5); setTextColor(pdf, '#374151');
      y = drawWrappedText(pdf, section.content, contentX, y, contentMaxW, lineH, bottomLimit, onNewPage);
    } else if (section.type === 'bullets' && section.content) {
      const lines = section.content.split('\n').map((l: string) => l.trim()).filter(Boolean);
      for (const line of lines) {
        y = drawBullet(pdf, line, contentX, y, contentMaxW, lineH, bottomLimit, onNewPage);
      }
    } else if (section.type === 'table' && section.columns?.length && section.rows?.length) {
      // Simple table: header row then data rows
      const colW = contentMaxW / section.columns.length;
      pdf.setFont(FONT_REGULAR, 'bold'); pdf.setFontSize(8);
      setFill(pdf, palette.accent); setTextColor(pdf, '#ffffff');
      pdf.rect(contentX, y - 4, contentMaxW, 5.5, 'F');
      for (let ci = 0; ci < section.columns.length; ci++) {
        pdf.text(section.columns[ci], contentX + ci * colW + 1, y);
      }
      y += 5.5;
      pdf.setFont(FONT_REGULAR, 'normal');
      for (let ri = 0; ri < section.rows.length; ri++) {
        if (y + 5 > bottomLimit) y = onNewPage(pdf);
        if (ri % 2 === 0) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(contentX, y - 4, contentMaxW, 5.5, 'F');
        }
        setTextColor(pdf, '#374151');
        for (let ci = 0; ci < section.rows[ri].length; ci++) {
          pdf.text(String(section.rows[ri][ci] || ''), contentX + ci * colW + 1, y);
        }
        y += 5.5;
      }
    }
    y += 4;
  }

  // ── References page ───────────────────────────────────────────────────
  if (refs.length > 0) {
    pdf.addPage();
    onPage1 = false;

    // Sidebar background on refs page too
    if (isSidebar) {
      setFill(pdf, palette.sidebarBg!);
      pdf.rect(0, 0, ML + SIDEBAR_W + 3, PH, 'F');
    } else {
      // Thin accent bar at top
      setFill(pdf, palette.headerBg);
      pdf.rect(0, 0, PW, 8, 'F');
    }

    let ry = MT + 4;
    ry = drawSectionHeading(pdf, 'References', contentX, ry, contentMaxW, palette.accent, bottomLimit, onNewPage);
    ry += 2;

    // Two-column grid for references
    const refColW = (contentMaxW - 8) / 2;
    let col = 0;

    for (const ref of refs) {
      const rx = col === 0 ? contentX : contentX + refColW + 8;
      let refY = ry;

      pdf.setFont(FONT_REGULAR, 'bold'); pdf.setFontSize(9); setTextColor(pdf, '#111827');
      pdf.text(ref.name, rx, refY); refY += lineH;

      if (ref.title) {
        pdf.setFont(FONT_REGULAR, 'normal'); pdf.setFontSize(8.5); setTextColor(pdf, '#374151');
        pdf.text(ref.title, rx, refY); refY += lineH;
      }
      if (ref.organisation) {
        pdf.setFont(FONT_REGULAR, 'normal'); pdf.setFontSize(8); setTextColor(pdf, '#6b7280');
        pdf.text(ref.organisation, rx, refY); refY += lineH;
      }
      if (ref.relationship) {
        pdf.setFont(FONT_REGULAR, 'italic'); pdf.setFontSize(7.5); setTextColor(pdf, '#6b7280');
        pdf.text(ref.relationship, rx, refY); refY += lineH;
      }
      if (ref.phone || ref.email) {
        pdf.setFont(FONT_REGULAR, 'normal'); pdf.setFontSize(7.5); setTextColor(pdf, '#6b7280');
        pdf.text([ref.phone, ref.email].filter(Boolean).join('  ·  '), rx, refY);
      }

      if (col === 0) {
        col = 1;
      } else {
        col = 0;
        ry += 24;
      }
    }
  }

  // ── Watermark ─────────────────────────────────────────────────────────
  if (data.watermark) {
    const pages = pdf.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      pdf.setPage(p);
      setFill(pdf, '#1e2a3a');
      pdf.rect(0, PH - 8, PW, 8, 'F');
      setTextColor(pdf, '#ffffff');
      pdf.setFont(FONT_REGULAR, 'normal');
      pdf.setFontSize(7);
      const wText = 'Created FREE at www.crosssa.co.za — Connecting SA Educators';
      const wW = pdf.getTextWidth(wText);
      pdf.text(wText, (PW - wW) / 2, PH - 3);
    }
  }

  void filename;
  return pdf.output('blob');
}