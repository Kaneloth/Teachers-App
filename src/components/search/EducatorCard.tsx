import { MapPin, Navigation, Monitor, ChevronRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export interface MyProfile {
  phase?: string;
  current_province?: string;
  town?: string;
  subjects?: string[];
}

/**
 * Weighted match formula:
 *   Phase 20% + Province 20% + District 20% + Subjects (Jaccard) 40%
 * Hard rule: no common subjects → always 0%.
 */
export function calculateMatch(me: MyProfile, them: MyProfile): number {
  const setA = new Set((me.subjects || []).map(s => s.toLowerCase()));
  const setB = new Set((them.subjects || []).map(s => s.toLowerCase()));
  const common = [...setA].filter(s => setB.has(s)).length;

  if (common === 0) return 0;

  const totalDistinct = new Set([...setA, ...setB]).size;
  const subjectScore  = totalDistinct > 0 ? common / totalDistinct : 0;

  const phaseScore    = me.phase && them.phase && me.phase === them.phase ? 0.20 : 0;
  const provinceScore = me.current_province && them.current_province
                        && me.current_province === them.current_province ? 0.20 : 0;
  const districtScore = me.town && them.town && me.town === them.town ? 0.20 : 0;

  return Math.round((phaseScore + provinceScore + districtScore + subjectScore * 0.40) * 100);
}

interface Educator {
  id: string;
  full_name: string;
  avatar_url?: string;
  is_actively_looking?: boolean;
  is_sace_verified?: boolean;
  current_province?: string;
  town?: string;
  preferred_provinces?: string[];
  subjects?: string[];
  phase?: string;
}

interface Props {
  educator: Educator;
  myProfile?: MyProfile;
  isPro?: boolean;
  index?: number;
}

export default function EducatorCard({ educator, myProfile, isPro = false, index = 0 }: Props) {
  const match   = myProfile ? calculateMatch(myProfile, educator) : 0;
  const initial = educator.full_name?.[0]?.toUpperCase() || '?';

  const locationParts = [educator.current_province, educator.town].filter(Boolean);
  const location      = locationParts.length ? locationParts.join(' – ') : '–';
  const wants         = educator.preferred_provinces?.length ? educator.preferred_provinces.join(', ') : 'Any';
  const subjectsStr   = educator.subjects?.length
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
          <div className="flex items-center gap-1.5 mb-1">
            <p className="font-semibold text-sm text-foreground truncate">{educator.full_name}</p>
            {educator.is_sace_verified && (
              <span title="Identity Verified" className="shrink-0 inline-flex items-center gap-0.5 bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-primary/20">
                <ShieldCheck className="w-3 h-3" />Verified
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            {/* Current province — Pro only; free users see nothing here */}
            {isPro && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}
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

        {/* Match % ring — visible to all users */}
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
