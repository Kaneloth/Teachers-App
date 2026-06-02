import { Link } from 'react-router-dom';
import { MapPin, BookOpen, ArrowRight, Flame, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  educator: any;
  mySubjects?: string[];
  index?: number;
}

export default function EducatorCard({ educator, mySubjects, index = 0 }: Props) {
  const sharedSubjects = mySubjects && educator.subjects
    ? educator.subjects.filter((s: string) => mySubjects.includes(s))
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link to={`/educator/${educator.id}`} className="block bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-all group">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {educator.avatar_url
              ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
              : <span className="text-sm font-bold text-primary">{educator.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="font-semibold text-foreground truncate">{educator.full_name}</p>
              {educator.is_sace_verified && (
                <span title="Identity Verified" className="shrink-0 inline-flex items-center gap-0.5 bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-primary/20">
                  <ShieldCheck className="w-3 h-3" />Verified
                </span>
              )}
              {educator.is_actively_looking && (
                <Flame className="w-3.5 h-3.5 text-accent shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{educator.current_province}</p>
              {educator.preferred_provinces?.length > 0 && (
                <>
                  <ArrowRight className="w-3 h-3 text-muted-foreground mx-0.5" />
                  <p className="text-xs text-muted-foreground truncate">{educator.preferred_provinces.slice(0, 2).join(', ')}</p>
                </>
              )}
            </div>
            {educator.phase && (
              <p className="text-xs text-muted-foreground mb-1">{educator.phase}</p>
            )}
            {educator.subjects?.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <BookOpen className="w-3 h-3 text-muted-foreground" />
                {educator.subjects.slice(0, 3).map((s: string) => (
                  <span
                    key={s}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sharedSubjects.includes(s) ? 'bg-primary/15 text-primary' : 'bg-secondary text-secondary-foreground'}`}
                  >
                    {s}
                  </span>
                ))}
                {educator.subjects.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{educator.subjects.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
        {sharedSubjects.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-[11px] text-primary font-medium">✓ Shared: {sharedSubjects.join(', ')}</p>
          </div>
        )}
      </Link>
    </motion.div>
  );
}
