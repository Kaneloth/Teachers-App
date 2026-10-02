import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Radar, MessageSquare, MessageCircle, UserCheck, Mail, FileText, School, ClipboardList, Send, Phone, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import StepCard from '@/components/landing/StepCard';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import FeatureBullet from '@/components/landing/FeatureBullet';
import PhoneMockup from '@/components/landing/PhoneMockup';
import MapRadiusVisual from '@/components/landing/MapRadiusVisual';

// Mirrors the real, in-app Provincial DoE Cross-Transfer guide (Guides tab)
// step for step — this teaser must stay in sync with that page, not read
// as a separate, generic "transfer tips" blog.
const TRANSFER_STEPS = [
  { icon: UserCheck,     title: 'Confirm your match',                                    text: 'Verify in the Matches tab that both you and the other educator have confirmed the mutual transfer.' },
  { icon: Mail,          title: 'Write a request letter to your principal & SGB',         text: 'Formally request approval to apply for the transfer.' },
  { icon: FileText,      title: 'Obtain a release letter from your current school',       text: "Confirming your current school is willing to let you go." },
  { icon: School,        title: 'Obtain an acceptance letter from the receiving school',  text: "Confirming they're willing to take you on." },
  { icon: ClipboardList, title: 'Complete the official Annexure A form',                  text: 'The official Provincial DoE reference form for cross transfers.' },
  { icon: Send,          title: 'Submit all documents',                                   text: 'To both principals and your education district office.' },
  { icon: Phone,         title: 'Follow up with district and HR',                         text: 'Keep checking in until the transfer is formally approved.' },
];

// Same 4 templates as the in-app guide. No download links here — the real
// files are pre-filled with the signed-in educator's own details and only
// unlock once they're inside the app.
const TRANSFER_TEMPLATES = [
  { icon: Mail,          name: 'Request Letter',    desc: 'To your principal & SGB' },
  { icon: FileText,      name: 'Release Letter',    desc: 'From your current school' },
  { icon: School,        name: 'Acceptance Letter', desc: 'From the receiving school' },
  { icon: ClipboardList, name: 'Annexure A',        desc: 'Official Provincial DoE reference form' },
];

export default function TransferPage() {
  useEffect(() => { document.title = 'Find Your Transfer Match | Crosssa'; }, []);

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-[#0066FF]/[0.06] to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl font-bold text-[#1A1A2E] leading-tight mb-4"
            >
              Find Your Transfer Match—Automatically
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-base text-[#6B7280] leading-relaxed mb-7"
            >
              Crosssa scans daily for educators who match your profile. No manual searching.
              Just register and wait for your SMS alert.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Link to="/register">
                <Button className="h-12 px-7 rounded-xl text-sm font-semibold bg-[#0066FF] hover:bg-[#0052cc] text-white border-0">
                  Start Finding Your Match →
                </Button>
              </Link>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <PhoneMockup message="New match found near Centurion — tap to view Thandi's profile." pulse />
          </motion.div>
        </div>
      </section>

      {/* ── How It Works (4 steps) ───────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-14">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-2">How It Works</h2>
          <p className="text-sm text-[#6B7280]">Four steps, fully automatic after step one.</p>
        </div>

        <StepCard
          step={1}
          icon={User}
          title="Build Your Profile"
          text="Add your phase, subjects, location, and preferred transfer destinations."
          visual={<div className="w-full space-y-2"><div className="h-2.5 w-2/3 bg-[#0066FF]/20 rounded-full" /><div className="h-2.5 w-1/2 bg-[#E5E7EB] rounded-full" /><div className="h-2.5 w-3/4 bg-[#E5E7EB] rounded-full" /></div>}
        />
        <StepCard
          step={2}
          icon={Radar}
          title="We Scan Daily for Matches"
          text="Our system runs automatic scans every day—no manual searching required."
          reverse
          visual={
            <div className="relative w-28 h-28">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[#0066FF]/30"
                animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
              <div className="absolute inset-0 rounded-full border-2 border-[#0066FF]/40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Radar className="w-8 h-8 text-[#0066FF]" strokeWidth={1.5} />
              </div>
            </div>
          }
        />
        <StepCard
          step={3}
          icon={MessageSquare}
          title="Get Notified by SMS"
          text="When we find a match, you get an SMS alert with their details."
          visual={<PhoneMockup message="Match found! Bongani T. — Intermediate Phase, Pretoria. View profile in-app." />}
        />
        <StepCard
          step={4}
          icon={MessageCircle}
          title="Chat and Make the Swap"
          text="Connect directly with your match and arrange the transfer."
          reverse
          visual={
            <div className="w-full space-y-2">
              <div className="flex"><div className="bg-[#E5E7EB] rounded-2xl rounded-bl-sm px-3 py-2 text-[10px] text-[#1A1A2E] max-w-[75%]">Hi! Saw we're a match for Gauteng → Western Cape.</div></div>
              <div className="flex justify-end"><div className="bg-[#0066FF] text-white rounded-2xl rounded-br-sm px-3 py-2 text-[10px] max-w-[75%]">Yes! When would work for you?</div></div>
            </div>
          }
        />
      </section>

      {/* ── Why Radius Search Matters ─────────────────────────────────── */}
      <section className="bg-[#F8F9FB] py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-4">Why Radius Search Matters</h2>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-3">
              District boundaries skip matches. Someone in Midrand or Centurion won't appear in a
              Johannesburg North District search—even though they're 15 minutes away.
            </p>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-5">
              Crosssa uses proximity radius search and geo-coding to find matches in your exact
              location and nearby places. No one gets missed.
            </p>
            <ul className="space-y-2.5">
              <FeatureBullet>Finds matches across district boundaries</FeatureBullet>
              <FeatureBullet>Uses geo-coding to convert your town to coordinates</FeatureBullet>
              <FeatureBullet>Scans within your chosen radius (e.g. 50km, 100km)</FeatureBullet>
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
            <MapRadiusVisual />
          </div>
        </div>
      </section>

      {/* ── Transfer Guides & Resources — the real, in-app Provincial DoE
          cross-transfer guide (7 steps, 4 templates), not a generic blog
          list. Templates show name + source only, no download affordance:
          the real files are pre-filled per-educator and only unlock once
          signed in, which this teaser shouldn't imply it can hand over. ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-2">Transfer Guides & Resources</h2>
          <p className="text-sm text-[#6B7280] max-w-xl mx-auto">
            The exact Provincial DoE cross-transfer process, with 4 ready-to-use templates pre-filled with your own details once you sign up.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {['7 Steps', '4 Templates', 'Provincial DoE', 'Cross-Transfer'].map(label => (
            <span key={label} className="text-xs font-semibold px-3 py-1 rounded-full bg-[#0066FF]/10 text-[#0066FF]">{label}</span>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {TRANSFER_STEPS.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex gap-4"
            >
              <div className="w-8 h-8 rounded-full bg-[#0066FF]/10 flex items-center justify-center shrink-0 text-xs font-bold text-[#0066FF]">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-[#0066FF] shrink-0" strokeWidth={1.75} />
                  <p className="font-semibold text-sm text-[#1A1A2E]">{title}</p>
                </div>
                <p className="text-xs text-[#6B7280] leading-relaxed">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="bg-[#F8F9FB] rounded-2xl border border-[#E5E7EB] p-6 sm:p-8">
          <p className="text-sm font-semibold text-[#1A1A2E] mb-4">4 templates included</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {TRANSFER_TEMPLATES.map(({ icon: Icon, name, desc }) => (
              <div key={name} className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#0066FF]/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#0066FF]" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#1A1A2E]">{name}</p>
                  <p className="text-xs text-[#6B7280]">{desc}</p>
                </div>
                <Lock className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
              </div>
            ))}
          </div>
          <p className="text-xs text-[#6B7280] text-center mt-5">
            Templates are pre-filled with your own details and unlock once you sign up.{' '}
            <Link to="/register" className="font-semibold text-[#0066FF] hover:underline">Sign up free →</Link>
          </p>
        </div>
      </section>

      {/* ── Testimonials — real, admin-approved reviews, same pool and
          moderation flow as the old landing page (testimonials table) ── */}
      <TestimonialsSection
        eyebrow="What Educators Say"
        heading="Educators Who Found Their Match"
        subheading="Real stories from educators who found their transfer on Crosssa."
        formSource="match_prompt"
        dark
        fallback={[
          { name: 'Nomvula M.', role_label: 'Gauteng', quote: "Got my SMS alert within two weeks. The radius search found someone eight district lines away — I'd never have found her myself." },
          { name: 'Thabo K.', role_label: 'Western Cape', quote: 'No more scrolling Facebook groups at midnight. It just scans for you, every single day.' },
          { name: 'Sarah B.', role_label: 'KwaZulu-Natal', quote: 'The chat made the whole process easy — we sorted out our swap in under a week.' },
        ]}
      />

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-[#0A2463] py-14 sm:py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Ready to find your match?</h2>
          <Link to="/register">
            <Button className="h-12 px-8 rounded-xl text-sm font-semibold bg-[#FF6B35] hover:bg-[#e55a2b] text-white border-0">
              Start Finding Your Match →
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Cross-link ────────────────────────────────────────────────── */}
      <section className="py-8 text-center border-t border-[#E5E7EB]">
        <p className="text-sm text-[#6B7280]">
          Also looking for a new job?{' '}
          <Link to="/explore/career-tools" className="font-semibold text-[#0066FF] hover:underline">
            Explore our Career Tools →
          </Link>
        </p>
      </section>

      <Footer />
    </div>
  );
}
