import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

const SUBJECT_OPTIONS = [
  'Account & login issues',
  'Payments & subscriptions',
  'Credits & CV downloads',
  'Profile, matching & search',
  'Report a bug',
  'Other',
];

export default function SupportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const userCode  = (user?.user_metadata?.user_code as string | undefined) ?? null;
  const fullName  = (user?.user_metadata?.full_name as string | undefined) || '';
  const email     = user?.email ?? '';

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message before sending.');
      return;
    }
    if (!email) {
      toast.error('Could not determine your account email. Please try logging in again.');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-support-email', {
        body: {
          email,
          full_name: fullName,
          user_code: userCode,
          subject:   subject || 'General enquiry',
          message:   message.trim(),
        },
      });
      if (error) throw error;

      toast.success('Message sent! Our support team will get back to you by email.');
      setSubject('');
      setMessage('');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 pt-4 pb-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Contact Support</h1>
          <p className="text-sm text-muted-foreground">We typically reply within 1–2 business days</p>
        </div>
      </div>

      <div className="px-4 pb-8 space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          {/* Sender info — read-only, sent automatically with the message */}
          <div className="flex items-start gap-3 bg-muted/40 rounded-xl p-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div className="text-sm min-w-0">
              <p className="font-medium text-foreground truncate">{fullName || email}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reference Code: <span className="font-mono font-semibold text-primary">{userCode ?? 'Not assigned'}</span>
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">What can we help with?</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SUBJECT_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    subject === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Message</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe your issue or question in as much detail as possible..."
              rows={6}
              className="rounded-xl"
            />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={sending || !message.trim()}
          className="w-full rounded-xl font-semibold gap-2 h-11"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Sending...' : 'Send Message'}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Your reference code is included automatically so our team can find your account quickly.
        </p>
      </div>
    </div>
  );
}
