import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Users } from 'lucide-react';
import SearchPage from './SearchPage';
import MatchesPage from './MatchesPage';

export default function SearchAndMatches() {
  const [activeTab, setActiveTab] = useState('search');

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