/**
 * Smart PDF export for CV templates.
 *
 * Architecture (final fix)
 * ────────────────────────
 * Page 1 content is rendered freely — no fixed-height DOM constraint.
 * The canvas is sliced at A4 boundaries using content-aware row scanning
 * (finds the whitest row near each page boundary to avoid cutting text).
 *
 * The references section has className="cv-page" — it is rendered as a
 * SEPARATE html2canvas capture and appended as a clean PDF page with no
 * risk of the content-body bleeding into it.
 *
 * This means:
 * - Page 1..N: content-aware canvas slices of the main content
 * - Final page: references, clean and independent
 *
 * The top of each slice (except slice 0) gets a small white padding strip
 * so text never starts right at the very top edge of a page.
 */

const PDF_SCALE  = 2;
const A4_W_PX    = 794;
const A4_W_PT    = 595.28;
const A4_H_PT    = 841.89;
const PAGE_TOP_PAD_PX = 24;   // white padding added to top of continuation pages (logical px)

/**
 * Finds the best Y position to cut near proposedY.
 * Scans the content column (right 65%, skipping sidebar) for the whitest row.
 */
function findSafeCutY(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  proposedY: number,
  searchPx = 40,
): number {
  const scanTop = Math.max(0,            proposedY - searchPx);
  const scanBot = Math.min(canvasHeight, proposedY + searchPx);
  const scanH   = scanBot - scanTop;
  if (scanH <= 0) return proposedY;

  const startX = Math.floor(canvasWidth * 0.35);
  const w      = canvasWidth - startX;

  let data: ImageData;
  try { data = ctx.getImageData(startX, scanTop, w, scanH); }
  catch { return proposedY; }

  let bestY = proposedY, bestScore = -1;
  for (let dy = 0; dy < scanH; dy++) {
    let light = 0;
    for (let x = 0; x < w; x++) {
      const i = (dy * w + x) * 4;
      if (data.data[i] > 230 && data.data[i+1] > 230 && data.data[i+2] > 230) light++;
    }
    const score = light / w;
    if (score > bestScore) { bestScore = score; bestY = scanTop + dy; }
  }
  return bestY;
}

type PDF = InstanceType<import('jspdf').jsPDF>;

/**
 * Copies a horizontal strip from `canvas` into the PDF.
 * `topPad` (canvas pixels) adds a white strip at the top — used for
 * continuation pages so text doesn't start at the very edge.
 */
function addSliceToPDF(
  pdf: PDF,
  canvas: HTMLCanvasElement,
  startY: number,
  endY: number,
  topPad = 0,
): void {
  const contentH = endY - startY;
  if (contentH <= 0) return;

  const totalH = contentH + topPad;
  const tmp    = document.createElement('canvas');
  tmp.width    = canvas.width;
  tmp.height   = totalH;
  const ctx    = tmp.getContext('2d')!;

  // Fill white background (handles the padding strip + any transparent areas)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  // Draw content below the padding strip
  ctx.drawImage(canvas, 0, startY, canvas.width, contentH, 0, topPad, canvas.width, contentH);

  const imgH  = (totalH / canvas.width) * A4_W_PT;
  const scale = Math.min(1, A4_H_PT / imgH);   // shrink to fit if taller than A4
  const drawH = imgH * scale;
  const drawW = A4_W_PT * scale;
  pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', (A4_W_PT - drawW) / 2, 0, drawW, drawH);
}

export async function exportElementAsPDF(container: HTMLElement, filename: string): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF }                = await import('jspdf');

  // ── Separate the references page element from the main content ────────────
  const refsEl = container.querySelector<HTMLElement>('.cv-page');

  // Temporarily hide the references page during main-content render
  if (refsEl) refsEl.style.display = 'none';

  // ── 1. Render main content (no references) ───────────────────────────────
  const canvas = await html2canvas(container, {
    scale:       PDF_SCALE,
    useCORS:     true,
    logging:     false,
    width:       A4_W_PX,
    windowWidth: A4_W_PX,
  });

  // Restore references page
  if (refsEl) refsEl.style.display = '';

  const ctx     = canvas.getContext('2d')!;
  const pageHpx = Math.round(A4_H_PT * PDF_SCALE);
  const padPx   = Math.round(PAGE_TOP_PAD_PX * PDF_SCALE);

  // ── 2. Slice main content at A4 boundaries ────────────────────────────────
  const pdf = new jsPDF({ format: 'a4', unit: 'pt', compress: true });
  let y = 0, pageNum = 0;

  while (y < canvas.height) {
    const availH  = pageNum === 0 ? pageHpx : pageHpx - padPx;   // first page uses full height
    const rawEnd  = Math.min(y + availH, canvas.height);
    const safeEnd = rawEnd < canvas.height
      ? findSafeCutY(ctx, canvas.width, canvas.height, rawEnd)
      : rawEnd;
    const endY = Math.max(safeEnd, y + 1);

    if (pageNum > 0) pdf.addPage();
    addSliceToPDF(pdf, canvas, y, endY, pageNum === 0 ? 0 : padPx);

    y = endY;
    pageNum++;
  }

  // ── 3. Render references page separately and append ───────────────────────
  if (refsEl) {
    refsEl.style.display = '';   // ensure visible
    const refsCanvas = await html2canvas(refsEl, {
      scale:       PDF_SCALE,
      useCORS:     true,
      logging:     false,
      width:       A4_W_PX,
      windowWidth: A4_W_PX,
      backgroundColor: '#ffffff',
    });

    // References page: add white top padding, then render
    pdf.addPage();
    addSliceToPDF(pdf, refsCanvas, 0, refsCanvas.height, padPx);
  }

  void filename;
  return pdf.output('blob');
}
