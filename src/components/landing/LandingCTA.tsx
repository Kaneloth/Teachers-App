import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function LandingCTA() {
  return (
    <section id="contact" className="bg-[#0d9488] py-20 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-white/60 text-sm font-semibold uppercase tracking-widest mb-3">📱 Free to Download · Works on Any Device</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Start Your Journey Today</h2>
        <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
          Join hundreds of South African educators and job seekers. Build your CV, find transfer matches, and land your next opportunity – all free.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-white text-[#0d9488] font-bold px-8 py-3.5 rounded-xl hover:bg-[#f0fdfa] transition-colors shadow-lg text-base">
            Create Free Account <ArrowRight className="w-5 h-5" />
          </Link>
          <Link to="/login" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 border-2 border-white/60 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-base">
            Sign In
          </Link>
        </div>
        <p className="text-white/50 text-xs mt-6">No credit card required · Free plan available · Cancel anytime</p>
      </div>
    </section>
  );
}