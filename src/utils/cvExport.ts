/**
 * Smart PDF export for CV templates.
 *
 * Cut strategy:
 * - Proposed cut = A4 boundary (pageHpx from previous cut)
 * - Search window = ±80px around proposed cut, CONTENT COLUMN ONLY (right 55%)
 * - Score each row by whiteness; pick the row with the highest score
 * - If the best row is ABOVE the proposed cut, that's fine (small footer gap)
 * - If it's BELOW, the extra content becomes top-padding on next page
 * - White threshold lowered to 60% to handle light-grey backgrounds
 *
 * Key insight: the sidebar is always a solid colour so we skip it entirely
 * when scoring rows. We only look at the text content column.
 */

const PDF_SCALE       = 2;
const A4_W_PX         = 794;
const A4_W_PT         = 595.28;
const A4_H_PT         = 841.89;
const PAGE_TOP_PAD_PX = 36;   // padding at top of page 2+ (logical px)
const SEARCH_PX       = 80;   // search ±80 logical px around cut point

function findSafeCutY(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  proposedY: number,
): number {
  const searchPx = Math.round(SEARCH_PX * PDF_SCALE);
  const scanTop  = Math.max(0,            proposedY - searchPx);
  const scanBot  = Math.min(canvasHeight, proposedY + searchPx);
  const scanH    = scanBot - scanTop;
  if (scanH <= 0) return proposedY;

  // Only scan the content column — skip the left 40% (sidebar area)
  const startX = Math.floor(canvasWidth * 0.40);
  const w      = canvasWidth - startX;

  let data: ImageData;
  try { data = ctx.getImageData(startX, scanTop, w, scanH); }
  catch { return proposedY; }

  let bestY = proposedY, bestScore = -1;

  for (let dy = 0; dy < scanH; dy++) {
    let light = 0;
    for (let x = 0; x < w; x++) {
      const i = (dy * w + x) * 4;
      // Count pixels that are near-white (>220 on all channels)
      if (data.data[i] > 220 && data.data[i+1] > 220 && data.data[i+2] > 220) light++;
    }
    const score = light / w;

    // Prefer rows that are very blank (>75% white)
    // Among equally-scoring rows, prefer ones closer to the proposed cut
    // to minimize both footer gap and header bleed
    if (score > bestScore && score > 0.75) {
      // Bias: slightly prefer rows at or below proposedY (smaller footer gap)
      const distancePenalty = (scanTop + dy) < proposedY ? 0.01 : 0;
      if (score - distancePenalty > bestScore) {
        bestScore = score - distancePenalty;
        bestY     = scanTop + dy;
      }
    }
  }

  // If no row was >75% white, fall back to the single whitest row
  if (bestScore < 0) {
    bestScore = -1;
    for (let dy = 0; dy < scanH; dy++) {
      let light = 0;
      for (let x = 0; x < w; x++) {
        const i = (dy * w + x) * 4;
        if (data.data[i] > 220 && data.data[i+1] > 220 && data.data[i+2] > 220) light++;
      }
      const score = light / w;
      if (score > bestScore) { bestScore = score; bestY = scanTop + dy; }
    }
  }

  return bestY;
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
  const tctx   = tmp.getContext('2d')!;

  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, tmp.width, tmp.height);
  tctx.drawImage(canvas, 0, startY, canvas.width, contentH, 0, topPad, canvas.width, contentH);

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

  // ── 2. Slice at A4 boundaries ────────────────────────────────────────────
  const pdf = new jsPDF({ format: 'a4', unit: 'pt', compress: true });
  let y = 0, pageNum = 0;

  while (y < canvas.height) {
    const availH = pageNum === 0 ? pageHpx : pageHpx - padPx;
    const rawEnd = y + availH;

    let endY: number;
    if (rawEnd >= canvas.height) {
      endY = canvas.height;
    } else {
      endY = findSafeCutY(ctx, canvas.width, canvas.height, rawEnd);
      endY = Math.max(endY, y + 1);
    }

    if (pageNum > 0) pdf.addPage();
    addSliceToPDF(pdf, canvas, y, endY, pageNum === 0 ? 0 : padPx);

    y = endY;
    pageNum++;
  }

  // ── 3. References — separate render, clean page ──────────────────────────
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
    addSliceToPDF(pdf, refsCanvas, 0, refsCanvas.height, padPx);
  }

  void filename;
  return pdf.output('blob');
}
