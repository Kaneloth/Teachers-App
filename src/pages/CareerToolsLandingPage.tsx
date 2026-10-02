import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, FileEdit, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import TestimonialCard from '@/components/landing/TestimonialCard';
import FeatureBullet from '@/components/landing/FeatureBullet';
import ATSScoreMeter from '@/components/landing/ATSScoreMeter';
import CVPreviewMockup from '@/components/landing/CVPreviewMockup';
import TemplateGalleryGrid from '@/components/landing/TemplateGalleryGrid';

/**
 * Public, pre-sign-up showcase for the CV builder, cover letters and job
 * search. Section 4 (Template Gallery) is the piece the person explicitly
 * asked for: a browsable grid where clicking a template opens a full A4
 * preview, with "Use this template" carrying the choice into sign-up.
 */
export default function CareerToolsLandingPage() {
  useEffect(() => { document.title = 'Build Your CV Free | Crosssa'; }, []);

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-[#FF6B35]/[0.06] to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl font-bold text-[#1A1A2E] leading-tight mb-4"
            >
              Build a Professional CV in Minutes
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-base text-[#6B7280] leading-relaxed mb-7"
            >
              Create an ATS-friendly CV with live previews, AI wording suggestions, and
              professional templates. Plus cover letters and job search — all in one place.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
              <Link to="/register">
                <Button className="h-12 px-7 rounded-xl text-sm font-semibold bg-[#FF6B35] hover:bg-[#e55a2b] text-white border-0 w-full sm:w-auto">
                  Build Your CV Free →
                </Button>
              </Link>
              <a href="#templates">
                <Button variant="outline" className="h-12 px-7 rounded-xl text-sm font-semibold border-[#E5E7EB] text-[#1A1A2E] w-full sm:w-auto">
                  Browse Templates
                </Button>
              </a>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-sm">
            <CVPreviewMockup />
          </motion.div>
        </div>
      </section>

      {/* ── Live Preview Demo ─────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-2">Watch Your CV Update as You Type</h2>
        <p className="text-sm text-[#6B7280] max-w-xl mx-auto mb-8">
          No more guessing what your CV will look like. See it come to life as you build it.
        </p>
        <div className="bg-[#F8F9FB] rounded-2xl border border-[#E5E7EB] p-5 sm:p-8 max-w-2xl mx-auto">
          <CVPreviewMockup />
        </div>
      </section>

      {/* ── ATS Scoring ───────────────────────────────────────────────── */}
      <section className="bg-[#F8F9FB] py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
          <div className="bg-white rounded-2xl border border-[#E5E7EB]">
            <ATSScoreMeter score={85} />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-4">Know Your CV Passes Automated Screening</h2>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-5">
              Most companies use Applicant Tracking Systems (ATS) to screen CVs before a human ever
              sees them. Crosssa scores your CV and tells you exactly what to improve.
            </p>
            <ul className="space-y-2.5">
              <FeatureBullet>Real-time ATS compatibility score</FeatureBullet>
              <FeatureBullet>Suggestions to improve your score</FeatureBullet>
              <FeatureBullet>Keyword optimization for each job</FeatureBullet>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Template Gallery — interactive, pre-sign-up ──────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 scroll-mt-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-2">Choose from Our Professional Templates</h2>
          <p className="text-sm text-[#6B7280]">Tap any template to see it full-size, then use it to start your CV.</p>
        </div>
        <TemplateGalleryGrid />
      </section>

      {/* ── AI Wording Suggestions ────────────────────────────────────── */}
      <section className="bg-[#F8F9FB] py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-2">AI That Improves Your Wording</h2>
          <p className="text-sm text-[#6B7280] mb-8">
            Our AI suggests stronger, more impactful wording. Accept or decline each suggestion — you're always in control.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
              <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Before</p>
              <p className="text-sm text-[#1A1A2E]">"Assisted customers with inquiries"</p>
            </div>
            <div className="bg-white rounded-2xl border-2 border-[#10B981]/40 p-5 relative">
              <Sparkles className="w-4 h-4 text-[#10B981] absolute top-5 right-5" />
              <p className="text-[10px] font-semibold text-[#10B981] uppercase tracking-wide mb-2">After</p>
              <p className="text-sm text-[#1A1A2E]">"Delivered excellent customer service by resolving inquiries efficiently and professionally"</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cover Letter Generator ────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-4">Cover Letters Tailored to Each Job</h2>
          <p className="text-sm text-[#6B7280] leading-relaxed mb-5">
            Paste a job description and our AI generates a tailored cover letter in seconds.
          </p>
          <ul className="space-y-2.5">
            <FeatureBullet>Job-specific customization</FeatureBullet>
            <FeatureBullet>Professional tone</FeatureBullet>
            <FeatureBullet>Ready to download and send</FeatureBullet>
          </ul>
        </div>
        <div className="bg-[#F8F9FB] rounded-2xl border border-[#E5E7EB] p-6 flex items-center justify-center">
          <FileEdit className="w-16 h-16 text-[#FF6B35]/40" strokeWidth={1} />
        </div>
      </section>

      {/* ── Job Search ────────────────────────────────────────────────── */}
      <section className="bg-[#F8F9FB] py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 flex items-center justify-center order-2 md:order-1">
            <Briefcase className="w-16 h-16 text-[#0066FF]/40" strokeWidth={1} />
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-4">Find Your Next Role</h2>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-5">
              Browse vacancies in your preferred province. Apply directly through Crosssa.
            </p>
            <Link to="/register">
              <Button variant="outline" className="h-10 rounded-xl text-sm font-semibold border-[#E5E7EB] text-[#1A1A2E]">
                Browse Vacancies →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E]">Job Seekers Who Got Hired</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <TestimonialCard initials="LP" name="Lerato P." meta="Admin Assistant, Durban" quote="The ATS score caught three things I'd never have known to fix. Got a callback the same week." />
          <TestimonialCard initials="JV" name="Johan V." meta="Sales Rep, Pretoria" quote="Picked a template, pasted in my job history, done in fifteen minutes. Looked better than anything I'd made myself." delay={0.08} />
          <TestimonialCard initials="AK" name="Aisha K." meta="Graduate, Cape Town" quote="The cover letter generator alone saved me hours across a dozen applications." delay={0.16} />
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-[#0A2463] py-14 sm:py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Ready to build your future?</h2>
          <Link to="/register">
            <Button className="h-12 px-8 rounded-xl text-sm font-semibold bg-[#FF6B35] hover:bg-[#e55a2b] text-white border-0">
              Build Your CV Free →
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Cross-link ────────────────────────────────────────────────── */}
      <section className="py-8 text-center border-t border-[#E5E7EB]">
        <p className="text-sm text-[#6B7280]">
          Educator looking for a transfer?{' '}
          <Link to="/explore/transfer" className="font-semibold text-[#0066FF] hover:underline">
            Explore Transfer Matching →
          </Link>
        </p>
      </section>

      <Footer />
    </div>
  );
}
