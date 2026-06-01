import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, BookOpen, Users, Send, Loader2, CheckCircle2, Star, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function EducatorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: educator, isLoading } = useQuery({
    queryKey: ['educator', id],
    queryFn: async () => {
      const { data } = await supabase.from('educators').select('*').eq('id', id).single();
      return data;
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => { const { data: { user } } = await supabase.auth.getUser(); return user; },
  });

  const startChat = useMutation({
    mutationFn: async () => {
      if (!currentUser || !educator) throw new Error('Not logged in');
      const convId = [currentUser.id, educator.user_id].sort().join('_');
      return convId;
    },
    onSuccess: (convId) => navigate(`/chat/${convId}`),
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center pt-20">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }
  if (!educator) return null;

  const isOwnProfile = currentUser?.id === educator.user_id;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary h-36 relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-5 left-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="relative px-4 pb-10">
        <div className="flex items-end gap-4 -mt-12 mb-5">
          <div className="w-24 h-24 rounded-full border-4 border-background bg-primary/10 flex items-center justify-center overflow-hidden shadow-md">
            {educator.avatar_url
              ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-primary">{educator.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
            }
          </div>
          <div className="pb-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground leading-tight">{educator.full_name}</h1>
              {educator.is_actively_looking && (
                <span className="text-[10px] font-bold bg-green-100 text-green-700 rounded-full px-2 py-0.5">Active</span>
              )}
            </div>
            {educator.current_province && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{educator.current_province}</p>
              </div>
            )}
          </div>
        </div>

        {!isOwnProfile && (
          <Button className="w-full h-12 rounded-xl font-semibold mb-6" onClick={() => startChat.mutate()}>
            {startChat.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Message
          </Button>
        )}
        {isOwnProfile && (
          <Button variant="outline" className="w-full h-12 rounded-xl font-semibold mb-6" onClick={() => navigate('/profile')}>
            Edit My Profile
          </Button>
        )}

        {educator.bio && (
          <div className="bg-card rounded-2xl border border-border p-4 mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">About</h2>
            <p className="text-sm text-foreground leading-relaxed">{educator.bio}</p>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border p-4 mb-4 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teaching Info</h2>
          {educator.phase && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-foreground">{educator.phase}</p>
            </div>
          )}
          {educator.subjects?.length > 0 && (
            <div className="flex items-start gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div className="flex flex-wrap gap-1.5">
                {educator.subjects.map((s: string) => (
                  <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}
          {educator.years_experience && (
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-foreground">{educator.years_experience} years experience</p>
            </div>
          )}
          {educator.current_school && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-foreground">{educator.current_school}{educator.town && `, ${educator.town}`}</p>
            </div>
          )}
        </div>

        {educator.preferred_provinces?.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Looking to Move To</h2>
            <div className="flex flex-wrap gap-2">
              {educator.preferred_provinces.map((p: string) => (
                <div key={p} className="flex items-center gap-1 px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium">
                  <ChevronRight className="w-3 h-3" />
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
