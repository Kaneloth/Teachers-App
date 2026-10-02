import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LINES = [
  'Experienced Sales Coordinator with 4 years...',
  'Experienced Sales Coordinator with 4+ years in retail management...',
  'Experienced Sales Coordinator with 4+ years in retail management, team leadership, and client relations.',
];

/**
 * Split-screen "form on the left, CV preview on the right" mockup for the
 * Career Tools page's Live Preview Demo section. Cycles a bio line through
 * a few lengths so the right-hand preview visibly grows in sync, without
 * needing a real video/GIF asset.
 */
export default function CVPreviewMockup() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(n => (n + 1) % LINES.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {/* Form side */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 sm:p-4">
        <p className="text-[9px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">About Me</p>
        <div className="rounded-lg border border-[#0066FF]/40 bg-[#0066FF]/5 p-2 min-h-[70px]">
          <AnimatePresence mode="wait">
            <motion.p
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] text-[#1A1A2E] leading-relaxed"
            >
              {LINES[i]}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                className="inline-block w-[2px] h-3 bg-[#0066FF] ml-0.5 align-middle"
              />
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-2 w-2/3 bg-[#E5E7EB] rounded-full" />
          <div className="h-2 w-1/2 bg-[#E5E7EB] rounded-full" />
        </div>
      </div>

      {/* Live preview side */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 sm:p-4 shadow-sm">
        <div className="h-2 w-1/3 bg-[#0A2463] rounded-full mb-2" />
        <div className="h-1.5 w-1/4 bg-[#E5E7EB] rounded-full mb-3" />
        <p className="text-[8px] font-semibold text-[#0066FF] uppercase tracking-wide mb-1">About Me</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={i}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-[9px] text-[#374151] leading-relaxed mb-3"
          >
            {LINES[i]}
          </motion.p>
        </AnimatePresence>
        <div className="space-y-1.5">
          <div className="h-1.5 w-full bg-[#F3F4F6] rounded-full" />
          <div className="h-1.5 w-5/6 bg-[#F3F4F6] rounded-full" />
          <div className="h-1.5 w-2/3 bg-[#F3F4F6] rounded-full" />
        </div>
      </div>
    </div>
  );
}
