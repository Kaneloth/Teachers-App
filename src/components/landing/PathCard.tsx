import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface PathCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  linkLabel: string;
  to: string;
  accent: 'blue' | 'orange';
  visual: React.ReactNode;
  delay?: number;
}

const ACCENTS = {
  blue:   { iconBg: 'bg-[#0066FF]/10', iconText: 'text-[#0066FF]', ring: 'hover:border-[#0066FF]/40', link: 'text-[#0066FF]' },
  orange: { iconBg: 'bg-[#FF6B35]/10', iconText: 'text-[#FF6B35]', ring: 'hover:border-[#FF6B35]/40', link: 'text-[#FF6B35]' },
};

export default function PathCard({ icon: Icon, title, description, linkLabel, to, accent, visual, delay = 0 }: PathCardProps) {
  const tone = ACCENTS[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay }}
      className={`bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 flex flex-col transition-all hover:shadow-lg ${tone.ring}`}
    >
      <div className={`w-12 h-12 rounded-2xl ${tone.iconBg} flex items-center justify-center mb-5`}>
        <Icon className={`w-6 h-6 ${tone.iconText}`} strokeWidth={1.75} />
      </div>

      <div className="mb-5 rounded-2xl overflow-hidden bg-[#F8F9FB] border border-[#E5E7EB]">
        {visual}
      </div>

      <h3 className="text-xl font-bold text-[#1A1A2E] mb-2">{title}</h3>
      <p className="text-sm text-[#6B7280] leading-relaxed mb-6 flex-1">{description}</p>

      <Link to={to} className={`inline-flex items-center gap-1.5 text-sm font-semibold ${tone.link} group`}>
        {linkLabel}
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </motion.div>
  );
}
