import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, Eye } from 'lucide-react';
import CVTemplateRenderer from './CVTemplateRenderer';
import ATSScoreBadge from './ATSScoreBadge';

// Same A4-at-96dpi convention CVStepReview.tsx's pagination uses — 794px
// wide, ~1123px tall per page. Kept in sync manually since these two
// components don't share a constants file; if you ever change one, check
// the other.
const PAGE_HEIGHT = 1123;

// Same safety net as CVStepReview.tsx (see that file for the full
// rationale) — AI-imported data can occasionally produce a structured
// language entry like { language: 'English', speak: true } instead of a
// plain string, which crashes React if handed straight to
// CVTemplateRenderer as a child. This drawer renders live data on every
// step BEFORE the user ever reaches Review, so it needs this
// independently rather than relying on Review's copy running first.
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
  /** Collapsed handle always renders; expanded panel is portaled to <body>
   *  to escape CVBuilderPage's framer-motion ancestors (their `transform`
   *  would otherwise make `position: fixed` anchor to the wrong box —
   *  same issue the purchase modal already had to solve this way). */
  ownerName?: string;
  /** Called with the collapsed handle's real rendered height (including
   *  when it's 0, once unmounted) so the parent page can reserve exactly
   *  that much extra bottom padding — otherwise content sitting at the
   *  very bottom of a step (Save & Exit, Reset CV) scrolls up underneath
   *  this fixed-position handle and gets visually covered by it. */
  onHandleHeight?: (px: number) => void;
}

export default function CVPreviewDrawer({ data, ownerName, onHandleHeight }: Props) {
  const [open, setOpen] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const measureRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);

  // Report the handle's real height to the parent whenever it changes
  // (font/zoom differences, or the handle unmounting on step 7 → 0).
  useEffect(() => {
    if (!onHandleHeight) return;
    if (open || !handleRef.current) { onHandleHeight(0); return; }
    const el = handleRef.current;
    const report = () => onHandleHeight(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, onHandleHeight]);

  // Measure the REAL bottom nav height instead of guessing at it — an
  // earlier hardcoded 80px estimate was wrong (too tall on some screens,
  // leaving a visible gap; too short on others, letting the nav's higher
  // z-index render over part of the handle and hide it). Same selector
  // CreditBalance.tsx already uses elsewhere to find this exact element
  // (AppLayout.tsx's <nav className="fixed bottom-0 ...">).
  const [navHeight, setNavHeight] = useState(64); // reasonable fallback until measured
  useEffect(() => {
    const nav = document.querySelector('nav.fixed.bottom-0') as HTMLElement | null;
    if (!nav) return;
    const measure = () => setNavHeight(nav.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  const safeData = {
    ...data,
    skills: {
      ...data.skills,
      languages: (data.skills?.languages || []).map(normalizeLanguage),
    },
  };

  // Re-measure whenever the CV data changes (new bullet, new section, etc.)
  // or the panel opens (closed panels aren't laid out by the browser, so a
  // measurement taken while closed can be stale/zero).
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => setPageCount(Math.max(1, Math.ceil(el.scrollHeight / PAGE_HEIGHT)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data, open]);

  // ── Drag-to-close on the expanded panel's handle ──────────────────────────
  // Deliberately does NOT handle drag-to-OPEN — tapping the collapsed bar
  // already opens it instantly, and a free-dragging open gesture adds a lot
  // of edge-case handling (velocity thresholds, rubber-banding) for a
  // motion most people will just tap through anyway. Drag-to-dismiss on the
  // already-open panel is the polish that makes it feel alive; the initial
  // open doesn't need to be a drag too.
  const dragRef = useRef({ startY: 0, dy: 0, active: false });
  const [dragY, setDragY] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const onHandleTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, dy: 0, active: true };
  };
  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current.active) return;
    const dy = Math.max(0, e.touches[0].clientY - dragRef.current.startY); // only allow dragging DOWN
    dragRef.current.dy = dy;
    setDragY(dy);
  };
  const onHandleTouchEnd = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const closeThreshold = (panelRef.current?.clientHeight ?? 600) * 0.25;
    if (dragRef.current.dy > closeThreshold) setOpen(false);
    setDragY(0);
  };

  // Lock background scroll while the panel is open — otherwise a touch
  // that starts on the backdrop can scroll the CV Builder step underneath.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  const previewNode = (
    <div ref={measureRef} style={{ width: '794px' }}>
      <CVTemplateRenderer data={safeData} forExport cvType={safeData.cvType} />
    </div>
  );

  return (
    <>
      {/* ── Collapsed handle — portaled to <body> for the same reason as the
             expanded panel below: CVBuilderPage renders inside AppLayout's
             swipeable tab strip for general users, which applies a CSS
             transform for the swipe animation. A transformed ancestor
             becomes the containing block for any `position: fixed`
             descendant, so without this portal the handle was being
             positioned relative to that shifted, horizontally-translated
             strip container instead of the real viewport — not just a
             wrong pixel value, but the wrong coordinate system entirely. ── */}
      {!open && createPortal(
        <button
          ref={handleRef}
          onClick={() => setOpen(true)}
          className="fixed left-0 right-0 z-[55] bg-card border-t border-border shadow-[0_-2px_12px_rgba(0,0,0,0.06)] flex items-center gap-3 px-4 py-2.5"
          style={{ bottom: `${navHeight}px` }}
        >
          <div className="w-9 h-11 rounded-md overflow-hidden border border-border bg-white shrink-0 relative">
            <div style={{ zoom: 36 / 794, pointerEvents: 'none' }}>
              <CVTemplateRenderer data={safeData} cvType={safeData.cvType} />
            </div>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Eye className="w-3 h-3" /> Live Preview
            </p>
            <p className="text-[11px] text-primary font-medium truncate">Tap to view full CV</p>
          </div>
          <ATSScoreBadge data={safeData} compact />
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>,
        document.body
      )}

      {/* ── Expanded panel — portaled to <body> to escape the framer-motion
             transform ancestors in CVBuilderPage.tsx ── */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className="relative bg-muted rounded-t-3xl overflow-hidden flex flex-col"
            style={{
              height: '90vh',
              transform: `translateY(${dragY}px)`,
              transition: dragRef.current.active ? 'none' : 'transform 0.2s ease-out',
            }}
          >
            {/* Drag handle */}
            <div
              className="shrink-0 bg-card border-b border-border pt-2 pb-3 px-4 flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing"
              onTouchStart={onHandleTouchStart}
              onTouchMove={onHandleTouchMove}
              onTouchEnd={onHandleTouchEnd}
            >
              <div className="w-10 h-1 rounded-full bg-border" />
              <div className="w-full flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Live Preview</p>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="shrink-0 bg-card px-4 pb-3">
              <ATSScoreBadge data={safeData} />
            </div>

            {/* Paginated preview — same slicing technique as CVStepReview.tsx:
                render the full content once per page, each clipped to a
                1123px window and shifted up to reveal that page's slice. */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div style={{ zoom: 0.4 }} className="space-y-3 mx-auto" >
                {Array.from({ length: pageCount }).map((_, i) => (
                  <div key={i}>
                    {pageCount > 1 && (
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textAlign: 'center', margin: '0 0 6px' }}>
                        Page {i + 1} of {pageCount}
                      </p>
                    )}
                    <div
                      className="rounded-xl overflow-hidden border border-border bg-white shadow-sm mx-auto"
                      style={{ width: '794px', height: `${PAGE_HEIGHT}px`, position: 'relative' }}
                    >
                      <div style={{ position: 'absolute', top: `${-i * PAGE_HEIGHT}px`, left: 0 }}>
                        <CVTemplateRenderer data={safeData} forExport cvType={safeData.cvType} />
                      </div>
                      {/* See CVStepReview.tsx for why this fade + label exist —
                          this pixel-height slicing can cut a line of text
                          right at the page boundary, unlike cvExport.ts's
                          real line-aware pagination. This softens the cut
                          visually and the label makes clear these are
                          sequential pages, not separate/broken content. */}
                      {i < pageCount - 1 && (
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px',
                          background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.95))',
                          pointerEvents: 'none',
                        }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {pageCount > 1 && (
                <p className="text-xs text-muted-foreground text-center mt-3">This CV will print as {pageCount} pages — page breaks shown here are approximate</p>
              )}
            </div>

            {/* Hidden full-size render used only to measure real page count —
                the visible preview above is zoomed down, which reports a
                shrunken scrollHeight if measured directly. */}
            <div style={{ position: 'absolute', top: 0, left: '-9999px', visibility: 'hidden' }}>
              {previewNode}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
