import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import { useAuth } from '@/lib/AuthContext';
import SearchPage from './Search';        // ✅ correct filename
import MatchesPage from './MatchesPage'; // ✅ unchanged

export default function SearchAndMatches() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('search');
  const [isPro, setIsPro] = useState(false);
  const [checked, setChecked] = useState(false);
  const { gates, loading: gatesLoading } = useFeatureGates();

  /* ── R79+ purchase check ─────────────────────────────────────────────────
     Users who have purchased an R79+ credit pack get access to the Matches
     page (75%+ score matches and town-swap matches). Basic users get the
     two-tab layout with Search + a locked Matches preview.                  */
  useEffect(() => {
    if (!user) return;

    // Admins always get advanced access
    if (user.user_metadata?.is_admin) { setIsPro(true); setChecked(true); return; }

    // Advanced search unlocked by R79+ credit purchase
    supabase
      .from('credit_ledger')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'purchase')
      .gte('amount', 60)
      .limit(1)
      .then(({ data }) => {
        setIsPro(!!(data && data.length > 0));
        setChecked(true);
      });
  }, [user]);

  // Avoid a flash of the two-tab layout for Pro users while the
  // subscription check resolves.
  // Gate off = everyone gets access regardless of purchase
  // Advanced search and matches are now free for all users
  const effectiveIsPro = true;

  if (!checked || gatesLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (effectiveIsPro) {
    // R79+ users get a single unified search page:
    // — All educators shown (0–100% match), sorted/filtered freely
    // — Advanced filters enabled (radius search, distance etc.)
    // — Match % rings visible on every card
    // — No separate Matches tab needed — everything is in one view
    return <SearchPage />;
  }

  // Free users get two tabs: basic Search + a locked Matches preview
  return (
    <div className="max-w-2xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-10 bg-background px-4 pt-2 pb-1 border-b border-border">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" className="gap-2">
              <Search className="w-4 h-4" />
              Find educators
            </TabsTrigger>
            <TabsTrigger value="matches" className="gap-2">
              <Users className="w-4 h-4" />
              Your matches
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="search" className="mt-0">
          <SearchPage embedded />
        </TabsContent>
        <TabsContent value="matches" className="mt-0">
          <MatchesPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
