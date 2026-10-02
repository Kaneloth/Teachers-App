import { motion } from 'framer-motion';

/**
 * Circular ATS score meter for the marketing page (distinct from the
 * in-app ATSScoreBadge.tsx, which reads a real computed score — this one
 * animates to a fixed illustrative value for the showcase).
 */
export default function ATSScoreMeter({ score = 85 }: { score?: number }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
          <motion.circle
            cx="60" cy="60" r={r} fill="none"
            stroke="#10B981" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{ strokeDashoffset: offset }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-[#1A1A2E]">{score}</span>
          <span className="text-[10px] text-[#6B7280] font-medium">out of 100</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#10B981]">ATS-ready</p>
    </div>
  );
}
