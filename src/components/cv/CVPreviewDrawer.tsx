import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, Eye, Loader2 } from 'lucide-react';
import CVTemplateRenderer from './CVTemplateRenderer';
import ATSScoreBadge from './ATSScoreBadge';
import { useCVPdfPreview } from './useCVPdfPreview';
import CVPreviewPageGuard from './CVPreviewPageGuard';

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
  /** Whether the real download will carry the free-tier watermark — pass
   *  the same value CVStepReview.tsx computes (hasPurchased/isAdmin/the
   *  cv_watermark feature gate) so this preview matches what downloading
   *  right now would actually produce. Defaults to false (no watermark)
   *  if the parent doesn't have that gating result handy. */
  watermark?: boolean;
  /** Pass `!hasPurchased && !isAdmin` (same signal CVStepReview.tsx uses
   *  for previewResolutionRestricted) so an unpaid user's preview renders
   *  at a reduced resolution — still legible on-screen, but a screenshot
   *  or saved copy of it is visibly soft if blown up or printed, instead
   *  of a crisp, directly reusable copy of the finished CV. Defaults to
   *  true (the safer choice) if the parent doesn't pass this. */
  lowRes?: boolean;
}

export default function CVPreviewDrawer({ data, ownerName, onHandleHeight, watermark = false, lowRes = true }: Props) {
  const [open, setOpen] = useState(false);
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

  // Measure the real sticky app header the same way — see AppLayout.tsx's
  // <div className="sticky top-0 z-40 ..."><AppHeader /></div>. The
  // expanded panel below is deliberately kept BELOW this header (never
  // covering or dimming it) rather than using inset-0 like a normal
  // bottom-sheet would: with the header always eating a fixed chunk of
  // the viewport, the panel's available height can never reach "the
  // entire screen", so a single screenshot can never capture a whole CV
  // page top-to-bottom even on a long CV — there's always a cropped edge
  // and the header visible above it, both signalling "this is a partial
  // preview, not the real thing".
  const [headerHeight, setHeaderHeight] = useState(56); // reasonable fallback until measured
  useEffect(() => {
    const header = document.querySelector('.sticky.top-0.z-40') as HTMLElement | null;
    if (!header) return;
    const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const safeData = {
    ...data,
    skills: {
      ...data.skills,
      languages: (data.skills?.languages || []).map(normalizeLanguage),
    },
  };

  // Renders the real, downloadable PDF (same exportElementAsPDF code path
  // as the actual download button) and rasterizes its actual pages —
  // instead of approximating pagination from this component's own DOM/CSS
  // layout, which cvExport.ts's independent jsPDF-based layout doesn't
  // reliably agree with (confirmed: a CV that downloads as 2 pages was
  // previewing as 3, with different content on each). See
  // useCVPdfPreview.ts for the full rationale. Only runs while the panel
  // is open (`enabled: open`) — no point spending a real PDF generation on
  // every keystroke while the user hasn't even opened this to look.
  const { pages, loading, error } = useCVPdfPreview({ ...safeData, watermark }, open, lowRes ? 0.75 : 1.5);

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
          {/* This small thumbnail is just a glance indicator, not the
              accurate paginated preview — it stays a cheap live
              CVTemplateRenderer render rather than a generated-PDF
              rasterization, since generating a real PDF for a 36px-wide
              thumbnail on every keystroke would be wasted work. */}
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
        <div
          className="fixed left-0 right-0 bottom-0 z-[60] flex flex-col justify-end"
          style={{ top: `${headerHeight}px` }}
        >
          {/* Backdrop only covers the area below the header — the header
              itself is never dimmed or hidden behind it (see headerHeight
              above for why that matters for how much of a page can ever
              be on screen at once). */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className="relative bg-muted rounded-t-3xl overflow-hidden flex flex-col"
            style={{
              // 97% of the space already left over after the header —
              // not 97vh of the full screen — so the header's height
              // compounds with this margin rather than being eaten by it.
              // Pushed up from 90% → 97% to close most of the gap between
              // the header and the sheet, while the small remainder still
              // keeps the backdrop (and therefore the header above it)
              // visibly reachable rather than the sheet butting flush
              // against the header's bottom edge.
              height: '97%',
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

            {/* Real downloaded-PDF pages, rasterized — see useCVPdfPreview.ts.
                pages.length === 0 && loading: first generation for this
                open, nothing to show yet. pages.length > 0 && loading: a
                newer edit is being re-rendered — keep showing the last
                good pages rather than blanking out, with a small spinner. */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {pages.length === 0 && loading && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-xs">Rendering preview…</p>
                </div>
              )}
              {error && pages.length === 0 && (
                <p className="text-xs text-destructive text-center py-16">{error}</p>
              )}
              <div className="space-y-3 mx-auto" style={{ maxWidth: '380px' }}>
                {pages.map((page, i) => (
                  <div key={i}>
                    {pages.length > 1 && (
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textAlign: 'center', margin: '0 0 6px' }}>
                        {page.isReferences ? 'References' : `Page ${i + 1} of ${pages.length}`}
                      </p>
                    )}
                    <CVPreviewPageGuard
                      src={page.dataUrl}
                      alt={page.isReferences ? 'References page' : `Page ${i + 1}`}
                      className="w-full rounded-xl overflow-hidden border border-border bg-white shadow-sm block"
                    />
                  </div>
                ))}
              </div>
              {loading && pages.length > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Updating preview…
                </p>
              )}
              {!loading && pages.length > 1 && (
                <p className="text-xs text-muted-foreground text-center mt-3">This CV will print as {pages.length} pages</p>
              )}
              {!loading && pages.length > 0 && (
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  The "PREVIEW" watermark above is just for browsing — it won't appear in your downloaded PDF.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
