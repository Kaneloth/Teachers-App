import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Heart, Send, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function MatchesPage() {
  const navigate = useNavigate();

  const { data: myProfile } = useQuery({
    queryKey: ['my-educator-match'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('educators').select('*').eq('user_id', user.id).single();
      return data;
    },
  });

  const { data: educators = [], isLoading } = useQuery({
    queryKey: ['matches', myProfile?.id],
    enabled: !!myProfile,
    queryFn: async () => {
      const { data } = await supabase.from('educators').select('*')
        .neq('id', myProfile.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const matches = (educators as any[]).filter((e: any) => {
    if (!myProfile) return false;
    const theyWantMyProv = e.preferred_provinces?.includes(myProfile.current_province);
    const iWantTheirProv = myProfile.preferred_provinces?.includes(e.current_province);
    const sharedSubjects = (myProfile.subjects || []).some((s: string) => (e.subjects || []).includes(s));
    const samePhase = myProfile.phase === e.phase;
    return theyWantMyProv && iWantTheirProv && sharedSubjects && samePhase;
  });

  const startChat = async (educator: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const convId = [user.id, educator.user_id].sort().join('_');
    navigate(`/chat/${convId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center pt-20">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-2">
        <ArrowLeftRight className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">My Matches</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Educators who match your province, phase, and subjects</p>

      {!myProfile?.current_province || !myProfile?.preferred_provinces?.length ? (
        <div className="text-center py-16 px-4">
          <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h2 className="font-semibold text-foreground mb-2">Complete your profile first</h2>
          <p className="text-sm text-muted-foreground mb-6">Add your province, preferred provinces, phase, and subjects to find matches.</p>
          <Link to="/profile">
            <Button className="rounded-xl px-8 h-11 font-semibold">Update Profile</Button>
          </Link>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 px-4">
          <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h2 className="font-semibold text-foreground mb-2">No matches yet</h2>
          <p className="text-sm text-muted-foreground mb-6">No one matches your exact criteria right now. Try broadening your preferred provinces or check back later.</p>
          <Link to="/search">
            <Button variant="outline" className="rounded-xl px-8 h-11 font-semibold">Browse All Educators</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((educator: any) => (
            <div key={educator.id} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {educator.avatar_url
                    ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
                    : <span className="text-sm font-bold text-primary">{educator.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{educator.full_name}</p>
                  <p className="text-sm text-muted-foreground">{educator.current_province} → {myProfile?.current_province}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {educator.phase} · {educator.subjects?.slice(0, 3).join(', ')}
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="text-xs font-medium bg-green-100 text-green-700 rounded-full px-2 py-0.5">Match!</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/educator/${educator.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full rounded-xl text-xs">View Profile</Button>
                </Link>
                <Button size="sm" className="flex-1 rounded-xl text-xs" onClick={() => startChat(educator)}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />Message
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
