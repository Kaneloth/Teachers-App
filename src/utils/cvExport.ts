/**
 * CV PDF Export — jsPDF direct drawing
 *
 * Clean, professional output matching the Nasi Ispani style:
 * - Proper section heading lines
 * - Accent squares/dashes as icon substitutes (jsPDF-safe, no emoji)
 * - Consistent line & paragraph spacing
 * - Footer on every page: "Resume of [Name]" left, "Page N of M" right
 */

import type { jsPDF as JsPDFType } from 'jspdf';

// ── Page geometry (mm) ────────────────────────────────────────────────────
const PW        = 210;
const PH        = 297;
const ML        = 15;      // left margin
const MR        = 15;      // right margin
const MT        = 14;      // top margin (content start below header)
const FOOTER_H  = 10;      // footer strip height
const BOTTOM    = PH - FOOTER_H - 4;  // lowest Y content can reach

// Sidebar
const SIDEBAR_W = 52;      // mm — sidebar column width

// Typography
const F         = 'helvetica';

// Spacing (mm)
const LINE_H    = 5.2;     // body text line height
const SECTION_GAP   = 7;   // gap before each section heading
const HEADING_GAP   = 5;   // gap after section heading before first item
const ITEM_GAP      = 2.5; // gap between items within a section
const BULLET_INDENT = 4.5; // bullet text indent from content x

// ── Palettes ──────────────────────────────────────────────────────────────
interface Palette {
  sidebar:    boolean;
  headerBg:   string;
  headerText: string;
  accent:     string;
  accentDim:  string;   // lighter shade for sub-text
  sidebarBg?: string;
}

function getPalette(t: string): Palette {
  switch (t) {
    case 'modern':       return { sidebar: true,  headerBg: '#0d9488', headerText: '#ffffff', accent: '#0d9488', accentDim: '#0f766e', sidebarBg: '#0d9488' };
    case 'sidebar':      return { sidebar: true,  headerBg: '#3b5998', headerText: '#ffffff', accent: '#3b5998', accentDim: '#2d4373', sidebarBg: '#3b5998' };
    case 'corporate':    return { sidebar: true,  headerBg: '#1a2a4a', headerText: '#ffffff', accent: '#1a2a4a', accentDim: '#243a6b', sidebarBg: '#1a2a4a' };
    case 'professional': return { sidebar: false, headerBg: '#1e4d2b', headerText: '#ffffff', accent: '#1e4d2b', accentDim: '#2d7a47' };
    case 'minimal':      return { sidebar: false, headerBg: '#f9fafb', headerText: '#111827', accent: '#111827', accentDim: '#374151' };
    case 'bold':         return { sidebar: false, headerBg: '#c2185b', headerText: '#ffffff', accent: '#c2185b', accentDim: '#ad1457' };
    case 'executive':    return { sidebar: false, headerBg: '#6b1a1a', headerText: '#ffffff', accent: '#6b1a1a', accentDim: '#8b2424' };
    default:             return { sidebar: false, headerBg: '#1e2a3a', headerText: '#ffffff', accent: '#1e2a3a', accentDim: '#2d3f52' }; // classic
  }
}

// ── Colour utilities ──────────────────────────────────────────────────────
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const setFill  = (p: JsPDFType, h: string) => p.setFillColor(...rgb(h));
const setTxt   = (p: JsPDFType, h: string) => p.setTextColor(...rgb(h));
const setDraw  = (p: JsPDFType, h: string) => p.setDrawColor(...rgb(h));

// ── Small filled square — used as a bullet/icon substitute ───────────────
function dot(p: JsPDFType, x: number, y: number, color: string, size = 1.2) {
  setFill(p, color);
  p.rect(x, y - size + 0.2, size, size, 'F');
}

// ── Horizontal rule ───────────────────────────────────────────────────────
function hRule(p: JsPDFType, x: number, y: number, w: number, color: string, lw = 0.3) {
  setDraw(p, color);
  p.setLineWidth(lw);
  p.line(x, y, x + w, y);
}

// ── Section heading with left accent bar + full-width rule ────────────────
// Style: [accent rect] TITLE ────────────────────
function sectionHeading(
  p: JsPDFType,
  title: string,
  x: number,
  y: number,
  maxW: number,
  accent: string,
  bottom: number,
  newPage: () => number,
): number {
  if (y + 10 > bottom) y = newPage();
  y += SECTION_GAP * 0.6;

  // Left accent bar (3mm tall rectangle, 2.5mm wide)
  setFill(p, accent);
  p.rect(x, y - 3.2, 2.5, 3.8, 'F');

  // Title text
  setTxt(p, accent);
  p.setFont(F, 'bold');
  p.setFontSize(9);
  p.text(title.toUpperCase(), x + 4, y);

  // Rule from end of title to right edge
  const titleW = p.getTextWidth(title.toUpperCase());
  hRule(p, x + 4 + titleW + 2, y - 1.5, maxW - 4 - titleW - 2, accent, 0.35);

  return y + HEADING_GAP;
}

// ── Wrapped text block ────────────────────────────────────────────────────
function wrappedText(
  p: JsPDFType,
  text: string,
  x: number,
  y: number,
  maxW: number,
  bottom: number,
  newPage: () => number,
  lh = LINE_H,
): number {
  const lines = p.splitTextToSize(text, maxW) as string[];
  for (const line of lines) {
    if (y + lh > bottom) y = newPage();
    p.text(line, x, y);
    y += lh;
  }
  return y;
}

// ── Bullet line ───────────────────────────────────────────────────────────
function bulletLine(
  p: JsPDFType,
  text: string,
  x: number,
  y: number,
  maxW: number,
  accent: string,
  bottom: number,
  newPage: () => number,
): number {
  const textX = x + BULLET_INDENT;
  const lines = p.splitTextToSize(text, maxW - BULLET_INDENT) as string[];
  for (let i = 0; i < lines.length; i++) {
    if (y + LINE_H > bottom) y = newPage();
    if (i === 0) dot(p, x + 0.8, y - 0.2, accent, 1.1);
    setTxt(p, '#374151');
    p.text(lines[i], textX, y);
    y += LINE_H;
  }
  return y;
}

// ── Footer ────────────────────────────────────────────────────────────────
function drawFooter(p: JsPDFType, name: string, pageNum: number, totalPages: number, accent: string) {
  const fy = PH - 5;
  // Thin top rule
  hRule(p, ML, PH - FOOTER_H, PW - ML - MR, '#e5e7eb', 0.25);
  // "Resume of Name" left
  p.setFont(F, 'italic');
  p.setFontSize(7);
  setTxt(p, '#9ca3af');
  p.text(`Resume of ${name}`, ML, fy);
  // "Page N of M" right
  const pageStr = `Page ${pageNum} of ${totalPages}`;
  const pw2 = p.getTextWidth(pageStr);
  p.text(pageStr, PW - MR - pw2, fy);
}

// ── Sidebar label heading ─────────────────────────────────────────────────
function sidebarLabel(p: JsPDFType, text: string, x: number, y: number, maxW: number): number {
  p.setFont(F, 'bold');
  p.setFontSize(7);
  p.setTextColor(200, 230, 225);
  p.text(text.toUpperCase(), x, y);
  p.setLineWidth(0.2);
  p.setDrawColor(180, 220, 215);
  p.line(x, y + 1, x + maxW, y + 1);
  return y + 4;
}

// ── Main export ───────────────────────────────────────────────────────────
export async function exportElementAsPDF(
  _container: HTMLElement,
  filename: string,
  cvData?: Record<string, unknown>,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  if (!cvData) throw new Error('cvData required');

  const data      = cvData as any;
  const p         = data.personal  || {};
  const edu       = (data.education      || []).filter((e: any) => e.institution);
  const exp       = (data.experience     || []).filter((e: any) => e.school);
  const sk        = data.skills          || {};
  const refs      = (data.references     || []).filter((r: any) => r.name);
  const customs   = (data.custom_sections|| []).filter((s: any) => s.title);
  const pal       = getPalette(data.template || 'classic');
  const isSB      = pal.sidebar;
  const ownerName = p.full_name || 'Applicant';

  const pdf = new jsPDF({ format: 'a4', unit: 'mm', compress: true });

  // Content column geometry
  const CX   = isSB ? ML + SIDEBAR_W + 5 : ML;     // content left edge
  const CMW  = isSB ? PW - MR - CX : PW - ML - MR; // content max width

  // Page tracking
  let pageCount = 1;

  // newPage: adds a page, draws sidebar bg if needed, returns new Y
  function newPage(): number {
    pdf.addPage();
    pageCount++;
    if (isSB) {
      setFill(pdf, pal.sidebarBg!);
      pdf.rect(0, 0, ML + SIDEBAR_W + 2, PH, 'F');
    }
    return MT;
  }

  // ── HEADER ─────────────────────────────────────────────────────────────
  let headerH: number;

  if (isSB) {
    // ── Sidebar header: full-page sidebar + name/title in content area ──
    setFill(pdf, pal.sidebarBg!);
    pdf.rect(0, 0, ML + SIDEBAR_W + 2, PH, 'F');

    // ─ Sidebar contents ─
    let sy    = MT + 4;
    const sx  = ML;
    const smw = SIDEBAR_W - 3;

    // Initials avatar
    const initials = ownerName.split(' ').map((n: string) => n[0] || '').join('').slice(0, 2).toUpperCase();
    pdf.setFillColor(255, 255, 255, 0.15);
    pdf.setFillColor(230, 255, 250);
    pdf.circle(sx + smw / 2, sy + 7, 9, 'F');
    setTxt(pdf, pal.sidebarBg!);
    pdf.setFont(F, 'bold'); pdf.setFontSize(10);
    const iw = pdf.getTextWidth(initials);
    pdf.text(initials, sx + smw / 2 - iw / 2, sy + 9);
    sy += 20;

    // Name
    setTxt(pdf, '#ffffff');
    pdf.setFont(F, 'bold'); pdf.setFontSize(9.5);
    const nameLines = pdf.splitTextToSize(ownerName, smw) as string[];
    for (const l of nameLines) { pdf.text(l, sx, sy); sy += 5; }
    sy += 3;

    // Contact
    sy = sidebarLabel(pdf, 'Contact', sx, sy, smw);
    pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); setTxt(pdf, '#e0fdf4');
    if (p.email) {
      for (const l of (pdf.splitTextToSize(p.email, smw) as string[])) { pdf.text(l, sx, sy); sy += 4; }
      sy += 0.5;
    }
    if (p.phone)  { pdf.text(p.phone, sx, sy); sy += 4; }
    if (p.address) {
      for (const l of (pdf.splitTextToSize(p.address, smw) as string[])) { pdf.text(l, sx, sy); sy += 4; }
    }
    if (p.id_number) { pdf.text(`ID: ${p.id_number}`, sx, sy); sy += 4; }
    sy += 5;

    // Subjects
    if (sk.subjects?.length) {
      sy = sidebarLabel(pdf, 'Subjects', sx, sy, smw);
      pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); setTxt(pdf, '#e0fdf4');
      for (const s of sk.subjects) {
        for (const l of (pdf.splitTextToSize(`- ${s}`, smw) as string[])) { pdf.text(l, sx, sy); sy += 4; }
      }
      sy += 4;
    }

    // Languages
    if (sk.languages?.length) {
      sy = sidebarLabel(pdf, 'Languages', sx, sy, smw);
      pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); setTxt(pdf, '#e0fdf4');
      for (const l of sk.languages) { pdf.text(`- ${l}`, sx, sy); sy += 4; }
      sy += 4;
    }

    // Skills
    if (sk.soft_skills?.length) {
      sy = sidebarLabel(pdf, 'Skills', sx, sy, smw);
      pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); setTxt(pdf, '#e0fdf4');
      for (const s of sk.soft_skills) {
        for (const l of (pdf.splitTextToSize(`- ${s}`, smw) as string[])) { pdf.text(l, sx, sy); sy += 4; }
      }
    }

    // ─ Name + divider in content area ─
    let cy = MT + 8;
    setTxt(pdf, pal.accent);
    pdf.setFont(F, 'bold'); pdf.setFontSize(16);
    pdf.text(ownerName.toUpperCase(), CX, cy); cy += 6;
    setTxt(pdf, '#6b7280');
    pdf.setFont(F, 'normal'); pdf.setFontSize(8);
    pdf.text('EDUCATOR', CX, cy); cy += 3;
    hRule(pdf, CX, cy, CMW, pal.accent, 0.5);
    headerH = cy + 5 - MT;

  } else {
    // ── Banner header ──
    const hh = 32;
    setFill(pdf, pal.headerBg);
    pdf.rect(0, 0, PW, hh, 'F');

    // Name
    setTxt(pdf, pal.headerText);
    pdf.setFont(F, 'bold'); pdf.setFontSize(17);
    pdf.text(ownerName.toUpperCase(), ML, 13);

    // Thin rule below name
    hRule(pdf, ML, 16, PW - ML - MR,
      pal.headerText === '#ffffff' ? 'rgba(255,255,255,0.3)' : '#d1d5db', 0.3);
    // Use a slightly transparent white by setting draw color manually
    pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.25);
    pdf.line(ML, 16, PW - MR, 16);

    // Contact row
    const contactParts = [p.email, p.phone, p.address, p.id_number && `ID: ${p.id_number}`]
      .filter(Boolean) as string[];
    const contactStr = contactParts.join('   |   ');
    pdf.setFont(F, 'normal'); pdf.setFontSize(7.5);
    setTxt(pdf, pal.headerText);
    const cLines = pdf.splitTextToSize(contactStr, PW - ML - MR) as string[];
    cLines.forEach((cl: string, i: number) => pdf.text(cl, ML, 21 + i * 4));

    headerH = hh + 3;
  }

  // ── Content Y cursor ─────────────────────────────────────────────────
  let y = MT + headerH;

  // ── Professional Summary ──────────────────────────────────────────────
  if (p.bio) {
    y = sectionHeading(pdf, 'Professional Summary', CX, y, CMW, pal.accent, BOTTOM, newPage);
    pdf.setFont(F, 'normal'); pdf.setFontSize(9); setTxt(pdf, '#374151');
    y = wrappedText(pdf, p.bio, CX, y, CMW, BOTTOM, newPage);
    y += ITEM_GAP + 1;
  }

  // ── Experience ────────────────────────────────────────────────────────
  if (exp.length) {
    y = sectionHeading(pdf, 'Teaching Experience', CX, y, CMW, pal.accent, BOTTOM, newPage);

    for (const e of exp) {
      if (y + 16 > BOTTOM) y = newPage();

      // Role — bold, dark
      pdf.setFont(F, 'bold'); pdf.setFontSize(10); setTxt(pdf, '#111827');
      pdf.text(e.role || '', CX, y); y += LINE_H;

      // School — accent colour
      pdf.setFont(F, 'bold'); pdf.setFontSize(8.5); setTxt(pdf, pal.accent);
      const school = e.school || '';
      pdf.text(school, CX, y);

      // Date — grey, right-aligned
      const dateStr = [e.from, e.to].filter(Boolean).join(' - ');
      if (dateStr) {
        pdf.setFont(F, 'normal'); pdf.setFontSize(8); setTxt(pdf, '#6b7280');
        const dw = pdf.getTextWidth(dateStr);
        pdf.text(dateStr, CX + CMW - dw, y);
      }
      y += LINE_H;

      // Thin rule under school/date row
      hRule(pdf, CX, y - 1.5, CMW, '#e5e7eb', 0.2);

      // Bullets
      if (e.description) {
        y += 1;
        pdf.setFont(F, 'normal'); pdf.setFontSize(9); setTxt(pdf, '#374151');
        for (const b of e.description.split('\n').map((l: string) => l.trim()).filter(Boolean)) {
          y = bulletLine(pdf, b, CX, y, CMW, pal.accent, BOTTOM, newPage);
        }
      }
      y += ITEM_GAP + 1;
    }
    y += 1;
  }

  // ── Education ─────────────────────────────────────────────────────────
  if (edu.length) {
    y = sectionHeading(pdf, 'Education', CX, y, CMW, pal.accent, BOTTOM, newPage);

    for (const e of edu) {
      if (y + 12 > BOTTOM) y = newPage();

      // Qualification
      pdf.setFont(F, 'bold'); pdf.setFontSize(10); setTxt(pdf, '#111827');
      pdf.text(e.qualification || '', CX, y); y += LINE_H;

      // Institution + year
      pdf.setFont(F, 'normal'); pdf.setFontSize(8.5); setTxt(pdf, '#6b7280');
      const instStr = [e.institution, e.year].filter(Boolean).join('   |   ');
      pdf.text(instStr, CX, y);
      y += LINE_H + ITEM_GAP;
    }
    y += 1;
  }

  // ── Skills (non-sidebar templates) ───────────────────────────────────
  if (!isSB && (sk.subjects?.length || sk.soft_skills?.length || sk.languages?.length)) {
    y = sectionHeading(pdf, 'Skills & Languages', CX, y, CMW, pal.accent, BOTTOM, newPage);

    const skillRows: [string, string[]][] = [
      ['Subjects',  sk.subjects   || []],
      ['Skills',    sk.soft_skills|| []],
      ['Languages', sk.languages  || []],
    ].filter(([, arr]) => arr.length) as [string, string[]][];

    for (const [label, items] of skillRows) {
      if (y + LINE_H > BOTTOM) y = newPage();
      pdf.setFont(F, 'bold'); pdf.setFontSize(9); setTxt(pdf, '#374151');
      pdf.text(`${label}:`, CX, y);
      const lw = pdf.getTextWidth(`${label}:`) + 2;
      pdf.setFont(F, 'normal'); setTxt(pdf, '#374151');
      y = wrappedText(pdf, items.join('  |  '), CX + lw, y, CMW - lw, BOTTOM, newPage);
      y += ITEM_GAP;
    }
    y += 2;
  }

  // ── Custom sections ───────────────────────────────────────────────────
  for (const sec of customs) {
    y = sectionHeading(pdf, sec.title, CX, y, CMW, pal.accent, BOTTOM, newPage);
    pdf.setFont(F, 'normal'); pdf.setFontSize(9); setTxt(pdf, '#374151');

    if (sec.type === 'text' && sec.content) {
      y = wrappedText(pdf, sec.content, CX, y, CMW, BOTTOM, newPage);
    } else if (sec.type === 'bullets' && sec.content) {
      for (const b of sec.content.split('\n').map((l: string) => l.trim()).filter(Boolean)) {
        y = bulletLine(pdf, b, CX, y, CMW, pal.accent, BOTTOM, newPage);
      }
    } else if (sec.type === 'table' && sec.columns?.length && sec.rows?.length) {
      const cw = CMW / sec.columns.length;
      // Header row
      setFill(pdf, pal.accent); setTxt(pdf, '#ffffff');
      pdf.rect(CX, y - 4, CMW, 6, 'F');
      pdf.setFont(F, 'bold'); pdf.setFontSize(8);
      sec.columns.forEach((col: string, ci: number) => pdf.text(col, CX + ci * cw + 1, y));
      y += 6;
      pdf.setFont(F, 'normal'); pdf.setFontSize(8.5);
      for (let ri = 0; ri < sec.rows.length; ri++) {
        if (y + 6 > BOTTOM) y = newPage();
        if (ri % 2 === 0) { pdf.setFillColor(249, 250, 251); pdf.rect(CX, y - 4, CMW, 6, 'F'); }
        setTxt(pdf, '#374151');
        sec.rows[ri].forEach((cell: string, ci: number) => pdf.text(String(cell || ''), CX + ci * cw + 1, y));
        y += 6;
      }
    }
    y += 3;
  }

  // ── References page ───────────────────────────────────────────────────
  if (refs.length) {
    pdf.addPage(); pageCount++;

    if (isSB) {
      setFill(pdf, pal.sidebarBg!);
      pdf.rect(0, 0, ML + SIDEBAR_W + 2, PH, 'F');
    } else {
      // Thin accent top bar
      setFill(pdf, pal.headerBg);
      pdf.rect(0, 0, PW, 6, 'F');
    }

    let ry = MT;
    ry = sectionHeading(pdf, 'References', CX, ry, CMW, pal.accent, BOTTOM, newPage);
    ry += 2;

    // Two-column references grid
    // Draw all left-column refs first, then right-column, tracking max Y per row
    const half   = (CMW - 8) / 2;
    const COL_GAP = 8;

    // Draw a single reference card, return end Y
    function drawRefCard(ref: any, rx: number, startY: number): number {
      let cy = startY;
      dot(pdf, rx, cy - 0.8, pal.accent, 1.6);
      pdf.setFont(F, 'bold'); pdf.setFontSize(9.5); setTxt(pdf, '#111827');
      pdf.text(ref.name, rx + 3, cy); cy += LINE_H;
      if (ref.title) {
        pdf.setFont(F, 'normal'); pdf.setFontSize(9); setTxt(pdf, pal.accent);
        pdf.text(ref.title, rx + 3, cy); cy += LINE_H;
      }
      if (ref.organisation) {
        pdf.setFont(F, 'normal'); pdf.setFontSize(8.5); setTxt(pdf, '#6b7280');
        pdf.text(ref.organisation, rx + 3, cy); cy += LINE_H;
      }
      if (ref.relationship) {
        pdf.setFont(F, 'italic'); pdf.setFontSize(8); setTxt(pdf, '#9ca3af');
        pdf.text(ref.relationship, rx + 3, cy); cy += LINE_H;
      }
      if (ref.phone || ref.email) {
        pdf.setFont(F, 'normal'); pdf.setFontSize(8); setTxt(pdf, '#6b7280');
        pdf.text([ref.phone, ref.email].filter(Boolean).join('  |  '), rx + 3, cy); cy += LINE_H;
      }
      return cy;
    }

    // Lay out in pairs
    for (let i = 0; i < refs.length; i += 2) {
      const leftY  = drawRefCard(refs[i],   CX,                ry);
      const rightY = refs[i + 1] ? drawRefCard(refs[i + 1], CX + half + COL_GAP, ry) : ry;
      // Light separator line below each row
      const rowEndY = Math.max(leftY, rightY) + 2;
      hRule(pdf, CX, rowEndY, CMW, '#e5e7eb', 0.2);
      ry = rowEndY + 5;
    }
  }

  // ── Watermark strip (free plan) ───────────────────────────────────────
  if (data.watermark) {
    const total = pdf.getNumberOfPages();
    for (let pg = 1; pg <= total; pg++) {
      pdf.setPage(pg);
      setFill(pdf, '#0f172a');
      pdf.rect(0, PH - FOOTER_H, PW, FOOTER_H, 'F');
      setTxt(pdf, '#94a3b8');
      pdf.setFont(F, 'normal'); pdf.setFontSize(7);
      const wt = 'Created FREE at www.crosssa.co.za  -  Upgrade to remove this watermark';
      const wtw = pdf.getTextWidth(wt);
      pdf.text(wt, (PW - wtw) / 2, PH - 3.5);
    }
  }

  // ── Footer: "Resume of Name"  |  "Page N of M" on every page ─────────
  const totalPages = pdf.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    pdf.setPage(pg);
    if (!data.watermark) {
      drawFooter(pdf, ownerName, pg, totalPages, pal.accent);
    } else {
      // Watermark replaces footer — draw footer text on top of watermark bar
      const fy = PH - 3.5;
      pdf.setFont(F, 'normal'); pdf.setFontSize(7); setTxt(pdf, '#ffffff');
      pdf.text(`Resume of ${ownerName}`, ML, fy);
      const ps = `Page ${pg} of ${totalPages}`;
      pdf.text(ps, PW - MR - pdf.getTextWidth(ps), fy);
    }
  }

  void filename;
  return pdf.output('blob');
}