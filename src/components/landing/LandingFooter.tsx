const FACEBOOK_URL = "https://www.facebook.com/share/1D5mYLA3b1/";
const TIKTOK_URL = "https://www.tiktok.com/@crosssa_za";

export default function LandingFooter() {
  return (
    <footer className="bg-[#0f172a] text-white/70 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-8 pb-8 border-b border-white/10">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <img src="/icons/icon-512.png" alt="Crosssa" className="w-7 h-7 rounded-lg" style={{ background: '#0f172a' }} />
              <span className="text-white text-lg font-bold">Crosssa</span>
            </div>
            <p className="text-sm leading-relaxed">
              The dedicated platform connecting South African educators with opportunities, peers, and professional growth tools.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3 mt-4">
              <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Crosssa on Facebook">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
              </a>
              <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Crosssa on TikTok">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.16 8.16 0 004.77 1.52V6.75a4.85 4.85 0 01-1-.06z"/>
                </svg>
              </a>
            </div>
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
                <li><a href="/register" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Sign Up Free</a></li>
                <li><a href="/login" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Sign In</a></li>
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
