import { useState } from 'react';
import { Star, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

interface Props {
  source?: 'public_form' | 'cv_download_prompt' | 'match_prompt';
  onSubmitted?: () => void;
  /** Compact mode trims spacing/heading for use inside a modal. */
  compact?: boolean;
}

export default function TestimonialForm({ source = 'public_form', onSubmitted, compact = false }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState((user?.user_metadata?.full_name as string) || '');
  const [roleLabel, setRoleLabel] = useState('');
  const [quote, setQuote] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !quote.trim()) {
      toast.error('Please add your name and a short review.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('testimonials').insert([{
        user_id:    user?.id ?? null,
        name:       name.trim(),
        role_label: roleLabel.trim() || null,
        quote:      quote.trim(),
        rating,
        source,
        status:     'pending',
      }]);
      if (error) throw error;

      setSubmitted(true);
      toast.success('Thank you for sharing! We\'ll publish it shortly.');
      onSubmitted?.();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center py-8 px-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <CheckCircle2 className="w-6 h-6 text-primary" />
        </div>
        <p className="font-semibold text-foreground">Thanks for sharing!</p>
        <p className="text-sm text-muted-foreground mt-1">We'll publish it on our landing page shortly.</p>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!compact && (
        <div>
          <h3 className="text-base font-bold text-foreground">Share Your Experience</h3>
          <p className="text-sm text-muted-foreground">Tell other educators and job seekers about your experience with Crosssa.</p>
        </div>
      )}

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5"
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                n <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Your Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nomsa Dlamini" className="rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Role (optional)</Label>
        <Input
          value={roleLabel}
          onChange={e => setRoleLabel(e.target.value)}
          placeholder="e.g. English Educator · KZN"
          className="rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Your Review</Label>
        <Textarea
          value={quote}
          onChange={e => setQuote(e.target.value)}
          placeholder="What was your experience using Crosssa?"
          rows={4}
          className="rounded-xl"
        />
      </div>

      <Button onClick={handleSubmit} disabled={submitting} className="w-full rounded-xl font-semibold gap-2 h-11">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {submitting ? 'Submitting...' : 'Submit Review'}
      </Button>
    </div>
  );
}
