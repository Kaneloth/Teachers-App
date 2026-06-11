/**
 * Smart PDF export for CV templates.
 *
 * Strategy
 * ────────
 * 1. Render the WHOLE container with html2canvas.
 * 2. Use getBoundingClientRect() relative to container to measure each
 *    .cv-page div — works correctly for off-screen containers.
 * 3. Each .cv-page slice is stamped onto one PDF page.
 *    If a slice is taller than one A4 page (overflow content), sub-slice
 *    using content-aware row scanning that avoids cutting through text.
 * 4. Fallback to content-aware slicing if no .cv-page divs found.
 */

const PDF_SCALE = 2;
const A4_W_PX   = 794;
const A4_W_PT   = 595.28;
const A4_H_PT   = 841.89;

/**
 * Finds the best Y position to cut the canvas near proposedY.
 * Scans the content column (skips sidebar) for the whitest/most-blank row.
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

  // Scan the right 65% of canvas (content column, not sidebar)
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

function addSliceToPDF(pdf: PDF, canvas: HTMLCanvasElement, startY: number, endY: number): void {
  const h = endY - startY;
  if (h <= 0) return;
  const tmp  = document.createElement('canvas');
  tmp.width  = canvas.width;
  tmp.height = h;
  tmp.getContext('2d')!.drawImage(canvas, 0, startY, canvas.width, h, 0, 0, canvas.width, h);
  const imgH  = (h / canvas.width) * A4_W_PT;
  const drawH = Math.min(imgH, A4_H_PT);
  const drawW = (drawH / imgH) * A4_W_PT;
  pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', (A4_W_PT - drawW) / 2, 0, drawW, drawH);
}

export async function exportElementAsPDF(container: HTMLElement, filename: string): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF }                = await import('jspdf');

  // ── 1. Render ────────────────────────────────────────────────────────────
  const canvas = await html2canvas(container, {
    scale:       PDF_SCALE,
    useCORS:     true,
    logging:     false,
    width:       A4_W_PX,
    windowWidth: A4_W_PX,
  });

  const ctx     = canvas.getContext('2d')!;
  const pageHpx = Math.round(A4_H_PT * PDF_SCALE);

  // ── 2. Get .cv-page slice boundaries via getBoundingClientRect ───────────
  const pageEls = Array.from(container.querySelectorAll<HTMLElement>('.cv-page'));

  type Slice = [number, number];
  let slices: Slice[];

  if (pageEls.length >= 1) {
    const containerRect = container.getBoundingClientRect();
    slices = pageEls
      .map(el => {
        const r      = el.getBoundingClientRect();
        const startPx = Math.round(Math.max(0, r.top    - containerRect.top)  * PDF_SCALE);
        const endPx   = Math.round(Math.max(0, r.bottom - containerRect.top)  * PDF_SCALE);
        return [startPx, Math.min(endPx, canvas.height)] as Slice;
      })
      .filter(([s, e]) => e > s);
  } else {
    // Fallback
    slices = [];
    let y = 0;
    while (y < canvas.height) {
      const rawEnd  = Math.min(y + pageHpx, canvas.height);
      const safeEnd = rawEnd < canvas.height ? findSafeCutY(ctx, canvas.width, canvas.height, rawEnd) : rawEnd;
      slices.push([y, Math.max(safeEnd, y + 1)]);
      y = safeEnd;
    }
  }

  // ── 3. Build PDF — each slice = one PDF page (sub-split if too tall) ─────
  const pdf = new jsPDF({ format: 'a4', unit: 'pt', compress: true });
  let pageNum = 0;

  for (const [startY, endY] of slices) {
    const sliceH = endY - startY;
    if (sliceH <= 0) continue;
    if (pageNum > 0) pdf.addPage();

    if (sliceH > pageHpx * 1.02) {
      // Content overflows one A4 — sub-divide with smart cuts
      let subY = startY, subPage = 0;
      while (subY < endY) {
        if (subPage > 0) pdf.addPage();
        const rawCut  = Math.min(subY + pageHpx, endY);
        const safeCut = rawCut < endY ? findSafeCutY(ctx, canvas.width, canvas.height, rawCut) : rawCut;
        addSliceToPDF(pdf, canvas, subY, Math.max(safeCut, subY + 1));
        subY = safeCut;
        subPage++;
      }
    } else {
      addSliceToPDF(pdf, canvas, startY, endY);
    }

    pageNum++;
  }

  void filename;
  return pdf.output('blob');
}
