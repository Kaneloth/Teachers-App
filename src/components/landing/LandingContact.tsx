import { useState } from 'react';
import { Mail, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const SUBJECT_OPTIONS = [
  'General enquiry',
  'Account & login issues',
  'Payments & subscriptions',
  'Partnership / press',
  'Report a bug',
];

export default function LandingContact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General enquiry');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-support-email', {
        body: {
          email: email.trim(),
          full_name: name.trim(),
          user_code: null, // public visitor — not a registered/logged-in user
          subject,
          message: message.trim(),
        },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      // Fall back to a plain mailto link if the function call fails for
      // any reason (e.g. network issue) — the visitor's message isn't lost.
      window.location.href = `mailto:support@crosssa.co.za?subject=${encodeURIComponent(`[Contact] ${subject}`)}&body=${encodeURIComponent(`From: ${name} <${email}>\n\n${message}`)}`;
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contact" className="bg-[#f8fafc] py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">Get In Touch</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mt-2 mb-3">Contact Us</h2>
          <p className="text-[#64748b] max-w-xl mx-auto">
            Questions, feedback, or need help? Send us a message and we'll get back to you by email.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center text-center py-10">
              <div className="w-12 h-12 rounded-full bg-[#ccfbf1] flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-[#0d9488]" />
              </div>
              <p className="font-bold text-[#0f172a]">Message sent!</p>
              <p className="text-sm text-[#64748b] mt-1">We'll reply to {email} shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0f172a]">Your Name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Thabo Pretorius"
                    required
                    className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0f172a]">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0f172a]">What's this about?</label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_OPTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSubject(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        subject === s
                          ? 'bg-[#0d9488] text-white border-[#0d9488]'
                          : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#0d9488]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0f172a]">Message</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  rows={5}
                  required
                  className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#0d9488] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0f766e] transition-colors disabled:opacity-60"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-8 text-sm text-[#64748b]">
          <a href="mailto:support@crosssa.co.za" className="flex items-center gap-2 hover:text-[#0d9488] transition-colors">
            <Mail className="w-4 h-4" /> support@crosssa.co.za
          </a>
        </div>
      </div>
    </section>
  );
}
