import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export default function LandingNav() {
  return (
    <nav className="bg-[#0d9488] sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Clickable Logo */}
        <Link to="/Home" className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
          <GraduationCap className="w-7 h-7 text-white" />
          <span className="text-white text-xl font-bold tracking-tight">Crosssa</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-white/90">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <span className="text-white/30">|</span>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <span className="text-white/30">|</span>
          <a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a>
          <span className="text-white/30">|</span>
          <a href="#about" className="hover:text-white transition-colors">About</a>
          <span className="text-white/30">|</span>
          <a href="#contact" className="hover:text-white transition-colors">Contact</a>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-white/80 hover:text-white transition-colors hidden sm:block">
            Sign In
          </Link>
          <Link to="/register" className="text-sm font-bold bg-white text-[#0d9488] hover:bg-[#f0fdfa] transition-all px-4 py-1.5 rounded-lg shadow">
            📱 Get the App
          </Link>
        </div>
      </div>
    </nav>
  );
}