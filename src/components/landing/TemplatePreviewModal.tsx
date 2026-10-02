import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
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

export default function TemplatePreviewModal({ index, onClose, onNavigate }: TemplatePreviewModalProps) {
  const navigate = useNavigate();
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  // The *unscaled* height of the rendered CV, in px. A CV with references
  // (like the sample data) renders as two stacked A4 pages, not one — a
  // fixed single-page aspect-ratio box would clip the second page with no
  // way to reach it. Instead the frame's height always matches the real
  // content (scaled), so the modal's own scroll area (below) can reach
  // every page, however many there are.
  const [contentHeight, setContentHeight] = useState(PAGE_WIDTH_PX * A4_RATIO);
  const template = TEMPLATES[index];

  useEffect(() => {
    const frameEl = frameRef.current;
    if (!frameEl) return;
    const measureWidth = () => {
      const width = frameEl.getBoundingClientRect().width;
      if (width > 0) setScale(width / PAGE_WIDTH_PX);
    };
    measureWidth();
    const roWidth = new ResizeObserver(measureWidth);
    roWidth.observe(frameEl);
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
    return () => roHeight.disconnect();
  }, []);

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
          className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl overflow-hidden flex flex-col"
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

            <div className="h-full overflow-y-auto flex items-start justify-center px-4 sm:px-16 py-5">
            <div
              ref={frameRef}
              className="relative bg-white shadow-xl mx-auto overflow-hidden shrink-0"
              style={{ width: '100%', maxWidth: '460px', height: contentHeight * scale }}
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
            <p className="hidden sm:block text-xs text-[#6B7280] flex-1">{template.description}</p>
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
