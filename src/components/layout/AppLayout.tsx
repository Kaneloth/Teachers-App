import { useState, useRef, useCallback, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, MessageCircle, ArrowLeftRight, Briefcase, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import AppHeader from './AppHeader';
import HomePage from '@/pages/Home';
import SearchPage from '@/pages/SearchPage';
import MatchesPage from '@/pages/MatchesPage';
import ChatsPage from '@/pages/ChatsPage';
import VacanciesPage from '@/pages/VacanciesPage';
import CVBuilderPage from '@/pages/CVBuilderPage';

const TABS = [
  { path: '/home',       component: HomePage,      icon: Home,          label: 'Home'      },
  { path: '/search',     component: SearchPage,    icon: Search,        label: 'Search'    },
  { path: '/matches',    component: MatchesPage,   icon: ArrowLeftRight, label: 'Matches'  },
  { path: '/chats',      component: ChatsPage,     icon: MessageCircle, label: 'Chats'     },
  { path: '/vacancies',  component: VacanciesPage, icon: Briefcase,     label: 'Vacancies' },
  { path: '/cv-builder', component: CVBuilderPage, icon: FileText,      label: 'CV'        },
];

const TAB_PATHS = TABS.map(t => t.path);
const THRESHOLD = 0.3;

function useNavigationProgress(pathname: string) {
  const [barState, setBarState] = useState({ width: 0, visible: false, done: false });
  const prevPathRef = useRef(pathname);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;
    clear();
    setBarState({ width: 0, visible: true, done: false });
    const t1 = setTimeout(() => setBarState(s => ({ ...s, width: 60 })), 30);
    const t2 = setTimeout(() => setBarState(s => ({ ...s, width: 80 })), 250);
    const t3 = setTimeout(() => setBarState(s => ({ ...s, width: 95 })), 500);
    const t4 = setTimeout(() => setBarState(s => ({ ...s, width: 100, done: true })), 700);
    const t5 = setTimeout(() => setBarState({ width: 0, visible: false, done: false }), 1050);
    timersRef.current = [t1, t2, t3, t4, t5];
    return clear;
  }, [pathname]);

  return barState;
}

function NavigationProgressBar({ pathname }: { pathname: string }) {
  const { width, visible, done } = useNavigationProgress(pathname);
  if (!visible) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none">
      <div style={{
        height: '100%', width: `${width}%`,
        transition: width === 0 ? 'none' : done
          ? 'width 0.2s ease-in, opacity 0.3s ease-out 0.05s'
          : 'width 0.4s ease-out',
        opacity: done ? 0 : 1,
        background: 'hsl(var(--primary))',
        boxShadow: '0 0 8px hsl(var(--primary) / 0.6)',
        borderRadius: '0 2px 2px 0',
      }} />
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const loadUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      const { data } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      setUnreadCount(data?.length || 0);

      channel = supabase
        .channel('messages-unread')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
          if (!userId) return;
          const { data: msgs } = await supabase
            .from('messages')
            .select('id')
            .eq('receiver_id', userId)
            .eq('is_read', false);
          setUnreadCount(msgs?.length || 0);
        })
        .subscribe();
    };

    loadUnread();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const isTabRoute = TAB_PATHS.includes(location.pathname);
  const tabIndex = isTabRoute ? TAB_PATHS.indexOf(location.pathname) : 0;

  const [dragPercent, setDragPercent] = useState(0);
  const isDragging = dragPercent !== 0;
  const touchRef = useRef({ startX: 0, startY: 0, active: false, axisLocked: false, horizontal: false });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isTabRoute) return;
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      active: true,
      axisLocked: false,
      horizontal: false,
    };
  }, [isTabRoute]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = touchRef.current;
    if (!t.active) return;
    const dx = e.touches[0].clientX - t.startX;
    const dy = e.touches[0].clientY - t.startY;
    if (!t.axisLocked) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      t.axisLocked = true;
      t.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!t.horizontal) return;
    e.preventDefault();
    let pct = (dx / window.innerWidth) * 100;
    if (pct > 0 && tabIndex === 0) pct *= 0.15;
    if (pct < 0 && tabIndex === TAB_PATHS.length - 1) pct *= 0.15;
    setDragPercent(pct);
  }, [tabIndex]);

  const onTouchEnd = useCallback(() => {
    const t = touchRef.current;
    t.active = false;
    if (!t.horizontal) return;
    if (dragPercent < -(THRESHOLD * 100) && tabIndex < TAB_PATHS.length - 1) {
      navigate(TAB_PATHS[tabIndex + 1]);
    } else if (dragPercent > (THRESHOLD * 100) && tabIndex > 0) {
      navigate(TAB_PATHS[tabIndex - 1]);
    }
    setDragPercent(0);
  }, [dragPercent, tabIndex, navigate]);

  useEffect(() => { setDragPercent(0); }, [location.pathname]);

  const N = TAB_PATHS.length;
  const baseX = -(tabIndex / N) * 100;
  const dragX = (dragPercent / 100) * (100 / N);
  const stripX = baseX + dragX;

  return (
    <div className="font-inter min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <AppHeader />
      </div>

      <NavigationProgressBar pathname={location.pathname} />

      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        {isTabRoute ? (
          <div
            className="absolute inset-0 flex"
            style={{
              width: `${N * 100}%`,
              transform: `translateX(${stripX}%)`,
              transition: isDragging ? 'none' : 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              willChange: 'transform',
            }}
          >
            {TABS.map(({ path, component: Page }, i) => {
              const isVisible = Math.abs(i - tabIndex) <= 1;
              return (
                <div
                  key={path}
                  className="h-full overflow-y-auto pb-20"
                  style={{ width: `${100 / N}%`, flexShrink: 0 }}
                >
                  {isVisible ? <Page /> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="scroll-container h-full overflow-y-auto pb-20">
            <Outlet />
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="max-w-lg mx-auto flex">
          {TABS.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            const isChats = path === '/chats';
            const showBadge = isChats && unreadCount > 0;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex-1 flex flex-col items-center py-3 gap-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
