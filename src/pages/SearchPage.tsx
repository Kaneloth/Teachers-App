import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, ArrowLeft } from 'lucide-react';
import EducatorCard from '@/components/search/EducatorCard';
import SearchFilters from '@/components/search/SearchFilters';
import { supabase } from '@/lib/supabase';

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({ province: '', subject: '', phase: '', activeOnly: false });

  const { data: educators = [], isLoading } = useQuery({
    queryKey: ['educators-search'],
    queryFn: async () => {
      const { data } = await supabase.from('educators').select('*').order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => { const { data: { user } } = await supabase.auth.getUser(); return user; },
  });

  const { data: myProfile } = useQuery({
    queryKey: ['my-educator-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('educators').select('*').eq('user_id', user.id).single();
      return data;
    },
  });

  const filtered = useMemo(() => {
    let result = (educators as any[]).filter(e =>
      (!myProfile || e.id !== myProfile.id) &&
      (!currentUser || e.user_id !== currentUser.id)
    );
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((e: any) =>
        e.full_name?.toLowerCase().includes(q) ||
        e.current_province?.toLowerCase().includes(q) ||
        e.subjects?.some((s: string) => s.toLowerCase().includes(q))
      );
    }
    if (filters.province) result = result.filter((e: any) => e.current_province === filters.province);
    if (filters.subject) result = result.filter((e: any) => e.subjects?.includes(filters.subject));
    if (filters.phase) result = result.filter((e: any) => e.phase === filters.phase);
    if (filters.activeOnly) result = result.filter((e: any) => e.is_actively_looking);
    result.sort((a: any, b: any) => {
      if (a.is_actively_looking && !b.is_actively_looking) return -1;
      if (!a.is_actively_looking && b.is_actively_looking) return 1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
    return result;
  }, [educators, searchText, filters, myProfile, currentUser]);

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => navigate('/home')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <RefreshCw className="w-5 h-5 text-primary" strokeWidth={2.5} />
        <h1 className="text-xl font-bold text-foreground">Find Educators</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Search by name, province, or subject</p>

      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search educators..." value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-9 rounded-xl h-11 bg-card" />
        </div>
        <SearchFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} educator{filtered.length !== 1 ? 's' : ''} found</p>

      <div className="space-y-3 pb-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-3 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))
        ) : filtered.length > 0 ? (
          filtered.map((educator: any, i: number) => (
            <EducatorCard key={educator.id} educator={educator} mySubjects={myProfile?.subjects} index={i} />
          ))
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No educators found matching your criteria.</p>
            <p className="text-xs mt-1">Try adjusting your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
