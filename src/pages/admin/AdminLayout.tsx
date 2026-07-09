import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Coins, ScrollText, GraduationCap,
  ShieldCheck, Star, SlidersHorizontal, Wrench, Menu, X, ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { path: '/admin',              icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'People',
    items: [
      { path: '/admin/users',        icon: Users,         label: 'Users' },
      { path: '/admin/educators',    icon: GraduationCap, label: 'Educators' },
      { path: '/admin/id-verification', icon: ShieldCheck, label: 'ID Verification' },
    ],
  },
  {
    label: 'Money',
    items: [
      { path: '/admin/credits',      icon: Coins,         label: 'Credits & Payments' },
    ],
  },
  {
    label: 'Content',
    items: [
      { path: '/admin/testimonials', icon: Star,          label: 'Testimonials' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/admin/gates',        icon: SlidersHorizontal, label: 'Feature Gates' },
      { path: '/admin/audit-log',    icon: ScrollText,        label: 'Audit Log' },
      { path: '/admin/tools',        icon: Wrench,             label: 'Tools' },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            C
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">Crosssa</p>
            <p className="text-xs text-muted-foreground leading-tight">Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ path, icon: Icon, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/admin'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <NavLink
          to="/home"
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Back to app
        </NavLink>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar — fixed, always visible on md+ */}
      <aside className="hidden md:block w-64 shrink-0 border-r border-border bg-card">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile sidebar — slide-over */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-card border-r border-border">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <p className="text-sm font-bold text-foreground">Crosssa Admin</p>
        </div>

        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
