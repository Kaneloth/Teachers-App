import { useQuery } from '@tanstack/react-query';
import { Briefcase, MapPin, Calendar, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export default function VacanciesPage() {
  const { data: vacancies = [], isLoading } = useQuery({
    queryKey: ['vacancies'],
    queryFn: async () => {
      const { data } = await supabase
        .from('vacancies')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
    staleTime: 60000,
  });

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-2">
        <Briefcase className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Vacancies</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Department of Education vacancies for South African educators</p>

      {isLoading ? (
        <div className="flex justify-center pt-16">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      ) : vacancies.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium">No vacancies currently listed.</p>
          <p className="text-xs mt-1">Check back soon for new posts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(vacancies as any[]).map((v: any) => (
            <div key={v.id} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm leading-snug">{v.title}</h3>
                  <p className="text-xs text-primary font-medium mt-0.5">{v.institution || v.school}</p>
                </div>
                {v.is_new && (
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5 shrink-0">NEW</span>
                )}
              </div>

              {v.province && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {v.province}
                </div>
              )}

              {v.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{v.description}</p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {v.closing_date && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      Closes {format(new Date(v.closing_date), 'd MMM yyyy')}
                    </div>
                  )}
                </div>
                {v.application_url && (
                  <a href={v.application_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="text-xs rounded-xl h-8 gap-1">
                      Apply <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
