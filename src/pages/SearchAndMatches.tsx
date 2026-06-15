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

    const metaPlan = user.user_metadata?.subscription_plan as string | undefined;
    const metaEnd  = user.user_metadata?.subscription_end  as string | undefined;
    if (metaPlan && metaPlan !== 'free' && metaEnd && new Date(metaEnd) > new Date()) {
      setIsPro(true);
      setChecked(true);
      return;
    }

    supabase
      .from('profiles')
      .select('subscription_plan, subscription_end')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setIsPro(
          !!data?.subscription_plan &&
          data.subscription_plan !== 'free' &&
          !!data.subscription_end &&
          new Date(data.subscription_end) > new Date()
        );
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
    return (
      <div className="max-w-2xl mx-auto">
        <MatchesPage embedded />
      </div>
    );
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
