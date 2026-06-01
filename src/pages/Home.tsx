import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Flame, Users, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const { data: educators = [] } = useQuery({
    queryKey: ['educators-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('educators')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const activeCount = educators.filter((e: any) => e.is_actively_looking).length;
  const provinceCount = new Set(educators.map((e: any) => e.current_province)).size;

  return (
    <div className="px-4 pt-6">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">Find your exchange partner</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: Users, value: educators.length, label: 'Educators', color: 'bg-primary/10 text-primary' },
          { icon: Flame, value: activeCount, label: 'Active', color: 'bg-accent/10 text-accent' },
          { icon: MapPin, value: provinceCount, label: 'Provinces', color: 'bg-secondary text-secondary-foreground' },
        ].map(({ icon: Icon, value, label, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card rounded-2xl border border-border p-4 text-center"
          >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mx-auto mb-2`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </motion.div>
        ))}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Flame className="w-5 h-5 text-accent" />
            Actively Looking
          </h2>
          <Link to="/search" className="text-sm text-primary font-medium flex items-center gap-1">
            See all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-3">
          {educators
            .filter((e: any) => e.is_actively_looking)
            .slice(0, 5)
            .map((educator: any, i: number) => (
              <motion.div
                key={educator.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={`/educator/${educator.id}`}
                  className="flex items-center gap-3 bg-card rounded-xl border border-border p-3 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {educator.avatar_url
                      ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
                      : <span className="text-sm font-bold text-primary">{educator.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{educator.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {educator.subjects?.slice(0, 2).join(', ')} · {educator.current_province}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    → {educator.preferred_provinces?.slice(0, 1).join(', ') || 'Any'}
                  </div>
                </Link>
              </motion.div>
            ))}

          {educators.filter((e: any) => e.is_actively_looking).length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Flame className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No educators are actively looking yet.</p>
              <p className="text-xs mt-1">Be the first to set your status!</p>
            </div>
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-primary rounded-2xl p-5 text-primary-foreground mb-6"
      >
        <h3 className="font-semibold text-lg mb-1">Ready to find your match?</h3>
        <p className="text-sm opacity-90 mb-4">
          Search educators by province, subject, and phase to find your perfect exchange partner.
        </p>
        <Link to="/search">
          <Button variant="secondary" className="rounded-xl font-semibold">Start Searching</Button>
        </Link>
      </motion.div>
    </div>
  );
}
