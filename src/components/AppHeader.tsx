import { useState, useRef, useEffect } from 'react';
import { GraduationCap, User, Settings, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const meta = user?.user_metadata ?? {};
  const initial = (meta.full_name as string | undefined)?.[0]?.toUpperCase()
    || user?.email?.[0]?.toUpperCase()
    || 'U';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 h-16 max-w-2xl mx-auto">
        {/* Logo — left-aligned */}
        <Link to="/home" className="flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary" strokeWidth={2} />
          <span className="text-xl font-extrabold text-foreground tracking-tight">EduCross</span>
        </Link>

        {/* Avatar + dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(o => !o)}
            className="w-9 h-9 rounded-full overflow-hidden border border-border flex items-center justify-center bg-primary/10 hover:ring-2 hover:ring-primary/30 transition-all"
          >
            {meta.avatar_url
              ? <img src={meta.avatar_url as string} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-xs font-bold text-primary">{initial}</span>
            }
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-2xl shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-foreground truncate">
                  {(meta.full_name as string | undefined) || user?.email || 'Educator'}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <MenuItem icon={User} label="Profile" to="/profile" onClick={() => setOpen(false)} />
              <MenuItem icon={Settings} label="Settings" to="/settings" onClick={() => setOpen(false)} />
              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon: Icon, label, to, onClick }: { icon: React.ElementType; label: string; to: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
    >
      <Icon className="w-4 h-4 text-muted-foreground" /> {label}
    </Link>
  );
}
