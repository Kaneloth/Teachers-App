import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

interface TestimonialCardProps {
  name: string;
  meta: string; // province, or role + company
  quote: string;
  initials: string;
  delay?: number;
}

export default function TestimonialCard({ name, meta, quote, initials, delay = 0 }: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay }}
      className="bg-white rounded-2xl border border-[#E5E7EB] p-6 flex flex-col"
    >
      <Quote className="w-6 h-6 text-[#0066FF]/30 mb-3" fill="currentColor" strokeWidth={0} />
      <p className="text-sm text-[#1A1A2E] leading-relaxed flex-1 mb-5">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#0A2463] text-white text-sm font-bold flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1A1A2E]">{name}</p>
          <p className="text-xs text-[#6B7280]">{meta}</p>
        </div>
      </div>
    </motion.div>
  );
}
