import { useEffect, useState } from 'react';
import { Users, MapPin, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

interface Educator {
  id: string;
  full_name: string;
  avatar_url?: string;
  current_province?: string;
  preferred_provinces?: string[];
  subjects?: string[];
  phase?: string;
  is_actively_looking?: boolean;
  user_id?: string;
}

export default function MatchesPage() {
  const { user } = useAuth();
  const [myProfile, setMyProfile] = useState<Educator | null>(null);
  const [matches, setMatches] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchMatches = async () => {
      const { data: mine } = await supabase.from('educators').select('*').eq('user_id', user.id).maybeSingle();
      if (!mine) { setLoading(false); return; }
      setMyProfile(mine);

      const { data: all } = await supabase.from('educators').select('*').neq('user_id', user.id);
      if (!all) { setLoading(false); return; }

      const scored = all
        .filter(e => e.is_actively_looking)
        .map(e => {
          let score = 0;
          const wantsMyProvince = e.preferred_provinces?.includes(mine.current_province);
          const iWantTheirProvince = mine.preferred_provinces?.includes(e.current_province);
          if (wantsMyProvince) score += 40;
          if (iWantTheirProvince) score += 40;
          const sharedSubjects = (e.subjects || []).filter((s: string) => (mine.subjects || []).includes(s)).length;
          score += sharedSubjects * 10;
          if (e.phase === mine.phase) score += 10;
          return { ...e, score };
        })
        .filter(e => e.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      setMatches(scored);
      setLoading(false);
    };
    fetchMatches();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Transfer Matches</h1>
        <p className="text-sm text-muted-foreground">Educators who match your transfer preferences</p>
      </div>

      {!myProfile ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Complete your profile to see matches</p>
          <Link to="/onboarding" className="text-primary text-sm hover:underline mt-2 block">Set up profile →</Link>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No matches yet</p>
          <p className="text-sm mt-1">Check back as more educators join EduCross</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((ed, i) => (
            <motion.div key={ed.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/educator/${ed.id}`} className="block bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {ed.avatar_url
                      ? <img src={ed.avatar_url} alt={ed.full_name} className="w-full h-full object-cover rounded-full" />
                      : <span className="text-sm font-bold text-primary">{ed.full_name[0]?.toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground">{ed.full_name}</h3>
                    <div className="space-y-1 mt-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" /> {ed.current_province} → wants {myProfile.current_province}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BookOpen className="w-3 h-3" /> {ed.phase} · {ed.subjects?.slice(0, 2).join(', ')}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(ed.subjects || []).filter((s: string) => (myProfile.subjects || []).includes(s)).map(s => (
                        <Badge key={s} className="text-[10px] bg-primary/10 text-primary border-0">{s}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
