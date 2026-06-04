import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, BookOpen, Navigation, ShieldCheck, MessageCircle, ArrowLeft, Flame, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import SubscriptionModal from '@/components/SubscriptionModal';
import { canStartNewChat } from '@/utils/chatLimit';

interface Educator {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  current_school?: string;
  current_province?: string;
  town?: string;
  phase?: string;
  subjects?: string[];
  preferred_provinces?: string[];
  is_actively_looking?: boolean;
  is_sace_verified?: boolean;
  years_experience?: number;
  user_id?: string;
}

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border px-4 py-3.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

export default function EducatorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [educator, setEducator] = useState<Educator | null>(null);
  const [loading, setLoading] = useState(true);
  const [messaging, setMessaging] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('educators').select('*').eq('id', id).single().then(({ data }) => {
      setEducator(data);
      setLoading(false);
    });
  }, [id]);

  const handleMessage = async () => {
    if (!user || !educator) return;
    setMessaging(true);
    try {
      const targetId = educator.user_id ?? '';

      /* ── Gate: check subscription + chat limit before doing anything ── */
      const allowed = await canStartNewChat(user.id, targetId);
      if (!allowed) {
        toast.error('You've reached your 5 free chat limit. Upgrade to Pro for unlimited messaging.');
        setShowSubModal(true);
        return;
      }

      /* ── Open / create the conversation ────────────────────────── */
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),` +
          `and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`
        )
        .limit(1);

      if (!existing?.length) {
        await supabase.from('messages').insert([{
          sender_id: user.id,
          receiver_id: targetId,
          content: `Hi ${educator.full_name}, I found your profile on Crosssa and would like to connect!`,
        }]);
        toast.success(`Message sent to ${educator.full_name}`);
      }

      navigate(`/chat/${targetId}`);
    } catch {
      toast.error('Failed to start conversation');
    } finally {
      setMessaging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!educator) {
    return <div className="text-center py-20 text-muted-foreground">Educator not found</div>;
  }

  const isOwn = educator.user_id === user?.id;
  const initials = educator.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const preferredLabel = educator.preferred_provinces?.length
    ? educator.preferred_provinces.join(', ')
    : 'Any province';

  return (
    <div className="max-w-2xl mx-auto flex flex-col min-h-[calc(100vh-56px-64px)]">
      {/* Back button */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2 pt-3 pb-5 px-4">
        <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center border-2 border-primary/20 overflow-hidden">
          {educator.avatar_url
            ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-primary">{initials}</span>
          }
        </div>
        <h1 className="text-lg font-bold text-foreground text-center">{educator.full_name}</h1>
        {educator.is_actively_looking && (
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-500">Actively Looking</span>
          </div>
        )}
        {educator.is_sace_verified && (
          <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Verified</span>
          </div>
        )}
      </div>

      {/* Section cards */}
      <div className="flex-1 px-4 space-y-3 pb-28">
        <SectionCard label="Current Position">
          <InfoRow icon={MapPin} label="Province" value={educator.current_province} />
          <InfoRow icon={MapPin} label="Town" value={educator.town} />
          <InfoRow icon={Briefcase} label="School" value={educator.current_school} />
        </SectionCard>

        <SectionCard label="Transfer Preferences">
          <InfoRow icon={Navigation} label="Preferred" value={preferredLabel} />
        </SectionCard>

        <SectionCard label="Teaching Details">
          <InfoRow icon={BookOpen} label="Phase" value={educator.phase} />
          {educator.subjects?.length ? (
            <div className="flex flex-wrap gap-1.5 pl-6">
              {educator.subjects.map(s => (
                <span key={s} className="text-[11px] bg-muted text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
                  {s}
                </span>
              ))}
            </div>
          ) : null}
          <InfoRow icon={Briefcase} label="Experience" value={educator.years_experience ? `${educator.years_experience} years` : null} />
        </SectionCard>

        <SectionCard label="About">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {educator.bio || 'About me'}
          </p>
        </SectionCard>
      </div>

      {/* Sticky Send Message button */}
      {!isOwn && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 bg-background/90 backdrop-blur-sm">
          <Button
            onClick={handleMessage}
            disabled={messaging}
            className="w-full h-12 rounded-2xl text-base font-semibold gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            {messaging ? 'Checking…' : 'Send Message'}
          </Button>
        </div>
      )}

      <SubscriptionModal open={showSubModal} onClose={() => setShowSubModal(false)} />
    </div>
  );
}
