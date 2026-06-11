/**
 * CV PDF Export — guaranteed no-crop strategy
 *
 * Each page shows exactly one A4's worth of content.
 * Page boundaries are fixed (no pixel scanning) so text is NEVER cropped.
 *
 * How page transitions work:
 *   Page 1: canvas rows 0 … pageHpx
 *   Page 2: rows (pageHpx - padPx) … (2*pageHpx - padPx)  ← backed up by padPx
 *   Page 3: rows (2*pageHpx - 2*padPx) … (3*pageHpx - 2*padPx)
 *   etc.
 *
 * Each continuation page has a white strip of padPx at the TOP, so the first
 * visible content row is padPx below the page top edge. This padding acts as
 * both the "header margin" and ensures the last line of the previous page
 * never appears again (it's hidden under the white strip).
 *
 * The footer gap is eliminated because we always take the full pageHpx of
 * canvas content — no early cutting.
 *
 * References (.cv-page) are rendered separately and appended as a clean page.
 */

const PDF_SCALE       = 2;
const A4_W_PX         = 794;
const A4_W_PT         = 595.28;
const A4_H_PT         = 841.89;
const PAGE_TOP_PAD_PX = 32;   // white margin at top of page 2+ (logical px)

type PDF = InstanceType<import('jspdf').jsPDF>;

/**
 * Copies canvas rows [startY, endY) into the PDF page.
 * A white rectangle of `topPad` canvas-pixels is painted above the content.
 */
function addSliceToPDF(
  pdf: PDF,
  canvas: HTMLCanvasElement,
  startY: number,
  endY: number,
  topPad = 0,
): void {
  const contentH = Math.min(endY - startY, canvas.height - startY);
  if (contentH <= 0) return;

  const totalH = contentH + topPad;
  const tmp    = document.createElement('canvas');
  tmp.width    = canvas.width;
  tmp.height   = totalH;
  const ctx    = tmp.getContext('2d')!;

  // White background (covers padding strip + any transparent areas)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  // Content below the padding strip
  ctx.drawImage(
    canvas,
    0, startY, canvas.width, contentH,
    0, topPad, canvas.width, contentH,
  );

  // Scale proportionally to fit A4 width; never upscale
  const imgH  = (totalH / canvas.width) * A4_W_PT;
  const scale = Math.min(1, A4_H_PT / imgH);
  const drawH = imgH  * scale;
  const drawW = A4_W_PT * scale;

  pdf.addImage(
    tmp.toDataURL('image/jpeg', 0.95),
    'JPEG',
    (A4_W_PT - drawW) / 2, 0,
    drawW, drawH,
  );
}

export async function exportElementAsPDF(
  container: HTMLElement,
  filename: string,
): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF }                = await import('jspdf');

  // ── Hide references block during main render ─────────────────────────────
  const refsEl = container.querySelector<HTMLElement>('.cv-page');
  if (refsEl) refsEl.style.display = 'none';

  // ── 1. Render full main content to one canvas ────────────────────────────
  const canvas = await html2canvas(container, {
    scale:       PDF_SCALE,
    useCORS:     true,
    logging:     false,
    width:       A4_W_PX,
    windowWidth: A4_W_PX,
  });

  if (refsEl) refsEl.style.display = '';

  const pageHpx = Math.round(A4_H_PT  * PDF_SCALE);  // canvas px per A4 page
  const padPx   = Math.round(PAGE_TOP_PAD_PX * PDF_SCALE);

  // ── 2. Slice into fixed-height pages — no pixel scanning, no cropping ────
  const pdf     = new jsPDF({ format: 'a4', unit: 'pt', compress: true });
  let   pageNum = 0;
  let   canvasY = 0;   // top of the current content slice in the canvas

  while (canvasY < canvas.height) {
    if (pageNum > 0) pdf.addPage();

    const isFirst    = pageNum === 0;
    const topPad     = isFirst ? 0 : padPx;
    // How many canvas rows fit as content on this page
    const contentHpx = pageHpx - topPad;
    const sliceEnd   = Math.min(canvasY + contentHpx, canvas.height);

    addSliceToPDF(pdf, canvas, canvasY, sliceEnd, topPad);

    // Advance by exactly contentHpx so the next page starts where this ended
    canvasY += contentHpx;
    pageNum++;
  }

  // ── 3. References — separate render, clean final page ────────────────────
  if (refsEl) {
    const refsCanvas = await html2canvas(refsEl, {
      scale:           PDF_SCALE,
      useCORS:         true,
      logging:         false,
      width:           A4_W_PX,
      windowWidth:     A4_W_PX,
      backgroundColor: '#ffffff',
    });
    pdf.addPage();
    // References always get top padding so they don't start at the very edge
    addSliceToPDF(pdf, refsCanvas, 0, refsCanvas.height, padPx);
  }

  void filename;
  return pdf.output('blob');
}