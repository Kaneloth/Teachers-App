/**
 * Smart PDF export for CV templates.
 *
 * Architecture
 * ────────────
 * - Main content is canvas-sliced at A4 boundaries.
 * - findSafeCutY searches DOWNWARD only from the proposed cut point,
 *   so it never creates a large blank footer by cutting too early.
 * - Continuation pages get top padding so text doesn't start at the edge.
 * - References (.cv-page) are rendered separately and appended cleanly.
 */

const PDF_SCALE       = 2;
const A4_W_PX         = 794;
const A4_W_PT         = 595.28;
const A4_H_PT         = 841.89;
const PAGE_TOP_PAD_PX = 36;    // padding at top of page 2+ (logical px)
const SEARCH_DOWN_PX  = 60;    // how far below the boundary to search for a safe cut

/**
 * Searches DOWNWARD from proposedY for the first sufficiently blank row
 * in the content column (right 65%, skipping sidebar).
 * Searching downward means we never cut early — the gap is always at the
 * TOP of the next page (as padding), never at the bottom of the current page.
 */
function findSafeCutY(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  proposedY: number,
): number {
  const searchDown = Math.round(SEARCH_DOWN_PX * PDF_SCALE);
  const scanTop = proposedY;
  const scanBot = Math.min(canvasHeight, proposedY + searchDown);
  const scanH   = scanBot - scanTop;
  if (scanH <= 0) return proposedY;

  const startX = Math.floor(canvasWidth * 0.35);
  const w      = canvasWidth - startX;

  let data: ImageData;
  try { data = ctx.getImageData(startX, scanTop, w, scanH); }
  catch { return proposedY; }

  // Return the FIRST row that is mostly white (>80% white pixels)
  // This cuts right at the first clean gap below the boundary
  for (let dy = 0; dy < scanH; dy++) {
    let light = 0;
    for (let x = 0; x < w; x++) {
      const i = (dy * w + x) * 4;
      if (data.data[i] > 230 && data.data[i+1] > 230 && data.data[i+2] > 230) light++;
    }
    if (light / w > 0.80) return scanTop + dy;
  }

  // No clean gap found — just cut at the proposed point
  return proposedY;
}

type PDF = InstanceType<import('jspdf').jsPDF>;

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

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(canvas, 0, startY, canvas.width, contentH, 0, topPad, canvas.width, contentH);

  const imgH  = (totalH / canvas.width) * A4_W_PT;
  const scale = Math.min(1, A4_H_PT / imgH);
  const drawH = imgH * scale;
  const drawW = A4_W_PT * scale;
  pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', (A4_W_PT - drawW) / 2, 0, drawW, drawH);
}

export async function exportElementAsPDF(container: HTMLElement, filename: string): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF }                = await import('jspdf');

  const refsEl = container.querySelector<HTMLElement>('.cv-page');
  if (refsEl) refsEl.style.display = 'none';

  // ── 1. Render main content ───────────────────────────────────────────────
  const canvas = await html2canvas(container, {
    scale:       PDF_SCALE,
    useCORS:     true,
    logging:     false,
    width:       A4_W_PX,
    windowWidth: A4_W_PX,
  });

  if (refsEl) refsEl.style.display = '';

  const ctx     = canvas.getContext('2d')!;
  const pageHpx = Math.round(A4_H_PT * PDF_SCALE);
  const padPx   = Math.round(PAGE_TOP_PAD_PX * PDF_SCALE);

  // ── 2. Slice at A4 boundaries, searching downward for clean cut points ───
  const pdf = new jsPDF({ format: 'a4', unit: 'pt', compress: true });
  let y = 0, pageNum = 0;

  while (y < canvas.height) {
    // Each continuation page loses padPx from top to account for the padding strip
    const availH = pageNum === 0 ? pageHpx : pageHpx - padPx;
    const rawEnd = y + availH;

    let endY: number;
    if (rawEnd >= canvas.height) {
      endY = canvas.height;
    } else {
      endY = findSafeCutY(ctx, canvas.width, canvas.height, rawEnd);
    }
    endY = Math.max(endY, y + 1);

    if (pageNum > 0) pdf.addPage();
    addSliceToPDF(pdf, canvas, y, endY, pageNum === 0 ? 0 : padPx);

    y = endY;
    pageNum++;
  }

  // ── 3. References page — separate render, clean page ────────────────────
  if (refsEl) {
    const refsCanvas = await html2canvas(refsEl, {
      scale:       PDF_SCALE,
      useCORS:     true,
      logging:     false,
      width:       A4_W_PX,
      windowWidth: A4_W_PX,
      backgroundColor: '#ffffff',
    });
    pdf.addPage();
    addSliceToPDF(pdf, refsCanvas, 0, refsCanvas.height, padPx);
  }

  void filename;
  return pdf.output('blob');
}
