import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shared header for the 3-page hub model (/, /explore/transfer,
 * /explore/career-tools). Nav links point at homepage sections via hash —
 * from a path page they first navigate home, then the browser's own hash
 * scroll takes over, which is the simplest thing that works without a
 * scroll-spy / cross-page anchor library.
 */
const NAV_LINKS = [
  { label: 'Features',     href: '/#features' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'About',        href: '/#about' },
  { label: 'Contact',      href: '/#contact' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-[#0d9488] shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity" onClick={() => setOpen(false)}>
          <img src="/icons/icon-512.png" alt="Crosssa" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-xl tracking-tight text-white">Crosssa</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 h-9 rounded-xl text-sm font-semibold">
              Sign In
            </Button>
          </Link>
          <Link to="/register">
            <Button className="h-9 rounded-xl text-sm font-semibold bg-white hover:bg-[#f0fdfa] text-[#0d9488] border-0">
              Sign Up Free
            </Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-white/10 bg-[#0d9488]"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {NAV_LINKS.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="py-2.5 text-sm font-medium text-white/90"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex gap-2 mt-3">
                <Link to="/login" className="flex-1" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full h-10 rounded-xl text-sm font-semibold border-white/30 text-white hover:bg-white/10 bg-transparent">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register" className="flex-1" onClick={() => setOpen(false)}>
                  <Button className="w-full h-10 rounded-xl text-sm font-semibold bg-white hover:bg-[#f0fdfa] text-[#0d9488] border-0">
                    Sign Up Free
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
