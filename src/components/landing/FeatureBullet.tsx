import { Check } from 'lucide-react';

export default function FeatureBullet({ children, tone = 'dark' }: { children: React.ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="w-5 h-5 rounded-full bg-[#10B981]/15 flex items-center justify-center shrink-0 mt-0.5">
        <Check className="w-3 h-3 text-[#10B981]" strokeWidth={3} />
      </span>
      <span className={`text-sm leading-relaxed ${tone === 'dark' ? 'text-[#1A1A2E]' : 'text-white/85'}`}>{children}</span>
    </li>
  );
}
