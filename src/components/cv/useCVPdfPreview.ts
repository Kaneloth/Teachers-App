import { useEffect, useRef, useState } from 'react';
import { exportElementAsPDF } from '@/utils/cvExport';
import * as pdfjsLib from 'pdfjs-dist';
// Vite worker-URL import convention. Requires `pdfjs-dist` as a real
// dependency (`npm install pdfjs-dist`) — this repo didn't have it before,
// since nothing previously rendered a PDF back into the browser.
// @ts-ignore -- resolved by Vite's ?url suffix, not a real TS module
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export interface PdfPreviewPage {
  dataUrl: string;
  width: number;
  height: number;
  /** True for the References page, detected from the real rendered page's
   *  own text layer rather than guessed from CV data shape. */
  isReferences: boolean;
}

export interface CVPdfPreviewResult {
  pages: PdfPreviewPage[];
  loading: boolean;
  error: string | null;
}

/**
 * Generates the in-app CV preview by running the exact same PDF-generation
 * code path the real download uses (exportElementAsPDF -> cvExport.ts's
 * per-template jsPDF drawing functions) and rasterizing ITS actual output
 * pages — instead of approximating pagination from the separate React/CSS
 * preview (CVTemplateRenderer.tsx) the way this used to work.
 *
 * That DOM-based approach (see the now-unused cvPagination.ts) could only
 * ever be an approximation: cvExport.ts computes its own layout per
 * template directly in jsPDF, from jsPDF's point-based text measurement,
 * which is a genuinely different system from the browser's CSS layout of
 * CVTemplateRenderer.tsx. In practice the two disagreed on both where
 * pages broke AND how many pages a CV ran to (confirmed — a CV that
 * downloads as 2 pages was previewing as 3, with content split
 * differently between them). Rendering the real generated PDF is the only
 * way the preview can actually match what gets downloaded, because it IS
 * what gets downloaded, just rasterized to a canvas here instead of saved
 * to disk.
 *
 * This charges no credits: `deduct()` is only ever called around the real
 * download button in CVStepReview.tsx, never here, and exportElementAsPDF
 * itself has no credit logic of its own — it just draws and returns a
 * Blob. Its `_container` parameter is unused by the function (confirmed
 * from its source — everything it draws comes from the `cvData` argument),
 * so there's no hidden full-size DOM render needed to call it anymore.
 */
export function useCVPdfPreview(
  data: Record<string, unknown>,
  enabled: boolean,
  scale = 2,
): CVPdfPreviewResult {
  const [pages, setPages] = useState<PdfPreviewPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  // Deep-compared via JSON rather than the `data` reference itself —
  // callers typically pass a freshly spread `{ ...data, ... }` object on
  // every render, which would otherwise reset the debounce timer below on
  // every parent re-render (including ones unrelated to CV content) and
  // could in principle never let it actually fire.
  const dataKey = JSON.stringify(data);

  useEffect(() => {
    if (!enabled) return;
    const myRun = ++generation.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const blob = await exportElementAsPDF(document.body, 'preview.pdf', data);
        if (myRun !== generation.current) return; // superseded by a newer edit
        const buf = await blob.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        const nextPages: PdfPreviewPage[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const pg = await doc.getPage(i);
          const viewport = pg.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) await pg.render({ canvasContext: ctx, viewport }).promise;
          // The References heading is drawn right at the top of its own
          // page (refsPage() in cvExport.ts always forces a fresh page) —
          // checking just the first handful of text items is enough to
          // tell without false-matching a reference's own text lower down
          // a long page.
          const textContent = await pg.getTextContent();
          const topText = textContent.items.slice(0, 8).map((it: any) => it.str || '').join(' ');
          nextPages.push({
            dataUrl: canvas.toDataURL('image/png'),
            width: viewport.width,
            height: viewport.height,
            isReferences: /references/i.test(topText),
          });
        }
        if (myRun !== generation.current) return;
        setPages(nextPages);
      } catch (e) {
        if (myRun !== generation.current) return;
        console.error('[useCVPdfPreview] failed to generate preview', e);
        setError('Preview unavailable — try again in a moment.');
      } finally {
        if (myRun === generation.current) setLoading(false);
      }
      // Debounced — this runs the real PDF generator, which is heavier
      // than the old DOM measurement, so it shouldn't fire on every single
      // keystroke while editing.
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, enabled, scale]);

  return { pages, loading, error };
}
