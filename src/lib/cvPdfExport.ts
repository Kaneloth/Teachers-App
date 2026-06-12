import { jsPDF as JsPDFClass } from 'jspdf';

interface CVData {
  personal: { full_name?: string; email?: string; phone?: string; address?: string; bio?: string; photo_url?: string; id_number?: string };
  education: { institution: string; qualification: string; year: string }[];
  experience: { school: string; role: string; from: string; to: string; description: string }[];
  skills: { subjects?: string[]; soft_skills?: string[]; languages?: string[] };
  references?: { name: string; title: string; organisation: string; phone: string; email: string; relationship: string }[];
  custom_sections?: { title: string; type: 'text' | 'bullets' | 'table'; content?: string; columns?: string[]; rows?: string[][] }[];
  template: string;
  watermark?: boolean;
}

const PW = 210; const PH = 297; const ML = 15; const MR = 15; const MT = 14;
const FOOTER_H = 10; const BOTTOM = PH - FOOTER_H - 4;
const SIDEBAR_W = 34; const F = 'helvetica'; const LINE_H = 5.2;
const SECTION_GAP = 7; const HEADING_GAP = 5; const ITEM_GAP = 2.5; const BULLET_INDENT = 4.5;

interface Palette {
  sidebar: boolean; layout: string;
  hbR: number; hbG: number; hbB: number;
  htR: number; htG: number; htB: number;
  aR: number; aG: number; aB: number;
  sbR: number; sbG: number; sbB: number;
}

function getPalette(t: string): Palette {
  switch (t) {
    case 'modern':       return { sidebar:true, layout:'sidebar', hbR:13, hbG:148, hbB:136, htR:255,htG:255,htB:255, aR:13, aG:148, aB:136, sbR:13, sbG:148, sbB:136 };
    case 'sidebar':      return { sidebar:true, layout:'sidebar', hbR:59, hbG:89,  hbB:152, htR:255,htG:255,htB:255, aR:59, aG:89,  aB:152, sbR:59, sbG:89,  sbB:152 };
    case 'corporate':    return { sidebar:true, layout:'sidebar', hbR:26, hbG:42,  hbB:74,  htR:255,htG:255,htB:255, aR:26, aG:42,  aB:74,  sbR:26, sbG:42,  sbB:74  };
    case 'professional': return { sidebar:false,layout:'banner',  hbR:30, hbG:77,  hbB:43,  htR:255,htG:255,htB:255, aR:30, aG:77,  aB:43,  sbR:30, sbG:77,  sbB:43  };
    case 'minimal':      return { sidebar:false,layout:'minimal', hbR:249,hbG:250, hbB:251, htR:17, htG:24,  htB:39,  aR:17, aG:24,  aB:39,  sbR:249,sbG:250, sbB:251 };
    case 'bold':         return { sidebar:false,layout:'banner',  hbR:194,hbG:24,  hbB:91,  htR:255,htG:255,htB:255, aR:194,aG:24,  aB:91,  sbR:194,sbG:24,  sbB:91  };
    case 'executive':    return { sidebar:false,layout:'banner',  hbR:107,hbG:26,  hbB:26,  htR:255,htG:255,htB:255, aR:107,aG:26,  aB:26,  sbR:107,sbG:26,  sbB:26  };
    case 'stylish':      return { sidebar:false,layout:'two-col', hbR:224,hbG:92,  hbB:107, htR:255,htG:255,htB:255, aR:224,aG:92,  aB:107, sbR:224,sbG:92,  sbB:107 };
    case 'boxed':        return { sidebar:false,layout:'boxed',   hbR:55, hbG:65,  hbB:81,  htR:255,htG:255,htB:255, aR:55, aG:65,  aB:81,  sbR:55, sbG:65,  sbB:81  };
    case 'traditional':  return { sidebar:false,layout:'left-date',hbR:249,hbG:250, hbB:251, htR:17, htG:24,  htB:39,  aR:55, aG:65,  aB:81,  sbR:249,sbG:250, sbB:251 };
    case 'navy':         return { sidebar:true,layout:'right-sidebar',hbR:26,hbG:42,hbB:74,htR:255,htG:255,htB:255, aR:26,aG:42,aB:74,sbR:26,sbG:42,sbB:74 };
    case 'timeline':     return { sidebar:false,layout:'timeline',hbR:55,hbG:65, hbB:81,  htR:255,htG:255,htB:255, aR:55, aG:65, aB:81,  sbR:55, sbG:65, sbB:81  };
    case 'shaded':       return { sidebar:false,layout:'shaded',  hbR:243,hbG:244, hbB:246, htR:55, htG:65,  htB:81,  aR:55, aG:65, aB:81,  sbR:243,sbG:244, sbB:246 };
    case 'teal':         return { sidebar:false,layout:'two-col', hbR:6,  hbG:182, hbB:212, htR:17, htG:24,  htB:39,  aR:6,  aG:182,aB:212, sbR:6,  sbG:182, sbB:212 };
    case 'crimson':      return { sidebar:false,layout:'banner',  hbR:192,hbG:57,  hbB:43,  htR:255,htG:255,htB:255, aR:192,aG:57,  aB:43,  sbR:192,sbG:57,  sbB:43  };
    case 'sage':         return { sidebar:false,layout:'sage',    hbR:232,hbG:240, hbB:232, htR:55, htG:65,  htB:81,  aR:127,aG:163, aB:127, sbR:232,sbG:240, sbB:232 };
    default:             return { sidebar:false,layout:'banner',  hbR:30, hbG:42,  hbB:58,  htR:255,htG:255,htB:255, aR:30, aG:42,  aB:58,  sbR:30, sbG:42,  sbB:58  };
  }
}

function fill(p: any, r: number, g: number, b: number) { p.setFillColor(r, g, b); }
function text(p: any, r: number, g: number, b: number) { p.setTextColor(r, g, b); }
function draw(p: any, r: number, g: number, b: number) { p.setDrawColor(r, g, b); }
function reset(p: any) { p.setFillColor(255,255,255); p.setDrawColor(0,0,0); p.setTextColor(0,0,0); }

function dot(p: any, x: number, y: number, aR: number, aG: number, aB: number, size = 1.1) {
  fill(p, aR, aG, aB);
  p.rect(x, y - size + 0.2, size, size, 'F');
}

function hLine(p: any, x: number, y: number, w: number, r: number, g: number, b: number, lw = 0.3) {
  draw(p, r, g, b); p.setLineWidth(lw); p.line(x, y, x + w, y);
}

function sectionHeading(
  p: any, title: string, x: number, y: number, maxW: number,
  aR: number, aG: number, aB: number,
  bottom: number, newPage: () => number, getLayout?: () => { cx: number; cmw: number },
  layout = 'banner',
): number {
  if (y + 28 > bottom) { y = newPage(); if (getLayout) { x = getLayout().cx; maxW = getLayout().cmw; } }
  y += SECTION_GAP * 0.6;
  if (layout === 'shaded') {
    fill(p, 243, 244, 246); p.rect(x - 2, y - 4, maxW + 4, 7, 'F');
    text(p, 55, 65, 81); p.setFont(F, 'bold'); p.setFontSize(9);
    p.text(title.toUpperCase(), x + 2, y);
  } else if (layout === 'timeline') {
    text(p, aR, aG, aB); p.setFont(F, 'bold'); p.setFontSize(9);
    p.text('◆ ' + title.toUpperCase(), x, y);
    const tw = p.getTextWidth('◆ ' + title.toUpperCase());
    hLine(p, x + tw + 2, y - 1.5, maxW - tw - 2, 209, 213, 219, 0.4);
  } else if (layout === 'sage') {
    text(p, aR, aG, aB); p.setFont(F, 'bold'); p.setFontSize(11);
    p.text(title, x, y);
    hLine(p, x, y + 2, maxW, aR, aG, aB, 0.5);
  } else {
    fill(p, aR, aG, aB); p.rect(x, y - 3.2, 2.5, 3.8, 'F');
    text(p, aR, aG, aB); p.setFont(F, 'bold'); p.setFontSize(9);
    p.text(title.toUpperCase(), x + 4, y);
    const tw = p.getTextWidth(title.toUpperCase());
    hLine(p, x + 4 + tw + 2, y - 1.5, maxW - 4 - tw - 2, aR, aG, aB, 0.35);
  }
  return y + HEADING_GAP;
}

function justifyRow(p: any, line: string, x: number, y: number, maxW: number, isLast: boolean) {
  const words = line.trim().split(' ').filter((w: string) => w.length > 0);
  if (isLast || words.length <= 1) { p.text(line, x, y); return; }
  const totalW = words.reduce((s: number, w: string) => s + p.getTextWidth(w), 0);
  const gap = words.length > 1 ? (maxW - totalW) / (words.length - 1) : 0;
  let wx = x;
  for (const w of words) { p.text(w, wx, y); wx += p.getTextWidth(w) + gap; }
}

function wrappedText(
  p: any, t: string, x: number, y: number, maxW: number,
  bottom: number, newPage: () => number, lh = LINE_H,
  getLayout?: () => { cx: number; cmw: number },
): number {
  const lines = p.splitTextToSize(t, maxW) as string[];
  for (let i = 0; i < lines.length; i++) {
    if (y + lh > bottom) { y = newPage(); if (getLayout) { x = getLayout().cx; maxW = getLayout().cmw; } }
    justifyRow(p, lines[i], x, y, maxW, i === lines.length - 1);
    y += lh;
  }
  return y;
}

function bulletLine(
  p: any, t: string, x: number, y: number, maxW: number,
  aR: number, aG: number, aB: number,
  bottom: number, newPage: () => number, getLayout?: () => { cx: number; cmw: number },
): number {
  const bw = maxW - BULLET_INDENT;
  const lines = p.splitTextToSize(t, bw) as string[];
  for (let i = 0; i < lines.length; i++) {
    if (y + LINE_H > bottom) { y = newPage(); if (getLayout) { x = getLayout().cx; maxW = getLayout().cmw; } }
    if (i === 0) dot(p, x + 0.8, y - 0.2, aR, aG, aB, 1.1);
    text(p, 55, 65, 81);
    justifyRow(p, lines[i], x + BULLET_INDENT, y, maxW - BULLET_INDENT, i === lines.length - 1);
    y += LINE_H;
  }
  return y;
}

function sidebarLabel(p: any, t: string, x: number, y: number, maxW: number): number {
  p.setFont(F, 'bold'); p.setFontSize(7);
  p.setTextColor(200, 230, 225);
  p.text(t.toUpperCase(), x, y);
  p.setLineWidth(0.2); p.setDrawColor(180, 220, 215);
  p.line(x, y + 1, x + maxW, y + 1);
  return y + 4;
}

function drawFooter(p: any, name: string, pg: number, total: number, aR: number, aG: number, aB: number) {
  hLine(p, ML, PH - FOOTER_H, PW - ML - MR, 229, 231, 235, 0.25);
  p.setFont(F, 'italic'); p.setFontSize(7); text(p, 156, 163, 175);
  p.text(`Resume of ${name}`, ML, PH - 5);
  const ps = `Page ${pg} of ${total}`;
  p.text(ps, PW - MR - p.getTextWidth(ps), PH - 5);
}

export async function generateCvPdf(cvData: CVData): Promise<Blob> {
  const jsPDF = JsPDFClass;
  const data = cvData as any;
  const pr = data.personal || {};
  const edu = (data.education || []).filter((e: any) => e.institution);
  const exp = (data.experience || []).filter((e: any) => e.school);
  const sk = data.skills || {};
  const refs = (data.references || []).filter((r: any) => r.name);
  const customs = (data.custom_sections || []).filter((s: any) => s.title);
  const pal = getPalette(data.template || 'classic');
  const isSB = pal.layout === 'sidebar';
  const owner = pr.full_name || 'Applicant';
  const { aR, aG, aB, hbR, hbG, hbB, htR, htG, htB, sbR, sbG, sbB } = pal;

  const pdf = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  reset(pdf);

  const CX1 = isSB ? ML + SIDEBAR_W + 10 : ML;
  const CMW1 = PW - MR - CX1;
  const CX2 = ML;
  const CMW2 = PW - ML - MR;
  const layout = { cx: CX1, cmw: CMW1 };
  let pageCount = 1;

  function newPage(): number {
    pdf.addPage(); pageCount++;
    reset(pdf);
    layout.cx = CX2; layout.cmw = CMW2;
    fill(pdf, hbR, hbG, hbB); pdf.rect(0, 0, PW, 6, 'F'); reset(pdf);
    if (pal.layout === 'right-sidebar' || pal.layout === 'two-col') {
      layout.cx = ML; layout.cmw = CMW2;
    }
    return MT + 6;
  }

  const GL = () => layout;
  let y = MT;
  let headerH = 0;

  // ── HEADER ──
  if (pal.layout === 'sidebar') {
    fill(pdf, sbR, sbG, sbB); pdf.rect(0, 0, ML + SIDEBAR_W + 2, PH, 'F');
    let sy = MT + 4; const sx = ML + 1; const smw = SIDEBAR_W - 4;
    pdf.setFillColor(220, 245, 242); pdf.circle(sx + smw / 2, sy + 7, 9, 'F');
    const initials = owner.split(' ').map((n: string) => n[0] || '').join('').slice(0, 2).toUpperCase();
    text(pdf, sbR, sbG, sbB); pdf.setFont(F, 'bold'); pdf.setFontSize(10);
    pdf.text(initials, sx + smw / 2 - pdf.getTextWidth(initials) / 2, sy + 9);
    sy += 22;
    sy = sidebarLabel(pdf, 'Contact', sx, sy, smw);
    pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); text(pdf, 224, 253, 244);
    if (pr.email) { sy += 4; pdf.text(pr.email, sx, sy); sy += 4; }
    if (pr.phone) { sy += 1; pdf.text(pr.phone, sx, sy); sy += 4; }
    if (pr.address) { sy += 1; const ls = pdf.splitTextToSize(pr.address, smw) as string[]; ls.forEach((l: string) => { pdf.text(l, sx, sy); sy += 4; }); }
    if (pr.id_number) { sy += 1; pdf.text(`ID: ${pr.id_number}`, sx, sy); sy += 4; }
    // ... (sidebar skills/languages/subjects — compacted for brevity)
    reset(pdf);
    let cy = MT + 8;
    text(pdf, aR, aG, aB); pdf.setFont(F, 'bold'); pdf.setFontSize(16);
    pdf.text(owner.toUpperCase(), layout.cx, cy); cy += 6;
    text(pdf, 107, 114, 128); pdf.setFont(F, 'normal'); pdf.setFontSize(8);
    pdf.text('EDUCATOR', layout.cx, cy); cy += 3;
    hLine(pdf, layout.cx, cy, layout.cmw, aR, aG, aB, 0.5);
    headerH = cy + 5 - MT; y = MT + headerH;
  }
  // ... (all other layout headers, sections, references, footer, encryption)

  return pdf.output('blob');
}
