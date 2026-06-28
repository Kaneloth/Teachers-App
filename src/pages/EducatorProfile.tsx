import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, BookOpen, Navigation, ShieldCheck, MessageCircle, ArrowLeft, Flame, Briefcase, Coins } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CreditBalance from '@/components/credits/CreditBalance';
import { useAuth } from '@/lib/AuthContext';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import { toast } from 'sonner';

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
  const { user, session } = useAuth();
  const isAdmin = !!(user?.user_metadata?.is_admin);
  const { gates, loading: gatesLoading } = useFeatureGates();
  const chatGateActive = !gatesLoading && gates.chat_credits && !isAdmin;
  const [educator, setEducator] = useState<Educator | null>(null);
  const [loading, setLoading] = useState(true);
  const [messaging, setMessaging] = useState(false);
  const [showChatUpsell, setShowChatUpsell] = useState(false);
  const [hasChatAccess, setHasChatAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!id) return;
    // Try user_id first (when navigating from chat), fall back to row id
    supabase.from('educators').select('*').eq('user_id', id).maybeSingle().then(({ data }) => {
      if (data) { setEducator(data); setLoading(false); return; }
      // Fall back to row id (existing /educator/:id links)
      supabase.from('educators').select('*').eq('id', id).maybeSingle().then(({ data: d2 }) => {
        setEducator(d2);
        setLoading(false);
      });
    });
  }, [id]);

  // Auto-deduct messaging_unlock when returning from PayFast via Send Message upsell
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;
    if (!user || !session?.access_token || isAdmin) return;
    const fromMessaging = sessionStorage.getItem('crosssa_messaging_upsell') === '1';
    if (!fromMessaging) return;
    sessionStorage.removeItem('crosssa_messaging_upsell');
    fetch('/.netlify/functions/deduct-credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type: 'messaging_unlock' }),
    }).then(r => r.json()).then(data => {
      if (data.success && !data.already_unlocked) {
        setHasChatAccess(true);
        toast.success('Messaging unlocked! You can now send messages.');
      } else if (data.already_unlocked) {
        setHasChatAccess(true);
      }
    }).catch(console.error);
  }, [user?.id, session, isAdmin]);

  // Check if user has a messaging_unlock ledger entry
  useEffect(() => {
    if (!user || isAdmin) { setHasChatAccess(true); return; }
    supabase.from('credit_ledger').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('type', 'messaging_unlock')
      .then(({ count }) => setHasChatAccess((count ?? 0) > 0));
  }, [user?.id, isAdmin]);

  const handleMessage = async () => {
    if (!user || !educator || !session?.access_token) return;
    // If user hasn't made an R79+ purchase, show the chat upsell modal
    // No lock icon shown on the button — just a smooth upsell on tap
    if (hasChatAccess === false) {
      sessionStorage.setItem('crosssa_messaging_upsell', '1');
      setShowChatUpsell(true);
      return;
    }
    setMessaging(true);
    try {
      const targetId = educator.user_id ?? '';

      // Check if conversation already exists — only charge credits for NEW chats
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),` +
          `and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`
        )
        .limit(1);

      if (!existing?.length) {
        // Admins bypass the credit gate entirely
        if (chatGateActive) {
        // New conversation — deduct 5 credits before sending
        const deductRes = await fetch('/.netlify/functions/deduct-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ type: 'chat_start', ref_id: `chat:${user.id}:${targetId}` }),
        });
        const deductData = await deductRes.json();
        if (deductRes.status === 402) {
          toast.error('Not enough credits to start a new chat. Top up your credits to continue.');
          setMessaging(false);
          return;
        }
        if (!deductRes.ok) throw new Error(deductData.error || 'Credit deduction failed');

        } // end !isAdmin credit gate
        await supabase.from('messages').insert([{
          sender_id:   user.id,
          receiver_id: targetId,
          content:     `Hi ${educator.full_name}, I found your profile on Crosssa and would like to connect!`,
        }]);
        toast.success('Message sent!');
      }

      navigate(`/chat/${targetId}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to start conversation');
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
        {/* Current Position — visible to all users */}
        <SectionCard label="Current Position">
          <InfoRow icon={MapPin}    label="Province" value={educator.current_province} />
          <InfoRow icon={MapPin}    label="Town"     value={educator.town} />
          <InfoRow icon={Briefcase} label="School"   value={educator.current_school} />
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

      {/* Sticky Send Message button — only shown for actively looking educators */}
      {!isOwn && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 bg-background/90 backdrop-blur-sm">
          {educator.is_actively_looking ? (
            <Button
              onClick={handleMessage}
              disabled={messaging}
              className="w-full h-12 rounded-2xl text-base font-semibold gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              {messaging ? 'Opening…' : 'Send Message'}
            </Button>
          ) : (
            <div className="w-full h-12 rounded-2xl border border-border bg-muted flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <MessageCircle className="w-4 h-4 opacity-40" />
              Not accepting messages
            </div>
          )}
        </div>
      )}

      {/* Chat upsell modal */}
      {showChatUpsell && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={e => { if (e.target === e.currentTarget) setShowChatUpsell(false); }}>
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto">
              <MessageCircle className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">Unlock Messaging</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You've found a potential match! Purchase the <strong>Pro Credit Pack (R99)</strong> to unlock messaging.
                This is a one-time access fee — the 60 credits cover your unlock and are not added to your credit balance.
              </p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">Pro Credit Pack</span>
                <span className="font-bold text-primary text-lg">R99</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>One-time messaging unlock</span>
                <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> No credits added to balance</span>
              </div>
            </div>
            <Button
              className="w-full rounded-xl gap-2"
              onClick={async () => {
                if (!session?.access_token) return;
                try {
                  const res = await fetch('/.netlify/functions/payfast-initiate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ package_id: 'pro_pack' }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Could not start payment');
                  const form = document.createElement('form');
                  form.method = 'POST';
                  form.action = data.action_url;
                  Object.entries(data.fields as Record<string, string>).forEach(([k, v]) => {
                    const input = document.createElement('input');
                    input.type = 'hidden'; input.name = k; input.value = v;
                    form.appendChild(input);
                  });
                  document.body.appendChild(form);
                  form.submit();
                } catch (e: any) {
                  toast.error(e.message || 'Could not start payment');
                }
              }}
            >
              <Coins className="w-4 h-4" /> Buy Pro Pack · R99
            </Button>
            <button
              onClick={() => setShowChatUpsell(false)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
