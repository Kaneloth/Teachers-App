/**
 * CV PDF Export — html2canvas → jsPDF
 *
 * Captures the already-rendered CVTemplateRenderer DOM node (the hidden
 * off-screen copy in CVStepReview) and slices it into A4 pages.
 *
 * Why this approach:
 *   The old version re-drew everything from scratch with jsPDF drawing
 *   primitives and only had ~8 structural layouts, so most templates came
 *   out looking identical (same layout, different colour).  This version
 *   screenshots the real React render, so the downloaded PDF matches the
 *   on-screen preview pixel-for-pixel.
 *
 * Page-break strategy:
 *   The renderer wraps each logical page in a div with class="cv-page" or
 *   class="cv-content-page".  We look for those divs first so we get clean
 *   cuts.  If none exist we fall back to slicing the canvas at A4 height
 *   intervals.
 *
 * Watermark / footer:
 *   Added as a jsPDF text layer on every page so it never overlaps content.
 */

import { jsPDF as JsPDFClass } from 'jspdf';
import html2canvas from 'html2canvas';

// A4 dimensions in mm and px (96 dpi equivalent used by jsPDF)
const A4_W_MM = 210;
const A4_H_MM = 297;
// At 2× scale the canvas pixel width for A4 = 794 * 2 = 1588 px
// jsPDF converts: image width in mm = canvas px / scale / (px-per-mm)
// We just use the ratio: MM_PER_PX = A4_W_MM / 794
const CV_WIDTH_PX = 794; // the fixed width we render at
const SCALE       = 2;   // html2canvas devicePixelRatio — higher = sharper

const FOOTER_H_MM = 8;
const F = 'helvetica';

// ── Watermark bar drawn by jsPDF (keeps it outside the captured image) ───────
function drawWatermarkFooter(pdf: InstanceType<typeof JsPDFClass>, owner: string, pg: number, total: number) {
  const y = A4_H_MM - FOOTER_H_MM;
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, y, A4_W_MM, FOOTER_H_MM, 'F');
  pdf.setFont(F, 'normal'); pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  const wt = 'Created FREE at www.crosssa.co.za  –  Upgrade to remove this watermark';
  pdf.text(wt, (A4_W_MM - pdf.getTextWidth(wt)) / 2, y + 5);
  pdf.setFont(F, 'italic'); pdf.setTextColor(255, 255, 255);
  pdf.text(`Resume of ${owner}`, 15, y + 5);
  const ps = `Page ${pg} of ${total}`;
  pdf.text(ps, A4_W_MM - 15 - pdf.getTextWidth(ps), y + 5);
}

function drawNormalFooter(pdf: InstanceType<typeof JsPDFClass>, owner: string, pg: number, total: number) {
  const y = A4_H_MM - FOOTER_H_MM;
  pdf.setDrawColor(209, 213, 219); pdf.setLineWidth(0.25);
  pdf.line(15, y, A4_W_MM - 15, y);
  pdf.setFont(F, 'italic'); pdf.setFontSize(7); pdf.setTextColor(156, 163, 175);
  pdf.text(`Resume of ${owner}`, 15, y + 4);
  const ps = `Page ${pg} of ${total}`;
  pdf.text(ps, A4_W_MM - 15 - pdf.getTextWidth(ps), y + 4);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function exportElementAsPDF(
  container: HTMLElement,
  filename: string,
  cvData?: Record<string, unknown>,
): Promise<Blob> {
  if (!container) throw new Error('No container element provided');

  const owner     = (cvData as any)?.personal?.full_name || 'Applicant';
  const watermark = !!(cvData as any)?.watermark;

  // ── 1. Render the container to a high-res canvas ──────────────────────────
  //
  // allowTaint + useCORS: needed so photo_url images (Supabase storage) are
  // included.  If CORS headers are missing on the bucket the photo is simply
  // omitted rather than crashing.
  //
  // backgroundColor white: the CV templates assume a white page background.
  // logging false: keeps the console clean.
  const canvas = await html2canvas(container, {
    scale:           SCALE,
    useCORS:         true,
    allowTaint:      true,
    backgroundColor: '#ffffff',
    logging:         false,
    // Expand the clipping region to catch any overflow from sidebar templates
    windowWidth:     CV_WIDTH_PX + 40,
    windowHeight:    Math.max(container.scrollHeight, container.offsetHeight) + 200,
  });

  const totalCanvasH = canvas.height; // px at @2x scale
  const totalCanvasW = canvas.width;

  // mm per canvas pixel (at our render scale)
  const mmPerPx = A4_W_MM / totalCanvasW;

  // A4 page height in canvas pixels
  const pageH_px  = Math.round(A4_H_MM / mmPerPx);

  // Usable page height (leave room for footer)
  const footerH_px = Math.round(FOOTER_H_MM / mmPerPx);
  const usableH_px = pageH_px - footerH_px;

  // ── 2. Determine page-break points ───────────────────────────────────────
  //
  // Preferred: use .cv-page / .cv-content-page divs — the renderer already
  // organises content into logical A4 pages so we get clean cuts.
  //
  // Fallback: slice every usableH_px pixels.
  const pageBreaks: number[] = [0]; // canvas Y positions (px) where new pages start

  const pageNodes = container.querySelectorAll<HTMLElement>('.cv-page, .cv-content-page');
  if (pageNodes.length > 1) {
    // Measure each page node's top offset relative to the container
    const containerTop = container.getBoundingClientRect().top;
    pageNodes.forEach((node, i) => {
      if (i === 0) return; // first page starts at 0
      const nodeTop = node.getBoundingClientRect().top - containerTop;
      // Convert to canvas pixels
      pageBreaks.push(Math.round(nodeTop * SCALE));
    });
  } else {
    // Simple slice fallback
    let sliceY = usableH_px;
    while (sliceY < totalCanvasH) {
      pageBreaks.push(sliceY);
      sliceY += usableH_px;
    }
  }
  pageBreaks.push(totalCanvasH); // sentinel end

  const pageCount = pageBreaks.length - 1;

  // ── 3. Build the PDF ──────────────────────────────────────────────────────
  const pdf = new JsPDFClass({ format: 'a4', unit: 'mm', compress: true });

  for (let i = 0; i < pageCount; i++) {
    if (i > 0) pdf.addPage();

    const sliceTop = pageBreaks[i];
    const sliceBot = pageBreaks[i + 1];
    const sliceH   = sliceBot - sliceTop;

    // Create a temporary canvas for this slice
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width  = totalCanvasW;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, sliceTop, totalCanvasW, sliceH, 0, 0, totalCanvasW, sliceH);

    const imgData  = sliceCanvas.toDataURL('image/jpeg', 0.92);
    const imgH_mm  = sliceH * mmPerPx;

    // Place image at top of the PDF page
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, imgH_mm);

    // Overlay footer below the image
    if (watermark) {
      drawWatermarkFooter(pdf, owner, i + 1, pageCount);
    } else {
      drawNormalFooter(pdf, owner, i + 1, pageCount);
    }
  }

  // ── 4. Optional encryption (print-only permissions) ───────────────────────
  try {
    (pdf as any).encrypt({
      userPassword:    '',
      ownerPassword:   'crosssa-cv-owner-2025',
      userPermissions: ['print', 'print-high'],
    });
  } catch (_) {
    // jsPDF encryption is optional — silently skip if unavailable
  }

  void filename; // filename used by caller for the download anchor
  return pdf.output('blob');
}