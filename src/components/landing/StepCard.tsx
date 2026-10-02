import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StepCardProps {
  step: number;
  icon: LucideIcon;
  title: string;
  text: string;
  visual?: React.ReactNode;
  reverse?: boolean;
}

export default function StepCard({ step, icon: Icon, title, text, visual, reverse = false }: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className={`grid md:grid-cols-2 gap-8 items-center ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}
    >
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="w-8 h-8 rounded-full bg-[#0A2463] text-white text-sm font-bold flex items-center justify-center shrink-0">
            {step}
          </span>
          <Icon className="w-5 h-5 text-[#0066FF]" strokeWidth={1.75} />
        </div>
        <h3 className="text-lg font-bold text-[#1A1A2E] mb-2">{title}</h3>
        <p className="text-sm text-[#6B7280] leading-relaxed">{text}</p>
      </div>
      {visual && (
        <div className="rounded-2xl overflow-hidden bg-[#F8F9FB] border border-[#E5E7EB] min-h-[180px] flex items-center justify-center p-6">
          {visual}
        </div>
      )}
    </motion.div>
  );
}
