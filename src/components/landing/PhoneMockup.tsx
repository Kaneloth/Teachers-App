import { motion } from 'framer-motion';
import { Signal, Wifi, Battery } from 'lucide-react';

interface PhoneMockupProps {
  sender?: string;
  message: string;
  time?: string;
  pulse?: boolean;
}

/**
 * A simple phone-frame + SMS-bubble mockup, used anywhere the plan calls
 * for "phone mockup showing an SMS notification arriving" (homepage teaser,
 * /explore/transfer hero and Step 3).
 */
export default function PhoneMockup({ sender = 'Crosssa', message, time = 'now', pulse = false }: PhoneMockupProps) {
  return (
    <div className="relative mx-auto w-[220px]">
      <div className="rounded-[2rem] border-[6px] border-[#1A1A2E] bg-[#1A1A2E] shadow-xl overflow-hidden">
        <div className="bg-white rounded-[1.6rem] overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1 text-[10px] font-semibold text-[#1A1A2E]">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <Signal className="w-3 h-3" />
              <Wifi className="w-3 h-3" />
              <Battery className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="px-3 py-6 min-h-[200px] flex items-end bg-[#F8F9FB]">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={pulse ? { opacity: 1, y: 0, scale: [0.95, 1, 1] } : { opacity: 1, y: 0, scale: 1 }}
              transition={pulse ? { duration: 0.6, repeat: Infinity, repeatDelay: 2.4 } : { duration: 0.5 }}
              className="w-full bg-white rounded-2xl rounded-bl-sm border border-[#E5E7EB] shadow-sm px-3.5 py-3"
            >
              <p className="text-[10px] font-bold text-[#0066FF] mb-1">{sender}</p>
              <p className="text-xs text-[#1A1A2E] leading-snug">{message}</p>
              <p className="text-[9px] text-[#6B7280] mt-1.5 text-right">{time}</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
