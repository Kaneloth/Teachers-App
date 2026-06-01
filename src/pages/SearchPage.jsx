import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, ArrowLeft } from 'lucide-react';
import EducatorCard from '@/components/search/EducatorCard';
import SearchFilters from '@/components/search/SearchFilters';

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    province: '',
    subject: '',
    phase: '',
    activeOnly: false,
  });

  const { data: educators = [], isLoading } = useQuery({
    queryKey: ['educators-search'],
    queryFn: () => base44.entities.Educator.list('-created_date', 100),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: myProfile } = useQuery({
    queryKey: ['my-educator-profile'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Educator.filter({ created_by_id: user.id });
      return profiles[0] || null;
    },
  });

  const filtered = useMemo(() => {
    // Exclude the current user's own profile (filter by both entity id and created_by_id)
    let result = educators.filter(e =>
      (!myProfile || e.id !== myProfile.id) &&
      (!currentUser || e.created_by_id !== currentUser.id)
    );

    // Text search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(e =>
        e.full_name?.toLowerCase().includes(q) ||
        e.current_province?.toLowerCase().includes(q) ||
        e.subjects?.some(s => s.toLowerCase().includes(q))
      );
    }

    // Filter: province
    if (filters.province) {
      result = result.filter(e => e.current_province === filters.province);
    }

    // Filter: subject
    if (filters.subject) {
      result = result.filter(e => e.subjects?.includes(filters.subject));
    }

    // Filter: phase
    if (filters.phase) {
      result = result.filter(e => e.phase === filters.phase);
    }

    // Filter: active only
    if (filters.activeOnly) {
      result = result.filter(e => e.is_actively_looking);
    }

    // Sort: active first, then by name
    result.sort((a, b) => {
      if (a.is_actively_looking && !b.is_actively_looking) return -1;
      if (!a.is_actively_looking && b.is_actively_looking) return 1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });

    return result;
  }, [educators, searchText, filters, myProfile, currentUser]);

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <RefreshCw className="w-5 h-5 text-primary" strokeWidth={2.5} />
        <h1 className="text-xl font-bold text-foreground">Find Educators</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Search by name, province, or subject
      </p>

      {/* Search Bar + Filters */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search educators..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 rounded-xl h-11 bg-card"
          />
        </div>
        <SearchFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground mb-3">
        {filtered.length} educator{filtered.length !== 1 ? 's' : ''} found
      </p>

      {/* Results */}
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
          filtered.map((educator, i) => (
            <EducatorCard
              key={educator.id}
              educator={educator}
              mySubjects={myProfile?.subjects}
              index={i}
            />
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