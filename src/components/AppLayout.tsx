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
  { path: '/vacancies',      component: VacanciesPage,    icon: Briefcase, label: 'Jobs'   },
  { path: '/cv-builder',     component: CVBuilderPage,    icon: FileText,  label: 'CV'     },
  { path: '/cover-letters',  component: CoverLettersPage, icon: Mail,      label: 'Letters'},
];

const DIST_THRESHOLD = 0.22;   // 22% of screen width to navigate (distance)
const VEL_THRESHOLD  = 0.35;   // px/ms — fast flick always navigates regardless of distance

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

  // ── Swipe state ──────────────────────────────────────────────────────────────
  // dragOffsetPx: raw pixel offset of the strip from its resting position.
  // Using px (not percent) avoids the ratio mismatch that caused shakiness.
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const isDragging = dragOffsetPx !== 0;

  // Store all touch tracking in a ref so handlers never go stale
  const touchRef = useRef({
    startX:     0,
    startY:     0,
    lastX:      0,
    lastT:      0,           // timestamp of last move event
    active:     false,
    axisLocked: false,
    horizontal: false,
    tabIndex:   0,           // snapshot of tabIndex at touch start
    N:          0,           // snapshot of N at touch start
    paths:      [] as string[],
  });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isTabRoute) return;
    // Don't intercept if a horizontally-scrollable child owns the touch
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      const ox = window.getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth) return;
      el = el.parentElement;
    }
    const x = e.touches[0].clientX;
    const now = performance.now();
    touchRef.current = {
      startX:     x,
      startY:     e.touches[0].clientY,
      lastX:      x,
      lastT:      now,
      active:     true,
      axisLocked: false,
      horizontal: false,
      tabIndex,            // snapshot — avoids stale closure in onTouchEnd
      N,
      paths:      TAB_PATHS,
    };
  }, [isTabRoute, tabIndex, N, TAB_PATHS]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = touchRef.current;
    if (!t.active) return;

    const x  = e.touches[0].clientX;
    const dx = x - t.startX;
    const dy = e.touches[0].clientY - t.startY;

    // Axis lock: wait for 6px of movement then decide horizontal vs vertical
    if (!t.axisLocked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      t.axisLocked = true;
      t.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2; // bias toward vertical
    }
    if (!t.horizontal) return;

    e.preventDefault(); // prevent page scroll during horizontal swipe

    // Rubber-band at edges: logarithmic resistance like iOS
    let offset = dx;
    if (offset > 0 && t.tabIndex === 0) {
      offset = Math.log1p(offset) * 18; // slows progressively, never hard-stops
    } else if (offset < 0 && t.tabIndex === t.N - 1) {
      offset = -Math.log1p(-offset) * 18;
    }

    // Track velocity
    t.lastX = x;
    t.lastT = performance.now();

    setDragOffsetPx(offset);
  }, []); // empty deps — reads everything from touchRef, no stale closures

  const onTouchEnd = useCallback(() => {
    const t = touchRef.current;
    t.active = false;
    if (!t.horizontal) return;

    const dx       = t.lastX - t.startX;
    const dt       = performance.now() - t.lastT + 1; // +1 avoids /0
    const velocity = dx / dt; // px/ms — positive = right swipe

    const W           = window.innerWidth;
    const distRatio   = Math.abs(dx) / W;
    const isFastFlick = Math.abs(velocity) > VEL_THRESHOLD;
    const isFarEnough = distRatio > DIST_THRESHOLD;
    const shouldNav   = isFastFlick || isFarEnough;

    if (shouldNav && dx < 0 && t.tabIndex < t.N - 1) {
      navigate(t.paths[t.tabIndex + 1]);
    } else if (shouldNav && dx > 0 && t.tabIndex > 0) {
      navigate(t.paths[t.tabIndex - 1]);
    }

    setDragOffsetPx(0);
  }, [navigate]); // only navigate is external

  // Reset drag when route changes (e.g. programmatic navigation)
  useEffect(() => { setDragOffsetPx(0); }, [location.pathname]);

  // ── Strip position — pure pixel math, no unit conversion ───────────────────
  // Everything stays in px so there's zero rounding/conversion jump on release.
  // The strip is N tabs wide; each tab = window.innerWidth px.
  // Resting: strip shifted left by (tabIndex * vw) px.
  // During drag: add dragOffsetPx directly — 1:1 finger tracking.
  const vw      = typeof window !== 'undefined' ? window.innerWidth : 390;
  const stripPx = -(tabIndex * vw) + dragOffsetPx;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-40 bg-background border-b border-border">
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
              transform: `translateX(${stripPx}px)`,
              // No transition while finger is down — 1:1 tracking
              // Smooth decelerate-to-stop on release — no overshoot, no snap
              transition: isDragging
                ? 'none'
                : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
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