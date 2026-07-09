import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface TestimonialRow {
  id: string;
  name: string;
  role_label: string | null;
  quote: string;
  rating: number | null;
  source: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function AdminTestimonials() {
  const [rows, setRows] = useState<TestimonialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('testimonials')
      .select('id, name, role_label, quote, rating, source, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filter !== 'all') query = query.eq('status', filter);

    const { data, error } = await query;
    if (error) toast.error('Failed to load testimonials: ' + error.message);
    setRows((data as TestimonialRow[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('testimonials').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Failed to update: ' + error.message); return; }
    toast.success(status === 'approved' ? 'Testimonial approved — now live on the landing page.' : 'Testimonial rejected.');
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const deleteTestimonial = async (id: string) => {
    if (!window.confirm('Permanently delete this testimonial? This cannot be undone.')) return;
    const { error } = await supabase.from('testimonials').delete().eq('id', id);
    if (error) { toast.error('Failed to delete: ' + error.message); return; }
    toast.success('Testimonial deleted.');
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const sourceLabel = (s: string) => ({
    public_form: 'Public form', cv_download_prompt: 'CV download prompt', match_prompt: 'New match prompt',
  }[s] || s);

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Testimonials</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Moderate testimonials submitted for the landing page</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'
            }`}
          >{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-5 h-5 border-3 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No {filter !== 'all' ? filter : ''} testimonials.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(t => (
            <div key={t.id} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  {t.role_label && <p className="text-xs text-muted-foreground">{t.role_label}</p>}
                </div>
                {t.rating && (
                  <span className="text-xs font-medium text-amber-500 shrink-0">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</span>
                )}
              </div>
              <p className="text-sm text-foreground/90 italic mb-2">"{t.quote}"</p>
              <p className="text-[11px] text-muted-foreground mb-3">{sourceLabel(t.source)} · {fmtDate(t.created_at)}</p>
              {t.status === 'pending' ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setStatus(t.id, 'approved')} className="rounded-xl flex-1">Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(t.id, 'rejected')} className="rounded-xl flex-1">Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => deleteTestimonial(t.id)} className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.status === 'approved' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                    {t.status === 'approved' ? 'Approved — live on landing page' : 'Rejected'}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => deleteTestimonial(t.id)} className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5 h-7 px-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
