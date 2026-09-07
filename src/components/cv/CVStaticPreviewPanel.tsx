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
  /** Width of the panel in px — the internal zoom level is computed from
   *  this so the 794px-native CV always fills it exactly, rather than a
   *  hardcoded zoom fraction that would look wrong if the panel's own
   *  width (set by the parent's Tailwind classes) ever changes. */
  width?: number;
}

export default function CVStaticPreviewPanel({ data, width = 380 }: Props) {
  const [pageCount, setPageCount] = useState(1);
  const measureRef = useRef<HTMLDivElement>(null);

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

  const zoom = width / 794;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-foreground">Live Preview</p>
        <p className="text-xs text-muted-foreground mt-0.5">Updates as you type</p>
      </div>
      <div className="p-3 max-h-[calc(100vh-180px)] overflow-y-auto">
        <div style={{ zoom }} className="space-y-3">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg overflow-hidden border border-border bg-white shadow-sm"
              style={{ width: '794px', height: `${PAGE_HEIGHT}px`, position: 'relative' }}
            >
              <div style={{ position: 'absolute', top: `${-i * PAGE_HEIGHT}px`, left: 0 }}>
                <CVTemplateRenderer data={safeData} forExport />
              </div>
            </div>
          ))}
        </div>
        {pageCount > 1 && (
          <p className="text-xs text-muted-foreground text-center mt-2">This CV will print as {pageCount} pages</p>
        )}
      </div>

      {/* Hidden full-size render used only to measure real page count — the
          visible preview above is zoomed down, which reports a shrunken
          scrollHeight if measured directly. */}
      <div style={{ position: 'absolute', top: 0, left: '-9999px', visibility: 'hidden' }}>
        <div ref={measureRef} style={{ width: '794px' }}>
          <CVTemplateRenderer data={safeData} forExport />
        </div>
      </div>
    </div>
  );
}
