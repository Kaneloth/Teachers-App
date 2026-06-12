/**
 * CV PDF Export — jsPDF direct drawing
 * Mobile-safe: no spread operators on colour methods, no rgba strings,
 * explicit RGB values everywhere, try/catch with print fallback.
 */

import type { jsPDF as JsPDFType } from 'jspdf';
import { jsPDF as JsPDFClass } from 'jspdf';

const PW       = 210;
const PH       = 297;
const ML       = 15;
const MR       = 15;
const MT       = 14;
const FOOTER_H = 10;
const BOTTOM   = PH - FOOTER_H - 4;
const SIDEBAR_W = 34;
const F        = 'helvetica';
const LINE_H   = 5.2;
const SECTION_GAP  = 7;
const HEADING_GAP  = 5;
const ITEM_GAP     = 2.5;
const BULLET_INDENT = 4.5;

// ── Embedded SVG-style PNG icons (20x20) ────────────────────────────────
// Dark versions for light backgrounds, white versions for coloured sidebars/headers
const ICONS_DARK:  Record<string, string> = {
  briefcase: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAASUlEQVR4nGNgGAWUAkZcEhoaGv/xabxx4wZWvUyUuojmBsKdTciLhAAsCKjuQhZcNhEL0H1GexdSGpaD38uD30CqRwrVXTj4AQBPFBMRhDyysQAAAABJRU5ErkJggg==',
  graduation: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAi0lEQVR4nO2Tyw3AMAhDSdVhvP803iY9RYoSPk7OtdQDKjwMpWa/IgHoSl67AZEM654bV5lbt5M6ntnudnN4AvPyW/TiRiTbMwfjOYXM8ZslZa6jxi7QKxrwaoL0bBStU0hA9R4B9BIIoHujRyr/lHVnJFsGlXfonZQXp19ZbXRU4C0+y5foM6Ry9AFeGVGYLZ+xlQAAAABJRU5ErkJggg==',
  user: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAa0lEQVR4nOWS0QkAIAhErWncfxq3qa8gKs+UgqD7FO+ldkSvK1kNzFzGmoiovuyFobo5GQK6oDsGrQeuHNFxoKroDWFs0B216CyLnh8cwROwh6EAb/W584U8EdjKezw2qb1AhG9m6dqEH6oCjVQ5wVlaYa4AAAAASUVORK5CYII=',
  mail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAdElEQVR4nO2TSxLAIAhDQ6eH4f6nyW105YyDBWl14aJZInkSP8Cvr1LVAgBiC6u6dkCaSMo9a/DWvETDhD3EM/V1u+ljZA+qqiWCAYAbmaQ0s500OorwUkiKNUewKdBCZrA0MAt7BczqfODwbFb/9PYJz1cFb4ozvUKsP0wAAAAASUVORK5CYII=',
  phone: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAV0lEQVR4nGNgoDJgxCepoaHxH5fcjRs3sOplIscwYuQxFBNjIDY1OF1ILhg1cNTAUQOpaiCxhQFRBsIMI8ZQogyElX24ykBkgFMBMa7BZgFOFxJyDS55AD8+H3Y8FDK0AAAAAElFTkSuQmCC',
  mapPin: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAiElEQVR4nMWTUQ7AIAhDdafh/qfhNu7LhDBawCxbE39kfZOKY7ysmX0gIsvvqSr0wUIEqoBDoIVFJla/KicQkbUX+gkEepNvPavTE6IcWb4UeKIH0LaCslLVifJMW/YGC4v0zRxm4NbYZDC2T4FZy6hOn1VVNgI4NiewENiB/n/LkbkbCVT1sm7ld2MMcbuIkwAAAABJRU5ErkJggg==',
  award: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAcElEQVR4nMWUUQ7AIAxCO0/D/U/T27g/05iVUeMmvxh8EqLZKQHoyrm2+2IpUKWTAyvB1ypJlLuPnJYZK2FmE2HUG212edoho2Xef7NhT2bedsLHLiLB3BfzUil7XN1sWRSZUZR3+LkAdKW3M/9hRTdRUitu4McK1gAAAABJRU5ErkJggg==',
  bookOpen: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAQUlEQVR4nGNgGOyAEcbQ0ND4T6lhN27cYGSi1BB0wILNFmwKYT7AJo/sO6q7kOphOPi9PGrgqIGDwcDBX3xRHQAAB7ocJH2J0NIAAAAASUVORK5CYII=',
  languages: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAi0lEQVR4nNWUyxGAMAhESaqh/2rSTTzhrMgnaDzIcWGfQAaJNkfLCph5am2M4frchAVaAd8EDbJMUU2vwiwdff1eHsOyfLM6exPnVxCadYehfR3FCghDfMw83R0+je07JAEKtApH349GFmh1bD0uEVwKPn21EfS7O8zAXv4CjI4+0tH3/f9wBRyd6AFIBF4TPLxMwQAAAABJRU5ErkJggg==',
};
const ICONS_WHITE: Record<string, string> = {
  briefcase: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAASUlEQVR4nGNgGAWUAkZcEv////+PVyMjI1a9TJS6iOYGwp1NyIsEDYIGAdVdyILLJmIBus9o70JKw3Lwe3nwG0j1SKG6Cwc/AABSBxgbXOAFaQAAAABJRU5ErkJggg==',
  graduation: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAgUlEQVR4nO2TSw4AIQhDqZn7X7mzMjFafq7tjgw8CjJmT55IspKHGxAAt27cuIrcyk7V8cxOt4fDDkzlw/twIwAYazDVhazxFyWFy3caS6AqmvBsgvBsKtqnKAGr90iSKZAk1eie0j9l3xkARNDyDtVJqTh85WqjVoFafNigC80c/cfxVB1+/56PAAAAAElFTkSuQmCC',
  user: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAZklEQVR4nOWSSwoAIAhEtfvf2VZBZI4fCoJmKc5LbYheF3sNIiLKxGz6WhaG6u5kCJiCRgxWD1y5ouNAU9UbwtigO1rR2RYzP7iCFXCGoQCH+tL5Qp4KbOc9HhseLxDhm3m6NuGH6gmtc7TjVEeEAAAAAElFTkSuQmCC',
  mail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAbUlEQVR4nO2TOxLAIAhEdzO5/5VJozMOZgWjhUVeifAEP8DPV8zMAIA+sMq1Q1IhyTtKUGtqoq7DVqKK2rjf9HVkJbWCkgGAHJkka7HvdHQUw0thISsLhV4SydLCrGxKmOV8YfdsVv/09g7P5wFoziwu31U3CgAAAABJRU5ErkJggg==',
  phone: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAU0lEQVR4nO2UMQ4AMAgCtf//s51M2lQqMY6ygicTIs3Sn2lmBg9Vw9tVgTH+E2aAUQY2rGqAAxxgK5AdAwroMAZKAX370AZe2awV8+gUbJi1Qf4GuVAsD6jiUSwAAAAASUVORK5CYII=',
  mapPin: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAg0lEQVR4nMWTUQ7AMAhCy+5/Z/drLKBtlozPWZ5Ku7U+FroDERGbCZA+WWCgCZgCM4yZXP2ZTBBJqokEVlNdvavbCVWOLl8LvNEGzKuorABA5dmuXA0ZRps5mGvGprNABz56Nh3MfbfAbmVVt7/VVDkC+WxuYBR4Av3/lpn5NBKp6WW9KZloFt3MvnUAAAAASUVORK5CYII=',
  award: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAbUlEQVR4nMWUUQ7AIAhDwfvfuftZFmdGLURnf0vKkzSanRIAKHNt9WIpUKWTAzPBXiV5hbg/OS0yKmFmA2GvGW20PLwho2Xef7VhT2becsLPW/QE472YF0rpY7WzaVFkRpHu4Xbh1mzuzH+Y0QV7+TgHemsWlQAAAABJRU5ErkJggg==',
  bookOpen: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAQElEQVR4nGNgGOyAEcb4////f4oNY2RkZKLUEHTAgs0WbAphPsAmj+w7qruQ6mE4+L08auCogYPBwMFffFEdAAAsDRwk1pEW0gAAAABJRU5ErkJggg==',
  languages: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAiElEQVR4nNWUSRLAIAgE0f//eXKJ1qgskphDOALTLBaKHLYSJQDAIirF1JkBDbQDXhwzSBN5OTUL0/ysq2u6DwuLaZ29sV6FoVF3bLOusjMDGrq6dQBg7vCpHd+hNGCDZuGs+9HIDZodex5XhC6Fnz7bCOvNHUZgKz4AvaP3/Kz7/j/cAXsnegG8noPebkjsUAAAAABJRU5ErkJggg==',
};

function icon(p: JsPDFType, name: string, x: number, y: number, size: number, white = false) {
  const data = (white ? ICONS_WHITE : ICONS_DARK)[name];
  if (!data) return;
  try { p.addImage(data, 'PNG', x, y, size, size); } catch(_) {}
}

interface Palette {
  sidebar: boolean;
  hbR: number; hbG: number; hbB: number;   // headerBg RGB
  htR: number; htG: number; htB: number;   // headerText RGB
  aR:  number; aG:  number; aB:  number;   // accent RGB
  sbR: number; sbG: number; sbB: number;   // sidebarBg RGB (same as header for sidebar templates)
}

function getPalette(t: string): Palette {
  switch (t) {
    // ── Original 8 templates ──────────────────────────────────────────────
    case 'modern':       return { sidebar: true,  layout:'sidebar',   hbR:13,  hbG:148, hbB:136, htR:255,htG:255,htB:255, aR:13,  aG:148, aB:136, sbR:13,  sbG:148, sbB:136, accentDim:'#0f766e' };
    case 'sidebar':      return { sidebar: true,  layout:'sidebar',   hbR:59,  hbG:89,  hbB:152, htR:255,htG:255,htB:255, aR:59,  aG:89,  aB:152, sbR:59,  sbG:89,  sbB:152, accentDim:'#2d4373' };
    case 'corporate':    return { sidebar: true,  layout:'sidebar',   hbR:26,  hbG:42,  hbB:74,  htR:255,htG:255,htB:255, aR:26,  aG:42,  aB:74,  sbR:26,  sbG:42,  sbB:74,  accentDim:'#243a6b' };
    case 'professional': return { sidebar: false, layout:'banner',    hbR:30,  hbG:77,  hbB:43,  htR:255,htG:255,htB:255, aR:30,  aG:77,  aB:43,  sbR:30,  sbG:77,  sbB:43,  accentDim:'#2d7a47' };
    case 'minimal':      return { sidebar: false, layout:'minimal',   hbR:249, hbG:250, hbB:251, htR:17, htG:24, htB:39,  aR:17,  aG:24,  aB:39,  sbR:249, sbG:250, sbB:251, accentDim:'#374151' };
    case 'bold':         return { sidebar: false, layout:'banner',    hbR:194, hbG:24,  hbB:91,  htR:255,htG:255,htB:255, aR:194, aG:24,  aB:91,  sbR:194, sbG:24,  sbB:91,  accentDim:'#ad1457' };
    case 'executive':    return { sidebar: false, layout:'banner',    hbR:107, hbG:26,  hbB:26,  htR:255,htG:255,htB:255, aR:107, aG:26,  aB:26,  sbR:107, sbG:26,  sbB:26,  accentDim:'#8b2424' };
    // ── New 9 templates ───────────────────────────────────────────────────
    case 'stylish':      return { sidebar: false, layout:'two-col',   hbR:224, hbG:92,  hbB:107, htR:255,htG:255,htB:255, aR:224, aG:92,  aB:107, sbR:224, sbG:92,  sbB:107, accentDim:'#c0384a' };
    case 'boxed':        return { sidebar: false, layout:'boxed',     hbR:55,  hbG:65,  hbB:81,  htR:255,htG:255,htB:255, aR:55,  aG:65,  aB:81,  sbR:55,  sbG:65,  sbB:81,  accentDim:'#374151' };
    case 'traditional':  return { sidebar: false, layout:'left-date', hbR:249, hbG:250, hbB:251, htR:17, htG:24, htB:39,  aR:55,  aG:65,  aB:81,  sbR:249, sbG:250, sbB:251, accentDim:'#374151' };
    case 'navy':         return { sidebar: false, layout:'right-sidebar', hbR:26,  hbG:42,  hbB:74,  htR:255,htG:255,htB:255, aR:26,  aG:42,  aB:74,  sbR:26,  sbG:42,  sbB:74,  accentDim:'#243a6b' };
    case 'timeline':     return { sidebar: false, layout:'timeline',   hbR:55,  hbG:65,  hbB:81,  htR:255,htG:255,htB:255, aR:55,  aG:65,  aB:81,  sbR:55,  sbG:65,  sbB:81,  accentDim:'#4b5563' };
    case 'shaded':       return { sidebar: false, layout:'shaded',   hbR:243, hbG:244, hbB:246, htR:55, htG:65, htB:81,  aR:55,  aG:65,  aB:81,  sbR:243, sbG:244, sbB:246, accentDim:'#6b7280' };
    case 'teal':         return { sidebar: false, layout:'two-col',   hbR:6,   hbG:182, hbB:212, htR:17, htG:24, htB:39,  aR:6,   aG:182, aB:212, sbR:6,   sbG:182, sbB:212, accentDim:'#0891b2' };
    case 'crimson':      return { sidebar: false, layout:'banner',    hbR:192, hbG:57,  hbB:43,  htR:255,htG:255,htB:255, aR:192, aG:57,  aB:43,  sbR:192, sbG:57,  sbB:43,  accentDim:'#b91c1c' };
    case 'sage':         return { sidebar: false, layout:'sage',   hbR:232, hbG:240, hbB:232, htR:55, htG:65, htB:81,  aR:127, aG:163, aB:127, sbR:232, sbG:240, sbB:232, accentDim:'#4d7a4d' };
    // ── Default (classic) ─────────────────────────────────────────────────
    default:             return { sidebar: false, layout:'banner',    hbR:30,  hbG:42,  hbB:58,  htR:255,htG:255,htB:255, aR:30,  aG:42,  aB:58,  sbR:30,  sbG:42,  sbB:58,  accentDim:'#2d3f52' };
  }
}

// ── Safe colour setters (explicit RGB, no spread, no hex strings) ─────────
function fill(p: JsPDFType, r: number, g: number, b: number) { p.setFillColor(r, g, b); }
function text(p: JsPDFType, r: number, g: number, b: number) { p.setTextColor(r, g, b); }
function draw(p: JsPDFType, r: number, g: number, b: number) { p.setDrawColor(r, g, b); }
function reset(p: JsPDFType) { p.setFillColor(255,255,255); p.setDrawColor(0,0,0); p.setTextColor(0,0,0); }

// ── Drawing primitives ────────────────────────────────────────────────────
function dot(p: JsPDFType, x: number, y: number, aR: number, aG: number, aB: number, size = 1.1) {
  fill(p, aR, aG, aB);
  p.rect(x, y - size + 0.2, size, size, 'F');
}

function hLine(p: JsPDFType, x: number, y: number, w: number, r: number, g: number, b: number, lw = 0.3) {
  draw(p, r, g, b);
  p.setLineWidth(lw);
  p.line(x, y, x + w, y);
}

// ── Section heading: [accent rect] TITLE ──────────────────────────────────
function sectionHeading(
  p: JsPDFType, title: string, x: number, y: number, maxW: number,
  aR: number, aG: number, aB: number,
  bottom: number, newPage: () => number, getLayout?: () => { cx: number; cmw: number },
  iconName?: string,
  layout = 'banner',
): number {
  if (y + 28 > bottom) { y = newPage(); if (getLayout) { x = getLayout().cx; maxW = getLayout().cmw; } }
  y += SECTION_GAP * 0.6;
  if (layout === 'shaded') {
    // Grey filled bar — distinctive shaded template style
    fill(p, 243, 244, 246); p.rect(x - 2, y - 4, maxW + 4, 7, 'F');
    text(p, 55, 65, 81); p.setFont(F, 'bold'); p.setFontSize(9);
    p.text(title.toUpperCase(), x + 2, y);
  } else if (layout === 'timeline') {
    // Diamond bullet + title — timeline style
    text(p, aR, aG, aB); p.setFont(F, 'bold'); p.setFontSize(9);
    p.text('◆ ' + title.toUpperCase(), x, y);
    const tw = p.getTextWidth('◆ ' + title.toUpperCase());
    hLine(p, x + tw + 2, y - 1.5, maxW - tw - 2, 209, 213, 219, 0.4);
  } else if (layout === 'sage') {
    // Green accent line under title
    text(p, aR, aG, aB); p.setFont(F, 'bold'); p.setFontSize(11);
    p.text(title, x, y);
    hLine(p, x, y + 2, maxW, aR, aG, aB, 0.5);
  } else if (iconName) {
    const iconSize = 3.8;
    icon(p, iconName, x, y - 3.2, iconSize);
    const textStartX = x + iconSize + 1.5;
    text(p, aR, aG, aB); p.setFont(F, 'bold'); p.setFontSize(9);
    p.text(title.toUpperCase(), textStartX, y);
    const tw = p.getTextWidth(title.toUpperCase());
    hLine(p, textStartX + tw + 2, y - 1.5, maxW - (textStartX - x) - tw - 2, aR, aG, aB, 0.35);
  } else {
    fill(p, aR, aG, aB); p.rect(x, y - 3.2, 2.5, 3.8, 'F');
    text(p, aR, aG, aB); p.setFont(F, 'bold'); p.setFontSize(9);
    p.text(title.toUpperCase(), x + 4, y);
    const tw = p.getTextWidth(title.toUpperCase());
    hLine(p, x + 4 + tw + 2, y - 1.5, maxW - 4 - tw - 2, aR, aG, aB, 0.35);
  }
  return y + HEADING_GAP;
}

// ── Justified wrapped text ─────────────────────────────────────────────────
function justifyRow(p: JsPDFType, line: string, x: number, y: number, maxW: number, isLast: boolean) {
  const words = line.trim().split(' ').filter(w => w.length > 0);
  if (isLast || words.length <= 1) { p.text(line, x, y); return; }
  const totalW = words.reduce((s, w) => s + p.getTextWidth(w), 0);
  const gap    = words.length > 1 ? (maxW - totalW) / (words.length - 1) : 0;
  let wx = x;
  for (const w of words) { p.text(w, wx, y); wx += p.getTextWidth(w) + gap; }
}

function wrappedText(
  p: JsPDFType, t: string, x: number, y: number, maxW: number,
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
  p: JsPDFType, t: string, x: number, y: number, maxW: number,
  aR: number, aG: number, aB: number,
  bottom: number, newPage: () => number, getLayout?: () => { cx: number; cmw: number },
): number {
  const bw    = maxW - BULLET_INDENT;
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

// ── Sidebar label ─────────────────────────────────────────────────────────
function sidebarLabel(p: JsPDFType, t: string, x: number, y: number, maxW: number): number {
  p.setFont(F, 'bold'); p.setFontSize(7);
  p.setTextColor(200, 230, 225);
  p.text(t.toUpperCase(), x, y);
  p.setLineWidth(0.2); p.setDrawColor(180, 220, 215);
  p.line(x, y + 1, x + maxW, y + 1);
  return y + 4;
}

// ── Footer ────────────────────────────────────────────────────────────────
function drawFooter(p: JsPDFType, name: string, pg: number, total: number, aR: number, aG: number, aB: number) {
  hLine(p, ML, PH - FOOTER_H, PW - ML - MR, 229, 231, 235, 0.25);
  p.setFont(F, 'italic'); p.setFontSize(7); text(p, 156, 163, 175);
  p.text(`Resume of ${name}`, ML, PH - 5);
  const ps = `Page ${pg} of ${total}`;
  p.text(ps, PW - MR - p.getTextWidth(ps), PH - 5);
}

// ── Main export ───────────────────────────────────────────────────────────
export async function exportElementAsPDF(
  _container: HTMLElement, filename: string, cvData?: Record<string, unknown>,
): Promise<Blob> {
  const jsPDF = JsPDFClass;
  if (!cvData) throw new Error('cvData required');


  const data    = cvData as any;
  const pr      = data.personal       || {};
  const edu     = (data.education     || []).filter((e: any) => e.institution);
  const exp     = (data.experience    || []).filter((e: any) => e.school);
  const sk      = data.skills         || {};
  const refs    = (data.references    || []).filter((r: any) => r.name);
  const customs = (data.custom_sections || []).filter((s: any) => s.title);
  const pal     = getPalette(data.template || 'classic');
  const isSB = pal.layout === 'sidebar';
  const owner   = pr.full_name || 'Applicant';

  const { aR, aG, aB, hbR, hbG, hbB, htR, htG, htB, sbR, sbG, sbB } = pal;

  const pdf = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  reset(pdf);

  const CX1  = isSB ? ML + SIDEBAR_W + 10 : ML;
  const CMW1 = PW - MR - CX1;
  const CX2  = ML;
  const CMW2 = PW - ML - MR;
  const layout = { cx: CX1, cmw: CMW1 };
  let pageCount = 1;

  function newPage(): number {
    pdf.addPage(); pageCount++;
    reset(pdf);
    layout.cx  = CX2;
    layout.cmw = CMW2;
    // Accent top bar on ALL page 2+ — no right sidebar on subsequent pages
    fill(pdf, hbR, hbG, hbB); pdf.rect(0, 0, PW, 6, 'F'); reset(pdf);
    // Reset content width to full on page 2+ for right-sidebar templates
    if (pal.layout === 'right-sidebar' || pal.layout === 'two-col') {
      layout.cx = ML; layout.cmw = CMW2;
    }
    return MT + 6;
  }

  const GL = () => layout;

  // ── HEADER ───────────────────────────────────────────────────────────────
  let headerH: number;

  if (pal.layout === 'sidebar') {
    // Full-page sidebar bg
    fill(pdf, sbR, sbG, sbB);
    pdf.rect(0, 0, ML + SIDEBAR_W + 2, PH, 'F');

    // Sidebar contents
    let sy   = MT + 4;
    const sx = ML + 1;
    const smw = SIDEBAR_W - 4;

    // Initials circle
    pdf.setFillColor(220, 245, 242);
    pdf.circle(sx + smw / 2, sy + 7, 9, 'F');
    const initials = owner.split(' ').map((n: string) => n[0] || '').join('').slice(0, 2).toUpperCase();
    text(pdf, sbR, sbG, sbB);
    pdf.setFont(F, 'bold'); pdf.setFontSize(10);
    pdf.text(initials, sx + smw / 2 - pdf.getTextWidth(initials) / 2, sy + 9);
    sy += 22;

    // Contact
    sy = sidebarLabel(pdf, 'Contact', sx, sy, smw);
    pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); text(pdf, 224, 253, 244);
    const iSz   = 3;    // icon size mm
    const iOff  = 2.5;  // offset up from text baseline so icon vertically centres with text
    if (pr.email)  {
      icon(pdf, 'mail',   sx, sy - iOff, iSz, true);
      const lines = pdf.splitTextToSize(pr.email,  smw - iSz - 1.5) as string[];
      lines.forEach((l: string, i: number) => { pdf.text(l, sx + iSz + 1.5, sy + i * 4); });
      sy += lines.length * 4 + 1;
    }
    if (pr.phone)  {
      icon(pdf, 'phone',  sx, sy - iOff, iSz, true);
      pdf.text(pr.phone, sx + iSz + 1.5, sy);
      sy += 4 + 1;
    }
    if (pr.address){
      icon(pdf, 'mapPin', sx, sy - iOff, iSz, true);
      const lines = pdf.splitTextToSize(pr.address, smw - iSz - 1.5) as string[];
      lines.forEach((l: string, i: number) => { pdf.text(l, sx + iSz + 1.5, sy + i * 4); });
      sy += lines.length * 4 + 1;
    }
    if (pr.id_number) {
      icon(pdf, 'user',   sx, sy - iOff, iSz, true);
      pdf.text(`ID: ${pr.id_number}`, sx + iSz + 1.5, sy);
      sy += 4;
    }
    sy += 5;

    if (sk.subjects?.length) {
      sy = sidebarLabel(pdf, 'Subjects', sx, sy, smw);
      pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); text(pdf, 224, 253, 244);
      for (const s of sk.subjects) { for (const l of pdf.splitTextToSize(`- ${s}`, smw) as string[]) { pdf.text(l, sx, sy); sy += 4; } }
      sy += 4;
    }
    if (sk.languages?.length) {
      sy = sidebarLabel(pdf, 'Languages', sx, sy, smw);
      pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); text(pdf, 224, 253, 244);
      for (const l of sk.languages) { pdf.text(`- ${l}`, sx, sy); sy += 4; }
      sy += 4;
    }
    if (sk.soft_skills?.length) {
      sy = sidebarLabel(pdf, 'Skills', sx, sy, smw);
      pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); text(pdf, 224, 253, 244);
      for (const s of sk.soft_skills) { for (const l of pdf.splitTextToSize(`- ${s}`, smw) as string[]) { pdf.text(l, sx, sy); sy += 4; } }
    }

    // Name + divider in content area
    reset(pdf);
    let cy = MT + 8;
    text(pdf, aR, aG, aB); pdf.setFont(F, 'bold'); pdf.setFontSize(16);
    pdf.text(owner.toUpperCase(), layout.cx, cy); cy += 6;
    text(pdf, 107, 114, 128); pdf.setFont(F, 'normal'); pdf.setFontSize(8);
    pdf.text('EDUCATOR', layout.cx, cy); cy += 3;
    hLine(pdf, layout.cx, cy, layout.cmw, aR, aG, aB, 0.5);
    headerH = cy + 5 - MT;

  } else if (pal.layout === 'right-sidebar') {
    // ── Right sidebar: name+content left, dark sidebar right ──────────────
    // Draw right sidebar background for full page
    fill(pdf, hbR, hbG, hbB);
    pdf.rect(PW - 52, 0, 52, PH, 'F');
    // Sidebar content
    let rsy = MT + 6;
    const rsx = PW - 48;
    const rsmw = 40;
    pdf.setFont(F, 'normal'); pdf.setFontSize(7);
    text(pdf, 200, 210, 220);
    const rLabels = ['Details', 'Skills', 'Languages'];
    const rData = [
      [pr.address, pr.phone, pr.email].filter(Boolean),
      [...(sk.subjects || []), ...(sk.soft_skills || [])].slice(0, 5),
      sk.languages || [],
    ];
    rLabels.forEach((lbl, li) => {
      if (!rData[li].length) return;
      pdf.setFont(F, 'bold'); pdf.setFontSize(6);
      text(pdf, 150, 170, 200);
      pdf.text(lbl.toUpperCase(), rsx, rsy); rsy += 3;
      pdf.setLineWidth(0.2); pdf.setDrawColor(100, 130, 180);
      pdf.line(rsx, rsy, rsx + rsmw, rsy); rsy += 3;
      pdf.setFont(F, 'normal'); pdf.setFontSize(6.5); text(pdf, 200, 215, 230);
      rData[li].forEach((item: string) => {
        const ls = pdf.splitTextToSize(item, rsmw) as string[];
        ls.forEach((l: string) => { pdf.text(l, rsx, rsy); rsy += 3.5; });
        if (li === 1) { // skills - add progress bar
          pdf.setFillColor(80, 100, 140);
          pdf.rect(rsx, rsy - 1, rsmw * 0.75, 1.5, 'F');
          rsy += 1;
        }
      });
      rsy += 4;
    });
    // Name + divider in left content area (narrower — avoid right sidebar)
    reset(pdf);
    layout.cx  = ML;
    layout.cmw = PW - ML - 58; // leave room for right sidebar
    let cy = MT + 8;
    pdf.setFont(F, 'bold'); pdf.setFontSize(18); text(pdf, aR, aG, aB);
    pdf.text(owner, layout.cx, cy); cy += 6;
    pdf.setFont(F, 'normal'); pdf.setFontSize(8); text(pdf, 107, 114, 128);
    pdf.text('EDUCATOR', layout.cx, cy); cy += 3;
    hLine(pdf, layout.cx, cy, layout.cmw, aR, aG, aB, 0.5);
    headerH = cy + 5 - MT;
    reset(pdf);

  } else if (pal.layout === 'two-col') {
    // ── Two-column: accent banner header, skills in right col ─────────────
    fill(pdf, hbR, hbG, hbB); pdf.rect(0, 0, PW, 30, 'F');
    text(pdf, htR, htG, htB); pdf.setFont(F, 'bold'); pdf.setFontSize(16);
    pdf.text(owner.toUpperCase(), ML, 12);
    pdf.setFont(F, 'normal'); pdf.setFontSize(7.5);
    const tcp = [pr.email, pr.phone, pr.address].filter(Boolean).join('   |   ');
    pdf.text(tcp, ML, 20);
    headerH = 33;
    // Adjust layout to leave space for right skills column
    layout.cx  = ML;
    layout.cmw = PW - ML - MR - 55; // main content narrower
    reset(pdf);

  } else if (pal.layout === 'boxed') {
    // ── Boxed header: name in a rectangle, contact below ──────────────────
    fill(pdf, 248, 248, 248); pdf.rect(0, 0, PW, 36, 'F');
    // Boxed name
    pdf.setDrawColor(55, 65, 81); pdf.setLineWidth(0.8);
    pdf.rect(ML, 5, PW - ML - MR, 18, 'S');
    text(pdf, 17, 24, 39); pdf.setFont(F, 'bold'); pdf.setFontSize(15);
    const bnW = pdf.getTextWidth(owner.toUpperCase());
    pdf.text(owner.toUpperCase(), (PW - bnW) / 2, 16);
    pdf.setFont(F, 'normal'); pdf.setFontSize(7);
    const bsub = [pr.address].filter(Boolean).join(' · ');
    if (bsub) { const bsW = pdf.getTextWidth(bsub); pdf.text(bsub, (PW - bsW) / 2, 20); }
    // Contact strip
    text(pdf, 107, 114, 128); pdf.setFont(F, 'normal'); pdf.setFontSize(7.5);
    const bcp = [pr.email, pr.phone, pr.address].filter(Boolean).join('   |   ');
    const bcW = pdf.getTextWidth(bcp); pdf.text(bcp, (PW - bcW) / 2, 30);
    headerH = 40; reset(pdf);

  } else if (pal.layout === 'shaded') {
    // ── Shaded: grey section-header bars, centered name, no colour banner ──
    // Light grey top strip
    fill(pdf, 243, 244, 246); pdf.rect(0, 0, PW, 28, 'F');
    text(pdf, 17, 24, 39); pdf.setFont(F, 'bold'); pdf.setFontSize(16);
    const shW = pdf.getTextWidth(owner.toUpperCase());
    pdf.text(owner.toUpperCase(), (PW - shW) / 2, MT + 9);
    pdf.setFont(F, 'normal'); pdf.setFontSize(8); text(pdf, 107, 114, 128);
    const shcp = [pr.address, pr.phone, pr.email].filter(Boolean).join('   ·   ');
    const shcW = pdf.getTextWidth(shcp);
    pdf.text(shcp, (PW - shcW) / 2, MT + 16);
    hLine(pdf, ML, 28, PW - ML - MR, 209, 213, 219, 0.4);
    headerH = 32; reset(pdf);

  } else if (pal.layout === 'timeline') {
    // ── Timeline: centered name, thin rule, slate accent ─────────────────
    text(pdf, 17, 24, 39); pdf.setFont(F, 'bold'); pdf.setFontSize(18);
    const tlW = pdf.getTextWidth(owner.toUpperCase());
    pdf.text(owner.toUpperCase(), (PW - tlW) / 2, MT + 10);
    pdf.setFont(F, 'normal'); pdf.setFontSize(8); text(pdf, 107, 114, 128);
    const tlcp = [pr.address, pr.phone, pr.email].filter(Boolean).join('   ·   ');
    const tlcW = pdf.getTextWidth(tlcp);
    pdf.text(tlcp, (PW - tlcW) / 2, MT + 17);
    // Double rule in accent colour
    hLine(pdf, ML, MT + 20, PW - ML - MR, aR, aG, aB, 1.5);
    hLine(pdf, ML, MT + 23, PW - ML - MR, aR, aG, aB, 0.3);
    headerH = 28; reset(pdf);

  } else if (pal.layout === 'sage') {
    // ── Sage: rounded-card style header with green background ────────────
    // Green card background
    fill(pdf, sbR, sbG, sbB); pdf.roundedRect(ML - 2, MT - 4, PW - ML - MR + 4, 28, 3, 3, 'F');
    text(pdf, 26, 46, 26); pdf.setFont(F, 'bold'); pdf.setFontSize(16);
    pdf.text(owner, ML + 2, MT + 8);
    pdf.setFont(F, 'normal'); pdf.setFontSize(8); text(pdf, 55, 80, 55);
    const sgcp = [pr.address, pr.phone, pr.email].filter(Boolean).join('   ·   ');
    pdf.text(sgcp, ML + 2, MT + 16);
    headerH = 30; reset(pdf);

  } else if (pal.layout === 'left-date' || pal.layout === 'minimal') {
    // ── Minimal / Traditional header: centered name + contact, no banner ──
    text(pdf, 17, 24, 39); pdf.setFont(F, 'bold'); pdf.setFontSize(16);
    const mW = pdf.getTextWidth(owner.toUpperCase());
    pdf.text(owner.toUpperCase(), (PW - mW) / 2, MT + 8);
    pdf.setFont(F, 'normal'); pdf.setFontSize(8); text(pdf, 107, 114, 128);
    const mcp = [pr.address, pr.phone, pr.email].filter(Boolean).join('   ·   ');
    const mcW = pdf.getTextWidth(mcp); pdf.text(mcp, (PW - mcW) / 2, MT + 14);
    hLine(pdf, ML, MT + 17, PW - ML - MR, aR, aG, aB, 0.5);
    headerH = 22; reset(pdf);

  } else {
    // ── Default banner header (banner layout) ──────────────────────────────
    fill(pdf, hbR, hbG, hbB); pdf.rect(0, 0, PW, 32, 'F');
    text(pdf, htR, htG, htB); pdf.setFont(F, 'bold'); pdf.setFontSize(17);
    pdf.text(owner.toUpperCase(), ML, 13);
    draw(pdf, htR > 200 ? 200 : 209, htR > 200 ? 200 : 213, htR > 200 ? 200 : 219);
    pdf.setLineWidth(0.25); pdf.line(ML, 16, PW - MR, 16);
    text(pdf, htR, htG, htB); pdf.setFont(F, 'normal'); pdf.setFontSize(7.5);
    const contactIconMap: [string | undefined, string][] = [
      [pr.email,                    'mail'  ],
      [pr.phone,                    'phone' ],
      [pr.address,                  'mapPin'],
      [pr.id_number ? `ID: ${pr.id_number}` : undefined, 'user'],
    ];
    const ciSz = 3;
    const ciOff = ciSz - 0.5;
    let cx2 = ML; const ciY = 22;
    for (const [val, iname] of contactIconMap) {
      if (!val) continue;
      const tw2 = pdf.getTextWidth(val as string) + ciSz + 2 + 4;
      if (cx2 + tw2 > PW - MR) break;
      icon(pdf, iname, cx2, ciY - ciOff, ciSz, true);
      pdf.text(val as string, cx2 + ciSz + 1.5, ciY);
      cx2 += tw2;
    }
    headerH = 35;
    reset(pdf);
  }

  let y = MT + headerH;

  // ── Professional Summary ───────────────────────────────────────────────
  if (pr.bio) {
    y = sectionHeading(pdf, 'Professional Summary', layout.cx, y, layout.cmw, aR, aG, aB, BOTTOM, newPage, GL, 'bookOpen', pal.layout);
    pdf.setFont(F, 'normal'); pdf.setFontSize(9); text(pdf, 55, 65, 81);
    y = wrappedText(pdf, pr.bio, layout.cx, y, layout.cmw, BOTTOM, newPage, LINE_H, GL);
    y += ITEM_GAP + 1;
  }

  // ── Teaching Experience ────────────────────────────────────────────────
  if (exp.length) {
    y = sectionHeading(pdf, 'Teaching Experience', layout.cx, y, layout.cmw, aR, aG, aB, BOTTOM, newPage, GL, 'briefcase', pal.layout);
    for (const e of exp) {
      if (y + 16 > BOTTOM) y = newPage();
      pdf.setFont(F, 'bold'); pdf.setFontSize(10); text(pdf, 17, 24, 39);
      pdf.text(e.role || '', layout.cx, y); y += LINE_H;
      pdf.setFont(F, 'bold'); pdf.setFontSize(8.5); text(pdf, aR, aG, aB);
      pdf.text(e.school || '', layout.cx, y);
      const ds = [e.from, e.to].filter(Boolean).join(' - ');
      if (ds) { pdf.setFont(F, 'normal'); pdf.setFontSize(8); text(pdf, 107, 114, 128); pdf.text(ds, layout.cx + layout.cmw - pdf.getTextWidth(ds), y); }
      y += LINE_H;
      hLine(pdf, layout.cx, y - 1.5, layout.cmw, 229, 231, 235, 0.2);
      if (e.description) {
        y += 1; pdf.setFont(F, 'normal'); pdf.setFontSize(9); text(pdf, 55, 65, 81);
        for (const b of (e.description as string).split('\n').map((l: string) => l.trim()).filter(Boolean)) {
          y = bulletLine(pdf, b, layout.cx, y, layout.cmw, aR, aG, aB, BOTTOM, newPage, GL);
        }
      }
      y += ITEM_GAP + 1;
    }
    y += 1;
  }

  // ── Education ─────────────────────────────────────────────────────────
  if (edu.length) {
    y = sectionHeading(pdf, 'Education', layout.cx, y, layout.cmw, aR, aG, aB, BOTTOM, newPage, GL, 'graduation', pal.layout);
    for (const e of edu) {
      if (y + 12 > BOTTOM) y = newPage();
      pdf.setFont(F, 'bold'); pdf.setFontSize(10); text(pdf, 17, 24, 39);
      pdf.text(e.qualification || '', layout.cx, y); y += LINE_H;
      pdf.setFont(F, 'normal'); pdf.setFontSize(8.5); text(pdf, 107, 114, 128);
      pdf.text([e.institution, e.year].filter(Boolean).join('   |   '), layout.cx, y);
      y += LINE_H + ITEM_GAP;
    }
    y += 1;
  }

  // ── Skills (non-sidebar only) ──────────────────────────────────────────
  if (pal.layout !== 'sidebar' && (sk.subjects?.length || sk.soft_skills?.length || sk.languages?.length)) {
    y = sectionHeading(pdf, 'Skills & Languages', layout.cx, y, layout.cmw, aR, aG, aB, BOTTOM, newPage, GL, 'award', pal.layout);
    for (const [label, items] of [['Subjects', sk.subjects || []], ['Skills', sk.soft_skills || []], ['Languages', sk.languages || []]] as [string, string[]][]) {
      if (!items.length) continue;
      if (y + LINE_H > BOTTOM) y = newPage();
      pdf.setFont(F, 'bold'); pdf.setFontSize(9); text(pdf, 55, 65, 81);
      pdf.text(`${label}:`, layout.cx, y);
      const lw = pdf.getTextWidth(`${label}:`) + 2;
      pdf.setFont(F, 'normal'); text(pdf, 55, 65, 81);
      y = wrappedText(pdf, items.join('  |  '), layout.cx + lw, y, layout.cmw - lw, BOTTOM, newPage, LINE_H, GL);
      y += ITEM_GAP;
    }
    y += 2;
  }

  // ── Custom sections ────────────────────────────────────────────────────
  for (const sec of customs) {
    y = sectionHeading(pdf, sec.title, layout.cx, y, layout.cmw, aR, aG, aB, BOTTOM, newPage, GL, undefined, pal.layout);
    pdf.setFont(F, 'normal'); pdf.setFontSize(9); text(pdf, 55, 65, 81);
    if (sec.type === 'text' && sec.content) {
      y = wrappedText(pdf, sec.content, layout.cx, y, layout.cmw, BOTTOM, newPage, LINE_H, GL);
    } else if (sec.type === 'bullets' && sec.content) {
      for (const b of (sec.content as string).split('\n').map((l: string) => l.trim()).filter(Boolean)) {
        y = bulletLine(pdf, b, layout.cx, y, layout.cmw, aR, aG, aB, BOTTOM, newPage, GL);
      }
    } else if (sec.type === 'table' && sec.columns?.length && sec.rows?.length) {
      const cw = layout.cmw / sec.columns.length;
      fill(pdf, aR, aG, aB); text(pdf, 255, 255, 255);
      pdf.rect(layout.cx, y - 4, layout.cmw, 6, 'F');
      pdf.setFont(F, 'bold'); pdf.setFontSize(8);
      (sec.columns as string[]).forEach((col, ci) => pdf.text(col, layout.cx + ci * cw + 1, y));
      y += 6;
      pdf.setFont(F, 'normal'); pdf.setFontSize(8.5);
      for (let ri = 0; ri < sec.rows.length; ri++) {
        if (y + 6 > BOTTOM) y = newPage();
        if (ri % 2 === 0) { pdf.setFillColor(249, 250, 251); pdf.rect(layout.cx, y - 4, layout.cmw, 6, 'F'); }
        text(pdf, 55, 65, 81);
        (sec.rows[ri] as string[]).forEach((cell, ci) => pdf.text(String(cell || ''), layout.cx + ci * cw + 1, y));
        y += 6;
      }
    }
    y += 3;
  }

  // ── Right skills column for two-col layout ──────────────────────────────
  if (pal.layout === 'two-col') {
    const rcX = PW - MR - 50;
    const rcW = 50;
    let rcy   = MT + headerH + 2;
    pdf.setFont(F, 'bold'); pdf.setFontSize(8); text(pdf, aR, aG, aB);
    pdf.text('SKILLS', rcX, rcy); rcy += 4;
    hLine(pdf, rcX, rcy, rcW, aR, aG, aB, 0.4); rcy += 4;
    const allSkills = [...(sk.subjects || []), ...(sk.soft_skills || [])];
    pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); text(pdf, 55, 65, 81);
    allSkills.slice(0, 8).forEach(s => {
      const sl = pdf.splitTextToSize(s, rcW) as string[];
      sl.forEach(l => { if (rcy < BOTTOM) { pdf.text(l, rcX, rcy); rcy += 3.8; } });
      // Dot rating bar
      if (rcy < BOTTOM) {
        for (let d = 0; d < 5; d++) {
          fill(pdf, d < 3 ? aR : 229, d < 3 ? aG : 231, d < 3 ? aB : 235);
          pdf.circle(rcX + d * 5, rcy - 0.5, 1.5, 'F');
        }
        rcy += 5;
      }
    });
    if (sk.languages?.length) {
      rcy += 4;
      pdf.setFont(F, 'bold'); pdf.setFontSize(8); text(pdf, aR, aG, aB);
      pdf.text('LANGUAGES', rcX, rcy); rcy += 4;
      hLine(pdf, rcX, rcy, rcW, aR, aG, aB, 0.4); rcy += 4;
      pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); text(pdf, 55, 65, 81);
      sk.languages.forEach((l: string) => { if (rcy < BOTTOM) { pdf.text(l, rcX, rcy); rcy += 4; } });
    }
    reset(pdf);
  }

  // ── References page ────────────────────────────────────────────────────
  if (refs.length) {
    pdf.addPage(); pageCount++;
    reset(pdf);
    fill(pdf, hbR, hbG, hbB); pdf.rect(0, 0, PW, 6, 'F');
    reset(pdf);

    const rCX = ML; const rCMW = PW - ML - MR;
    let ry = MT;
    ry = sectionHeading(pdf, 'References', rCX, ry, rCMW, aR, aG, aB, BOTTOM, newPage, undefined, 'user', pal.layout);
    ry += 2;

    const half = (rCMW - 8) / 2;

    function refCard(ref: any, rx: number, startY: number): number {
      let cy = startY;
      dot(pdf, rx, cy - 0.8, aR, aG, aB, 1.6);
      pdf.setFont(F, 'bold'); pdf.setFontSize(9.5); text(pdf, 17, 24, 39);
      pdf.text(ref.name, rx + 3, cy); cy += LINE_H;
      if (ref.title)        { pdf.setFont(F, 'normal'); pdf.setFontSize(9);   text(pdf, aR, aG, aB);       pdf.text(ref.title,        rx + 3, cy); cy += LINE_H; }
      if (ref.organisation) { pdf.setFont(F, 'normal'); pdf.setFontSize(8.5); text(pdf, 107, 114, 128);    pdf.text(ref.organisation, rx + 3, cy); cy += LINE_H; }
      if (ref.relationship) { pdf.setFont(F, 'italic'); pdf.setFontSize(8);   text(pdf, 156, 163, 175);    pdf.text(ref.relationship, rx + 3, cy); cy += LINE_H; }
      if (ref.phone || ref.email) {
        pdf.setFont(F, 'normal'); pdf.setFontSize(8); text(pdf, 107, 114, 128);
        pdf.text([ref.phone, ref.email].filter(Boolean).join('  |  '), rx + 3, cy); cy += LINE_H;
      }
      return cy;
    }

    for (let i = 0; i < refs.length; i += 2) {
      const ly = refCard(refs[i], rCX, ry);
      const ry2 = refs[i + 1] ? refCard(refs[i + 1], rCX + half + 8, ry) : ry;
      const rowEnd = Math.max(ly, ry2) + 2;
      hLine(pdf, rCX, rowEnd, rCMW, 229, 231, 235, 0.2);
      ry = rowEnd + 5;
    }
  }

  // ── Watermark ──────────────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    pdf.setPage(pg);
    reset(pdf);
    if (data.watermark) {
      pdf.setFillColor(15, 23, 42); pdf.rect(0, PH - FOOTER_H, PW, FOOTER_H, 'F');
      text(pdf, 148, 163, 184); pdf.setFont(F, 'normal'); pdf.setFontSize(7);
      const wt = 'Created FREE at www.crosssa.co.za  -  Upgrade to remove this watermark';
      pdf.text(wt, (PW - pdf.getTextWidth(wt)) / 2, PH - 3.5);
      // Footer text on watermark bar
      text(pdf, 255, 255, 255); pdf.setFont(F, 'italic'); pdf.setFontSize(7);
      pdf.text(`Resume of ${owner}`, ML, PH - 3.5);
      const ps = `Page ${pg} of ${totalPages}`;
      pdf.text(ps, PW - MR - pdf.getTextWidth(ps), PH - 3.5);
    } else {
      drawFooter(pdf, owner, pg, totalPages, aR, aG, aB);
    }
  }

  // ── PDF Encryption ────────────────────────────────────────────────────
  // Lock the PDF to prevent copy-paste and Word conversion.
  // - userPassword: empty string = no password needed to open/view
  // - ownerPassword: secret master key that controls permissions
  // - Permissions: printing allowed, but copying text and editing blocked
  //   This stops most "PDF to Word" converters which rely on text extraction.
  try {
    (pdf as any).encrypt({
      userPassword:  '',                    // open freely — no password prompt
      ownerPassword: 'crosssa-cv-owner-2025', // internal lock key
      userPermissions: ['print', 'print-high'], // allow printing only
      // copy, modify, annot-forms, fill-forms are all omitted = blocked
    });
  } catch (_) {
    // Encryption not supported in this jsPDF build — output unencrypted
  }

  void filename;
  return pdf.output('blob');
}