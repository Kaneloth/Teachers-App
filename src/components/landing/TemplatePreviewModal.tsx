import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CVTemplateRenderer from '@/components/cv/CVTemplateRenderer';
import { SAMPLE_DATA, PAGE_WIDTH_PX, TEMPLATES } from '@/components/cv/CVStepTemplate';

// A plain blank box with no error message (the symptom reported against
// this modal) is the single hardest failure mode to debug — it looks
// identical whether the data is wrong, a template threw, or nothing
// rendered at all. This boundary turns that into a visible, specific
// message instead of silence, so a real rendering bug is diagnosable from
// a screenshot alone rather than needing the browser console.
class TemplateRenderBoundary extends Component<{ templateId: string; children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.error(`[TemplatePreviewModal] "${this.props.templateId}" failed to render:`, err, info.componentStack);
  }
  componentDidUpdate(prev: { templateId: string }) {
    if (prev.templateId !== this.props.templateId && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-full p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-red-600 mb-1">Couldn't render this template</p>
            <p className="text-xs text-[#6B7280]">{this.state.error}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface TemplatePreviewModalProps {
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

/**
 * The A4-frame template picker modal for the public /explore/career-tools
 * gallery. Opened by clicking a thumbnail in TemplateGalleryGrid; shows the
 * selected template at full detail (same live CVTemplateRenderer the CV
 * builder itself uses, so this is exactly what a visitor's CV will look
 * like), with prev/next to flip through the rest of the gallery without
 * closing the modal, and a "Use this template" CTA that hands the choice
 * off to sign-up.
 *
 * Handoff mechanism: the chosen template id is written to localStorage
 * (read once and consumed by CVBuilderPage.tsx on first load) rather than
 * a query param, so it survives the sign-up → email-confirm → onboarding
 * hop without needing to be threaded through every intermediate redirect.
 */
// A4 height-to-width ratio (297/210), used only as a plausible first-paint
// guess for a single-page CV before the real content height is measured.
const A4_RATIO = 297 / 210;

// Zoom multiplier applied on top of the auto-fit scale. Clamped so "Use
// this template" and the arrows stay reachable (zoom never has to be
// undone to find the CTA again) and so zooming out can't shrink the page
// to the point of being illegible.
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.25;
// 100% (the raw auto-fit size) crowds the page against the frame edges —
// 75% reads better by default, with room to zoom in from there.
const DEFAULT_ZOOM = 0.75;

export default function TemplatePreviewModal({ index, onClose, onNavigate }: TemplatePreviewModalProps) {
  const navigate = useNavigate();
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [baseScale, setBaseScale] = useState(0.4);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  // The *unscaled* height of the rendered CV, in px. A CV with references
  // (like the sample data) renders as two stacked A4 pages, not one — a
  // fixed single-page aspect-ratio box would clip the second page with no
  // way to reach it. Instead the frame's height always matches the real
  // content (scaled), so the modal's own scroll area (below) can reach
  // every page, however many there are.
  const [contentHeight, setContentHeight] = useState(PAGE_WIDTH_PX * A4_RATIO);
  const template = TEMPLATES[index];
  const scale = baseScale * zoom;

  // Zoom is relative to each template's own auto-fit size, not an absolute
  // number — resetting it when the template changes means switching
  // templates never leaves the next one stuck at a zoom level that made
  // sense for a differently-sized previous one.
  useEffect(() => { setZoom(DEFAULT_ZOOM); }, [template.id]);

  useEffect(() => {
    const frameOuterEl = frameRef.current?.parentElement;
    if (!frameOuterEl) return;
    const measureWidth = () => {
      const width = frameOuterEl.getBoundingClientRect().width;
      if (width > 0) setBaseScale(width / PAGE_WIDTH_PX);
    };
    measureWidth();
    const roWidth = new ResizeObserver(measureWidth);
    roWidth.observe(frameOuterEl);
    window.addEventListener('resize', measureWidth);
    return () => { roWidth.disconnect(); window.removeEventListener('resize', measureWidth); };
  }, []);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;
    // offsetHeight/ResizeObserver report the element's own pre-transform
    // layout size — unaffected by the `transform: scale()` applied to this
    // same node below — which is exactly the "real" height we need to then
    // multiply by scale ourselves for the frame's visual height.
    const measureHeight = () => {
      const height = contentEl.offsetHeight;
      if (height > 0) setContentHeight(height);
    };
    measureHeight();
    const roHeight = new ResizeObserver(measureHeight);
    roHeight.observe(contentEl);
    // Custom web fonts (several templates use non-system fonts) can finish
    // loading after this first measurement and reflow the text, changing
    // the real content height — re-measure once they're ready so the frame
    // doesn't stay sized for the pre-font-load layout.
    document.fonts?.ready?.then(measureHeight).catch(() => {});
    return () => roHeight.disconnect();
  }, [template.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  onNavigate((index - 1 + TEMPLATES.length) % TEMPLATES.length);
      if (e.key === 'ArrowRight') onNavigate((index + 1) % TEMPLATES.length);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [index, onClose, onNavigate]);

  const useThisTemplate = () => {
    try { localStorage.setItem('crosssa_selected_template', template.id); } catch {}
    navigate('/register');
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#1A1A2E]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          // A definite height (not just a max-height cap) matters here: a
          // flex column only distributes space to its flex-1 child when the
          // column itself has a definite size to distribute. With max-height
          // alone, the browser sizes the panel by hugging its children's
          // natural height first — so the content pane below also hugs its
          // (very tall, multi-page) content instead of being clamped to a
          // scrollable box, and nothing in it can actually scroll.
          className="relative w-full max-w-5xl h-[min(92vh,800px)] bg-white rounded-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5E7EB] shrink-0">
            <div>
              <p className="font-bold text-[#1A1A2E] text-sm">{template.name}</p>
              <p className="text-xs text-[#6B7280]">{index + 1} of {TEMPLATES.length} templates</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#F3F4F6] flex items-center justify-center text-[#6B7280]"
              aria-label="Close preview"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* A4 frame + prev/next. items-start (not center): a CV with a
              references page renders taller than this panel, and a
              vertically-centered flex child auto-scrolls to show its own
              *middle* on mount — confusing for a document preview, which
              should always open at the top of page 1, like any normal
              document viewer. Horizontal centering (mx-auto below) still
              applies for the common case where the frame is narrower than
              this column. */}
          <div className="relative flex-1 min-h-0 bg-[#F3F4F6]">
            {/* Arrows sit in this non-scrolling layer (a sibling of the
                scroll area, not a child of it) so they stay fixed on screen
                when a tall multi-page preview scrolls — previously they
                were inside the scrolling div and scrolled away with it. */}
            <button
              onClick={() => onNavigate((index - 1 + TEMPLATES.length) % TEMPLATES.length)}
              className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-[#1A1A2E] hover:bg-[#F8F9FB] z-10"
              aria-label="Previous template"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => onNavigate((index + 1) % TEMPLATES.length)}
              className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-[#1A1A2E] hover:bg-[#F8F9FB] z-10"
              aria-label="Next template"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Zoom controls — a non-scrolling layer so they stay put while
                the page below scrolls or is zoomed past the viewport. Top
                corner (not bottom) so they're never near the CTA footer. */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-white rounded-full shadow-md border border-[#E5E7EB] p-1">
              <button
                onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
                disabled={zoom <= ZOOM_MIN}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#1A1A2E] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(DEFAULT_ZOOM)}
                className="px-1.5 h-7 rounded-full flex items-center justify-center text-[#1A1A2E] hover:bg-[#F3F4F6] text-[11px] font-semibold tabular-nums min-w-[2.75rem]"
                aria-label="Reset zoom to default"
                title="Reset zoom"
              >
                {zoom === DEFAULT_ZOOM ? <RotateCcw className="w-3.5 h-3.5 mx-auto" /> : `${Math.round(zoom * 100)}%`}
              </button>
              <button
                onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
                disabled={zoom >= ZOOM_MAX}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#1A1A2E] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrolls both axes: zooming in can push the page wider and
                taller than this viewport, not just taller. */}
            <div className="h-full overflow-auto flex items-start justify-center px-4 sm:px-16 py-5">
            <div
              ref={frameRef}
              className="relative bg-white shadow-xl mx-auto overflow-hidden shrink-0"
              style={{ width: PAGE_WIDTH_PX * scale, height: contentHeight * scale }}
            >
              <div
                ref={contentRef}
                style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_WIDTH_PX, pointerEvents: 'none' }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <TemplateRenderBoundary templateId={template.id}>
                      <CVTemplateRenderer
                        data={{ ...SAMPLE_DATA, template: template.id } as any}
                        forExport={false}
                        watermark={false}
                        cvType="general"
                      />
                    </TemplateRenderBoundary>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            </div>
          </div>

          {/* Mobile prev/next + CTA footer */}
          <div className="px-5 py-4 border-t border-[#E5E7EB] shrink-0 flex items-center gap-3">
            <div className="flex sm:hidden items-center gap-1">
              <button onClick={() => onNavigate((index - 1 + TEMPLATES.length) % TEMPLATES.length)} className="w-8 h-8 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#1A1A2E]" aria-label="Previous template">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => onNavigate((index + 1) % TEMPLATES.length)} className="w-8 h-8 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#1A1A2E]" aria-label="Next template">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="hidden sm:block text-xs text-[#6B7280] flex-1 min-w-0 truncate pr-3">{template.description}</p>
            <Button
              onClick={useThisTemplate}
              className="ml-auto h-10 rounded-xl text-sm font-semibold bg-[#FF6B35] hover:bg-[#e55a2b] text-white border-0 px-5"
            >
              Use this template
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
