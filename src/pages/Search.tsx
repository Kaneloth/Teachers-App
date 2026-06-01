import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import EducatorCard from '@/components/search/EducatorCard';
import SearchFilters, { Filters } from '@/components/search/SearchFilters';

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

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [educators, setEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>({ province: '', subject: '', phase: '', activeOnly: false });
  const [mySubjects, setMySubjects] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('educators').select('subjects').eq('created_by_id', user.id).limit(1).then(({ data }) => {
      setMySubjects(data?.[0]?.subjects || []);
    });
  }, [user]);

  const fetchEducators = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('educators').select('*');
    if (filters.province) q = q.eq('current_province', filters.province);
    if (filters.phase) q = q.eq('phase', filters.phase);
    if (filters.activeOnly) q = q.eq('is_actively_looking', true);
    if (filters.subject) q = q.contains('subjects', [filters.subject]);
    const { data } = await q.limit(50);
    let results = data || [];
    if (query.trim()) {
      const lower = query.toLowerCase();
      results = results.filter(e =>
        e.full_name?.toLowerCase().includes(lower) ||
        e.current_province?.toLowerCase().includes(lower) ||
        e.subjects?.some((s: string) => s.toLowerCase().includes(lower))
      );
    }
    setEducators(results);
    setLoading(false);
  }, [filters, query]);

  useEffect(() => { fetchEducators(); }, [fetchEducators]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEducators();
    setRefreshing(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <button onClick={handleRefresh} className="p-1 rounded-full hover:bg-muted transition-colors">
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <h1 className="text-lg font-bold text-foreground">Find Educators</h1>
        </div>
        <p className="text-sm text-muted-foreground pl-1">Search by name, province, or subject</p>
      </div>

      {/* Search bar + filters */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search educators..."
            className="pl-9 rounded-xl bg-muted/40 border-border"
          />
        </div>
        <SearchFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : educators.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground px-8">
          <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No educators found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground px-4 pb-2">
            {educators.length} educator{educators.length !== 1 ? 's' : ''} found
          </p>
          <div className="space-y-2 px-4 pb-6">
            {educators.map((ed, i) => (
              <EducatorCard key={ed.id} educator={ed} mySubjects={mySubjects} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
