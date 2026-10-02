import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

/**
 * Static SVG explainer for "why radius search matters": a dashed district
 * boundary that cuts straight across the map, a solid radius circle
 * centred on the user's town that ignores it, and pins both inside and
 * outside the district line but inside the radius.
 */
export default function MapRadiusVisual() {
  const pins = [
    { x: 150, y: 110, inRadius: true,  label: 'You' , center: true },
    { x: 95,  y: 150, inRadius: true,  label: 'Match' },
    { x: 205, y: 95,  inRadius: true,  label: 'Match' },
    { x: 230, y: 160, inRadius: true,  label: 'Match' },
    { x: 60,  y: 70,  inRadius: false, label: 'Missed' },
  ];

  return (
    <div className="w-full">
      <svg viewBox="0 0 300 220" className="w-full h-auto">
        <rect x="0" y="0" width="300" height="220" rx="16" fill="#F8F9FB" />

        {/* District boundary — a straight line that cuts across the map,
            ignoring real proximity */}
        <line x1="20" y1="40" x2="180" y2="200" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x="24" y="34" fontSize="9" fill="#6B7280" fontWeight="600">District A</text>
        <text x="190" y="205" fontSize="9" fill="#6B7280" fontWeight="600">District B</text>

        {/* Radius circle, centred on the user, crossing the boundary */}
        <motion.circle
          cx="150" cy="110" r="4"
          initial={{ r: 4, opacity: 0.6 }}
          whileInView={{ r: 90, opacity: 0.15 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          fill="#0066FF"
        />
        <circle cx="150" cy="110" r="90" fill="none" stroke="#0066FF" strokeWidth="1.5" strokeDasharray="3 3" />

        {pins.map((p, i) => (
          <g key={i}>
            {p.center ? (
              <circle cx={p.x} cy={p.y} r="5" fill="#0A2463" stroke="#fff" strokeWidth="2" />
            ) : (
              <circle cx={p.x} cy={p.y} r="4" fill={p.inRadius ? '#10B981' : '#FF6B35'} stroke="#fff" strokeWidth="1.5" />
            )}
          </g>
        ))}
      </svg>

      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-[#6B7280]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0A2463]" />You</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10B981]" />Found by radius</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FF6B35]" />Missed by district</span>
      </div>
    </div>
  );
}
