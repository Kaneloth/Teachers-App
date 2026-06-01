import { MapPin, Navigation, Monitor, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

function getMatchPercentage(mySubjects: string[] | undefined, theirSubjects: string[] | undefined) {
  if (!mySubjects?.length || !theirSubjects?.length) return 0;
  const mySet = new Set(mySubjects.map(s => s.toLowerCase()));
  const theirSet = new Set(theirSubjects.map(s => s.toLowerCase()));
  const intersection = [...mySet].filter(s => theirSet.has(s));
  const union = new Set([...mySet, ...theirSet]);
  return Math.round((intersection.length / union.size) * 100);
}

interface Educator {
  id: string;
  full_name: string;
  avatar_url?: string;
  is_actively_looking?: boolean;
  is_sace_verified?: boolean;
  current_province?: string;
  current_district?: string;
  preferred_provinces?: string[];
  subjects?: string[];
  phase?: string;
}

interface Props {
  educator: Educator;
  mySubjects?: string[];
  index?: number;
}

export default function EducatorCard({ educator, mySubjects, index = 0 }: Props) {
  const match = getMatchPercentage(mySubjects, educator.subjects);
  const initial = educator.full_name?.[0]?.toUpperCase() || '?';

  const locationParts = [educator.current_province, educator.current_district].filter(Boolean);
  const location = locationParts.length ? locationParts.join(' – ') : '–';
  const wants = educator.preferred_provinces?.length ? educator.preferred_provinces.join(', ') : 'Any';
  const subjectsStr = educator.subjects?.length
    ? `${educator.subjects.join(', ')}${educator.phase ? ` (${educator.phase})` : ''}`
    : '()';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Link
        to={`/educator/${educator.id}`}
        className="flex items-center gap-3 bg-card rounded-2xl border border-border px-4 py-3.5 hover:shadow-sm transition-all duration-200 group"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
          {educator.avatar_url
            ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-primary">{initial}</span>
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate mb-1">{educator.full_name}</p>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{location}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Navigation className="w-3 h-3 shrink-0" />
              <span className="truncate">Wants: {wants}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Monitor className="w-3 h-3 shrink-0" />
              <span className="truncate">{subjectsStr}</span>
            </div>
          </div>
        </div>

        {/* Match % badge + chevron */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative w-9 h-9">
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2.5"
                strokeDasharray={`${(match / 100) * 94.2} 94.2`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary leading-none">
              {match}%
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </Link>
    </motion.div>
  );
}
