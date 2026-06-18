/**
 * CV PDF Export — jsPDF direct drawing, full 17-template implementation
 *
 * Every template is drawn with its true structure:
 *   - Left sidebar templates  : modern, sidebar, corporate
 *   - Right sidebar templates : navy
 *   - Banner + two-col body   : bold, executive, professional, crimson
 *   - Full-width banner       : classic
 *   - Left-date / timeline col: minimal, traditional, stylish
 *   - Two-col with right panel: teal
 *   - Left mini-sidebar       : timeline, boxed
 *   - Centre-header no sidebar: shaded, sage
 *   - Right sidebar + bars    : navy (progress bars)
 *   - Dot-timeline             : timeline (connector lines)
 */

import { jsPDF as JsPDFClass } from 'jspdf';
import { ICON_FONT_BASE64 } from './iconFont';

// Icon glyphs — a small subset of Font Awesome 4 (free, monochrome,
// glyf-based TrueType — confirmed to embed and render correctly via
// jsPDF's addFont). These give the PDF export real icons matching the
// React preview's section markers, which plain jsPDF standard fonts
// can't do at all (no emoji/Unicode support beyond WinAnsi/CP1252).
const ICON = {
  graduationCap: '\uf19d',
  briefcase:     '\uf0b1',
  fileText:      '\uf0f6',
  trophy:        '\uf091', // reserved for Awards & Achievements, not Skills
  cogs:          '\uf085', // used for Skills
  globe:         '\uf0ac',
  user:          '\uf007',
  envelope:      '\uf0e0',
  phone:         '\uf095',
  mapMarker:     '\uf041',
  book:          '\uf02d',
};

// IMPORTANT: do NOT use a module-level flag for "is the icon font
// registered" — in serverless environments (Netlify Functions), a warm
// container reuses the same loaded module across multiple separate
// requests, so a module-level boolean would stay `true` from one
// request's pdf instance and incorrectly skip registration on the NEXT
// request's brand-new pdf instance, which never actually had the font
// added to it. That mismatch caused icons to silently render as garbled
// text on some CV generations and not others, depending on whether the
// serverless container was "warm" from a previous request. Tracking
// registration on the pdf object itself (a property unique to each
// request's instance) avoids this entirely.
function ensureIconFont(p: any) {
  if (p.__iconFontRegistered) return;
  try {
    // Unique filename per call — defends against any caching jsPDF itself
    // might do internally (separate from our own p.__iconFontRegistered
    // instance flag) keyed by VFS filename. If such caching exists at a
    // scope broader than the pdf instance (e.g. a module-level registry
    // inside the jsPDF library), reusing the literal string
    // 'fa-subset.ttf' across multiple requests in the same warm
    // serverless container could collide with a stale/previous
    // registration — exactly matching "works on the first generation in
    // a container, breaks on the second." A unique name per call removes
    // any possibility of that collision regardless of jsPDF's internals.
    const vfsName = `fa-subset-${Date.now()}-${Math.random().toString(36).slice(2)}.ttf`;
    p.addFileToVFS(vfsName, ICON_FONT_BASE64);
    p.addFont(vfsName, 'FAIcons', 'normal');
    p.__iconFontRegistered = true;
  } catch (err) {
    console.error('[cvExport] Failed to register icon font — section icons will be skipped:', err);
    p.__iconFontRegistered = false;
  }
}

// Draws a single icon glyph at (x, y) in the given size/color, then
// restores the standard body font so subsequent text calls aren't left
// using the icon font by mistake. Safe to call even if the icon font
// failed to register (silently does nothing).
function drawIcon(p: any, glyph: string, x: number, y: number, size: number, color: RGB) {
  if (!p.__iconFontRegistered) return;
  const [r,g,b] = color;
  p.setFont('FAIcons', 'normal');
  p.setFontSize(size);
  tc(p, r, g, b);
  p.text(glyph, x, y);
  p.setFont(F, 'normal'); // restore standard text font for whatever is drawn next
}

// Draws "icon  text" inline, returning the x position right after the
// text — so callers can chain multiple icon+text items left to right
// (e.g. envelope+email, then phone-icon+number, with a separator
// between). Icon size/offset values (8pt, y-0.5) were tuned empirically
// against this specific font so the glyph optically aligns with text of
// the given fontSize rather than appearing to float above or sink below
// the text baseline.
function iconText(p: any, glyph: string | null, text: string, x: number, y: number,
                  fontSize: number, color: RGB): number {
  let cx = x;
  if (glyph && p.__iconFontRegistered) {
    drawIcon(p, glyph, cx, y - 0.5, fontSize - 1, color);
    cx += fontSize * 0.55 + 1.5; // room for the icon glyph before the text starts
  }
  p.setFont(F, 'normal'); p.setFontSize(fontSize);
  const [r,g,b] = color; tc(p,r,g,b);
  p.text(text, cx, y);
  return cx + p.getTextWidth(text);
}

// ── Page geometry (mm) ────────────────────────────────────────────────────────
const PW = 210;
const PH = 297;
const ML = 15;
const MR = 15;
const MT = 14;
const FOOTER_H = 9;
const BOTTOM = PH - FOOTER_H - 3;
const LINE_H = 5.2;
const SECTION_GAP = 7;
const HEADING_GAP = 5;
const ITEM_GAP = 2.5;
const BULLET_INDENT = 4.5;
const F = 'helvetica';

// ── Colour helpers ─────────────────────────────────────────────────────────────
type RGB = [number, number, number];
function fill(p: any, r: number, g: number, b: number) { p.setFillColor(r, g, b); }
function tc(p: any, r: number, g: number, b: number)   { p.setTextColor(r, g, b); }
function dc(p: any, r: number, g: number, b: number)   { p.setDrawColor(r, g, b); }
function reset(p: any) { fill(p,255,255,255); dc(p,0,0,0); tc(p,0,0,0); }

// Hex "#rrggbb" → [r,g,b]
function hex(h: string): RGB {
  const n = h.replace('#','');
  return [parseInt(n.slice(0,2),16), parseInt(n.slice(2,4),16), parseInt(n.slice(4,6),16)];
}
// Lighten an RGB by mixing toward white
function lighten([r,g,b]: RGB, t=0.85): RGB {
  return [Math.round(r+(255-r)*t), Math.round(g+(255-g)*t), Math.round(b+(255-b)*t)];
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function hLine(p: any, x: number, y: number, w: number, r=209, g=213, b=219, lw=0.3) {
  dc(p,r,g,b); p.setLineWidth(lw); p.line(x,y,x+w,y);
}
function dot(p: any, x: number, y: number, acc: RGB, sz=1.1) {
  const [r,g,b]=acc; fill(p,r,g,b); p.rect(x, y-sz+0.2, sz, sz, 'F');
}
function progressBar(p: any, x: number, y: number, w: number, pct: number, acc: RGB) {
  fill(p,229,231,235); p.rect(x, y, w, 2, 'F');
  const [r,g,b]=acc; fill(p,r,g,b); p.rect(x, y, w*pct, 2, 'F');
}
function chipTag(p: any, x: number, y: number, label: string, acc: RGB): number {
  const [r,g,b]=acc;
  const [lr,lg,lb]=lighten([r,g,b], 0.80);
  const lw = p.getTextWidth(label);
  const pad = 3;
  fill(p,lr,lg,lb);
  p.roundedRect(x-pad, y-3.5, lw+pad*2, 5.5, 1, 1, 'F');
  tc(p,r,g,b); p.setFont(F,'normal'); p.setFontSize(7);
  p.text(label, x, y);
  return lw + pad*2 + 2;
}

// ── Text helpers ───────────────────────────────────────────────────────────────
function wrapped(p: any, t: string, x: number, y: number, maxW: number,
                 bottom: number, newPage: ()=>number,
                 getXW?: ()=>[number,number], lh=LINE_H): number {
  const lines = p.splitTextToSize(t, maxW) as string[];
  for (const line of lines) {
    if (y+lh > bottom) { y = newPage(); if (getXW) { [x,maxW]=getXW(); } }
    p.text(line, x, y); y += lh;
  }
  return y;
}

function bulletLine(p: any, t: string, x: number, y: number, maxW: number,
                    accent: RGB, bottom: number, newPage: ()=>number,
                    getXW?: ()=>[number,number]): number {
  const lines = p.splitTextToSize(t, maxW-BULLET_INDENT) as string[];
  for (let i=0; i<lines.length; i++) {
    if (y+LINE_H > bottom) { y = newPage(); if (getXW) { [x,maxW]=getXW(); } }
    if (i===0) dot(p, x+0.8, y-0.2, accent);
    tc(p,55,65,81);
    p.text(lines[i], x+BULLET_INDENT, y); y += LINE_H;
  }
  return y;
}

// Centered multi-line text (e.g. a long contact-info line that wraps).
// Caller must have already set font/size/colour before calling.
function centeredWrapped(p: any, t: string, y: number, maxW: number,
                         bottom: number, newPage: ()=>number, lh=LINE_H): number {
  const lines = p.splitTextToSize(t, maxW) as string[];
  for (const line of lines) {
    if (y+lh > bottom) y = newPage();
    const tw = p.getTextWidth(line);
    p.text(line, (PW-tw)/2, y); y += lh;
  }
  return y;
}

// Render a sequence of {text, style} segments as wrapped text, switching
// font style (normal/italic/bold) per-segment — used for "Skill (description)"
// lists where the description is italicised inline.
interface RichSeg { text: string; style: 'normal'|'italic'|'bold'; color?: RGB }
function richInline(p: any, segs: RichSeg[], x: number, y: number, maxW: number,
                    bottom: number, newPage: ()=>number,
                    getXW?: ()=>[number,number], font='times', size=9,
                    normalColor: RGB=[55,65,81], italicColor: RGB=[100,116,139]): number {
  let cx = x;
  p.setFontSize(size);
  for (const seg of segs) {
    p.setFont(font, seg.style);
    const w = p.getTextWidth(seg.text);
    if (cx + w > x+maxW && cx > x) {
      y += LINE_H; cx = x;
      if (y+LINE_H > bottom) { y = newPage(); if (getXW) { [x,maxW]=getXW(); } cx = x; }
    }
    const c = seg.color || (seg.style==='italic' ? italicColor : normalColor);
    tc(p,c[0],c[1],c[2]);
    p.text(seg.text, cx, y);
    cx += w;
  }
  return y + LINE_H;
}

// ── Section heading styles ─────────────────────────────────────────────────────
type HeadingStyle = 'bar' | 'underline' | 'shaded' | 'italic-underline' | 'tag-underline' | 'dot-prefix' | 'center-lines' | 'double-line';

function sectionHeading(p: any, title: string, x: number, y: number, maxW: number,
                        accent: RGB, style: HeadingStyle,
                        bottom: number, newPage: ()=>number,
                        getXW?: ()=>[number,number], icon?: string): number {
  if (y+28 > bottom) { y = newPage(); if (getXW) { [x,maxW]=getXW(); } }
  y += SECTION_GAP * 0.6;
  const [ar,ag,ab] = accent;
  if (style === 'shaded') {
    y += 6; // clearance above the bar so it doesn't overlap the previous line/divider
    fill(p,243,244,246); p.rect(x-2, y-4, maxW+4, 7, 'F');
    tc(p,55,65,81); p.setFont(F,'bold'); p.setFontSize(9);
    p.text(title.toUpperCase(), x+2, y+1.5); // +1.5 vertically centers the cap-height text within the 7mm-tall bar
    return y + HEADING_GAP + 3; // clearance below the bar before content starts
  } else if (style === 'underline') {
    tc(p,ar,ag,ab); p.setFont(F,'bold'); p.setFontSize(9.5);
    p.text(title.toUpperCase(), x, y);
    const tw = p.getTextWidth(title.toUpperCase());
    hLine(p, x+tw+3, y-1.5, maxW-tw-3, ar,ag,ab, 0.4);
  } else if (style === 'italic-underline') {
    tc(p,ar,ag,ab); p.setFont(F,'bolditalic'); p.setFontSize(11);
    p.text(title, x, y);
    hLine(p, x, y+2, maxW, ar,ag,ab, 0.5);
  } else if (style === 'tag-underline') {
    tc(p,ar,ag,ab); p.setFont(F,'bold'); p.setFontSize(10);
    p.text(title.toUpperCase(), x, y);
    hLine(p, x, y+2, maxW, ar,ag,ab, 0.5);
    return y + HEADING_GAP + 2.5; // extra clearance below the underline so content doesn't overlap it
  } else if (style === 'dot-prefix') {
    tc(p,ar,ag,ab); p.setFont(F,'bold'); p.setFontSize(9);
    p.text('◆ '+title.toUpperCase(), x, y);
    const tw = p.getTextWidth('◆ '+title.toUpperCase());
    hLine(p, x+tw+3, y-1.5, maxW-tw-3, 209,213,219, 0.3);
  } else if (style === 'double-line') {
    tc(p,30,41,59); p.setFont('times','bold'); p.setFontSize(11);
    const txt = title.toUpperCase();
    const tw = p.getTextWidth(txt);
    p.text(txt, (PW/2)-tw/2, y);
    hLine(p, x, y+3,   maxW, 71,85,105, 0.35);
    hLine(p, x, y+3.8, maxW, 71,85,105, 0.35);
    return y + HEADING_GAP + 5; // extra clearance before & after the rules
  } else if (style === 'center-lines') {
    tc(p,30,41,59); p.setFont('times','bold'); p.setFontSize(11);
    const tw = p.getTextWidth(title);
    const cx = PW/2;
    p.text(title, cx-tw/2, y);
    const gap = 6;
    const leftW  = (cx-tw/2-gap) - x;
    const rightX = cx+tw/2+gap;
    const rightW = (x+maxW) - rightX;
    if (leftW>0)  hLine(p, x, y-1.5, leftW, 203,213,225, 0.3);
    if (rightW>0) hLine(p, rightX, y-1.5, rightW, 203,213,225, 0.3);
  } else { // 'bar' (default)
    let titleX = x + 4;
    if (icon && p.__iconFontRegistered) {
      drawIcon(p, icon, x, y-0.5, 8, accent);
      titleX = x + 6.5; // extra room for the icon glyph
    } else {
      fill(p,ar,ag,ab); p.rect(x, y-3.2, 2.5, 3.8, 'F'); // fallback plain tick if icon font failed to load
    }
    tc(p,ar,ag,ab); p.setFont(F,'bold'); p.setFontSize(9);
    p.text(title.toUpperCase(), titleX, y);
    const tw = p.getTextWidth(title.toUpperCase());
    hLine(p, titleX+tw+2, y-1.5, maxW-(titleX-x)-tw-2, ar,ag,ab, 0.35);
    return y + HEADING_GAP + 2.5; // extra clearance below the heading so content doesn't feel congested against it
  }
  return y + HEADING_GAP;
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function drawFooter(p: any, owner: string, pg: number, total: number,
                    accent: RGB, watermark: boolean) {
  if (watermark) {
    fill(p,15,23,42); p.rect(0, PH-FOOTER_H, PW, FOOTER_H, 'F');
    tc(p,148,163,184); p.setFont(F,'normal'); p.setFontSize(6.5);
    const wt='Created FREE at www.crosssa.co.za  –  Upgrade to remove this watermark';
    p.text(wt, (PW-p.getTextWidth(wt))/2, PH-3.2);
    tc(p,255,255,255); p.setFont(F,'italic'); p.setFontSize(6.5);
    p.text(`Resume of ${owner}`, ML, PH-3.2);
    const ps=`Page ${pg} of ${total}`;
    p.text(ps, PW-MR-p.getTextWidth(ps), PH-3.2);
  } else {
    const [ar,ag,ab] = accent;
    hLine(p, ML, PH-FOOTER_H, PW-ML-MR, ar,ag,ab, 0.25);
    p.setFont(F,'italic'); p.setFontSize(7); tc(p,156,163,175);
    p.text(`Resume of ${owner}`, ML, PH-4);
    const ps=`Page ${pg} of ${total}`;
    p.text(ps, PW-MR-p.getTextWidth(ps), PH-4);
  }
}

// ── References page ────────────────────────────────────────────────────────────
function refsPage(p: any, refs: any[], accent: RGB, headStyle: HeadingStyle,
                  addPage: ()=>number, bottom: number,
                  owner: string, watermark: boolean, bg?: RGB, topStrip: boolean = true) {
  const validRefs = refs.filter(r=>r.name);
  if (!validRefs.length) return;
  p.addPage();
  reset(p);
  const [ar,ag,ab] = accent;
  if (bg) {
    fill(p,bg[0],bg[1],bg[2]); p.rect(0,0,PW,PH,'F'); reset(p);
  } else if (topStrip) {
    // Only draw the accent-colored top strip if the template's first page
    // actually has a colored sidebar/top bar — otherwise it introduces a
    // jarring band of color that doesn't appear anywhere else in the CV.
    fill(p,ar,ag,ab); p.rect(0,0,PW,5,'F'); reset(p);
  }
  let y = (bg || topStrip) ? MT+5 : MT;
  const np = ()=>{ p.addPage(); reset(p); if (bg) { fill(p,bg[0],bg[1],bg[2]); p.rect(0,0,PW,PH,'F'); reset(p); } return MT; };
  y = sectionHeading(p,'References',ML,y,PW-ML-MR,accent,headStyle,bottom,np,undefined,ICON.user);
  y += 2;
  const half = (PW-ML-MR-8)/2;
  for (let i=0; i<validRefs.length; i+=2) {
    const drawRef = (ref: any, rx: number, startY: number): number => {
      let cy = startY;
      dot(p, rx, cy-0.8, accent, 1.6);
      p.setFont(F,'bold'); p.setFontSize(9.5); tc(p,17,24,39);
      p.text(ref.name, rx+3, cy); cy += LINE_H;
      if (ref.title)        { p.setFont(F,'normal'); p.setFontSize(9); tc(p,ar,ag,ab); p.text(ref.title, rx+3, cy); cy+=LINE_H; }
      if (ref.organisation) { p.setFont(F,'normal'); p.setFontSize(8.5); tc(p,107,114,128); p.text(ref.organisation, rx+3, cy); cy+=LINE_H; }
      if (ref.relationship) { p.setFont(F,'italic'); p.setFontSize(8); tc(p,156,163,175); p.text(ref.relationship, rx+3, cy); cy+=LINE_H; }
      if (ref.phone||ref.email) { p.setFont(F,'normal'); p.setFontSize(8); tc(p,107,114,128); p.text([ref.phone,ref.email].filter(Boolean).join('  |  '), rx+3, cy); cy+=LINE_H; }
      return cy;
    };
    const ly  = drawRef(validRefs[i],   ML,           y);
    const ry2 = validRefs[i+1] ? drawRef(validRefs[i+1], ML+half+8, y) : y;
    y = Math.max(ly,ry2)+2;
    hLine(p, ML, y, PW-ML-MR, 229,231,235, 0.2);
    y += 5;
  }
}

// ── Custom sections ────────────────────────────────────────────────────────────
function drawCustom(p: any, sections: any[], accent: RGB, headStyle: HeadingStyle,
                    x: number, y: number, maxW: number,
                    bottom: number, newPage: ()=>number,
                    getXW?: ()=>[number,number], font: string = F): number {
  if (!sections?.filter((s:any)=>s.title).length) return y;
  for (const sec of sections) {
    const hasContent =
      (sec.type === 'text'    && !!(sec.content && sec.content.trim())) ||
      (sec.type === 'bullets' && !!(sec.content && (sec.content as string).split('\n').map((l:string)=>l.trim()).filter(Boolean).length)) ||
      (sec.type === 'table'   && !!(sec.columns?.length && sec.rows?.length));
    if (!sec.title || !hasContent) continue;
    // Icon resolution order: 1) AI-resolved icon (set ahead of drawing by
    // resolveCustomSectionIcons, covers arbitrary user-defined titles
    // like "Training & Workshops"), 2) instant Awards/Achievements
    // keyword match as a fast-path that skips the AI call entirely,
    // 3) no icon (plain bar) if neither applies or the AI call failed.
    const ICON_MAP: Record<string, string> = {
      graduationCap: ICON.graduationCap, briefcase: ICON.briefcase, fileText: ICON.fileText,
      trophy: ICON.trophy, cogs: ICON.cogs, globe: ICON.globe, user: ICON.user,
      envelope: ICON.envelope, phone: ICON.phone, mapMarker: ICON.mapMarker, book: ICON.book,
    };
    const resolvedKey = (sec as any).__resolvedIcon as string | null;
    const sectionIcon = resolvedKey && ICON_MAP[resolvedKey]
      ? ICON_MAP[resolvedKey]
      : (/award|achievement|honour|honor|recognition/i.test(sec.title) ? ICON.trophy : undefined);
    // BUG FIX: x/maxW were the function's fixed parameters and were never
    // updated even when content overflowed to a new page mid-loop —
    // wrapped()/bulletLine()/sectionHeading() each correctly compute a
    // fresh [x,maxW] internally via getXW() when THEY overflow, but that
    // local reassignment was discarded the moment each call returned, so
    // every custom section drawn AFTER a page break still used the
    // stale, original (often sidebar-indented) x position — exactly the
    // "huge white space on the left on page 2" symptom. Wrapping getXW
    // here lets drawCustom track and reuse the corrected position for
    // every subsequent call within this same function, not just within
    // a single nested helper call.
    const trackedGetXW = getXW ? (): [number, number] => { const r = getXW(); x = r[0]; maxW = r[1]; return r; } : undefined;
    y = sectionHeading(p, sec.title, x, y, maxW, accent, headStyle, bottom, newPage, trackedGetXW, sectionIcon);
    p.setFont(font,'normal'); p.setFontSize(9); tc(p,55,65,81);
    if (sec.type==='text' && sec.content) {
      y = wrapped(p, sec.content, x, y, maxW, bottom, newPage, trackedGetXW);
    } else if (sec.type==='bullets' && sec.content) {
      for (const b of (sec.content as string).split('\n').map((l:string)=>l.trim()).filter(Boolean))
        y = bulletLine(p, b, x, y, maxW, accent, bottom, newPage, trackedGetXW);
    } else if (sec.type==='table' && sec.columns?.length && sec.rows?.length) {
      const cw = maxW/sec.columns.length;
      const [ar,ag,ab]=accent; fill(p,ar,ag,ab); tc(p,255,255,255);
      p.rect(x, y-4, maxW, 6, 'F');
      p.setFont(font,'bold'); p.setFontSize(8);
      sec.columns.forEach((col:string,ci:number)=>p.text(col, x+ci*cw+1, y));
      y+=6; p.setFont(font,'normal'); p.setFontSize(8.5);
      for (let ri=0; ri<sec.rows.length; ri++) {
        if (y+6>bottom) { y=newPage(); if (trackedGetXW) trackedGetXW(); }
        if (ri%2===0) { fill(p,249,250,251); p.rect(x,y-4,maxW,6,'F'); }
        tc(p,55,65,81);
        sec.rows[ri].forEach((cell:string,ci:number)=>p.text(String(cell||''), x+ci*cw+1, y));
        y+=6;
      }
    }
    y+=3;
  }
  return y;
}

// ── Sidebar label helper ───────────────────────────────────────────────────────
function sidebarLabel(p: any, t: string, x: number, y: number, maxW: number,
                      textRGB: RGB, lineRGB: RGB): number {
  const [tr,tg,tb]=textRGB; const [lr,lg,lb]=lineRGB;
  p.setFont(F,'bold'); p.setFontSize(7); tc(p,tr,tg,tb);
  p.text(t.toUpperCase(), x, y);
  dc(p,lr,lg,lb); p.setLineWidth(0.2); p.line(x, y+1, x+maxW, y+1);
  return y+4;
}

// ── Accent map ────────────────────────────────────────────────────────────────
function getAccent(tmpl: string): RGB {
  const map: Record<string,string> = {
    classic:'#1e2a3a', modern:'#0d9488', professional:'#1e4d2b', minimal:'#111827',
    sidebar:'#3b5998', bold:'#c2185b', executive:'#6b1a1a', corporate:'#1a2a4a',
    stylish:'#e05c6b', boxed:'#374151', traditional:'#374151', navy:'#1a2a4a',
    timeline:'#374151', shaded:'#374151', teal:'#06b6d4', crimson:'#c0392b', sage:'#7fa37f',
    elegant:'#475569',
    heritage:'#334155',
  };
  return hex(map[tmpl] || '#1e2a3a');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
// Cache of custom-section-title -> resolved icon key, shared across calls
// within the same loaded module/browser session. Keyed by the exact title
// text (case-insensitive) — safe to share across different users/CVs
// since the same title should sensibly get the same icon every time, and
// this avoids repeat AI calls for common titles ("Certifications",
// "Volunteer Work", etc.) that many different users will type.
const customSectionIconCache = new Map<string, string | null>();

// Resolves icons for a list of custom sections ahead of time (the actual
// PDF-drawing code is synchronous, so any AI call must happen before
// drawing starts, not during). Awards/Achievements-style titles are
// still matched instantly via the keyword regex with no AI call needed;
// anything else asks the AI to pick from a fixed, closed list of
// available icon keys (see enhance-cv.mjs's pick_section_icon action).
// Never throws — any failure (network, timeout, bad response) just
// results in that section having no icon (the existing plain-bar
// fallback), never blocking CV generation.
async function resolveCustomSectionIcons(sections: any[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  await Promise.all(sections.map(async (sec: any) => {
    const title = (sec.title || '').trim();
    if (!title) return;

    if (/award|achievement|honour|honor|recognition/i.test(title)) {
      result.set(title, 'trophy');
      return;
    }

    const cacheKey = title.toLowerCase();
    if (customSectionIconCache.has(cacheKey)) {
      result.set(title, customSectionIconCache.get(cacheKey)!);
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/enhance-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pick_section_icon', title }),
        signal: AbortSignal.timeout(4000), // never let a slow AI call meaningfully delay PDF generation
      });
      const data = await res.json();
      const icon = res.ok && data.success ? (data.icon as string | null) : null;
      customSectionIconCache.set(cacheKey, icon);
      result.set(title, icon);
    } catch {
      // Network error, timeout, etc. — fall back to no icon, never block.
      customSectionIconCache.set(cacheKey, null);
      result.set(title, null);
    }
  }));
  return result;
}

export async function exportElementAsPDF(
  _container: HTMLElement,
  filename: string,
  cvData?: Record<string, unknown>,
): Promise<Blob> {
  if (!cvData) throw new Error('cvData required');
  const data    = cvData as any;
  const pr      = data.personal      || {};
  const edu     = (data.education    || []).filter((e:any)=>e.institution);
  const exp     = (data.experience   || []).filter((e:any)=>e.school);
  const sk      = data.skills        || {};
  const refs    = (data.references   || []).filter((r:any)=>r.name);
  const customs = (data.custom_sections||[]).filter((s:any)=>s.title);
  const customIcons = await resolveCustomSectionIcons(customs);
  // Attach the resolved icon directly onto each section object (rather
  // than threading a new parameter through all 18 template-drawing
  // functions' signatures) — drawCustom reads sec.__resolvedIcon.
  for (const sec of customs) (sec as any).__resolvedIcon = customIcons.get((sec.title||'').trim()) ?? null;
  const tmpl    = data.template || 'classic';
  const isEdu    = data.cvType !== 'general';  // false = general CV, true = educator (default)
  const wm      = !!data.watermark;
  const owner   = pr.full_name || 'Applicant';

  // Lock the document against editing/copying — printing only. Set at
  // construction time via jsPDF's documented `encryption` option (the
  // ONLY encryption API actually confirmed in jsPDF's own source —
  // earlier code called a non-existent `.encrypt()` method, which always
  // threw and was silently swallowed by an empty catch, producing fully
  // unprotected/editable exports with no visible failure). PDF encryption
  // is applied to whatever content streams exist at `pdf.output()` time,
  // so setting this here at construction still covers every page and the
  // footer, which are drawn afterward.
  const pdf = new JsPDFClass({
    format: 'a4', unit: 'mm', compress: true,
    encryption: {
      userPassword:  '',                        // no password needed to open/view
      ownerPassword: 'crosssa-cv-owner-2025',    // internal key needed to change these restrictions
      userPermissions: ['print'],                // printing only — no modify, copy, or annot-forms
    },
  } as any);
  reset(pdf);
  ensureIconFont(pdf);

  const dispatch: Record<string, ()=>void> = {
    classic:      ()=>drawClassic(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    modern:       ()=>drawModern(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    professional: ()=>drawProfessional(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    minimal:      ()=>drawMinimal(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    sidebar:      ()=>drawSidebar(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    bold:         ()=>drawBold(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    executive:    ()=>drawExecutive(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    corporate:    ()=>drawCorporate(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    stylish:      ()=>drawStylish(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    boxed:        ()=>drawBoxed(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    traditional:  ()=>drawTraditional(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    navy:         ()=>drawNavy(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    timeline:     ()=>drawTimeline(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    shaded:       ()=>drawShaded(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    teal:         ()=>drawTeal(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    crimson:      ()=>drawCrimson(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    sage:         ()=>drawSage(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    elegant:      ()=>drawElegant(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
    heritage:     ()=>drawHeritage(pdf,pr,edu,exp,sk,refs,customs,wm,owner,isEdu),
  };

  (dispatch[tmpl] || dispatch['classic'])();

  // Stamp footers on every page now that total page count is known
  const accent = getAccent(tmpl);
  const total  = pdf.getNumberOfPages();
  for (let pg=1; pg<=total; pg++) {
    pdf.setPage(pg);
    reset(pdf);
    drawFooter(pdf, owner, pg, total, accent, wm);
  }

  void filename;
  return pdf.output('blob');
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE RENDERERS — each has its own genuine layout
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. CLASSIC — Dark full-width banner, single column, left accent bars ───────
function drawClassic(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#1e2a3a'); const [ar,ag,ab]=accent;
  fill(p,ar,ag,ab); p.rect(0,0,PW,30,'F');
  tc(p,255,255,255); p.setFont(F,'bold'); p.setFontSize(18); p.text(owner.toUpperCase(),ML,13);
  hLine(p,ML,16,PW-ML-MR,255,255,255,0.25);
  p.setFont(F, 'normal'); p.setFontSize(7.5); tc(p,160,174,192);
  {
    // Envelope icon before the email specifically; phone/address/ID
    // follow as plain text. Icon color matches the light gray-blue used
    // for this contact line (it sits on the dark navy banner, so a dark
    // icon color like `accent` would be invisible here).
    const lightGray: RGB = [160,174,192];
    let cx = ML;
    if (pr.email) cx = iconText(p, ICON.envelope, pr.email, cx, 23, 7.5, lightGray);
    const rest = [pr.phone, pr.address, pr.id_number?`ID: ${pr.id_number}`:null].filter(Boolean).join('   ·   ');
    if (rest) { p.setFont(F,'normal'); p.setFontSize(7.5); tc(p,lightGray[0],lightGray[1],lightGray[2]); p.text((pr.email?'   ·   ':'')+rest, cx, 23); }
  }
  reset(p); let y=MT+20;
  const np=()=>{p.addPage();reset(p);fill(p,ar,ag,ab);p.rect(0,0,PW,5,'F');reset(p);return MT+7;};
  const GXW=():[ number,number]=>[ML,PW-ML-MR];
  if(pr.bio){y=sectionHeading(p,isEdu?'Professional Summary':'Professional Summary',ML,y,PW-ML-MR,accent,'bar',BOTTOM,np,GXW,ICON.fileText);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,ML,y,PW-ML-MR,BOTTOM,np,GXW);y+=ITEM_GAP+1;}
  if(edu.length){y=sectionHeading(p,'Education',ML,y,PW-ML-MR,accent,'bar',BOTTOM,np,GXW,ICON.graduationCap);
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',ML,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),ML,y);y+=LINE_H+ITEM_GAP;}}
  if(exp.length){y=sectionHeading(p,isEdu?'Teaching Experience':'Work Experience',ML,y,PW-ML-MR,accent,'bar',BOTTOM,np,GXW,ICON.briefcase);
    for(const e of exp){if(y+14>BOTTOM)y=np();
      p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.role||'',ML,y);y+=LINE_H;
      p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text(e.school||'',ML,y);
      const ds=[e.from,e.to].filter(Boolean).join(' – ');if(ds){p.setFont(F,'normal');p.setFontSize(8);tc(p,156,163,175);p.text(ds,PW-MR-p.getTextWidth(ds),y);}y+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,ML,y,PW-MR-ML,accent,BOTTOM,np,()=>[ML,PW-MR-ML]);
      y+=ITEM_GAP+1;}}
  if(sk.subjects?.length||sk.soft_skills?.length||sk.languages?.length){y=sectionHeading(p,'Skills & Languages',ML,y,PW-ML-MR,accent,'bar',BOTTOM,np,GXW,ICON.cogs);
    for(const [lbl,items] of [['Subjects',sk.subjects||[]],['Skills',sk.soft_skills||[]],['Languages',sk.languages||[]]] as [string,string[]][]){if(!items.length)continue;
      p.setFont(F,'bold');p.setFontSize(9);tc(p,55,65,81);p.text(`${lbl}:`,ML,y);const lw=p.getTextWidth(`${lbl}:`)+2;p.setFont(F,'normal');tc(p,55,65,81);y=wrapped(p,items.join('  ·  '),ML+lw,y,PW-ML-MR-lw,BOTTOM,np,()=>[ML,PW-ML-MR]);y+=ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'bar',ML,y,PW-ML-MR,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'bar',np,BOTTOM,owner,wm);
}

// ── 2. MODERN — Teal left sidebar with avatar circle ─────────────────────────
function drawModern(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#0d9488'); const [ar,ag,ab]=accent;
  // Sidebar width reduced 30% then a further 20% (52mm -> ~29.1mm).
  // Page-1-only: pages 2+ use the normal full-width margin instead of
  // staying indented by the sidebar width.
  const SB=29.1; const cx=ML+SB+8; const cmw=PW-MR-cx;
  const mainCX = ML; const mainCMW = PW-ML-MR; // page 2+ content position
  fill(p,ar,ag,ab); p.rect(0,0,ML+SB+2,PH,'F');
  // sx shifted left and smw given extra safety margin (was SB-4, now
  // SB-7) — text was wrapping correctly by line count but individual
  // wrapped lines (especially unbroken runs like email addresses) were
  // still rendering right at/past the sidebar's edge, since
  // splitTextToSize's width estimate doesn't perfectly match real
  // rendered glyph widths. More margin avoids relying on that estimate
  // being exact.
  let sy=MT+4; const sx=ML+0.5; const smw=SB-7;
  // Sidebar elements stay horizontally centered relative to the new
  // (narrower) smw.
  p.setFillColor(220,245,242); p.circle(sx+smw/2,sy+8,10,'F');
  const ini=owner.split(' ').map((n:string)=>n[0]||'').join('').slice(0,2).toUpperCase();
  tc(p,ar,ag,ab);p.setFont(F,'bold');p.setFontSize(10);p.text(ini,sx+smw/2-p.getTextWidth(ini)/2,sy+10);sy+=26;
  sy=sidebarLabel(p,'Contact',sx,sy,smw,[255,255,255],[180,220,215]);
  p.setFont(F,'normal');p.setFontSize(7.5);tc(p,224,253,244);
  if(pr.email){const ls=p.splitTextToSize(pr.email,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=4;});sy+=1;}
  if(pr.phone){p.text(pr.phone,sx,sy);sy+=5;}
  if(pr.address){const ls=p.splitTextToSize(pr.address,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=4;});sy+=1;}
  if(pr.id_number){p.text(`ID: ${pr.id_number}`,sx,sy);sy+=5;}
  sy+=4;
  // Subjects and Skills (soft_skills) moved to the main content area
  // below — only Languages stays in the sidebar.
  if(sk.languages?.length){sy=sidebarLabel(p,'Languages',sx,sy,smw,[255,255,255],[180,220,215]);p.setFont(F,'normal');p.setFontSize(7.5);tc(p,224,253,244);for(const l of sk.languages){p.text(`– ${l}`,sx,sy);sy+=4;}sy+=3;}
  reset(p);let y=MT+8;
  tc(p,ar,ag,ab);p.setFont(F,'bold');p.setFontSize(15);p.text(owner.toUpperCase(),cx,y);y+=6;
  tc(p,107,114,128);p.setFont(F,'normal');p.setFontSize(8);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',cx,y);y+=3;
  hLine(p,cx,y,cmw,ar,ag,ab,0.5);y+=6;
  // Pages 2+: horizontal header strip in the sidebar's color, content at
  // the normal margin — no more vertical sidebar / left-side white gap
  // past page 1.
  const np=()=>{p.addPage();reset(p);fill(p,ar,ag,ab);p.rect(0,0,PW,6,'F');reset(p);return MT+8;};
  let onFirstPage = true;
  const GXW=():[number,number]=>{ onFirstPage=false; return [mainCX,mainCMW]; };
  if(pr.bio){y=sectionHeading(p,isEdu?'About Me':'About Me',cx,y,cmw,accent,'bar',BOTTOM,np,GXW,ICON.fileText);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,cx,y,cmw,BOTTOM,np,GXW);y+=ITEM_GAP+1;}
  if(exp.length){y=sectionHeading(p,isEdu?'Teaching Experience':'Work Experience',cx,y,cmw,accent,'bar',BOTTOM,np,GXW,ICON.briefcase);
    for(const e of exp){if(y+14>BOTTOM){y=np();onFirstPage=false;}
      const [ex,ew]=onFirstPage?[cx,cmw]:[mainCX,mainCMW];
      p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.role||'',ex,y);y+=LINE_H;
      p.setFont(F,'bold');p.setFontSize(8.5);tc(p,ar,ag,ab);p.text(e.school||'',ex,y);
      const ds=[e.from,e.to].filter(Boolean).join(' – ');if(ds){p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);p.text(ds,PW-MR-p.getTextWidth(ds),y);}y+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,ex,y,ew,accent,BOTTOM,np,()=>onFirstPage?[cx,cmw]:[mainCX,mainCMW]);
      y+=ITEM_GAP+1;}}
  if(edu.length){y=sectionHeading(p,'Education',onFirstPage?cx:mainCX,y,onFirstPage?cmw:mainCMW,accent,'bar',BOTTOM,np,GXW,ICON.graduationCap);
    for(const e of edu){if(y+12>BOTTOM){y=np();onFirstPage=false;}const [ex]=onFirstPage?[cx]:[mainCX];p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',ex,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),ex,y);y+=LINE_H+ITEM_GAP;}}
  // Subjects and Skills — moved here from the sidebar.
  if(sk.subjects?.length||sk.soft_skills?.length){
    const [sx2,sw2]=onFirstPage?[cx,cmw]:[mainCX,mainCMW];
    y=sectionHeading(p,'Subjects & Skills',sx2,y,sw2,accent,'bar',BOTTOM,np,GXW,ICON.cogs);
    for(const [lbl,items] of [['Subjects',sk.subjects||[]],['Skills',sk.soft_skills||[]]] as [string,string[]][]){if(!items.length)continue;
      const [ex,ew]=onFirstPage?[cx,cmw]:[mainCX,mainCMW];
      p.setFont(F,'bold');p.setFontSize(9);tc(p,55,65,81);p.text(`${lbl}:`,ex,y);const lw=p.getTextWidth(`${lbl}:`)+2;p.setFont(F,'normal');tc(p,55,65,81);y=wrapped(p,items.join('  ·  '),ex+lw,y,ew-lw,BOTTOM,np,()=>onFirstPage?[cx+lw,cmw-lw]:[mainCX+lw,mainCMW-lw]);y+=ITEM_GAP;}
  }
  y=drawCustom(p,customs,accent,'bar',onFirstPage?cx:mainCX,y,onFirstPage?cmw:mainCMW,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'bar',np,BOTTOM,owner,wm);
}

// ── 3. PROFESSIONAL — Green gradient banner, two-column body ──────────────────
function drawProfessional(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#1e4d2b'); const [ar,ag,ab]=accent; const LIGHT:RGB=[45,122,71];
  fill(p,ar,ag,ab);p.rect(0,0,PW,35,'F');fill(p,...LIGHT);p.rect(PW/2,0,PW/2,35,'F');fill(p,ar,ag,ab);p.rect(0,0,PW/2+10,35,'F');
  tc(p,255,255,255);p.setFont(F,'bold');p.setFontSize(18);p.text(owner.toUpperCase(),ML,14);
  p.setFont(F,'normal');p.setFontSize(8);tc(p,180,220,190);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',ML,21);
  hLine(p,ML,24,PW-ML-MR,255,255,255,0.2);
  p.setFont(F,'normal');p.setFontSize(7.5);tc(p,200,240,210);
  p.text([pr.email,pr.phone,pr.address,pr.id_number?`ID: ${pr.id_number}`:null].filter(Boolean).join('   ·   '),ML,30);
  reset(p);let y=MT+28;
  const np=()=>{p.addPage();reset(p);fill(p,ar,ag,ab);p.rect(0,0,PW,5,'F');reset(p);return MT+7;};
  if(pr.bio){y=sectionHeading(p,isEdu?'Professional Profile':'Professional Profile',ML,y,PW-ML-MR,accent,'underline',BOTTOM,np);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,ML,y,PW-ML-MR,BOTTOM,np);y+=ITEM_GAP+2;}
  const c1=ML;const c2=ML+(PW-ML-MR)/2+4;const cw=(PW-ML-MR)/2-4;let y1=y;let y2=y;
  if(exp.length){y1=sectionHeading(p,isEdu?'Teaching Experience':'Work Experience',c1,y1,cw,accent,'underline',BOTTOM,np);
    for(const e of exp){if(y1+14>BOTTOM)y1=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.role||'',c1,y1);y1+=LINE_H;
      p.setFont(F,'bold');p.setFontSize(8.5);tc(p,...LIGHT);p.text(e.school||'',c1,y1);const ds=[e.from,e.to].filter(Boolean).join(' – ');if(ds){tc(p,107,114,128);p.setFont(F,'normal');p.setFontSize(8);p.text(ds,c1+cw-p.getTextWidth(ds),y1);}y1+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y1=bulletLine(p,l,c1,y1,cw,accent,BOTTOM,np);
      y1+=ITEM_GAP+1;}}
  y1=drawCustom(p,customs,accent,'underline',c1,y1,cw,BOTTOM,np);
  if(edu.length){y2=sectionHeading(p,'Education',c2,y2,cw,accent,'underline',BOTTOM,np);
    for(const e of edu){if(y2+12>BOTTOM)y2=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',c2,y2);y2+=LINE_H;
      p.setFont(F,'normal');p.setFontSize(8.5);tc(p,...LIGHT);p.text(e.institution||'',c2,y2);if(e.year){tc(p,107,114,128);p.text(e.year,c2+cw-p.getTextWidth(e.year),y2);}y2+=LINE_H+ITEM_GAP;}}
  for(const [lbl,items] of [['Subjects',sk.subjects||[]],['Skills',sk.soft_skills||[]],['Languages',sk.languages||[]]] as [string,string[]][]){if(!items.length)continue;
    y2=sectionHeading(p,lbl,c2,y2,cw,accent,'underline',BOTTOM,np);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);
    for(const it of items){if(y2+LINE_H>BOTTOM)y2=np();y2=bulletLine(p,it,c2,y2,cw,accent,BOTTOM,np);}y2+=ITEM_GAP;}
  refsPage(p,refs,accent,'underline',np,BOTTOM,owner,wm);
}

// ── 4. MINIMAL — Centred header, left-date column layout ─────────────────────
function drawMinimal(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#111827'); const [ar,ag,ab]=accent;
  tc(p,ar,ag,ab);p.setFont(F,'bold');p.setFontSize(18);const nw=p.getTextWidth(owner.toUpperCase());p.text(owner.toUpperCase(),(PW-nw)/2,MT+8);
  p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);const ctxt=[pr.address,pr.phone,pr.email].filter(Boolean).join('   ·   ');const cw=p.getTextWidth(ctxt);p.text(ctxt,(PW-cw)/2,MT+14);
  hLine(p,ML,MT+17,PW-ML-MR,ar,ag,ab,0.6);reset(p);let y=MT+22;
  const DX=ML;const DW=28;const CX=ML+DW+6;const CMW=PW-MR-CX;
  const np=()=>{p.addPage();reset(p);return MT;};const GXW=():[ number,number]=>[CX,CMW];
  if(pr.bio){if(y+14>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(8);tc(p,156,163,175);p.text('SUMMARY',DX,y);p.setFont(F,'normal');p.setFontSize(9);tc(p,75,85,99);y=wrapped(p,pr.bio,CX,y,CMW,BOTTOM,np,GXW);y+=ITEM_GAP+2;}
  if(exp.length){hLine(p,ML,y,PW-ML-MR,ar,ag,ab,0.4);y+=4;p.setFont(F,'bold');p.setFontSize(8);tc(p,156,163,175);p.text(isEdu?'EXPERIENCE':'EXPERIENCE',DX,y);y+=LINE_H;
    for(const e of exp){if(y+14>BOTTOM)y=np();p.setFont(F,'normal');p.setFontSize(8);tc(p,156,163,175);p.text([e.from,e.to].filter(Boolean).join('–'),DX,y);
      p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.role||'',CX,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(9);tc(p,107,114,128);p.text(e.school||'',CX,y);y+=LINE_H;
      if(e.description){tc(p,55,65,81);for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,CX,y,CMW,accent,BOTTOM,np,GXW);}y+=ITEM_GAP+1;}}
  if(edu.length){hLine(p,ML,y,PW-ML-MR,ar,ag,ab,0.4);y+=4;p.setFont(F,'bold');p.setFontSize(8);tc(p,156,163,175);p.text('EDUCATION',DX,y);y+=LINE_H;
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'normal');p.setFontSize(8);tc(p,156,163,175);p.text(e.year||'',DX,y);p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',CX,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(9);tc(p,107,114,128);p.text(e.institution||'',CX,y);y+=LINE_H+ITEM_GAP;}}
  if(sk.subjects?.length||sk.soft_skills?.length||sk.languages?.length){hLine(p,ML,y,PW-ML-MR,ar,ag,ab,0.4);y+=4;p.setFont(F,'bold');p.setFontSize(8);tc(p,156,163,175);p.text('SKILLS',DX,y);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);
    if(sk.subjects?.length){y=wrapped(p,'Subjects: '+sk.subjects.join('  ·  '),CX,y,CMW,BOTTOM,np,GXW);y+=ITEM_GAP;}
    if(sk.soft_skills?.length){y=wrapped(p,'Skills: '+sk.soft_skills.join('  ·  '),CX,y,CMW,BOTTOM,np,GXW);y+=ITEM_GAP;}
    if(sk.languages?.length){p.text('Languages: '+sk.languages.join('  ·  '),CX,y);y+=LINE_H+ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'bar',CX,y,CMW,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'bar',np,BOTTOM,owner,wm);
}

// ── 5. SIDEBAR — Blue left sidebar with initials circle ───────────────────────
function drawSidebar(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const BLUE=hex('#3b5998'); const [sr,sg,sb]=BLUE;
  // Sidebar width reduced 30% then a further 20% (55mm -> 38.5mm -> ~30.8mm).
  // Page-1-only: content on page 1 is indented to clear the sidebar;
  // pages 2+ use the full normal margin (ML) instead of staying indented
  // by the sidebar width, which previously left a large unused white
  // strip on every page after the first.
  const SB=30.8; const cx=ML+SB+8; const cmw=PW-MR-cx;
  const mainCX = ML; const mainCMW = PW-ML-MR; // page 2+ content position — normal full-width margin, no sidebar offset
  fill(p,sr,sg,sb);p.rect(0,0,ML+SB+2,PH,'F');
  // sx shifted left and smw given extra safety margin (was SB-4, now
  // SB-7) — same fix as Modern: text was wrapping by line count
  // correctly, but individual wrapped lines (especially unbroken runs
  // like email addresses) were still rendering right at/past the
  // sidebar's edge, since splitTextToSize's width estimate doesn't
  // perfectly match real rendered glyph widths.
  let sy=MT+4;const sx=ML+0.5;const smw=SB-7;
  // All sidebar elements are horizontally centered within the new
  // (narrower) smw — same centering technique as before, just relative
  // to the reduced width so nothing runs into the sidebar's edge.
  p.setFillColor(220,230,255);p.circle(sx+smw/2,sy+8,10,'F');
  const ini=owner.split(' ').map((n:string)=>n[0]||'').join('').slice(0,2).toUpperCase();
  tc(p,sr,sg,sb);p.setFont(F,'bold');p.setFontSize(10);p.text(ini,sx+smw/2-p.getTextWidth(ini)/2,sy+10);sy+=24;
  tc(p,255,255,255);p.setFont(F,'bold');p.setFontSize(9);const nw=p.getTextWidth(owner);p.text(owner,sx+smw/2-Math.min(nw,smw)/2,sy);sy+=5;
  p.setFont(F,'normal');p.setFontSize(7);tc(p,200,210,240);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',(()=>{const t=isEdu?'EDUCATOR':'PROFESSIONAL';return sx+smw/2-p.getTextWidth(t)/2;})(),sy);sy+=8;
  sy=sidebarLabel(p,'Contact',sx,sy,smw,[255,255,255],[180,195,240]);
  p.setFont(F,'normal');p.setFontSize(7);tc(p,210,220,255);
  if(pr.email){const ls=p.splitTextToSize(pr.email,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=3.5;});sy+=1;}
  if(pr.phone){p.text(pr.phone,sx,sy);sy+=5;}
  if(pr.address){const ls=p.splitTextToSize(pr.address,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=3.5;});sy+=1;}
  sy+=3;
  // Subjects and Skills (soft_skills) moved to the main content area
  // below — only Languages stays in the sidebar.
  if(sk.languages?.length){sy=sidebarLabel(p,'Languages',sx,sy,smw,[255,255,255],[180,195,240]);p.setFont(F,'normal');p.setFontSize(7);tc(p,210,220,255);for(const l of sk.languages){p.text(`– ${l}`,sx,sy);sy+=3.5;}sy+=3;}
  reset(p);let y=MT+8;tc(p,sr,sg,sb);p.setFont(F,'bold');p.setFontSize(16);p.text(owner.toUpperCase(),cx,y);y+=6;
  tc(p,107,114,128);p.setFont(F,'normal');p.setFontSize(8);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',cx,y);y+=3;hLine(p,cx,y,cmw,sr,sg,sb,0.5);y+=6;
  // Pages 2+: a horizontal shaded header strip in the same sidebar color
  // (matching the request for visual consistency across pages) instead
  // of a vertical sidebar — and content starts at the NORMAL margin
  // (mainCX/mainCMW), not still indented by the page-1 sidebar width.
  const np=()=>{p.addPage();reset(p);fill(p,sr,sg,sb);p.rect(0,0,PW,6,'F');reset(p);return MT+8;};
  // GXW must report different x/width depending on which "side" of the
  // page-1/page-2+ boundary content currently sits on. Since content is
  // drawn sequentially and np() is only called once a new page is
  // actually needed, anything drawn AFTER the first np() call is on
  // page 2+ and should use the normal margin from then on.
  let onFirstPage = true;
  const GXW=():[number,number]=>{ onFirstPage=false; return [mainCX,mainCMW]; };
  if(pr.bio){y=sectionHeading(p,isEdu?'About Me':'About Me',cx,y,cmw,BLUE,'bar',BOTTOM,np,GXW,ICON.fileText);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,cx,y,cmw,BOTTOM,np,GXW);y+=ITEM_GAP+1;}
  if(exp.length){y=sectionHeading(p,isEdu?'Teaching Experience':'Work History',cx,y,cmw,BLUE,'bar',BOTTOM,np,GXW,ICON.briefcase);
    for(const e of exp){if(y+14>BOTTOM){y=np();onFirstPage=false;}
      const [ex,ew]=onFirstPage?[cx,cmw]:[mainCX,mainCMW];
      p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.role||'',ex,y);y+=LINE_H;
      p.setFont(F,'bold');p.setFontSize(8.5);tc(p,sr,sg,sb);p.text(e.school||'',ex,y);const ds=[e.from,e.to].filter(Boolean).join(' – ');if(ds){tc(p,107,114,128);p.setFont(F,'normal');p.setFontSize(8);p.text(ds,ex+ew-p.getTextWidth(ds),y);}y+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,ex,y,ew,BLUE,BOTTOM,np,GXW);
      y+=ITEM_GAP+1;}}
  if(edu.length){y=sectionHeading(p,'Education',onFirstPage?cx:mainCX,y,onFirstPage?cmw:mainCMW,BLUE,'bar',BOTTOM,np,GXW,ICON.graduationCap);
    for(const e of edu){if(y+12>BOTTOM){y=np();onFirstPage=false;}const [ex,ew]=onFirstPage?[cx,cmw]:[mainCX,mainCMW];p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',ex,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),ex,y);y+=LINE_H+ITEM_GAP;void ew;}}
  // Subjects and Skills — moved here from the sidebar, drawn in the main
  // content area like a normal section.
  if(sk.subjects?.length||sk.soft_skills?.length){
    const [sx2,sw2]=onFirstPage?[cx,cmw]:[mainCX,mainCMW];
    y=sectionHeading(p,'Subjects & Skills',sx2,y,sw2,BLUE,'bar',BOTTOM,np,GXW,ICON.cogs);
    for(const [lbl,items] of [['Subjects',sk.subjects||[]],['Skills',sk.soft_skills||[]]] as [string,string[]][]){if(!items.length)continue;
      const [ex,ew]=onFirstPage?[cx,cmw]:[mainCX,mainCMW];
      p.setFont(F,'bold');p.setFontSize(9);tc(p,55,65,81);p.text(`${lbl}:`,ex,y);const lw=p.getTextWidth(`${lbl}:`)+2;p.setFont(F,'normal');tc(p,55,65,81);y=wrapped(p,items.join('  ·  '),ex+lw,y,ew-lw,BOTTOM,np,()=>onFirstPage?[cx+lw,cmw-lw]:[mainCX+lw,mainCMW-lw]);y+=ITEM_GAP;}
  }
  y=drawCustom(p,customs,BLUE,'bar',onFirstPage?cx:mainCX,y,onFirstPage?cmw:mainCMW,BOTTOM,np,GXW);
  refsPage(p,refs,BLUE,'bar',np,BOTTOM,owner,wm);
}

// ── 6. BOLD — Pink banner, main left column + narrow right skill panel ─────────
function drawBold(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#c2185b');const [ar,ag,ab]=accent;
  fill(p,ar,ag,ab);p.rect(0,0,PW,32,'F');tc(p,255,255,255);p.setFont(F,'bold');p.setFontSize(18);p.text(owner.toUpperCase(),ML,12);
  p.setFont(F,'normal');p.setFontSize(8);tc(p,255,180,210);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',ML,18);
  fill(p,255,255,255);p.rect(ML,20,PW-ML-MR,0.4,'F');
  p.setFont(F,'normal');p.setFontSize(7.5);tc(p,255,210,230);p.text([pr.email,pr.phone,pr.address].filter(Boolean).join('   |   '),ML,27);
  reset(p);
  const RCX=PW-MR-50;const RCW=50;const MCW=RCX-ML-6;let y=MT+24;
  const np=()=>{p.addPage();reset(p);fill(p,ar,ag,ab);p.rect(0,0,PW,5,'F');reset(p);return MT+7;};const GXW=():[ number,number]=>[ML,MCW];
  if(pr.bio){y=sectionHeading(p,'Summary',ML,y,MCW,accent,'bar',BOTTOM,np,GXW);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,ML,y,MCW,BOTTOM,np,GXW);y+=ITEM_GAP+1;}
  if(exp.length){y=sectionHeading(p,'Experience',ML,y,MCW,accent,'bar',BOTTOM,np,GXW);
    for(const e of exp){if(y+14>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.role||'',ML,y);y+=LINE_H;
      p.setFont(F,'bold');p.setFontSize(8.5);tc(p,ar,ag,ab);p.text(e.school||'',ML,y);const ds=[e.from,e.to].filter(Boolean).join(' – ');if(ds){tc(p,107,114,128);p.setFont(F,'normal');p.setFontSize(8);p.text(ds,RCX-4-p.getTextWidth(ds),y);}y+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,ML,y,MCW,accent,BOTTOM,np,GXW);
      y+=ITEM_GAP+1;}}
  y=drawCustom(p,customs,accent,'bar',ML,y,MCW,BOTTOM,np,GXW);
  // Right panel
  let rcy=MT+24;
  if(edu.length){p.setFont(F,'bold');p.setFontSize(8);tc(p,ar,ag,ab);p.text('EDUCATION',RCX,rcy);rcy+=4;hLine(p,RCX,rcy,RCW,ar,ag,ab,0.4);rcy+=4;
    for(const e of edu){if(rcy>=BOTTOM)break;const ql=p.splitTextToSize(e.qualification||'',RCW) as string[];ql.forEach((l:string)=>{p.setFont(F,'bold');p.setFontSize(8.5);tc(p,17,24,39);p.text(l,RCX,rcy);rcy+=3.8;});
      p.setFont(F,'normal');p.setFontSize(7.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join(' · '),RCX,rcy);rcy+=5;}rcy+=3;}
  for(const [lbl,items] of [['Subjects',sk.subjects||[]],['Skills',sk.soft_skills||[]],['Languages',sk.languages||[]]] as [string,string[]][]){if(!items.length)continue;
    p.setFont(F,'bold');p.setFontSize(8);tc(p,ar,ag,ab);p.text(lbl.toUpperCase(),RCX,rcy);rcy+=4;hLine(p,RCX,rcy,RCW,ar,ag,ab,0.4);rcy+=4;
    for(const it of items){if(rcy>=BOTTOM)break;const ls=p.splitTextToSize(`– ${it}`,RCW) as string[];ls.forEach((l:string)=>{p.setFont(F,'normal');p.setFontSize(7.5);tc(p,55,65,81);p.text(l,RCX,rcy);rcy+=3.8;});}rcy+=3;}
  refsPage(p,refs,accent,'bar',np,BOTTOM,owner,wm);
}

// ── 7. EXECUTIVE — Burgundy gradient banner, two-col body ─────────────────────
function drawExecutive(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#6b1a1a');const [ar,ag,ab]=accent;const LIGHT:RGB=[139,36,36];
  fill(p,ar,ag,ab);p.rect(0,0,PW,35,'F');fill(p,...LIGHT);p.rect(PW*0.6,0,PW*0.4,35,'F');fill(p,ar,ag,ab);p.rect(0,0,PW*0.6+8,35,'F');
  tc(p,255,255,255);p.setFont(F,'bold');p.setFontSize(18);p.text(owner.toUpperCase(),ML,14);
  p.setFont(F,'normal');p.setFontSize(8);tc(p,200,160,160);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',ML,20);hLine(p,ML,23,PW-ML-MR,255,255,255,0.2);
  p.setFont(F,'normal');p.setFontSize(7.5);tc(p,220,190,190);p.text([pr.email,pr.phone,pr.address,pr.id_number?`ID: ${pr.id_number}`:null].filter(Boolean).join('   ·   '),ML,30);
  reset(p);let y=MT+28;
  const np=()=>{p.addPage();reset(p);fill(p,ar,ag,ab);p.rect(0,0,PW,5,'F');reset(p);return MT+7;};
  if(pr.bio){y=sectionHeading(p,'Executive Profile',ML,y,PW-ML-MR,accent,'underline',BOTTOM,np);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,ML,y,PW-ML-MR,BOTTOM,np);y+=ITEM_GAP+2;}
  const c1=ML;const c2=ML+(PW-ML-MR)/2+4;const cw=(PW-ML-MR)/2-4;let y1=y;let y2=y;
  if(exp.length){y1=sectionHeading(p,isEdu?'Teaching Experience':'Work Experience',c1,y1,cw,accent,'underline',BOTTOM,np);
    for(const e of exp){if(y1+14>BOTTOM)y1=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.role||'',c1,y1);y1+=LINE_H;
      p.setFont(F,'bold');p.setFontSize(8.5);tc(p,...LIGHT);p.text(e.school||'',c1,y1);const ds=[e.from,e.to].filter(Boolean).join(' – ');if(ds){tc(p,107,114,128);p.setFont(F,'normal');p.setFontSize(8);p.text(ds,c1+cw-p.getTextWidth(ds),y1);}y1+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y1=bulletLine(p,l,c1,y1,cw,accent,BOTTOM,np);
      y1+=ITEM_GAP+1;}}
  y1=drawCustom(p,customs,accent,'underline',c1,y1,cw,BOTTOM,np);
  if(edu.length){y2=sectionHeading(p,'Education',c2,y2,cw,accent,'underline',BOTTOM,np);
    for(const e of edu){if(y2+12>BOTTOM)y2=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',c2,y2);y2+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),c2,y2);y2+=LINE_H+ITEM_GAP;}}
  for(const [lbl,items] of [['Subjects',sk.subjects||[]],['Skills',sk.soft_skills||[]],['Languages',sk.languages||[]]] as [string,string[]][]){if(!items.length)continue;
    y2=sectionHeading(p,lbl,c2,y2,cw,accent,'underline',BOTTOM,np);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);
    for(const it of items){if(y2+LINE_H>BOTTOM)y2=np();y2=bulletLine(p,it,c2,y2,cw,accent,BOTTOM,np);}y2+=ITEM_GAP;}
  refsPage(p,refs,accent,'underline',np,BOTTOM,owner,wm);
}

// ── 8. CORPORATE — Dark navy left sidebar (square avatar), right content ───────
function drawCorporate(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#1a2a4a');const [ar,ag,ab]=accent;const SB=55;const cx=ML+SB+8;const cmw=PW-MR-cx;
  fill(p,ar,ag,ab);p.rect(0,0,ML+SB+2,PH,'F');
  let sy=MT+4;const sx=ML+1;const smw=SB-4;
  fill(p,40,60,90);p.rect(sx+smw/2-9,sy,18,18,'F');dc(p,255,255,255);p.setLineWidth(0.5);p.rect(sx+smw/2-9,sy,18,18,'S');
  const ini=owner.split(' ').map((n:string)=>n[0]||'').join('').slice(0,2).toUpperCase();
  tc(p,255,255,255);p.setFont(F,'bold');p.setFontSize(10);p.text(ini,sx+smw/2-p.getTextWidth(ini)/2,sy+11);sy+=24;
  sy=sidebarLabel(p,'Contact',sx,sy,smw,[255,255,255],[80,100,140]);
  p.setFont(F,'normal');p.setFontSize(7);tc(p,190,210,240);
  if(pr.email){const ls=p.splitTextToSize(pr.email,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=3.5;});sy+=1;}
  if(pr.phone){p.text(pr.phone,sx,sy);sy+=5;}
  if(pr.address){const ls=p.splitTextToSize(pr.address,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=3.5;});sy+=1;}
  sy+=3;
  if(sk.subjects?.length){sy=sidebarLabel(p,'Subjects',sx,sy,smw,[255,255,255],[80,100,140]);p.setFont(F,'normal');p.setFontSize(7);tc(p,190,210,240);for(const s of sk.subjects){const ls=p.splitTextToSize(`– ${s}`,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=3.5;});}sy+=3;}
  if(sk.soft_skills?.length){sy=sidebarLabel(p,'Skills',sx,sy,smw,[255,255,255],[80,100,140]);p.setFont(F,'normal');p.setFontSize(7);tc(p,190,210,240);for(const s of sk.soft_skills){const ls=p.splitTextToSize(`– ${s}`,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=3.5;});}sy+=3;}
  if(sk.languages?.length){sy=sidebarLabel(p,'Languages',sx,sy,smw,[255,255,255],[80,100,140]);p.setFont(F,'normal');p.setFontSize(7);tc(p,190,210,240);for(const l of sk.languages){p.text(`– ${l}`,sx,sy);sy+=3.5;}}
  reset(p);let y=MT+8;p.setFont(F,'bold');p.setFontSize(16);tc(p,ar,ag,ab);p.text(owner.toUpperCase(),cx,y);y+=6;
  hLine(p,cx,y,cmw,ar,ag,ab,1.2);y+=4;p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',cx,y);y+=5;
  const np=()=>{p.addPage();reset(p);fill(p,ar,ag,ab);p.rect(0,0,6,PH,'F');reset(p);return MT+4;};const GXW=():[ number,number]=>[cx,cmw];
  if(pr.bio){y=sectionHeading(p,'Professional Summary',cx,y,cmw,accent,'bar',BOTTOM,np,GXW);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,cx,y,cmw,BOTTOM,np,GXW);y+=ITEM_GAP+1;}
  if(exp.length){y=sectionHeading(p,isEdu?'Teaching Experience':'Work Experience',cx,y,cmw,accent,'bar',BOTTOM,np,GXW);
    for(const e of exp){if(y+14>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.role||'',cx,y);y+=LINE_H;
      p.setFont(F,'bold');p.setFontSize(8.5);tc(p,ar,ag,ab);p.text(e.school||'',cx,y);const ds=[e.from,e.to].filter(Boolean).join(' – ');if(ds){tc(p,107,114,128);p.setFont(F,'normal');p.setFontSize(8);p.text(ds,cx+cmw-p.getTextWidth(ds),y);}y+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,cx,y,cmw,accent,BOTTOM,np,GXW);
      y+=ITEM_GAP+1;}}
  if(edu.length){y=sectionHeading(p,'Education',cx,y,cmw,accent,'bar',BOTTOM,np,GXW);
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',cx,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),cx,y);y+=LINE_H+ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'bar',cx,y,cmw,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'bar',np,BOTTOM,owner,wm);
}

// ── 9. STYLISH — Coral, date+school left col, main content, right skill dots ───
function drawStylish(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#e05c6b');const [ar,ag,ab]=accent;
  tc(p,17,24,39);p.setFont(F,'bold');p.setFontSize(20);p.text(owner,ML,MT+8);
  hLine(p,ML,MT+11,PW-ML-MR,ar,ag,ab,1.2);
  p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);p.text([pr.address,pr.email,pr.phone].filter(Boolean).join('   ·   '),ML,MT+17);
  reset(p);
  const DX=ML;const DW=28;const CX=ML+DW+6;const RCX=PW-MR-50;const MCW=RCX-CX-6;let y=MT+22;
  const np=()=>{p.addPage();reset(p);return MT;};const GXW=():[ number,number]=>[CX,MCW];
  if(pr.bio){p.setFont(F,'bold');p.setFontSize(8);tc(p,ar,ag,ab);p.text('PROFILE',DX,y);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,CX,y,MCW,BOTTOM,np,GXW);y+=ITEM_GAP+2;}
  if(exp.length){hLine(p,ML,y,PW-ML-MR,ar,ag,ab,0.6);y+=4;p.setFont(F,'bold');p.setFontSize(8);tc(p,ar,ag,ab);p.text(isEdu?'EMPLOYMENT HISTORY':'WORK HISTORY',DX,y);y+=LINE_H+1;
    for(const e of exp){if(y+14>BOTTOM)y=np();
      p.setFont(F,'normal');p.setFontSize(8);tc(p,ar,ag,ab);const dStr=[e.from,e.to].filter(Boolean).join('–');
      const dl=p.splitTextToSize(dStr,DW) as string[];dl.forEach((l:string,i:number)=>p.text(l,DX,y+i*LINE_H));
      const sl=p.splitTextToSize(e.school||'',DW) as string[];sl.forEach((l:string,i:number)=>p.text(l,DX,y+(dl.length+i)*LINE_H));
      fill(p,243,244,246);p.rect(CX-2,y-3.5,MCW+4,LINE_H+1,'F');reset(p);tc(p,17,24,39);p.setFont(F,'bold');p.setFontSize(10);p.text(e.role||'',CX,y);y+=LINE_H;
      if(e.description){p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,CX,y,MCW,accent,BOTTOM,np,GXW);}
      y+=ITEM_GAP+2;}}
  if(edu.length){hLine(p,ML,y,PW-ML-MR,ar,ag,ab,0.6);y+=4;p.setFont(F,'bold');p.setFontSize(8);tc(p,ar,ag,ab);p.text('EDUCATION',DX,y);y+=LINE_H+1;
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'normal');p.setFontSize(8);tc(p,ar,ag,ab);p.text(e.year||'',DX,y);p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',CX,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(9);tc(p,107,114,128);p.text(e.institution||'',CX,y);y+=LINE_H+ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'underline',CX,y,MCW,BOTTOM,np,GXW);
  // Right skill dots panel
  let rcy=MT+22;
  for(const [lbl,items] of [['Skills',[...(sk.subjects||[]),...(sk.soft_skills||[])]],['Languages',sk.languages||[]]] as [string,string[]][]){if(!items.length)continue;
    p.setFont(F,'bold');p.setFontSize(8);tc(p,ar,ag,ab);p.text(lbl.toUpperCase(),RCX,rcy);rcy+=4;hLine(p,RCX,rcy,50,ar,ag,ab,0.4);rcy+=4;
    for(const it of items){if(rcy>=BOTTOM-10)break;p.setFont(F,'normal');p.setFontSize(7.5);tc(p,55,65,81);
      const ls=p.splitTextToSize(it,50) as string[];ls.forEach((l:string)=>{p.text(l,RCX,rcy);rcy+=3.8;});
      for(let d=0;d<5;d++){fill(p,d<3?ar:229,d<3?ag:231,d<3?ab:235);p.circle(RCX+d*5+2,rcy-1,1.2,'F');}rcy+=5;}rcy+=3;}
  refsPage(p,refs,accent,'underline',np,BOTTOM,owner,wm);
}

// ── 10. BOXED — Grey left sidebar, boxed-name centred header ─────────────────
function drawBoxed(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#374151');const [ar,ag,ab]=accent;const SBW=52;const CX=ML+SBW+4;const CMW=PW-MR-CX;
  fill(p,248,248,248);p.rect(0,0,ML+SBW+2,PH,'F');dc(p,229,231,235);p.setLineWidth(0.3);p.line(ML+SBW+2,0,ML+SBW+2,PH);
  let sy=MT+8;const sx=ML+1;const smw=SBW-4;
  const sbH=(t:string)=>{p.setFont(F,'bold');p.setFontSize(7.5);tc(p,ar,ag,ab);p.text(t.toUpperCase(),sx,sy);hLine(p,sx,sy+1.5,smw,ar,ag,ab,0.8);sy+=6;};
  if(pr.address){sbH('DETAILS');p.setFont(F,'normal');p.setFontSize(7.5);tc(p,75,85,99);const ls=p.splitTextToSize(pr.address,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=3.8;});sy+=3;}
  if(pr.phone){p.setFont(F,'normal');p.setFontSize(7.5);tc(p,75,85,99);p.text(pr.phone,sx,sy);sy+=4;}
  if(pr.email){const ls=p.splitTextToSize(pr.email,smw) as string[];ls.forEach((l:string)=>{p.setFont(F,'normal');p.setFontSize(7.5);tc(p,75,85,99);p.text(l,sx,sy);sy+=3.8;});sy+=4;}
  if(sk.subjects?.length||sk.soft_skills?.length){sy+=2;sbH('SKILLS');
    for(const it of [...(sk.subjects||[]),...(sk.soft_skills||[])].slice(0,12)){if(sy>=BOTTOM-12)break;
      const ls=p.splitTextToSize(it,smw) as string[];ls.forEach((l:string)=>{p.setFont(F,'normal');p.setFontSize(7.5);tc(p,75,85,99);p.text(l,sx,sy);sy+=3.8;});
      for(let d=0;d<5;d++){fill(p,ar,ag,ab);p.circle(sx+d*4+1,sy-1,1.2,'F');}sy+=6;}}
  if(sk.languages?.length){sy+=2;sbH('LANGUAGES');for(const l of sk.languages){if(sy>=BOTTOM-8)break;p.setFont(F,'normal');p.setFontSize(7.5);tc(p,75,85,99);p.text(l,sx,sy);sy+=4;}}
  reset(p);let y=MT+4;
  dc(p,ar,ag,ab);p.setLineWidth(0.8);p.rect(CX,y,CMW,20,'S');
  tc(p,17,24,39);p.setFont(F,'bold');p.setFontSize(14);const nw=p.getTextWidth(owner.toUpperCase());p.text(owner.toUpperCase(),CX+(CMW-nw)/2,y+9);
  p.setFont(F,'normal');p.setFontSize(7);tc(p,107,114,128);if(pr.address){const aw=p.getTextWidth(pr.address);p.text(pr.address,CX+(CMW-aw)/2,y+15);}y+=24;
  const np=()=>{p.addPage();reset(p);fill(p,248,248,248);p.rect(0,0,ML+SBW+2,PH,'F');dc(p,229,231,235);p.setLineWidth(0.3);p.line(ML+SBW+2,0,ML+SBW+2,PH);reset(p);return MT;};const GXW=():[ number,number]=>[CX,CMW];
  const bH=(t:string)=>{p.setFont(F,'bold');p.setFontSize(8.5);tc(p,ar,ag,ab);p.text(t,CX,y);hLine(p,CX,y+1.5,CMW,ar,ag,ab,0.5);y+=6;};
  if(pr.bio){bH('PROFILE');p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,CX,y,CMW,BOTTOM,np,GXW);y+=ITEM_GAP+2;}
  if(exp.length){bH(isEdu?'EMPLOYMENT HISTORY':'WORK HISTORY');
    for(const e of exp){if(y+14>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);const ds=[e.from,e.to].filter(Boolean).join(' — ');
      p.text(`${e.role||''}${e.school?`, ${e.school}`:''}`,CX,y);if(ds){tc(p,107,114,128);p.setFont(F,'normal');p.setFontSize(8);p.text(ds,CX+CMW-p.getTextWidth(ds),y);}y+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,CX,y,CMW,accent,BOTTOM,np,GXW);
      y+=ITEM_GAP+1;}}
  if(edu.length){bH('EDUCATION');
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',CX,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),CX,y);y+=LINE_H+ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'bar',CX,y,CMW,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'bar',np,BOTTOM,owner,wm);
}

// ── 11. TRADITIONAL — Centred name, left-date + vertical rule ─────────────────
function drawTraditional(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#374151');const [ar,ag,ab]=accent;
  tc(p,17,24,39);p.setFont(F,'bold');p.setFontSize(16);const nw=p.getTextWidth(owner);p.text(owner,(PW-nw)/2,MT+8);
  p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);const ctxt=[pr.address,pr.phone,pr.email].filter(Boolean).join('   ·   ');const cw=p.getTextWidth(ctxt);p.text(ctxt,(PW-cw)/2,MT+14);
  hLine(p,ML,MT+17,PW-ML-MR,ar,ag,ab,0.5);reset(p);let y=MT+22;
  const DX=ML;const DW=32;const CX=ML+DW+4;const CMW=PW-MR-CX;const VX=CX-2;
  const np=()=>{p.addPage();reset(p);return MT;};const GXW=():[ number,number]=>[CX,CMW];
  const tHead=(t:string)=>{if(y+16>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(8);tc(p,ar,ag,ab);
    const tl=p.splitTextToSize(t.toUpperCase(),DW) as string[];tl.forEach((l:string,i:number)=>p.text(l,DX,y+i*LINE_H));
    dc(p,229,231,235);p.setLineWidth(0.4);p.line(VX,y-2,VX,y+6);hLine(p,CX,y,CMW,229,231,235,0.4);y+=tl.length*LINE_H+1;};
  if(pr.bio){tHead('PROFILE');p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);dc(p,229,231,235);p.setLineWidth(0.4);p.line(VX,y-2,VX,y+30);y=wrapped(p,pr.bio,CX,y,CMW,BOTTOM,np,GXW);y+=ITEM_GAP+2;}
  if(exp.length){tHead(isEdu?'EMPLOYMENT\nHISTORY':'WORK\nHISTORY');
    for(const e of exp){if(y+14>BOTTOM)y=np();p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);p.text([e.from,e.to].filter(Boolean).join(' — '),DX,y);
      dc(p,229,231,235);p.setLineWidth(0.3);p.line(VX,y-3,VX,y+14);p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(`${e.role||''}${e.school?`, ${e.school}`:''}`,CX,y);y+=LINE_H;
      if(e.description){p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,CX,y,CMW,accent,BOTTOM,np,GXW);}y+=ITEM_GAP+1;}}
  if(edu.length){tHead('EDUCATION');
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);p.text(e.year||'',DX,y);
      dc(p,229,231,235);p.setLineWidth(0.3);p.line(VX,y-3,VX,y+10);p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',CX,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text(e.institution||'',CX,y);y+=LINE_H+ITEM_GAP;}}
  if(sk.subjects?.length||sk.soft_skills?.length||sk.languages?.length){tHead('SKILLS');p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);
    const allSk=[...(sk.subjects||[]),...(sk.soft_skills||[])];if(allSk.length){y=wrapped(p,allSk.join('  ·  '),CX,y,CMW,BOTTOM,np,GXW);y+=ITEM_GAP;}
    if(sk.languages?.length){p.setFont(F,'bold');tc(p,ar,ag,ab);p.text('Languages: ',CX,y);const lw=p.getTextWidth('Languages: ');p.setFont(F,'normal');tc(p,55,65,81);p.text(sk.languages.join(', '),CX+lw,y);y+=LINE_H+ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'bar',CX,y,CMW,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'bar',np,BOTTOM,owner,wm);
}

// ── 12. NAVY — Dark right sidebar with progress bars ──────────────────────────
function drawNavy(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#1a2a4a');const [ar,ag,ab]=accent;const RSBW=52;const CMW=PW-ML-RSBW-8;const RSBX=PW-RSBW;
  fill(p,ar,ag,ab);p.rect(RSBX-2,0,RSBW+2,PH,'F');
  let rsy=MT+6;const rsw=RSBW-8;const rsx=RSBX+2;
  const nsbH=(t:string)=>{p.setFont(F,'bold');p.setFontSize(6.5);tc(p,150,170,200);p.text(t.toUpperCase(),rsx,rsy);rsy+=3;dc(p,100,130,180);p.setLineWidth(0.2);p.line(rsx,rsy,rsx+rsw,rsy);rsy+=3;};
  nsbH('Details');p.setFont(F,'normal');p.setFontSize(7);tc(p,200,215,230);
  if(pr.address){const ls=p.splitTextToSize(pr.address,rsw) as string[];ls.forEach((l:string)=>{p.text(l,rsx,rsy);rsy+=3.5;});rsy+=2;}
  if(pr.phone){p.text(pr.phone,rsx,rsy);rsy+=4;}
  if(pr.email){const ls=p.splitTextToSize(pr.email,rsw) as string[];ls.forEach((l:string)=>{p.text(l,rsx,rsy);rsy+=3.5;});rsy+=3;}
  const allSk=[...(sk.subjects||[]),...(sk.soft_skills||[])];
  if(allSk.length){nsbH('Skills');for(const s of allSk.slice(0,8)){if(rsy>=BOTTOM-8)break;const ls=p.splitTextToSize(s,rsw) as string[];ls.forEach((l:string)=>{p.setFont(F,'normal');p.setFontSize(6.5);tc(p,200,215,230);p.text(l,rsx,rsy);rsy+=3.5;});fill(p,80,100,140);p.rect(rsx,rsy-1,rsw*0.7,1.5,'F');rsy+=4;}rsy+=3;}
  if(sk.languages?.length){nsbH('Languages');for(const l of sk.languages){if(rsy>=BOTTOM-6)break;p.setFont(F,'normal');p.setFontSize(6.5);tc(p,200,215,230);p.text(l,rsx,rsy);fill(p,80,100,140);p.rect(rsx,rsy+1,rsw*0.8,1.5,'F');rsy+=6;}}
  reset(p);let y=MT+8;p.setFont(F,'bold');p.setFontSize(18);tc(p,ar,ag,ab);p.text(owner,ML,y);y+=6;
  p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',ML,y);y+=3;
  hLine(p,ML,y,CMW,ar,ag,ab,1.5);hLine(p,ML,y+3,CMW,ar,ag,ab,0.3);y+=7;
  const np=()=>{p.addPage();reset(p);fill(p,ar,ag,ab);p.rect(RSBX-2,0,RSBW+2,PH,'F');reset(p);return MT+4;};const GXW=():[ number,number]=>[ML,CMW];
  if(pr.bio){y=sectionHeading(p,'Profile',ML,y,CMW,accent,'bar',BOTTOM,np,GXW);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,ML,y,CMW,BOTTOM,np,GXW);y+=ITEM_GAP+1;}
  if(exp.length){y=sectionHeading(p,isEdu?'Teaching Experience':'Employment History',ML,y,CMW,accent,'bar',BOTTOM,np,GXW);
    for(const e of exp){if(y+14>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(`${e.role||''}${e.school?`, ${e.school}`:''}`,ML,y);y+=LINE_H;
      p.setFont(F,'normal');p.setFontSize(8);tc(p,156,163,175);p.text([e.from,e.to].filter(Boolean).join(' — '),ML,y);y+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,ML,y,CMW,accent,BOTTOM,np,GXW);
      y+=ITEM_GAP+1;}}
  if(edu.length){y=sectionHeading(p,'Education',ML,y,CMW,accent,'bar',BOTTOM,np,GXW);
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',ML,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8);tc(p,156,163,175);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),ML,y);y+=LINE_H+ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'bar',ML,y,CMW,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'bar',np,BOTTOM,owner,wm);
}

// ── 13. TIMELINE — Mini left sidebar, centred header, timeline dots ────────────
function drawTimeline(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#374151');const [ar,ag,ab]=accent;const SBW=44;const CX=ML+SBW+6;const CMW=PW-MR-CX;
  dc(p,229,231,235);p.setLineWidth(0.4);p.line(ML+SBW+4,MT,ML+SBW+4,BOTTOM);
  let sy=MT+4;const sx=ML;const smw=SBW-2;
  const tsbH=(t:string)=>{p.setFont(F,'bold');p.setFontSize(7);tc(p,ar,ag,ab);p.text(`• ${t} •`,sx,sy);sy+=5;};
  tsbH('DETAILS');p.setFont(F,'normal');p.setFontSize(7);tc(p,75,85,99);
  if(pr.address){const ls=p.splitTextToSize(pr.address,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=3.5;});sy+=2;}
  if(pr.phone){p.text(pr.phone,sx,sy);sy+=4;}
  if(pr.email){const ls=p.splitTextToSize(pr.email,smw) as string[];ls.forEach((l:string)=>{p.text(l,sx,sy);sy+=3.5;});sy+=3;}
  const allSk=[...(sk.subjects||[]),...(sk.soft_skills||[])];
  if(allSk.length){tsbH('SKILLS');for(const s of allSk.slice(0,8)){if(sy>=BOTTOM-12)break;const ls=p.splitTextToSize(s,smw) as string[];ls.forEach((l:string)=>{p.setFont(F,'normal');p.setFontSize(7);tc(p,75,85,99);p.text(l,sx,sy);sy+=3.5;});fill(p,ar,ag,ab);p.rect(sx,sy-1,smw*0.75,2,'F');sy+=4;}sy+=2;}
  if(sk.languages?.length){tsbH('LANGUAGES');for(const l of sk.languages){if(sy>=BOTTOM-8)break;p.setFont(F,'normal');p.setFontSize(7);tc(p,75,85,99);p.text(l,sx,sy);sy+=3.5;fill(p,ar,ag,ab);p.rect(sx,sy-1,smw*0.8,2,'F');sy+=4;}}
  reset(p);let y=MT+4;
  tc(p,17,24,39);p.setFont(F,'bold');p.setFontSize(16);const nw=p.getTextWidth(owner.toUpperCase());p.text(owner.toUpperCase(),CX+(CMW-nw)/2,y);y+=6;
  p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);const sub=[pr.address,pr.phone].filter(Boolean).join('   ·   ');const sw=p.getTextWidth(sub);p.text(sub,CX+(CMW-sw)/2,y);y+=4;
  hLine(p,CX,y,CMW,ar,ag,ab,1.5);hLine(p,CX,y+3,CMW,ar,ag,ab,0.3);y+=8;
  const np=()=>{p.addPage();reset(p);dc(p,229,231,235);p.setLineWidth(0.4);p.line(ML+SBW+4,MT,ML+SBW+4,BOTTOM);reset(p);return MT+4;};const GXW=():[ number,number]=>[CX,CMW];
  if(pr.bio){p.setFont(F,'bold');p.setFontSize(9);tc(p,ar,ag,ab);p.text('◆ PROFILE',CX,y);y+=HEADING_GAP;p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,CX,y,CMW,BOTTOM,np,GXW);y+=ITEM_GAP+2;}
  if(exp.length){p.setFont(F,'bold');p.setFontSize(9);tc(p,ar,ag,ab);p.text('◆ '+(isEdu?'EMPLOYMENT HISTORY':'WORK HISTORY'),CX,y);y+=HEADING_GAP;
    for(const e of exp){if(y+14>BOTTOM)y=np();
      fill(p,ar,ag,ab);p.circle(CX+3,y-1,2.5,'F');dc(p,229,231,235);p.setLineWidth(0.5);p.line(CX+3,y+2,CX+3,y+14);
      p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.role||'',CX+9,y);y+=LINE_H;
      p.setFont(F,'normal');p.setFontSize(8);tc(p,156,163,175);p.text(`${e.school||''}   ${[e.from,e.to].filter(Boolean).join(' — ')}`,CX+9,y);y+=LINE_H;
      if(e.description){p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);
        for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean)){if(y+LINE_H>BOTTOM)y=np();fill(p,ar,ag,ab);p.triangle(CX+9,y-1,CX+10.5,y+1.5,CX+7.5,y+1.5,'F');tc(p,55,65,81);p.text(l,CX+13,y);y+=LINE_H;}}
      y+=ITEM_GAP+1;}}
  if(edu.length){p.setFont(F,'bold');p.setFontSize(9);tc(p,ar,ag,ab);p.text('◆ EDUCATION',CX,y);y+=HEADING_GAP;
    for(const e of edu){if(y+12>BOTTOM)y=np();fill(p,209,213,219);p.circle(CX+3,y-1,2.5,'F');p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',CX+9,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8);tc(p,156,163,175);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),CX+9,y);y+=LINE_H+ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'dot-prefix',CX,y,CMW,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'dot-prefix',np,BOTTOM,owner,wm);
}

// ── 14. SHADED — Centred header, shaded section bars, • entry markers ─────────
function drawShaded(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#374151');const [ar,ag,ab]=accent;
  fill(p,243,244,246);p.rect(0,0,PW,28,'F');
  tc(p,17,24,39);p.setFont(F,'bold');p.setFontSize(16);const nw=p.getTextWidth(owner.toUpperCase());p.text(owner.toUpperCase(),(PW-nw)/2,MT+8);
  if(pr.address){p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);const aw=p.getTextWidth(pr.address);p.text(pr.address,(PW-aw)/2,MT+13);}
  hLine(p,ML,MT+16,PW-ML-MR,229,231,235,0.4);
  p.setFont(F,'normal');p.setFontSize(8);tc(p,75,85,99);const ctxt=[pr.phone,pr.email].filter(Boolean).join('   ·   ');const cw=p.getTextWidth(ctxt);p.text(ctxt,(PW-cw)/2,MT+21);
  hLine(p,ML,MT+24,PW-ML-MR,229,231,235,0.4);reset(p);let y=MT+28;
  const np=()=>{p.addPage();reset(p);return MT;};const GXW=():[ number,number]=>[ML,PW-ML-MR];
  const shdH=(t:string)=>{
    if(y+18>BOTTOM)y=np();
    y+=6;  // clearance above the bar so it doesn't overlap the previous line/divider
    fill(p,243,244,246);p.rect(ML-2,y-4,PW-ML-MR+4,7,'F');
    tc(p,ar,ag,ab);p.setFont(F,'bold');p.setFontSize(9);p.text(t.toUpperCase(),ML+2,y+1.5); // +1.5 vertically centers the cap-height text within the 7mm-tall bar
    y+=HEADING_GAP+3;  // clearance below the bar before content starts
  };
  // Numbered "step" circle badge for entry headings (Employment History /
  // Education) — bigger and more prominent than the small square bullets
  // used for description points below, similar to Word's numbered-circle
  // list style.
  const TEXT_X = ML+7;
  const numberBadge=(n:number,by:number)=>{
    const cx=ML+2.3, cy=by-1.6, r=2.3;
    fill(p,ar,ag,ab); p.circle(cx,cy,r,'F');
    tc(p,255,255,255); p.setFont(F,'bold'); p.setFontSize(6.5);
    const s=String(n); const tw=p.getTextWidth(s);
    p.text(s, cx-tw/2, cy+1.1);
  };
  if(pr.bio){shdH('PROFILE');p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,ML,y,PW-ML-MR,BOTTOM,np,GXW);y+=ITEM_GAP+2;}
  if(exp.length){shdH(isEdu?'EMPLOYMENT HISTORY':'WORK HISTORY');
    let expIdx=0;
    for(const e of exp){if(y+14>BOTTOM)y=np();expIdx++;numberBadge(expIdx,y);
      p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(`${e.role||''}${e.school?`, ${e.school}`:''}`,TEXT_X,y);
      const ds=[e.from,e.to].filter(Boolean).join(' — ');if(ds){tc(p,156,163,175);p.setFont(F,'normal');p.setFontSize(8);p.text(ds,PW-MR-p.getTextWidth(ds),y);}y+=LINE_H;
      if(e.description){p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,TEXT_X,y,PW-ML-MR-(TEXT_X-ML),accent,BOTTOM,np);}y+=ITEM_GAP+1;}}
  if(edu.length){shdH('EDUCATION');
    let eduIdx=0;
    for(const e of edu){if(y+12>BOTTOM)y=np();eduIdx++;numberBadge(eduIdx,y);
      p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',TEXT_X,y);const ds=e.year||'';if(ds){tc(p,156,163,175);p.setFont(F,'normal');p.setFontSize(8);p.text(ds,PW-MR-p.getTextWidth(ds),y);}y+=LINE_H;
      p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text(e.institution||'',TEXT_X,y);y+=LINE_H+ITEM_GAP;}}
  // ── Skills — grouped by category (Key Skills / Professional Skills / Languages) ──
  const shadedSkillGroups = ([
    ['Key Skills',          sk.subjects    || []],
    ['Professional Skills', sk.soft_skills || []],
    ['Languages',           sk.languages   || []],
  ] as [string, string[]][]).filter(([, items]) => items.length);
  if(shadedSkillGroups.length){
    shdH('SKILLS');
    for(let g=0; g<shadedSkillGroups.length; g++){
      const [label, items] = shadedSkillGroups[g];
      if(y+LINE_H>BOTTOM) y=np();
      p.setFont(F,'bold');p.setFontSize(9);tc(p,ar,ag,ab);p.text(label.toUpperCase(),ML,y);y+=LINE_H;
      p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);
      y=wrapped(p,items.join('  ·  '),ML,y,PW-ML-MR,BOTTOM,np,GXW);
      y+=ITEM_GAP+(g<shadedSkillGroups.length-1?1:0);
    }
  }
  y=drawCustom(p,customs,accent,'shaded',ML,y,PW-ML-MR,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'shaded',np,BOTTOM,owner,wm,undefined,false);
}

// ── 15. TEAL — Full-width teal header, left skill sidebar, right content ───────
function drawTeal(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#06b6d4');const [ar,ag,ab]=accent;
  fill(p,ar,ag,ab);p.rect(0,0,PW,28,'F');
  tc(p,17,24,39);p.setFont(F,'bold');p.setFontSize(18);p.text(owner,ML,13);
  p.setFont(F,'normal');p.setFontSize(8);tc(p,14,116,144);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',ML,19);
  p.setFont(F,'normal');p.setFontSize(7.5);tc(p,14,80,100);p.text([pr.address,pr.phone,pr.email].filter(Boolean).join('   ·   '),ML,24);
  reset(p);
  const LSBW=52;const RCX=ML+LSBW+6;const RCMW=PW-MR-RCX;
  dc(p,241,245,249);p.setLineWidth(0.3);p.line(ML+LSBW+4,28,ML+LSBW+4,PH);
  let sy=30;const sx=ML;const smw=LSBW;
  const tH=(t:string)=>{p.setFont(F,'bold');p.setFontSize(8.5);tc(p,17,24,39);p.text(t,sx,sy);hLine(p,sx,sy+1.5,smw,ar,ag,ab,1);sy+=7;};
  const allSk=[...(sk.subjects||[]),...(sk.soft_skills||[])];
  if(allSk.length){tH('Skills');for(const s of allSk.slice(0,10)){if(sy>=BOTTOM-10)break;const ls=p.splitTextToSize(s,smw) as string[];ls.forEach((l:string)=>{p.setFont(F,'normal');p.setFontSize(7.5);tc(p,55,65,81);p.text(l,sx,sy);sy+=3.8;});progressBar(p,sx,sy,smw*0.75,0.75,accent);sy+=5;}sy+=3;}
  if(sk.languages?.length){tH('Languages');for(const l of sk.languages){if(sy>=BOTTOM-10)break;const ls=p.splitTextToSize(l,smw) as string[];ls.forEach((ln:string)=>{p.setFont(F,'normal');p.setFontSize(7.5);tc(p,55,65,81);p.text(ln,sx,sy);sy+=3.8;});progressBar(p,sx,sy,smw*0.8,0.8,accent);sy+=5;}}
  reset(p);let y=30;
  const np=()=>{p.addPage();reset(p);fill(p,ar,ag,ab);p.rect(0,0,PW,5,'F');dc(p,241,245,249);p.setLineWidth(0.3);p.line(ML+LSBW+4,5,ML+LSBW+4,PH);reset(p);return MT+7;};const GXW=():[ number,number]=>[RCX,RCMW];
  if(pr.bio){y=sectionHeading(p,'Profile',RCX,y,RCMW,accent,'tag-underline',BOTTOM,np,GXW);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,RCX,y,RCMW,BOTTOM,np,GXW);y+=ITEM_GAP+1;}
  if(exp.length){y=sectionHeading(p,isEdu?'Teaching Experience':'Employment History',RCX,y,RCMW,accent,'tag-underline',BOTTOM,np,GXW);
    for(const e of exp){if(y+14>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(`${e.role||''}${e.school?`, ${e.school}`:''}`,RCX,y);y+=LINE_H;
      p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);p.text([e.from,e.to].filter(Boolean).join(' — '),RCX,y);y+=LINE_H;
      if(e.description)for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,RCX,y,RCMW,accent,BOTTOM,np,GXW);
      y+=ITEM_GAP+1;}}
  if(edu.length){y=sectionHeading(p,'Education',RCX,y,RCMW,accent,'tag-underline',BOTTOM,np,GXW);
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',RCX,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),RCX,y);y+=LINE_H+ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'tag-underline',RCX,y,RCMW,BOTTOM,np,GXW);
  refsPage(p,refs,accent,'tag-underline',np,BOTTOM,owner,wm);
}

// ── 16. CRIMSON — Red banner, italic section headings, right skill bars ────────
function drawCrimson(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#c0392b');const [ar,ag,ab]=accent;
  fill(p,ar,ag,ab);p.rect(0,0,PW,28,'F');tc(p,255,255,255);p.setFont(F,'bolditalic');p.setFontSize(18);p.text(owner,ML,12);
  p.setFont(F,'normal');p.setFontSize(8);tc(p,255,180,160);p.text(isEdu?'EDUCATOR':'PROFESSIONAL',ML,18);reset(p);
  hLine(p,0,28,PW,229,231,235,0.5);p.setFont(F,'normal');p.setFontSize(8);tc(p,107,114,128);
  let ci=ML;for(const item of [pr.email,pr.address,pr.phone].filter(Boolean) as string[]){if(ci+p.getTextWidth(item)+10>PW-MR)break;p.text(item,ci,34);ci+=p.getTextWidth(item)+10;}
  reset(p);
  const RCX=PW-MR-52;const RCW=52;const MCW=RCX-ML-6;let y=38;
  const np=()=>{p.addPage();reset(p);fill(p,ar,ag,ab);p.rect(0,0,PW,5,'F');reset(p);return MT+7;};const GXW=():[ number,number]=>[ML,MCW];
  if(pr.bio){y=sectionHeading(p,'Profile',ML,y,MCW,accent,'italic-underline',BOTTOM,np,GXW);p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);y=wrapped(p,pr.bio,ML,y,MCW,BOTTOM,np,GXW);y+=ITEM_GAP+2;}
  if(exp.length){y=sectionHeading(p,isEdu?'Teaching Experience':'Employment History',ML,y,MCW,accent,'italic-underline',BOTTOM,np,GXW);
    for(const e of exp){if(y+14>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(`${e.role||''}${e.school?`, ${e.school}`:''}`,ML,y);y+=LINE_H;
      p.setFont(F,'italic');p.setFontSize(8);tc(p,156,163,175);p.text([e.from,e.to].filter(Boolean).join(' — '),ML,y);y+=LINE_H;
      if(e.description){p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,ML,y,MCW,accent,BOTTOM,np,GXW);}y+=ITEM_GAP+1;}}
  if(edu.length){y=sectionHeading(p,'Education',ML,y,MCW,accent,'italic-underline',BOTTOM,np,GXW);
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'bold');p.setFontSize(10);tc(p,17,24,39);p.text(e.qualification||'',ML,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),ML,y);y+=LINE_H+ITEM_GAP;}}
  y=drawCustom(p,customs,accent,'italic-underline',ML,y,MCW,BOTTOM,np,GXW);
  // Right skill bars
  let rcy=38;const allSk=[...(sk.subjects||[]),...(sk.soft_skills||[])];
  if(allSk.length){p.setFont(F,'bolditalic');p.setFontSize(10);tc(p,ar,ag,ab);p.text('Skills',RCX,rcy);hLine(p,RCX,rcy+2,RCW,ar,ag,ab,0.5);rcy+=8;
    for(const s of allSk.slice(0,10)){if(rcy>=BOTTOM-10)break;p.setFont(F,'normal');p.setFontSize(8);tc(p,55,65,81);p.text(s,RCX,rcy);rcy+=3.8;progressBar(p,RCX,rcy,RCW,0.75,accent);rcy+=5;}rcy+=4;}
  if(sk.languages?.length){p.setFont(F,'bolditalic');p.setFontSize(10);tc(p,ar,ag,ab);p.text('Languages',RCX,rcy);hLine(p,RCX,rcy+2,RCW,ar,ag,ab,0.5);rcy+=8;for(const l of sk.languages){if(rcy>=BOTTOM-6)break;p.setFont(F,'normal');p.setFontSize(8);tc(p,55,65,81);p.text(l,RCX,rcy);rcy+=4;}}
  refsPage(p,refs,accent,'italic-underline',np,BOTTOM,owner,wm);
}

// ── 17. SAGE — Soft green card header, bulleted skills list ───────────────────
function drawSage(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent=hex('#7fa37f');const SAGE_BG:RGB=[232,240,232];const [ar,ag,ab]=accent;
  const STRIP_H = 8; // height of the sage-green top strip on page 2+

  // Helper: paints the sage-green top strip on continuation pages so every
  // page from page 2 onward carries the same header shade as page 1.
  const paintStrip = () => {
    fill(p,SAGE_BG[0],SAGE_BG[1],SAGE_BG[2]);
    p.rect(0, 0, PW, STRIP_H, 'F');
    reset(p);
  };

  // ── Calculate header height dynamically so the shaded card always
  // contains all content without overflowing the bottom border.
  // Rows: name + job title (optional) + divider line + contact line.
  const HEADER_PAD_TOP    = 4;   // space from card top to name baseline
  const HEADER_NAME_H     = 9;   // name row (16 pt bold)
  const HEADER_JOBTITLE_H = 6;   // job-title row (9.5 pt) — always reserved
  const HEADER_DIVIDER_H  = 5;   // gap from last text row to divider line
  const HEADER_CONTACT_H  = 7;   // gap from divider to contact baseline
  const HEADER_PAD_BOTTOM = 5;   // breathing room below contact
  const headerCardH = HEADER_PAD_TOP + HEADER_NAME_H + HEADER_JOBTITLE_H
                    + HEADER_DIVIDER_H + HEADER_CONTACT_H + HEADER_PAD_BOTTOM;

  fill(p,SAGE_BG[0],SAGE_BG[1],SAGE_BG[2]);
  p.roundedRect(ML-2, MT-4, PW-ML-MR+4, headerCardH, 3, 3, 'F');

  // Name
  const nameY = MT + HEADER_PAD_TOP + HEADER_NAME_H - 4;
  tc(p,26,46,26); p.setFont(F,'bold'); p.setFontSize(16);
  p.text(owner, ML+2, nameY);

  // Job title / profession (most recent role, or fallback to isEdu label)
  const jobTitle = (exp[0]?.role || (isEdu ? 'Educator' : 'Professional')).trim();
  const jobTitleY = nameY + HEADER_JOBTITLE_H;
  p.setFont(F,'normal'); p.setFontSize(9.5); tc(p,75,108,75);
  p.text(jobTitle, ML+2, jobTitleY);

  // Divider line below the job title
  const dividerY = jobTitleY + HEADER_DIVIDER_H - 1;
  hLine(p, ML, dividerY, PW-ML-MR, ar, ag, ab, 0.6);

  // Contact line — fully inside the card, below the divider
  const contactY = dividerY + HEADER_CONTACT_H;
  const contactStr = [pr.address, pr.phone, pr.email].filter(Boolean).join('   ·   ');
  p.setFont(F,'normal'); p.setFontSize(8); tc(p,55,80,55);
  p.text(contactStr, ML+2, contactY);

  reset(p);
  // Body starts below the card with extra gap so the summary is clearly
  // visually separated from the header area.
  let y = MT - 4 + headerCardH + 10;
  const np=()=>{p.addPage();reset(p);paintStrip();return MT+STRIP_H+4;};
  const GXW=():[ number,number]=>[ML,PW-ML-MR];

  // Professional summary — rendered as a proper named section so it is
  // clearly separated from the header rather than floating immediately below it.
  if(pr.bio){
    y=sectionHeading(p,'Professional Summary',ML,y,PW-ML-MR,accent,'tag-underline',BOTTOM,np,GXW);
    p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);
    y=wrapped(p,pr.bio,ML,y,PW-ML-MR,BOTTOM,np,GXW);
    y+=ITEM_GAP+2;
  }

  if(exp.length){y=sectionHeading(p,isEdu?'Teaching Experience':'Career Experience',ML,y,PW-ML-MR,accent,'tag-underline',BOTTOM,np,GXW);
    for(const e of exp){if(y+14>BOTTOM)y=np();p.setFont(F,'normal');p.setFontSize(11);tc(p,ar,ag,ab);p.text(`${e.role||''}${e.school?`, ${e.school}`:''}`,ML,y);const ds=[e.from,e.to].filter(Boolean).join(' — ');if(ds){tc(p,156,163,175);p.setFont(F,'normal');p.setFontSize(8);p.text(ds,PW-MR-p.getTextWidth(ds),y);}y+=LINE_H;
      if(e.description){p.setFont(F,'normal');p.setFontSize(9);tc(p,55,65,81);for(const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))y=bulletLine(p,l,ML,y,PW-ML-MR,accent,BOTTOM,np,GXW);}y+=ITEM_GAP+1;}}

  if(edu.length){y=sectionHeading(p,'Education',ML,y,PW-ML-MR,accent,'tag-underline',BOTTOM,np,GXW);
    for(const e of edu){if(y+12>BOTTOM)y=np();p.setFont(F,'normal');p.setFontSize(11);tc(p,ar,ag,ab);p.text(e.qualification||'',ML,y);y+=LINE_H;p.setFont(F,'normal');p.setFontSize(8.5);tc(p,107,114,128);p.text([e.institution,e.year].filter(Boolean).join('  ·  '),ML,y);y+=LINE_H+ITEM_GAP;}}

  // ── Skills — grouped by category with a bold label per group ─────────────
  const sageSkillGroups = ([
    ['Key Skills',          sk.subjects    || []],
    ['Professional Skills', sk.soft_skills || []],
    ['Languages',           sk.languages   || []],
  ] as [string, string[]][]).filter(([, items]) => items.length);

  if (sageSkillGroups.length) {
    y = sectionHeading(p,'Skills & Languages',ML,y,PW-ML-MR,accent,'tag-underline',BOTTOM,np,GXW);
    for (let g=0; g<sageSkillGroups.length; g++) {
      const [label, items] = sageSkillGroups[g];
      if (y+LINE_H > BOTTOM) y = np();
      p.setFont(F,'bold'); p.setFontSize(9); tc(p,ar,ag,ab);
      p.text(label, ML, y);
      y += LINE_H;
      p.setFont(F,'normal'); p.setFontSize(9); tc(p,55,65,81);
      for (const s of items) y = bulletLine(p, s, ML, y, PW-ML-MR, accent, BOTTOM, np, GXW);
      y += ITEM_GAP + (g < sageSkillGroups.length-1 ? 1 : 0);
    }
    y += 1;
  }

  y=drawCustom(p,customs,accent,'tag-underline',ML,y,PW-ML-MR,BOTTOM,np,GXW);

  // ── References page — uses SAGE_BG strip so it matches the header shade ──
  // Pass SAGE_BG as the `bg` tint BUT we only want a top strip, not a full
  // page fill. We do this by calling refsPage with topStrip=false and
  // manually painting the strip on each refs page via a wrapper np.
  const validRefs = refs.filter((r:any)=>r.name);
  if (validRefs.length) {
    p.addPage(); reset(p); paintStrip();
    let ry = MT + STRIP_H + 4;
    const rnp = ()=>{ p.addPage(); reset(p); paintStrip(); return MT+STRIP_H+4; };
    ry = sectionHeading(p,'References',ML,ry,PW-ML-MR,accent,'tag-underline',BOTTOM,rnp,undefined,ICON.user);
    ry += 2;
    const half = (PW-ML-MR-8)/2;
    for (let i=0; i<validRefs.length; i+=2) {
      const drawRef = (ref:any, rx:number, startY:number): number => {
        let cy = startY;
        dot(p, rx, cy-0.8, accent, 1.6);
        p.setFont(F,'bold'); p.setFontSize(9.5); tc(p,17,24,39);
        p.text(ref.name, rx+3, cy); cy += LINE_H;
        if (ref.title)        { p.setFont(F,'normal'); p.setFontSize(9);   tc(p,ar,ag,ab);       p.text(ref.title,        rx+3, cy); cy+=LINE_H; }
        if (ref.organisation) { p.setFont(F,'normal'); p.setFontSize(8.5); tc(p,107,114,128);    p.text(ref.organisation, rx+3, cy); cy+=LINE_H; }
        if (ref.relationship) { p.setFont(F,'italic'); p.setFontSize(8);   tc(p,156,163,175);    p.text(ref.relationship, rx+3, cy); cy+=LINE_H; }
        if (ref.phone||ref.email) { p.setFont(F,'normal'); p.setFontSize(8); tc(p,107,114,128);  p.text([ref.phone,ref.email].filter(Boolean).join('  |  '), rx+3, cy); cy+=LINE_H; }
        return cy;
      };
      const ly  = drawRef(validRefs[i],     ML,           ry);
      const ry2 = validRefs[i+1] ? drawRef(validRefs[i+1], ML+half+8, ry) : ry;
      ry = Math.max(ly,ry2)+2;
      hLine(p, ML, ry, PW-ML-MR, 229,231,235, 0.2);
      ry += 5;
    }
  }
}

// ── 18. ELEGANT — Centered serif layout on soft lavender background ─────────
// Mirrors ElegantTemplate in CVTemplateRenderer.tsx: full-page light-blue
// background, centered header (name / role / contact), and section headings
// flanked by horizontal divider lines extending to the page margins.
function drawElegant(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent = hex('#475569');           // slate-600 — footer line, bullets
  const BG     = hex('#EAF0FB');           // page background
  const INK    = hex('#1e293b');           // slate-800 — name, headings
  const MUTED  = hex('#64748b');           // slate-500 — meta info, dates
  const BODY   = hex('#374151');           // slate-700 — body text
  const LINE   = [203,213,225] as RGB;     // slate-300 — divider lines

  const paintBg = () => { fill(p,BG[0],BG[1],BG[2]); p.rect(0,0,PW,PH,'F'); };
  paintBg();

  let y = MT + 6;
  const np = () => { p.addPage(); paintBg(); return MT + 6; };
  const GXW = ():[number,number] => [ML, PW-ML-MR];

  // ── Header: centered name / subtitle / contact ────────────────────────────
  p.setFont('times','bold'); p.setFontSize(20); tc(p,INK[0],INK[1],INK[2]);
  const name = owner.toUpperCase();
  let tw = p.getTextWidth(name);
  p.text(name, (PW-tw)/2, y);
  y += 7;

  // Subtitle = most recent role (users can type "Role A / Role B")
  const subtitle = (exp[0]?.role || '').toUpperCase();
  if (subtitle) {
    p.setFont('times','normal'); p.setFontSize(9); tc(p,MUTED[0],MUTED[1],MUTED[2]);
    tw = p.getTextWidth(subtitle);
    p.text(subtitle, (PW-tw)/2, y);
    y += 5.5;
  }

  const contact = [pr.address, pr.phone, pr.email, pr.id_number?`ID: ${pr.id_number}`:null].filter(Boolean).join('   |   ');
  if (contact) {
    p.setFont('times','normal'); p.setFontSize(8.5); tc(p,MUTED[0],MUTED[1],MUTED[2]);
    tw = p.getTextWidth(contact);
    p.text(contact, (PW-tw)/2, y);
    y += 6;
  }

  // ── Professional summary ──────────────────────────────────────────────────
  if (pr.bio) {
    y = sectionHeading(p,'Professional summary',ML,y,PW-ML-MR,accent,'center-lines',BOTTOM,np,GXW);
    p.setFont('times','normal'); p.setFontSize(9.5); tc(p,BODY[0],BODY[1],BODY[2]);
    y = wrapped(p,pr.bio,ML,y,PW-ML-MR,BOTTOM,np,GXW);
    y += ITEM_GAP;
  }

  // ── Work experience ───────────────────────────────────────────────────────
  if (exp.length) {
    y = sectionHeading(p,isEdu?'Teaching Experience':'Work Experience',ML,y,PW-ML-MR,accent,'center-lines',BOTTOM,np,GXW);
    for (const e of exp) {
      if (y+14>BOTTOM) y = np();
      p.setFont('times','bold'); p.setFontSize(10.5); tc(p,INK[0],INK[1],INK[2]);
      p.text(e.role||'', ML, y);
      const ds=[e.from,e.to].filter(Boolean).join(' – ');
      if (ds) { p.setFont('times','normal'); p.setFontSize(8.5); tc(p,MUTED[0],MUTED[1],MUTED[2]); p.text(ds, PW-MR-p.getTextWidth(ds), y); }
      y += LINE_H;
      if (e.school) {
        p.setFont('times','normal'); p.setFontSize(9); tc(p,MUTED[0],MUTED[1],MUTED[2]);
        p.text(e.school, ML, y); y += LINE_H;
      }
      if (e.description) for (const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))
        y = bulletLine(p,l,ML,y,PW-MR-ML,accent,BOTTOM,np,GXW);
      y += ITEM_GAP+1;
    }
  }

  // ── Education — centered "Qualification | Institution | Year" ────────────
  if (edu.length) {
    y = sectionHeading(p,'Education',ML,y,PW-ML-MR,accent,'center-lines',BOTTOM,np,GXW);
    const sep = '   |   ';
    p.setFont('times','normal'); p.setFontSize(8.5);
    const sepW = p.getTextWidth(sep);
    for (const e of edu) {
      if (y+LINE_H>BOTTOM) y = np();
      const parts: {t:string,bold:boolean}[] = [];
      if (e.qualification) parts.push({t:e.qualification,bold:true});
      if (e.institution)   parts.push({t:e.institution,bold:false});
      if (e.year)          parts.push({t:e.year,bold:false});
      let total = 0;
      const widths: number[] = parts.map((part,i)=>{
        p.setFont('times',part.bold?'bold':'normal'); p.setFontSize(9.5);
        const w = p.getTextWidth(part.t);
        total += w; if (i<parts.length-1) total += sepW;
        return w;
      });
      let cx = (PW-total)/2;
      parts.forEach((part,i)=>{
        p.setFont('times',part.bold?'bold':'normal'); p.setFontSize(9.5);
        if (part.bold) tc(p,INK[0],INK[1],INK[2]); else tc(p,MUTED[0],MUTED[1],MUTED[2]);
        p.text(part.t, cx, y);
        cx += widths[i];
        if (i<parts.length-1) { p.setFont('times','normal'); tc(p,LINE[0],LINE[1],LINE[2]); p.text(sep, cx, y); cx += sepW; }
      });
      y += LINE_H+1;
    }
    y += ITEM_GAP;
  }

  // ── Skills and Attributes — grouped by category, two-column "• item" ──────
  const elegantSkillGroups = ([
    ['Key Skills',          sk.subjects    || []],
    ['Professional Skills', sk.soft_skills || []],
    ['Languages',           sk.languages   || []],
  ] as [string, string[]][]).filter(([, items]) => items.length);

  if (elegantSkillGroups.length) {
    y = sectionHeading(p,'Skills and Attributes',ML,y,PW-ML-MR,accent,'center-lines',BOTTOM,np,GXW);
    const colGap = 8;
    const colW   = (PW-ML-MR-colGap)/2;
    const col2x  = ML+colW+colGap;

    for (let g=0; g<elegantSkillGroups.length; g++) {
      const [label, items] = elegantSkillGroups[g];
      if (y+LINE_H>BOTTOM) y = np();
      p.setFont('times','bolditalic'); p.setFontSize(9.5); tc(p,accent[0],accent[1],accent[2]);
      p.text(label, ML, y);
      y += LINE_H;

      p.setFont('times','normal'); p.setFontSize(9);
      let leftY = y, rightY = y;
      for (let i=0; i<items.length; i++) {
        const isLeft = i%2===0;
        const cx = isLeft ? ML : col2x;
        let cy = isLeft ? leftY : rightY;
        const lines = p.splitTextToSize(String(items[i]), colW-5) as string[];
        if (cy+lines.length*LINE_H>BOTTOM) { y = np(); leftY = y; rightY = y; cy = y; }
        tc(p,MUTED[0],MUTED[1],MUTED[2]); p.text('•', cx, cy);
        tc(p,BODY[0],BODY[1],BODY[2]);
        lines.forEach((line:string,li:number)=>p.text(line, cx+4, cy+li*LINE_H));
        const used = lines.length*LINE_H;
        if (isLeft) leftY = cy+used; else rightY = cy+used;
      }
      y = Math.max(leftY,rightY) + ITEM_GAP + (g < elegantSkillGroups.length-1 ? 1 : 0);
    }
  }

  y = drawCustom(p,customs,accent,'center-lines',ML,y,PW-ML-MR,BOTTOM,np,GXW,'times');

  // References page keeps the same lavender background
  refsPage(p,refs,accent,'center-lines',np,BOTTOM,owner,wm,BG);
}

// ── 19. HERITAGE — Formal centered layout, top contact bar, double rules ────
// Mirrors HeritageTemplate in CVTemplateRenderer.tsx: light lavender
// background, double horizontal rule + centered contact info at the very
// top, title-case name, italic role subtitle, and section headings in
// uppercase with a double rule beneath. Skills render as an inline
// "Name (description)" list with italicised descriptions.
function drawHeritage(p:any,pr:any,edu:any[],exp:any[],sk:any,refs:any[],customs:any[],wm:boolean,owner:string,isEdu:boolean=true) {
  const accent = hex('#334155');           // slate-700 — rules, footer
  const BG     = hex('#EAF0FB');           // page background
  const INK    = hex('#1e293b');           // slate-800 — name, headings
  const MUTED  = hex('#64748b');           // slate-500 — meta info, dates
  const BODY   = hex('#374151');           // slate-700 — body text
  const [acR,acG,acB] = accent;

  const paintBg = () => { fill(p,BG[0],BG[1],BG[2]); p.rect(0,0,PW,PH,'F'); };
  paintBg();

  let y = MT + 4;
  const np = () => { p.addPage(); paintBg(); return MT + 4; };
  const GXW = ():[number,number] => [ML, PW-ML-MR];

  // ── Top double rule + centered contact info ───────────────────────────────
  hLine(p, ML, y,     PW-ML-MR, acR,acG,acB, 0.35);
  hLine(p, ML, y+0.8, PW-ML-MR, acR,acG,acB, 0.35);
  y += 6;

  const contact = [pr.address, pr.email, pr.phone, pr.id_number?`ID: ${pr.id_number}`:null]
    .filter(Boolean).join('   •   ').toUpperCase();
  if (contact) {
    p.setFont('times','normal'); p.setFontSize(8); tc(p,MUTED[0],MUTED[1],MUTED[2]);
    y = centeredWrapped(p, contact, y, PW-ML-MR, BOTTOM, np);
    y += 3;
  }

  // ── Name (title case) + subtitle (most recent role, italic) ──────────────
  p.setFont('times','bold'); p.setFontSize(22); tc(p,INK[0],INK[1],INK[2]);
  let tw = p.getTextWidth(owner);
  p.text(owner, (PW-tw)/2, y);
  y += 7;

  const subtitle = exp[0]?.role || '';
  if (subtitle) {
    p.setFont('times','normal'); p.setFontSize(10); tc(p,MUTED[0],MUTED[1],MUTED[2]);
    tw = p.getTextWidth(subtitle);
    p.text(subtitle, (PW-tw)/2, y);
    y += 6;
  }

  // ── Professional summary ──────────────────────────────────────────────────
  if (pr.bio) {
    y = sectionHeading(p,'Professional summary',ML,y,PW-ML-MR,accent,'double-line',BOTTOM,np,GXW);
    p.setFont('times','normal'); p.setFontSize(9.5); tc(p,BODY[0],BODY[1],BODY[2]);
    y = wrapped(p,pr.bio,ML,y,PW-ML-MR,BOTTOM,np,GXW);
    y += ITEM_GAP;
  }

  // ── Work experience ───────────────────────────────────────────────────────
  if (exp.length) {
    y = sectionHeading(p,isEdu?'Teaching Experience':'Work Experience',ML,y,PW-ML-MR,accent,'double-line',BOTTOM,np,GXW);
    for (const e of exp) {
      if (y+14>BOTTOM) y = np();
      p.setFont('times','bold'); p.setFontSize(10); tc(p,INK[0],INK[1],INK[2]);
      p.text((e.role||'').toUpperCase(), ML, y);
      const ds=[e.from,e.to].filter(Boolean).join(' — ');
      if (ds) { p.setFont('times','bold'); p.setFontSize(9); tc(p,INK[0],INK[1],INK[2]); p.text(ds, PW-MR-p.getTextWidth(ds), y); }
      y += LINE_H;
      if (e.school) {
        p.setFont('times','normal'); p.setFontSize(9); tc(p,MUTED[0],MUTED[1],MUTED[2]);
        y = wrapped(p,e.school,ML,y,PW-ML-MR,BOTTOM,np,GXW);
      }
      if (e.description) for (const l of (e.description as string).split('\n').map((s:string)=>s.trim()).filter(Boolean))
        y = bulletLine(p,l,ML,y,PW-MR-ML,accent,BOTTOM,np,GXW);
      y += ITEM_GAP+1;
    }
  }

  // ── Education ──────────────────────────────────────────────────────────────
  if (edu.length) {
    y = sectionHeading(p,'Education',ML,y,PW-ML-MR,accent,'double-line',BOTTOM,np,GXW);
    for (const e of edu) {
      if (y+10>BOTTOM) y = np();
      p.setFont('times','bold'); p.setFontSize(10); tc(p,INK[0],INK[1],INK[2]);
      p.text((e.qualification||'').toUpperCase(), ML, y);
      if (e.year) { p.setFont('times','bold'); p.setFontSize(9); tc(p,INK[0],INK[1],INK[2]); p.text(e.year, PW-MR-p.getTextWidth(e.year), y); }
      y += LINE_H;
      if (e.institution) {
        p.setFont('times','normal'); p.setFontSize(9); tc(p,MUTED[0],MUTED[1],MUTED[2]);
        y = wrapped(p,e.institution,ML,y,PW-ML-MR,BOTTOM,np,GXW);
      }
      y += ITEM_GAP;
    }
  }

  // ── Skills and Attributes — grouped inline lists, no italics ─────────────
  const heritageSkillGroups = ([
    ['Key Skills',          sk.subjects    || []],
    ['Professional Skills', sk.soft_skills || []],
    ['Languages',           sk.languages   || []],
  ] as [string, string[]][]).filter(([, items]) => items.length);

  if (heritageSkillGroups.length) {
    y = sectionHeading(p,'Skills and Attributes',ML,y,PW-ML-MR,accent,'double-line',BOTTOM,np,GXW);
    for (let g=0; g<heritageSkillGroups.length; g++) {
      const [label, items] = heritageSkillGroups[g];
      if (y+LINE_H>BOTTOM) y = np();
      p.setFont('times','bold'); p.setFontSize(9); tc(p,accent[0],accent[1],accent[2]);
      p.text(label.toUpperCase(), ML, y);
      y += LINE_H;

      const segs: RichSeg[] = [];
      items.forEach((raw, i) => {
        const [name, desc] = String(raw).split('|').map((s:string)=>s.trim());
        if (desc) {
          segs.push({text: `${name} (`, style:'normal'});
          segs.push({text: `${desc})`, style:'normal', color: MUTED});
        } else {
          segs.push({text: name, style:'normal'});
        }
        segs.push({text: i<items.length-1 ? ', ' : '.', style:'normal'});
      });
      y = richInline(p, segs, ML, y, PW-ML-MR, BOTTOM, np, GXW, 'times', 9, [55,65,81], [100,116,139]);
      y += ITEM_GAP + (g < heritageSkillGroups.length-1 ? 1 : 0);
    }
  }

  y = drawCustom(p,customs,accent,'double-line',ML,y,PW-ML-MR,BOTTOM,np,GXW,'times');

  // References page keeps the same lavender background
  refsPage(p,refs,accent,'double-line',np,BOTTOM,owner,wm,BG);
}