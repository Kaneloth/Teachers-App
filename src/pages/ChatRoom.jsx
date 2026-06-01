import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Check, CheckCheck, Copy, Trash2, Trash } from 'lucide-react';
import { format } from 'date-fns';
import { useSubscription } from '@/hooks/useSubscription';
import SubscriptionGate from '@/components/SubscriptionGate';
import { toast } from 'sonner';

export default function ChatRoom() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [newMsg, setNewMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const scrollRef = useRef(null);
  const longPressRef = useRef(null);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
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

  const handleLongPress = (msg) => {
    longPressRef.current = setTimeout(() => setSelectedMsg(msg), 400);
  };
  const cancelLongPress = () => clearTimeout(longPressRef.current);

  const handleCopy = (msg) => {
    navigator.clipboard.writeText(msg.content);
    toast.success('Copied to clipboard');
    setSelectedMsg(null);
  };

  const handleDeleteForMe = async (msg) => {
    // Soft-delete: hide by marking with a local filter — we delete from DB only if sender
    // For "delete for me" we just remove from local state
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    setSelectedMsg(null);
  };

  const handleDeleteForEveryone = async (msg) => {
    await base44.entities.Message.delete(msg.id);
    setSelectedMsg(null);
  };

  const { isSubscribed, isLoading: subLoading } = useSubscription();

  const urlParams = new URLSearchParams(window.location.search);
  const withEducatorId = urlParams.get('with');

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: otherEducator } = useQuery({
    queryKey: ['other-educator', withEducatorId],
    queryFn: async () => {
      if (!withEducatorId) return null;
      const list = await base44.entities.Educator.filter({ id: withEducatorId });
      return list[0] || null;
    },
    enabled: !!withEducatorId,
  });

  // Real-time messages via subscription
  useEffect(() => {
    const load = async () => {
      const msgs = await base44.entities.Message.filter({ conversation_id: conversationId }, 'created_date', 200);
      setMessages(msgs);
    };

    load();

    const unsub = base44.entities.Message.subscribe(async () => {
      const msgs = await base44.entities.Message.filter({ conversation_id: conversationId }, 'created_date', 200);
      setMessages(msgs);
    });

    return () => unsub();
  }, [conversationId]);

  // Mark received messages as read when opening the chat
  useEffect(() => {
    if (!user || messages.length === 0) return;
    const unread = messages.filter(msg => msg.receiver_id === user.id && !msg.is_read);
    unread.forEach(msg => {
      base44.entities.Message.update(msg.id, { is_delivered: true, is_read: true });
    });
  }, [messages, user]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !user || sending) return;
    const content = newMsg.trim();
    setNewMsg('');
    setSending(true);
    const receiverId = otherEducator?.created_by_id || withEducatorId || '';
    await base44.entities.Message.create({
      sender_id: user.id,
      receiver_id: receiverId,
      content,
      conversation_id: conversationId,
      is_delivered: true,
      is_read: false,
    });
    setSending(false);
  };

  const initials = otherEducator?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2) || '?';

  const header = (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shadow-sm">
      <button
        onClick={() => navigate('/chats')}
        className="p-1 hover:bg-muted rounded-lg transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-foreground" />
      </button>
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
        {otherEducator?.avatar_url
          ? <img src={otherEducator.avatar_url} alt={otherEducator.full_name} className="w-full h-full object-cover" />
          : <span className="text-xs font-bold text-primary">{initials}</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">
          {otherEducator?.full_name || 'Educator'}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {otherEducator?.current_province}
        </p>
      </div>
    </div>
  );

  if (!subLoading && !isSubscribed) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] bg-background">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <SubscriptionGate message="You have unread messages waiting. Subscribe to read and reply to messages from other educators." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-background">
      {header}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-3 px-3 space-y-1"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border)/0.3) 1px, transparent 0)', backgroundSize: '20px 20px' }}
      >
        {messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="bg-card border border-border rounded-xl px-4 py-3 text-center max-w-xs shadow-sm">
              <p className="text-sm text-muted-foreground">Start the conversation!</p>
              <p className="text-xs text-muted-foreground mt-1">Introduce yourself and discuss a potential transfer.</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === user?.id;
          const prevMsg = messages[idx - 1];
          const showDateSeparator =
            idx === 0 ||
            format(new Date(msg.created_date), 'yyyy-MM-dd') !==
              format(new Date(prevMsg.created_date), 'yyyy-MM-dd');
          const isSelected = selectedMsg?.id === msg.id;

          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-3">
                  <span className="bg-card border border-border text-muted-foreground text-[10px] px-3 py-1 rounded-full shadow-sm">
                    {format(new Date(msg.created_date), 'dd MMM yyyy')}
                  </span>
                </div>
              )}

              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-0.5 relative`}>
                <div
                  onMouseDown={() => handleLongPress(msg)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => handleLongPress(msg)}
                  onTouchEnd={cancelLongPress}
                  onClick={() => setSelectedMsg(isSelected ? null : msg)}
                  className={`relative max-w-[75%] px-3 pt-2 pb-1.5 shadow-sm cursor-pointer select-none transition-opacity ${
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                      : 'bg-card border border-border text-foreground rounded-2xl rounded-bl-sm'
                  } ${isSelected ? 'opacity-80' : ''}`}
                >
                  {isMe ? (
                    <span className="absolute -bottom-0 -right-[5px] w-3 h-3 overflow-hidden" style={{ clipPath: 'polygon(0 0, 0% 100%, 100% 0)' }}>
                      <span className="block w-full h-full bg-primary" />
                    </span>
                  ) : (
                    <span className="absolute -bottom-0 -left-[5px] w-3 h-3 overflow-hidden" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}>
                      <span className="block w-full h-full bg-card" />
                    </span>
                  )}

                  <p className="text-sm leading-relaxed break-words">{msg.content}</p>

                  <div className={`flex items-center gap-1 justify-end mt-0.5 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    <span className="text-[10px]">
                      {format(new Date(msg.created_date), 'HH:mm')}
                    </span>
                    {isMe && (
                      msg.is_read ? (
                        <CheckCheck className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                      ) : msg.is_delivered ? (
                        <CheckCheck className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      ) : (
                        <Check className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      )
                    )}
                  </div>
                </div>

                {/* Context menu */}
                {isSelected && (
                  <div
                    ref={menuRef}
                    className={`absolute z-50 bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[170px]`}
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-3 border-t border-border bg-card"
      >
        <input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-full h-10 px-4 bg-background border border-input text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-full h-10 w-10 shrink-0"
          disabled={!newMsg.trim() || sending}
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}