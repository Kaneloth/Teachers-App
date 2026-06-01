import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, MapPin, Target, BookOpen, Calendar, Briefcase, MessageCircle,
  Flame, Shield, RefreshCw, Lock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useSubscription } from '@/hooks/useSubscription';

export default function EducatorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: educator, isLoading } = useQuery({
    queryKey: ['educator', id],
    queryFn: async () => {
      const list = await base44.entities.Educator.filter({ id });
      return list[0] || null;
    },
  });

  const { isSubscribed, tier } = useSubscription();

  const { data: myProfile } = useQuery({
    queryKey: ['my-educator-profile'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Educator.filter({ created_by_id: user.id });
      return profiles[0] || null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!educator) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-muted-foreground">Educator not found.</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">Go back</Button>
      </div>
    );
  }

  // Match calculation
  const getMatch = () => {
    if (!myProfile?.subjects?.length || !educator.subjects?.length) return null;
    const mySet = new Set(myProfile.subjects.map(s => s.toLowerCase()));
    const theirSet = new Set(educator.subjects.map(s => s.toLowerCase()));
    const intersection = [...mySet].filter(s => theirSet.has(s));
    const union = new Set([...mySet, ...theirSet]);
    return Math.round((intersection.length / union.size) * 100);
  };

  const match = getMatch();

  const handleStartChat = async () => {
    const user = await base44.auth.me();
    const conversationId = [user.id, educator.created_by_id].sort().join('_');

    // Free-tier check: count distinct existing conversations
    if (tier === 'free') {
      const [sent, received] = await Promise.all([
        base44.entities.Message.filter({ sender_id: user.id }, '-created_date', 300),
        base44.entities.Message.filter({ receiver_id: user.id }, '-created_date', 300),
      ]);
      const allConvIds = new Set([...sent, ...received].map(m => m.conversation_id));
      // If this is a new conversation and they already have 2, block it
      if (!allConvIds.has(conversationId) && allConvIds.size >= 2) {
        navigate('/settings', { state: { tab: 'subscription' } });
        return;
      }
    }

    navigate(`/chat/${conversationId}?with=${educator.id}`);
  };

  return (
    <div className="px-4 pt-4 pb-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Avatar & Name */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3 overflow-hidden">
            {educator.avatar_url
              ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-primary">
                  {educator.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
            }
          </div>
          <h1 className="text-xl font-bold text-foreground">{educator.full_name}</h1>

          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            {educator.is_sace_verified && (
              <Badge className="bg-primary/10 text-primary border-0 gap-1">
                <Shield className="w-3 h-3" /> SACE Verified
              </Badge>
            )}
            {educator.is_actively_looking && (
              <Badge className="bg-accent/15 text-accent border-0 gap-1">
                <Flame className="w-3 h-3" /> Actively Looking
              </Badge>
            )}
          </div>

          {match !== null && (
            <div className="mt-4 inline-flex items-center gap-2 bg-primary/5 rounded-xl px-4 py-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">{match}% Subject Match</span>
            </div>
          )}
        </div>

        {/* Info sections */}
        <div className="space-y-4">
          <InfoSection title="Current Position">
            <InfoRow icon={MapPin} label="Province" value={educator.current_province} />
            <InfoRow icon={MapPin} label="District" value={educator.current_district} />
            {educator.current_school && (
              <InfoRow icon={Briefcase} label="School" value={educator.current_school} />
            )}
          </InfoSection>

          <InfoSection title="Transfer Preferences">
            <InfoRow icon={Target} label="Preferred" value={educator.preferred_provinces?.join(', ') || 'Any province'} />
            {educator.available_from && (
              <InfoRow icon={Calendar} label="Available from" value={format(new Date(educator.available_from), 'MMM yyyy')} />
            )}
          </InfoSection>

          <InfoSection title="Teaching Details">
            <InfoRow icon={BookOpen} label="Phase" value={educator.phase} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {educator.subjects?.map(s => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
            {educator.years_experience && (
              <InfoRow icon={Briefcase} label="Experience" value={`${educator.years_experience} years`} />
            )}
          </InfoSection>

          {educator.bio && (
            <InfoSection title="About">
              <p className="text-sm text-muted-foreground leading-relaxed">{educator.bio}</p>
            </InfoSection>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          {(isSubscribed || tier === 'free') ? (
            <Button onClick={handleStartChat} className="w-full h-12 rounded-xl text-base font-semibold gap-2">
              <MessageCircle className="w-5 h-5" /> Send Message
            </Button>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center text-center gap-3">
              <Lock className="w-6 h-6 text-primary" />
              <p className="text-sm text-muted-foreground">Subscribe to send messages to this educator.</p>
              <Button
                onClick={() => navigate('/settings', { state: { tab: 'subscription' } })}
                className="w-full h-11 rounded-xl font-semibold"
              >
                Subscribe to Message
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function InfoSection({ title, children }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}