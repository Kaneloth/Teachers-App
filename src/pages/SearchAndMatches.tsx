import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import SearchPage from './Search';        // ✅ correct filename
import MatchesPage from './MatchesPage'; // ✅ unchanged

export default function SearchAndMatches() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('search');
  const [isPro, setIsPro] = useState(false);
  const [checked, setChecked] = useState(false);

  /* ── Subscription check ─────────────────────────────────────────────────
     Pro users only get the "Your matches" view (now showing ALL educators
     with full search/filter access) — the separate "Find educators" tab is
     redundant for them and is hidden entirely.                              */
  useEffect(() => {
    if (!user) return;

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
  if (!checked) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isPro) {
    // Non-embedded gives Pro users the page header (back arrow + "Find Your
    // Matches" title) and the narrower max-w-lg container — matching the
    // width of cards on other pages (e.g. Chats) instead of the wider
    // max-w-2xl used by the two-tab layout below.
    return <MatchesPage />;
  }

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
