/**
 * Smart PDF export for CV templates.
 *
 * Strategy
 * ────────
 * 1. Render the WHOLE container with html2canvas (keeps watermark + overlays).
 * 2. If `.cv-page` divs are present, use their measured offsetTop/offsetHeight
 *    to determine where to slice the canvas — one PDF page per cv-page div.
 * 3. If a single cv-page slice is taller than one A4 page (content overflows),
 *    sub-slice it using content-aware row scanning: scan near the boundary for
 *    the lightest (most-blank) row and cut there instead of through text.
 * 4. If there are no .cv-page divs at all, fall back to content-aware slicing
 *    of the full canvas.
 *
 * Result: no more lines cut in half, sidebar stays on page 1 only.
 */

const PDF_SCALE  = 2;          // retina quality render
const A4_W_PX    = 794;        // logical CSS pixels (matches template width)
const A4_W_PT    = 595.28;     // jsPDF A4 width  in points
const A4_H_PT    = 841.89;     // jsPDF A4 height in points

// ── Content-aware cut finder ──────────────────────────────────────────────

/**
 * Scans ±searchPx rows around `proposedY` in the canvas and returns the row
 * index that has the most light (background) pixels in the content area
 * (right 65 % of canvas, skipping dark sidebar columns on the left).
 *
 * Falls back to `proposedY` if the canvas context is unavailable.
 */
function findSafeCutY(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  proposedY: number,
  searchPx = 28,
): number {
  const scanTop = Math.max(0,           proposedY - searchPx);
  const scanBot = Math.min(canvasHeight, proposedY + searchPx);
  const scanH   = scanBot - scanTop;
  if (scanH <= 0) return proposedY;

  // Only look at the content area (skip the left sidebar column)
  const startX = Math.floor(canvasWidth * 0.28);
  const w      = canvasWidth - startX;

  let data: ImageData;
  try {
    data = ctx.getImageData(startX, scanTop, w, scanH);
  } catch {
    return proposedY;
  }

  let bestY    = proposedY;
  let bestScore = -1;

  for (let dy = 0; dy < scanH; dy++) {
    const rowOff = dy * w * 4;
    let light = 0;
    for (let x = 0; x < w; x++) {
      const i = rowOff + x * 4;
      if (data.data[i] > 230 && data.data[i + 1] > 230 && data.data[i + 2] > 230) light++;
    }
    const score = light / w;
    if (score > bestScore) {
      bestScore = score;
      bestY     = scanTop + dy;
    }
  }
  return bestY;
}

// ── Slice renderer ────────────────────────────────────────────────────────

type PDF = InstanceType<import('jspdf').jsPDF>;

function addSliceToPDF(
  pdf: PDF,
  canvas: HTMLCanvasElement,
  startY: number,
  endY: number,
): void {
  const h = endY - startY;
  if (h <= 0) return;

  const tmp  = document.createElement('canvas');
  tmp.width  = canvas.width;
  tmp.height = h;
  const tCtx = tmp.getContext('2d')!;
  tCtx.drawImage(canvas, 0, startY, canvas.width, h, 0, 0, canvas.width, h);

  // Scale proportionally to fit PDF page width; centre vertically if shorter
  const imgH = (h / canvas.width) * A4_W_PT;
  const drawH = Math.min(imgH, A4_H_PT);
  const drawW = (drawH / imgH) * A4_W_PT;
  const xOff  = (A4_W_PT - drawW) / 2;

  pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', xOff, 0, drawW, drawH);
}

// ── Public API ────────────────────────────────────────────────────────────

export async function exportElementAsPDF(
  container: HTMLElement,
  filename: string,
): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF }                = await import('jspdf');

  // ── 1. Render the full container to one canvas ───────────────────────────
  const canvas = await html2canvas(container, {
    scale:       PDF_SCALE,
    useCORS:     true,
    logging:     false,
    width:       A4_W_PX,
    windowWidth: A4_W_PX,
  });

  const ctx      = canvas.getContext('2d')!;
  const scale    = canvas.width / A4_W_PT;           // canvas px per PDF point
  const pageHpx  = Math.round(A4_H_PT * scale);      // one A4 page in canvas pixels

  // ── 2. Determine slice boundaries ────────────────────────────────────────
  const pageEls = Array.from(
    container.querySelectorAll<HTMLElement>('.cv-page'),
  );

  type Slice = [number, number];   // [canvasStartY, canvasEndY]
  let slices: Slice[];

  if (pageEls.length > 1) {
    // Use cv-page div positions — each div is one logical page
    slices = pageEls.map(el => {
      // Walk up to container to get the true offsetTop relative to container
      let top = 0;
      let cur: HTMLElement | null = el;
      while (cur && cur !== container) {
        top += cur.offsetTop;
        cur  = cur.offsetParent as HTMLElement | null;
      }
      const startPx = Math.round(top                   * PDF_SCALE);
      const endPx   = Math.round((top + el.offsetHeight) * PDF_SCALE);
      return [startPx, endPx] as Slice;
    });
  } else {
    // No (or only one) cv-page div: fall back to content-aware page slicing
    slices = [];
    let y = 0;
    while (y < canvas.height) {
      const rawEnd  = Math.min(y + pageHpx, canvas.height);
      const safeEnd = rawEnd < canvas.height
        ? findSafeCutY(ctx, canvas.width, canvas.height, rawEnd)
        : rawEnd;
      slices.push([y, Math.max(safeEnd, y + 1)]);
      y = safeEnd;
    }
  }

  // ── 3. Build the PDF ──────────────────────────────────────────────────────
  const pdf = new jsPDF({ format: 'a4', unit: 'pt', compress: true });
  let pageNum = 0;

  for (const [startY, endY] of slices) {
    const sliceH = endY - startY;
    if (sliceH <= 0) continue;

    if (pageNum > 0) pdf.addPage();

    if (sliceH > pageHpx * 1.05) {
      // Slice is too tall for one PDF page — sub-divide with content-aware cuts
      let subY    = startY;
      let subPage = 0;
      while (subY < endY) {
        if (subPage > 0) pdf.addPage();
        const rawCut  = Math.min(subY + pageHpx, endY);
        const safeCut = rawCut < endY
          ? findSafeCutY(ctx, canvas.width, canvas.height, rawCut)
          : rawCut;
        addSliceToPDF(pdf, canvas, subY, Math.max(safeCut, subY + 1));
        subY = safeCut;
        subPage++;
      }
    } else {
      addSliceToPDF(pdf, canvas, startY, endY);
    }

    pageNum++;
  }

  // Discard the initial blank page jsPDF creates, if we added at least one page
  // (jsPDF starts with one page already — we add a new page before each slice
  //  except the first, so page count is exactly slices.length)
  void filename; // filename is not used by jsPDF.output but kept for API compat
  return pdf.output('blob');
}
