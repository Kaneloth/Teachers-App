import { useEffect, useState } from 'react';
import { Briefcase, MapPin, Calendar, ExternalLink, Search, ArrowLeft, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { format, differenceInDays, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Vacancy {
  id: string;
  title: string;
  school?: string;
  province?: string;
  district?: string;
  phase?: string;
  type?: string;
  subjects?: string[];
  post_level?: string;
  closing_date?: string;
  source?: string;
  reference?: string;
  url?: string;
  created_at: string;
}

const PROVINCES = [
  'Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape',
  'Mpumalanga', 'Limpopo', 'North West', 'Free State', 'Northern Cape',
];

const TYPES = ['School-Based', 'Circuit', 'District', 'Provincial', 'National'];

function DaysLeftBadge({ closing_date }: { closing_date?: string }) {
  if (!closing_date) return null;
  const date = new Date(closing_date);
  if (isPast(date)) {
    return (
      <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 shrink-0">
        Expired
      </span>
    );
  }
  const days = differenceInDays(date, new Date());
  return (
    <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5 shrink-0">
      {days} day{days !== 1 ? 's' : ''} left
    </span>
  );
}

export default function VacanciesPage() {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('');
  const [type, setType] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    supabase
      .from('vacancies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setVacancies(data || []);
        if (data?.length) setLastUpdated(new Date(data[0].created_at));
        setLoading(false);
      });
  }, []);

  const filtered = vacancies.filter(v => {
    if (province && v.province !== province) return false;
    if (type && v.type !== type) return false;
    if (query.trim()) {
      const lower = query.toLowerCase();
      if (
        !v.title?.toLowerCase().includes(lower) &&
        !v.school?.toLowerCase().includes(lower) &&
        !v.district?.toLowerCase().includes(lower) &&
        !v.subjects?.some(s => s.toLowerCase().includes(lower))
      ) return false;
    }
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <Briefcase className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Vacancies</h1>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1 shrink-0">
              <Clock className="w-3 h-3" />
              Updated {format(lastUpdated, 'dd MMM yyyy')}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 pl-1">Teaching posts across South Africa</p>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title, school, district or subject..."
            className="pl-9 rounded-xl bg-muted/30 border-border"
          />
        </div>
      </div>

      {/* Filter dropdowns */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <Select value={province} onValueChange={v => setProvince(v === 'all' ? '' : v)}>
          <SelectTrigger className="rounded-xl bg-card text-sm">
            <SelectValue placeholder="All Provinces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Provinces</SelectItem>
            {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={v => setType(v === 'all' ? '' : v)}>
          <SelectTrigger className="rounded-xl bg-card text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Count */}
          <p className="text-xs text-muted-foreground px-4 pb-3">
            {filtered.length} post{filtered.length !== 1 ? 's' : ''} found
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground px-8">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No vacancies found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="px-4 pb-6 space-y-3">
              {filtered.map((v, i) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground text-sm leading-snug flex-1">
                        {v.title}
                      </h3>
                      <DaysLeftBadge closing_date={v.closing_date} />
                    </div>

                    {/* School + post level */}
                    {(v.school || v.post_level) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Briefcase className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {[v.school, v.post_level ? `Post Level ${v.post_level}` : null].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}

                    {/* Province / district */}
                    {(v.province || v.district) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{[v.province, v.district || 'Not specified'].join(' – ')}</span>
                      </div>
                    )}

                    {/* Closing date */}
                    {v.closing_date && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>Closes: {format(new Date(v.closing_date), 'dd MMM yyyy')}</span>
                      </div>
                    )}

                    {/* Subject + type tags */}
                    {(v.subjects?.length || v.type) && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {v.subjects?.map(s => (
                          <span key={s} className="text-[10px] bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 border border-border">
                            {s}
                          </span>
                        ))}
                        {v.type && (
                          <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5 font-medium">
                            {v.type}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Phase */}
                    {v.phase && (
                      <p className="text-xs text-muted-foreground">{v.phase}</p>
                    )}

                    {/* Ref + View button */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                      <p className="text-[11px] text-muted-foreground truncate">
                        Ref: {v.reference || 'Not specified'}{v.source ? ` · via ${v.source}` : ''}
                      </p>
                      {v.url && (
                        <a href={v.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs h-8 shrink-0">
                            View / Apply <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
