import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Check, CheckCheck, Copy, Trash, Trash2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';
import { useFeatureGates } from '@/hooks/useFeatureGates';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { isBlocked, blockUser } from '@/lib/blockUtils';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface PartnerInfo {
  full_name: string;
  current_province?: string;
}

function formatDateSeparator(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'd MMM yyyy');
}

const hiddenKey = (userId: string) => `educross_hidden_msgs_${userId}`;

function getHidden(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(hiddenKey(userId)) || '[]'));
  } catch {
    return new Set();
  }
}

function addHidden(userId: string, msgId: string) {
  const hidden = getHidden(userId);
  hidden.add(msgId);
  localStorage.setItem(hiddenKey(userId), JSON.stringify([...hidden]));
}

function removeHidden(userId: string, msgId: string) {
  const hidden = getHidden(userId);
  hidden.delete(msgId);
  localStorage.setItem(hiddenKey(userId), JSON.stringify([...hidden]));
}

export default function ChatRoom() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { balance, loading: creditsLoading } = useCredits();
  const isAdmin = !!(user?.user_metadata?.is_admin);
  const { gates, loading: gatesLoading } = useFeatureGates();
  // Gate off = chat is free for everyone (no 5-credit charge)
  const chatGateActive = !gatesLoading && gates.chat_credits && !isAdmin;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [menuOpenUp, setMenuOpenUp] = useState(false);
  const [chatBlocked, setChatBlocked] = useState(false);
  const [hasSentBefore, setHasSentBefore] = useState<boolean | null>(null);
  const [hasChatAccess, setHasChatAccess] = useState<boolean | null>(null);
  const [showChatUpsell, setShowChatUpsell] = useState(false);

  // Check R79+ purchase — required to send/reply to messages
  useEffect(() => {
    if (!user || isAdmin) { setHasChatAccess(true); return; }
    supabase.from('credit_ledger').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('type', 'purchase').gte('amount', 60)
      .then(({ count }) => setHasChatAccess((count ?? 0) > 0));
  }, [user, isAdmin]);
  const [checkingBlock, setCheckingBlock] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const broadcastChannelRef    = useRef<any>(null); // chat-specific (for partner's ChatRoom)
  const userNotifyChannelRef   = useRef<any>(null); // user-specific (for our own ChatsPage)
  const partnerNotifyChannelRef = useRef<any>(null); // partner-specific (for partner's ChatsPage)

  const checkBlockStatus = async () => {
    if (!user || !partnerId) {
      setCheckingBlock(false);
      return;
    }
    setCheckingBlock(true);
    try {
      const blockedByMe = await isBlocked(user.id, partnerId);
      const blockedByThem = await isBlocked(partnerId, user.id);
      setChatBlocked(blockedByMe || blockedByThem);
    } catch (err) {
      console.error('Failed to check block status:', err);
    } finally {
      setCheckingBlock(false);
    }
  };

  useEffect(() => {
    checkBlockStatus();

    const channel = supabase
      .channel(`block-status-${user?.id}-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_blocks',
          filter: `blocker_id=eq.${user?.id},blocked_id=eq.${partnerId}`,
        },
        () => checkBlockStatus()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_blocks',
          filter: `blocker_id=eq.${partnerId},blocked_id=eq.${user?.id}`,
        },
        () => checkBlockStatus()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, partnerId]);

  useEffect(() => {
    const handle = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSelectedMsg(null);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, []);

  // Measures available space below the bubble — if the context menu
  // (~140-180px tall) wouldn't fit, flip it to open upward instead so it
  // never gets hidden behind the input bar or bottom navigation.
  const decideMenuDirection = (target: HTMLElement | null) => {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setMenuOpenUp(spaceBelow < 180);
  };

  const startLongPress = (msg: Message, e?: React.MouseEvent | React.TouchEvent) => {
    longPressTriggered.current = false;
    const target = e?.currentTarget as HTMLElement | undefined;
    longPressRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      decideMenuDirection(target ?? null);
      setSelectedMsg(msg);
    }, 400);
  };

  const cancelLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const handleBubbleClick = (msg: Message, e?: React.MouseEvent) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    setSelectedMsg(prev => {
      if (prev?.id === msg.id) return null;
      decideMenuDirection((e?.currentTarget as HTMLElement) ?? null);
      return msg;
    });
  };

  const handleCopy = (msg: Message) => {
    navigator.clipboard.writeText(msg.content);
    toast.success('Copied to clipboard');
    setSelectedMsg(null);
  };

  const handleDeleteForMe = (msg: Message) => {
    if (user) addHidden(user.id, msg.id);
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    setSelectedMsg(null);
  };

  const handleDeleteForEveryone = async (msg: Message) => {
    const { error } = await supabase.from('messages').delete().eq('id', msg.id);
    if (error) {
      toast.error('Could not delete message');
    } else {
      if (user) removeHidden(user.id, msg.id);
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      // Notify the other user's ChatRoom (so their message list updates)
      broadcastChannelRef.current?.send({
        type: 'broadcast',
        event: 'message_deleted',
        payload: { id: msg.id },
      });
      // Notify both users' ChatsPage (so thread list last-message refreshes)
      userNotifyChannelRef.current?.send({
        type: 'broadcast',
        event: 'thread_changed',
        payload: { deletedId: msg.id },
      });
      partnerNotifyChannelRef.current?.send({
        type: 'broadcast',
        event: 'thread_changed',
        payload: { deletedId: msg.id },
      });
      toast.success('Message deleted for everyone');
    }
    setSelectedMsg(null);
  };

  useEffect(() => {
    if (!user || !partnerId) return;

    // Chat-specific channel: receive deletions from partner's ChatRoom

    const chatChannelName = `chat-broadcast-${[user.id, partnerId].sort().join('_')}`;
    const chatChannel = supabase
      .channel(chatChannelName)
      .on('broadcast', { event: 'message_deleted' }, payload => {
        if (payload.payload?.id) {
          setMessages(prev => prev.filter(m => m.id !== payload.payload.id));
        }
      })
      .subscribe();
    broadcastChannelRef.current = chatChannel;

    // User-specific channels: notify ChatsPage of changes for both users
    const myNotifyChannel = supabase.channel(`user-events-${user.id}`).subscribe();
    userNotifyChannelRef.current = myNotifyChannel;

    const partnerNotifyChannel = supabase.channel(`user-events-${partnerId}`).subscribe();
    partnerNotifyChannelRef.current = partnerNotifyChannel;

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(myNotifyChannel);
      supabase.removeChannel(partnerNotifyChannel);
    };
  }, [user, partnerId]);

  useEffect(() => {
    if (!partnerId) return;
    supabase
      .from('educators')
      .select('full_name, current_province')
      .eq('user_id', partnerId)
      .single()
      .then(({ data }) => { if (data) setPartner(data); });
  }, [partnerId]);

  useEffect(() => {
    if (!user || !partnerId) return;
    if (chatBlocked) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),` +
          `and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      const hidden = getHidden(user.id);
      const filtered = (data || []).filter(m => !hidden.has(m.id));
      setMessages(filtered);
      // Set hasSentBefore based on fetched messages
      setHasSentBefore(filtered.some(m => m.sender_id === user.id));

      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', partnerId)
        .eq('read', false);
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-${user.id}-${partnerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        payload => {
          const msg = payload.new as Message;
          if (msg.sender_id === partnerId) {
            const hidden = getHidden(user.id);
            if (!hidden.has(msg.id)) {
              setMessages(prev => [...prev, msg]);
            }
            supabase.from('messages').update({ read: true }).eq('id', msg.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        payload => {
          const deleted = payload.old as { id: string };
          if (deleted?.id) {
            setMessages(prev => prev.filter(m => m.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, partnerId, chatBlocked]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ✅ IMPROVED handleSend – check block first, never add optimistic if blocked
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || !partnerId || sending) return;
    // R79+ required to send — show upsell if not purchased
    if (hasChatAccess === false) {
      setShowChatUpsell(true);
      return;
    }

    // Check block status BEFORE adding any message
    const blockedByMe = await isBlocked(user.id, partnerId);
    const blockedByThem = await isBlocked(partnerId, user.id);
    if (blockedByMe || blockedByThem) {
      toast.error("You cannot send messages to this user (blocked).");
      return;
    }

    // If user hasn't sent to this partner before, deduct 5 credits
    // (admins bypass + gate off = free for everyone)
    if (!hasSentBefore && chatGateActive) {
      if (creditsLoading) return; // wait for balance to load
      if (balance < 5) {
        toast.error('You need 5 credits to start this conversation. Please top up your credits.');
        return;
      }
      const deductRes = await fetch('/.netlify/functions/deduct-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'chat_start', ref_id: `chat:${user.id}:${partnerId}` }),
      });
      const deductData = await deductRes.json();
      if (deductRes.status === 402) {
        toast.error(`Not enough credits. You need 5 credits to reply. You have ${deductData.balance}.`);
        return;
      }
      if (!deductRes.ok) {
        toast.error('Could not process credits. Please try again.');
        return;
      }
      setHasSentBefore(true); // mark so future replies in this session are free
    }

    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: partnerId,
      content: text.trim(),
      created_at: new Date().toISOString(),
      read: false,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setText('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{ sender_id: user.id, receiver_id: partnerId, content: optimisticMessage.content }])
        .select()
        .single();

      if (error) {
        console.error('Send failed:', error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        toast.error("Message not sent – you may have blocked this user or been blocked.");
      } else if (data) {
        setMessages(prev => prev.map(m => (m.id === tempId ? (data as Message) : m)));
        // Notify partner's ChatsPage so their thread list updates with new last message
        partnerNotifyChannelRef.current?.send({
          type: 'broadcast',
          event: 'thread_changed',
          payload: { newMessageId: data.id },
        });
      }
    } catch (err) {
      console.error('Unexpected send error:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const partnerInitials = partner?.full_name
    ? partner.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (checkingBlock) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-56px-64px)]">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (chatBlocked) {
    return (
      <div className="flex flex-col h-[calc(100vh-56px-64px)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{partnerInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight">{partner?.full_name || 'Educator'}</p>
            {partner?.current_province && (
              <p className="text-xs text-muted-foreground leading-tight">{partner.current_province}</p>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-6">
          <Lock className="w-14 h-14 mb-4 text-destructive/60" />
          <p className="text-center font-medium mb-1">Chat unavailable</p>
          <p className="text-sm text-center">
            You cannot send or receive messages with this user because one of you has blocked the other.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px-64px)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">{partnerInitials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground leading-tight">{partner?.full_name || 'Educator'}</p>
          {partner?.current_province && (
            <p className="text-xs text-muted-foreground leading-tight">{partner.current_province}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-background">
        {messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="bg-card border border-border rounded-xl px-4 py-3 text-center max-w-xs shadow-sm">
              <p className="text-sm text-muted-foreground">Start the conversation!</p>
              <p className="text-xs text-muted-foreground mt-1">Introduce yourself and discuss a potential transfer.</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          const msgDate = new Date(msg.created_at);
          const prevDate = i > 0 ? new Date(messages[i - 1].created_at) : null;
          const showDateSep = !prevDate || !isSameDay(msgDate, prevDate);
          const isSelected = selectedMsg?.id === msg.id;

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex justify-center my-3">
                  <span className="bg-muted text-muted-foreground text-[11px] px-3 py-1 rounded-full">
                    {formatDateSeparator(msgDate)}
                  </span>
                </div>
              )}

              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 relative`}>
                {isSelected && (
                  <div
                    ref={menuRef}
                    className={`absolute z-50 ${menuOpenUp ? 'bottom-full mb-1' : 'top-full mt-1'} ${isMe ? 'right-0' : 'left-0'} bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[180px]`}
                  >
                    <button
                      onClick={() => handleCopy(msg)}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Copy className="w-4 h-4 text-muted-foreground" />
                      Copy
                    </button>
                    <button
                      onClick={() => handleDeleteForMe(msg)}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Trash className="w-4 h-4 text-muted-foreground" />
                      Delete for me
                    </button>
                    {isMe && (
                      <button
                        onClick={() => handleDeleteForEveryone(msg)}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete for everyone
                      </button>
                    )}
                  </div>
                )}

                <div
                  onMouseDown={(e) => startLongPress(msg, e)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={(e) => startLongPress(msg, e)}
                  onTouchEnd={cancelLongPress}
                  onClick={(e) => handleBubbleClick(msg, e)}
                  className={`relative max-w-[72%] rounded-2xl px-3.5 py-2 text-sm cursor-pointer select-none transition-opacity ${
                    isMe
                      ? 'bg-primary text-white rounded-br-[4px]'
                      : 'bg-card border border-border text-foreground rounded-bl-[4px]'
                  } ${isSelected ? 'opacity-75' : ''}`}
                >
                  <p className="leading-snug break-words text-center">{msg.content}</p>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <span className={`text-[10px] ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {format(msgDate, 'HH:mm')}
                    </span>
                    {isMe && (
                      msg.read
                        ? <CheckCheck className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                        : msg.id.startsWith('temp-')
                          ? <Check className="w-3.5 h-3.5 text-white/60 shrink-0" />
                          : <CheckCheck className="w-3.5 h-3.5 text-white/60 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Always-visible input — send button triggers R79+ upsell if not purchased */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-4 py-3 border-t border-border bg-background"
      >
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
          className="rounded-full flex-1 bg-muted/40 border-border"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !text.trim()}
          className="rounded-full shrink-0 w-10 h-10"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {/* R79+ chat upsell modal */}
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
                Top up with the <strong>Pro Credit Pack (R79)</strong> to send and reply to messages.
                60 credits gives you 12 conversations with potential transfer partners.
              </p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">Pro Credit Pack</span>
                <span className="font-bold text-primary text-lg">R79</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>60 credits · 12 conversations</span>
                <span>R6.60/chat</span>
              </div>
            </div>
            <CreditBalance variant="full" />
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