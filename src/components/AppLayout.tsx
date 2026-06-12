import { useState, useRef, useCallback, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, MessageCircle, Briefcase, FileText, Mail, BookMarked, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import AppHeader from './AppHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

// Tab page components
import HomePage from '@/pages/Home';
import SearchAndMatches from '@/pages/SearchAndMatches';  // new combined page
import ChatsPage from '@/pages/ChatsPage';
import VacanciesPage from '@/pages/VacanciesPage';
import CVBuilderPage from '@/pages/CVBuilderPage';
import CareerToolsPage from '@/pages/CareerToolsPage';
import CoverLettersPage from '@/pages/CoverLettersPage';
import GuidesPage from '@/pages/GuidesPage';

// Educator tabs: Home, Search (combined), Chats, Guides, Career Tools
const EDUCATOR_TABS = [
  { path: '/home',         component: HomePage,         icon: Home,          label: 'Home'         },
  { path: '/search',       component: SearchAndMatches, icon: Search,        label: 'Search'       },
  { path: '/chats',        component: ChatsPage,        icon: MessageCircle, label: 'Chats'        },
  { path: '/guides',       component: GuidesPage,       icon: BookOpen,      label: 'Guides'       },
  { path: '/career-tools', component: CareerToolsPage,  icon: BookMarked,    label: 'Career Tools' },
];

// General tabs (unchanged)
const GENERAL_TABS = [
  { path: '/home',           component: HomePage,         icon: Home,     label: 'Home'    },
  { path: '/vacancies',      component: VacanciesPage,    icon: Briefcase, label: 'Vacancies'   },
  { path: '/cv-builder',     component: CVBuilderPage,    icon: FileText,  label: 'CV'     },
  { path: '/cover-letters',  component: CoverLettersPage, icon: Mail,      label: 'Letters'},
];

const SWIPE_THRESHOLD = 0.30;  // 30% drag to navigate — same as Skootlink

// ─── Navigation progress bar ──────────────────────────────────────────────────
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
        height: '100%',
        width: `${width}%`,
        transition: width === 0
          ? 'none'
          : done
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

// ─── Main layout ──────────────────────────────────────────────────────────────
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Profile type — determines which tab set to show ───────────
  const [profileType, setProfileType] = useState<'educator' | 'general'>('educator');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('educators')
      .select('profile_type')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.profile_type === 'general') setProfileType('general');
      });
  }, [user]);

  const TABS      = profileType === 'general' ? GENERAL_TABS : EDUCATOR_TABS;
  const TAB_PATHS = TABS.map(t => t.path);
  const N         = TABS.length;

  // ── Filtered unread message count (excludes blocked users) ───
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    if (!user) return;

    // 1. Get IDs of users blocked by current user
    const { data: blockedByMe } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id);
    const blockedByMeIds = blockedByMe?.map(b => b.blocked_id) || [];

    // 2. Get IDs of users who have blocked current user
    const { data: blockedMe } = await supabase
      .from('user_blocks')
      .select('blocker_id')
      .eq('blocked_id', user.id);
    const blockedByThemIds = blockedMe?.map(b => b.blocker_id) || [];

    const allBlockedIds = [...blockedByMeIds, ...blockedByThemIds];

    // 3. Query unread messages, excluding blocked senders
    let query = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('read', false);

    if (allBlockedIds.length > 0) {
      const idsString = allBlockedIds.map(id => `'${id}'`).join(',');
      query = query.not('sender_id', 'in', `(${idsString})`);
    }

    const { count } = await query;
    setUnreadCount(count ?? 0);
  }, [user]);

  // Load on mount & subscribe to messages + user_blocks changes
  useEffect(() => {
    if (!user) return;
    loadUnreadCount();

    const messagesChannel = supabase
      .channel('unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadUnreadCount)
      .subscribe();

    const blocksChannel = supabase
      .channel('unread-blocks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' }, loadUnreadCount)
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(blocksChannel);
    };
  }, [user, loadUnreadCount]);

  const isTabRoute = TAB_PATHS.includes(location.pathname);
  const tabIndex = isTabRoute ? TAB_PATHS.indexOf(location.pathname) : 0;

  // ── Swipe — exact Skootlink implementation ───────────────────────────────
  const [dragPercent, setDragPercent] = useState(0);
  const isDragging = dragPercent !== 0;
  const touchRef = useRef({ startX: 0, startY: 0, active: false, axisLocked: false, horizontal: false });
  const stripRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (!isTabRoute) return;
    // Don't intercept if touch starts inside a horizontally scrollable element
    // (e.g. filter chips, horizontal lists)
    let el = e.target as HTMLElement | null;
    while (el && el !== stripRef.current) {
      const style = window.getComputedStyle(el);
      const ox = style.overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth) return;
      el = el.parentElement;
    }
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      active: true,
      axisLocked: false,
      horizontal: false,
    };
  }, [isTabRoute]);

  const onTouchMove = useCallback((e: TouchEvent) => {
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
    if (pct > 0 && tabIndex === 0)      pct *= 0.15;
    if (pct < 0 && tabIndex === N - 1)  pct *= 0.15;

    setDragPercent(pct);
  }, [tabIndex, N]);

  const onTouchEnd = useCallback((_e?: TouchEvent) => {
    const t = touchRef.current;
    t.active = false;
    if (!t.horizontal) return;

    if (dragPercent < -(SWIPE_THRESHOLD * 100) && tabIndex < N - 1) {
      navigate(TAB_PATHS[tabIndex + 1]);
    } else if (dragPercent > (SWIPE_THRESHOLD * 100) && tabIndex > 0) {
      navigate(TAB_PATHS[tabIndex - 1]);
    }

    setDragPercent(0);
  }, [dragPercent, tabIndex, N, TAB_PATHS, navigate]);

  useEffect(() => { setDragPercent(0); }, [location.pathname]);

  // ── Register native touch events (avoids React synthetic event lag) ───────
  // Must use native events with passive:false so we can call e.preventDefault()
  // to block vertical scroll during a horizontal swipe — exactly like Skootlink.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    el.addEventListener('touchstart',  onTouchStart as unknown as EventListener, { passive: true });
    el.addEventListener('touchmove',   onTouchMove  as unknown as EventListener, { passive: false });
    el.addEventListener('touchend',    onTouchEnd   as unknown as EventListener, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd   as unknown as EventListener, { passive: true });
    return () => {
      el.removeEventListener('touchstart',  onTouchStart as unknown as EventListener);
      el.removeEventListener('touchmove',   onTouchMove  as unknown as EventListener);
      el.removeEventListener('touchend',    onTouchEnd   as unknown as EventListener);
      el.removeEventListener('touchcancel', onTouchEnd   as unknown as EventListener);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  // ── Strip translation — exact Skootlink formula ───────────────────────────
  const baseX  = -(tabIndex / N) * 100;
  const dragX  = (dragPercent / 100) * (100 / N);
  const stripX = baseX + dragX;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <AppHeader />
      </div>

      <NavigationProgressBar pathname={location.pathname} />

      <div
        ref={stripRef}
        className="flex-1 relative overflow-hidden"
        style={{ touchAction: 'pan-y' }}
      >
        {isTabRoute ? (
          <div
            className="absolute inset-0 flex"
            style={{
              width: `${N * 100}%`,
              transform: `translateX(${stripX}%)`,
              // No transition while finger is down — 1:1 tracking
              // Smooth decelerate-to-stop on release — no overshoot, no snap
              transition: isDragging
                ? 'none'
                : 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
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
          <div className="h-full overflow-y-auto pb-20">
            <Outlet />
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="max-w-2xl mx-auto flex">
          {TABS.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            const isChats = path === '/chats';
            const showBadge = isChats && unreadCount > 0;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
                  {showBadge && (
                    <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}