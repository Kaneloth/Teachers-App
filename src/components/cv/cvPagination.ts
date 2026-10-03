// Shared by CVPreviewDrawer.tsx and CVStepReview.tsx, which both render a
// hidden, full-size (forExport) copy of the CV purely to slice it into
// page-sized visual windows for an in-app preview. Previously each file
// carried its own copy of this logic (per a comment in CVPreviewDrawer:
// "Kept in sync manually since these two components don't share a
// constants file") and both just cut at a blind `i * PAGE_HEIGHT` pixel
// offset — which can (and did) slice straight through the middle of a
// line of text right at the page boundary, and let References start
// wherever there happened to be room left on the previous page instead of
// always opening its own final page.
//
// This can't be a pixel-perfect match for the real PDF: cvExport.ts paginates
// from jsPDF's own point-based text measurement, which never lines up
// exactly with the browser's CSS layout of the same content (see the longer
// comment this was lifted from in CVStepReview.tsx). What it CAN fix:
// 1) never cut through a line/bullet/heading — snap each break to the
//    nearest safe (leaf-element) boundary at or before the page height, and
// 2) always start References on its own fresh final page — a hard rule the
//    real export already enforces via the `.cv-page` class (see
//    CVTemplateRenderer.tsx), which a DOM measurement can match exactly
//    since it isn't font-metric-dependent.

// A4 at 794px wide (96dpi, the same width the real export renders at) is
// ~1123px tall (297mm).
export const PAGE_HEIGHT = 1123;

export interface PageSlice {
  /** Offset (px) into the full rendered content where this page's visible window starts. */
  start: number;
  /** Offset (px) into the full rendered content where this page's visible window ends (exclusive). */
  end: number;
  /** True for the References page — always the last slice when references are present. */
  isReferences: boolean;
}

const FALLBACK: PageSlice[] = [{ start: 0, end: PAGE_HEIGHT, isReferences: false }];

export function computeSmartPageBreaks(root: HTMLElement): PageSlice[] {
  const rootRect = root.getBoundingClientRect();
  const totalHeight = rootRect.height;
  if (totalHeight <= 0) return FALLBACK;

  // Leaf elements (no element children) are the safe places to cut — every
  // template renders each line/bullet/heading as its own small leaf div or
  // span, so cutting at a leaf's bottom edge never slices through the
  // middle of one.
  const leafBottoms: number[] = [];
  const walk = (el: Element) => {
    const kids = el.children;
    if (kids.length === 0) {
      const r = el.getBoundingClientRect();
      if (r.height > 0) leafBottoms.push(r.bottom - rootRect.top);
    } else {
      for (let i = 0; i < kids.length; i++) walk(kids[i]);
    }
  };
  walk(root);
  leafBottoms.sort((a, b) => a - b);

  const referencesEl = root.querySelector('.cv-page');
  const forcedBreak = referencesEl
    ? (referencesEl as HTMLElement).getBoundingClientRect().top - rootRect.top
    : null;

  const nextBreak = (cursor: number, ceiling: number): number => {
    const target = Math.min(cursor + PAGE_HEIGHT, ceiling);
    if (target >= ceiling) return ceiling;
    let candidate = -1;
    for (const b of leafBottoms) {
      if (b > cursor && b <= target) candidate = b;
      if (b > target) break;
    }
    // No safe break found in range (e.g. one element taller than a full
    // page, like a large photo) — fall back to the old hard pixel cut
    // rather than producing a runaway or empty page.
    return candidate === -1 ? target : candidate;
  };

  const slices: PageSlice[] = [];
  let cursor = 0;
  const mainCeiling = forcedBreak ?? totalHeight;
  while (cursor < mainCeiling) {
    const b = nextBreak(cursor, mainCeiling);
    slices.push({ start: cursor, end: b, isReferences: false });
    cursor = b;
  }
  if (forcedBreak !== null) {
    cursor = forcedBreak;
    while (cursor < totalHeight) {
      const b = nextBreak(cursor, totalHeight);
      slices.push({ start: cursor, end: b, isReferences: true });
      cursor = b;
    }
  }
  return slices.length ? slices : FALLBACK;
}
