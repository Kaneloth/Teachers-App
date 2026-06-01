import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Target, BookOpen, MessageCircle, ChevronRight, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

function getMatchPercentage(mySubjects, theirSubjects) {
  if (!mySubjects?.length || !theirSubjects?.length) return 0;
  const mySet = new Set(mySubjects.map(s => s.toLowerCase()));
  const theirSet = new Set(theirSubjects.map(s => s.toLowerCase()));
  const intersection = [...mySet].filter(s => theirSet.has(s));
  const union = new Set([...mySet, ...theirSet]);
  return Math.round((intersection.length / union.size) * 100);
}

export default function EducatorCard({ educator, mySubjects, index = 0 }) {
  const match = getMatchPercentage(mySubjects, educator.subjects);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link
        to={`/educator/${educator.id}`}
        className="block bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-all duration-200 group"
      >
        {educator.is_actively_looking && (
          <div className="flex items-center gap-1.5 mb-3">
            <Flame className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-semibold text-accent uppercase tracking-wide">
              Actively Looking
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-full border border-border overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
              {educator.avatar_url
                ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
                : <span className="text-sm font-bold text-primary">{educator.full_name?.[0]?.toUpperCase() || '?'}</span>
              }
            </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {educator.full_name}
              </h3>
              {educator.is_sace_verified && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0 shrink-0">
                  SACE ✓
                </Badge>
              )}
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{educator.current_province} – {educator.current_district}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Target className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Wants: {educator.preferred_provinces?.join(', ') || 'Any'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {educator.subjects?.join(', ')} ({educator.phase})
                </span>
              </div>
            </div>
          </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                <circle
                  cx="24" cy="24" r="20" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeDasharray={`${(match / 100) * 125.6} 125.6`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
                {match}%
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}