import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import CVTemplateRenderer from '@/components/cv/CVTemplateRenderer';
import { TEMPLATES, SAMPLE_DATA, PAGE_WIDTH_PX } from '@/components/cv/CVStepTemplate';
import TemplatePreviewModal from './TemplatePreviewModal';

/**
 * Public, pre-sign-up template gallery for /explore/career-tools. Every
 * thumbnail is a real, scaled-down render of the actual template (the same
 * CVTemplateRenderer + sample data the in-app picker uses, imported from
 * CVStepTemplate.tsx) — never a separate static mockup image — so nothing
 * shown here can drift out of sync with what the product actually ships.
 * Clicking a thumbnail opens the full A4 preview modal.
 */
export default function TemplateGalleryGrid() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.26);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setScale(width / PAGE_WIDTH_PX);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div id="templates">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {TEMPLATES.map((t, i) => (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.4) }}
            onClick={() => setOpenIndex(i)}
            className="group text-left rounded-xl border border-[#E5E7EB] bg-white overflow-hidden hover:border-[#0066FF]/50 hover:shadow-md transition-all"
          >
            <div
              ref={i === 0 ? boxRef : undefined}
              className="relative bg-white overflow-hidden"
              style={{ aspectRatio: '210 / 297' }}
            >
              <div
                style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_WIDTH_PX, pointerEvents: 'none' }}
              >
                <CVTemplateRenderer
                  data={{ ...SAMPLE_DATA, template: t.id } as any}
                  forExport={false}
                  watermark={false}
                  cvType="general"
                  thumbnail
                />
              </div>
              <div className="absolute inset-0 bg-[#0A2463]/0 group-hover:bg-[#0A2463]/5 transition-colors flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100">
                <span className="text-xs font-semibold bg-white/95 text-[#0A2463] px-3 py-1 rounded-full shadow-sm">Preview</span>
              </div>
            </div>
            <div className="p-2.5">
              <p className="text-sm font-semibold text-[#1A1A2E]">{t.name}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {openIndex !== null && (
        <TemplatePreviewModal
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </div>
  );
}
