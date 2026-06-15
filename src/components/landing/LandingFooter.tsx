import { GraduationCap } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="bg-[#0f172a] text-white/70 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-8 pb-8 border-b border-white/10">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-6 h-6 text-[#0d9488]" />
              <span className="text-white text-lg font-bold">Crosssa</span>
            </div>
            <p className="text-sm leading-relaxed">
              The dedicated platform connecting South African educators with opportunities, peers, and professional growth tools.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <div>
              <p className="text-white font-semibold mb-3">Platform</p>
              <ul className="space-y-2">
                <li><a href="/#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="/vacancies" className="hover:text-white transition-colors">Vacancies</a></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold mb-3">Account</p>
              <ul className="space-y-2">
                <li><a href="/register" className="hover:text-white transition-colors">Sign Up Free</a></li>
                <li><a href="/login" className="hover:text-white transition-colors">Sign In</a></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold mb-3">Legal</p>
              <ul className="space-y-2">
                <li>
                  <a href="/PAIA%20Manual.html" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    PAIA Manual
                  </a>
                </li>
                <li>
                  <a href="/Privacy%20Policy.html" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/Terms%20and%20Conditions.html" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p>© {new Date().getFullYear()} Crosssa. All rights reserved. Crosssa is a product of <a href="https://skootlink.co.za/" target="_blank" rel="noopener noreferrer" className="text-white/90 font-medium hover:text-white hover:underline transition-colors">Skootlink (Pty) Ltd</a>.</p>
          <p>Built for South African educators 🇿🇦</p>
        </div>
      </div>
    </footer>
  );
}