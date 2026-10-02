import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#1A1A2E] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/icons/icon-512.png" alt="Crosssa" className="w-8 h-8 rounded-lg" />
              <span className="font-bold text-lg">Crosssa</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">One platform, two paths. Built for South Africa.</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Educators</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/explore/transfer" className="hover:text-white transition-colors">Transfer Matching</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Create Free Account</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Job Seekers</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/explore/career-tools" className="hover:text-white transition-colors">CV Builder</Link></li>
              <li><Link to="/explore/career-tools#templates" className="hover:text-white transition-colors">Templates</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Company</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><a href="/#about" className="hover:text-white transition-colors">About</a></li>
              <li><a href="mailto:support@crosssa.co.za" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">© {new Date().getFullYear()} Crosssa. All rights reserved.</p>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            Built for South Africa
          </div>
        </div>
      </div>
    </footer>
  );
}
