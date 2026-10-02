import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Briefcase, UserPlus, Users, FolderCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import PathCard from '@/components/landing/PathCard';
import FeatureBullet from '@/components/landing/FeatureBullet';
import PhoneMockup from '@/components/landing/PhoneMockup';
import CVPreviewMockup from '@/components/landing/CVPreviewMockup';
import ContactForm from '@/components/landing/ContactForm';

/**
 * The homepage hub. Short and scannable (under 3 mobile scroll-lengths) —
 * it shows both paths and lets the visitor choose, rather than trying to
 * sell either one in full. The rich showcases live at /explore/transfer
 * and /explore/career-tools.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0A2463]/[0.04] to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 bg-[#0066FF]/10 text-[#0066FF] text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
          >
            One Platform, Two Paths
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-3xl sm:text-5xl font-bold text-[#1A1A2E] leading-tight tracking-tight mb-5"
          >
            Your Career Move Starts Here
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-base sm:text-lg text-[#6B7280] max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            Whether you're an educator seeking a transfer or a job seeker building your future
            — Crosssa has the tools to get you there.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to="/register">
              <Button className="h-12 px-7 rounded-xl text-sm font-semibold bg-[#FF6B35] hover:bg-[#e55a2b] text-white border-0 w-full sm:w-auto">
                Create Free Account
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" className="h-12 px-7 rounded-xl text-sm font-semibold border-[#E5E7EB] text-[#1A1A2E] w-full sm:w-auto">
                See How It Works
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Choose Your Path ("Features") ───────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 scroll-mt-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-2">Choose Your Path</h2>
          <p className="text-sm text-[#6B7280]">Two very different journeys. Both fully free to start.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <PathCard
            icon={ArrowLeftRight}
            title="Find Your Transfer Match—Automatically"
            description="We scan daily for matches based on your profile, phase, subjects, and location. Get notified by SMS when a match is found."
            linkLabel="Explore Transfer"
            to="/explore/transfer"
            accent="blue"
            visual={<div className="p-4"><PhoneMockup message="New match found near Centurion — tap to view Thandi's profile." pulse /></div>}
          />
          <PathCard
            icon={Briefcase}
            title="Build a Professional CV in Minutes"
            description="Create an ATS-friendly CV with live previews, AI wording suggestions, and professional templates. Plus cover letters and job search."
            linkLabel="Explore Career Tools"
            to="/explore/career-tools"
            accent="orange"
            visual={<div className="p-4"><CVPreviewMockup /></div>}
            delay={0.1}
          />
        </div>
      </section>

      {/* ── How It Works (brief, generic across both paths) ─────────────── */}
      <section id="how-it-works" className="bg-[#F8F9FB] py-14 sm:py-20 scroll-mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-2">How It Works</h2>
            <p className="text-sm text-[#6B7280]">Three steps, whichever path you pick.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: UserPlus,    title: '1. Create a free account',  text: 'Takes under two minutes. No subscription, no card required.' },
              { icon: Users,       title: '2. Tell us what you need',  text: 'Your profile, subjects and location — or your work history and target role.' },
              { icon: FolderCheck, title: '3. Get matched, or get hired', text: 'Daily transfer scans with SMS alerts, or a ready-to-send CV in minutes.' },
            ].map(({ icon: Icon, title, text }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08 }}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-5"
              >
                <div className="w-10 h-10 rounded-xl bg-[#0A2463]/10 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-[#0A2463]" strokeWidth={1.75} />
                </div>
                <p className="font-semibold text-[#1A1A2E] text-sm mb-1">{title}</p>
                <p className="text-xs text-[#6B7280] leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Bar ─────────────────────────────────────────────────── */}
      <section className="py-8 border-y border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {['Free to join', 'No subscriptions', 'No hidden costs', 'Built for South Africa'].map(label => (
              <li key={label} className="list-none">
                <FeatureBullet>{label}</FeatureBullet>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── About (brief) ────────────────────────────────────────────── */}
      <section id="about" className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center scroll-mt-16">
        <h2 className="text-xl sm:text-2xl font-bold text-[#1A1A2E] mb-3">Built for South Africa, by people who get it</h2>
        <p className="text-sm text-[#6B7280] leading-relaxed">
          Crosssa started with a simple problem: finding a transfer or a job in South Africa meant
          scattered Facebook groups, outdated PDFs, and no way to know who else was looking. We built
          one platform that does the searching for you — automatically, every day.
        </p>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="bg-[#0A2463] py-14 sm:py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            Not sure which path is for you?
          </h2>
          <p className="text-sm text-white/70 mb-7">Start free and explore both.</p>
          <Link to="/register">
            <Button className="h-12 px-8 rounded-xl text-sm font-semibold bg-[#FF6B35] hover:bg-[#e55a2b] text-white border-0">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      <ContactForm />

      <Footer />
    </div>
  );
}
