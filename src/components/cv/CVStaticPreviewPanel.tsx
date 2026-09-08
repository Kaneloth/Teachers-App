import { useEffect, useRef, useState } from 'react';
import CVTemplateRenderer from './CVTemplateRenderer';

// Same A4-at-96dpi convention CVStepReview.tsx / CVPreviewDrawer.tsx use —
// 794px wide, ~1123px tall per page. Duplicated here rather than shared,
// matching how this same constant is already independently defined in
// both of those files elsewhere in this codebase — see CVStepReview.tsx
// for the canonical explanation if this ever needs changing.
const PAGE_HEIGHT = 1123;

// Same safety net as CVStepReview.tsx / CVPreviewDrawer.tsx — see either
// for the full rationale. AI-imported data can occasionally produce a
// structured language entry instead of a plain string, which crashes
// React if handed straight to CVTemplateRenderer as a child.
function normalizeLanguage(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const obj = entry as { language?: string; read?: boolean; speak?: boolean; write?: boolean };
    const skillsList = [obj.read && 'read', obj.speak && 'speak', obj.write && 'write']
      .filter(Boolean)
      .join(', ');
    if (obj.language) return skillsList ? `${obj.language} (${skillsList})` : obj.language;
  }
  return String(entry);
}

interface Props {
  data: any;
  /** Optional fallback width in px, used only for the very first render
   *  before the container's real width has been measured (avoids a flash
   *  of near-zero-zoom content). Once mounted, the panel measures its own
   *  actual rendered width via ResizeObserver and computes zoom from that
   *  — so it correctly fills however much space its parent gives it,
   *  including a flexible/growing container, rather than being capped at
   *  a guessed pixel value that looks cramped on a wide screen. */
  fallbackWidth?: number;
}

export default function CVStaticPreviewPanel({ data, fallbackWidth = 420 }: Props) {
  const [pageCount, setPageCount] = useState(1);
  const measureRef = useRef<HTMLDivElement>(null);

  // Measures the CONTENT area of the scrollable wrapper below (the div
  // with the p-4 padding) — clientWidth includes padding on a
  // border-box element, so that's subtracted off to get the actual space
  // available for the zoomed CV itself.
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(fallbackWidth);
  useEffect(() => {
    const el = contentAreaRef.current;
    if (!el) return;
    const PADDING = 32; // p-4 = 16px each side
    const measure = () => setContentWidth(Math.max(200, el.clientWidth - PADDING));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safeData = {
    ...data,
    skills: {
      ...data.skills,
      languages: (data.skills?.languages || []).map(normalizeLanguage),
    },
  };

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => setPageCount(Math.max(1, Math.ceil(el.scrollHeight / PAGE_HEIGHT)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  const zoom = contentWidth / 794;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col max-h-[calc(100vh-32px)]">
      <div className="px-5 py-4 border-b border-border shrink-0">
        <p className="text-base font-semibold text-foreground">Live Preview</p>
        <p className="text-sm text-muted-foreground mt-0.5">Updates as you type</p>
      </div>
      <div ref={contentAreaRef} className="p-4 flex-1 overflow-y-auto min-h-0">
        <div style={{ zoom }} className="space-y-4">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg overflow-hidden border border-border bg-white shadow-md mx-auto"
              style={{ width: '794px', height: `${PAGE_HEIGHT}px`, position: 'relative' }}
            >
              <div style={{ position: 'absolute', top: `${-i * PAGE_HEIGHT}px`, left: 0 }}>
                <CVTemplateRenderer data={safeData} forExport cvType={safeData.cvType} />
              </div>
            </div>
          ))}
        </div>
        {pageCount > 1 && (
          <p className="text-xs text-muted-foreground text-center mt-3">This CV will print as {pageCount} pages</p>
        )}
      </div>

      {/* Hidden full-size render used only to measure real page count — the
          visible preview above is zoomed down, which reports a shrunken
          scrollHeight if measured directly. */}
      <div style={{ position: 'absolute', top: 0, left: '-9999px', visibility: 'hidden' }}>
        <div ref={measureRef} style={{ width: '794px' }}>
          <CVTemplateRenderer data={safeData} forExport cvType={safeData.cvType} />
        </div>
      </div>
    </div>
  );
}
