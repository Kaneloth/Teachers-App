import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

// Same cookie name/duration maintenance-access.html sets. Refreshing it here
// means an admin only needs to visit the secret maintenance-access.html?key=
// URL ONCE per browser — every subsequent visit to any /admin/* page while
// maintenance mode is on (or off) silently renews the cookie, so it never
// expires as long as they check in at least once every BYPASS_COOKIE_DAYS.
//
// This can't help with the VERY FIRST bypass on a given browser/device,
// though: while maintenance mode is on, the maintenance-gate.ts Edge
// Function decides whether to serve the real page or maintenance.html
// BEFORE any React code — including this file — ever runs. Being logged
// in as an admin doesn't matter at that point, because the browser never
// even receives the app's JS to check auth with. The one-time
// maintenance-access.html visit is what gets a browser its first cookie;
// this is just what keeps it alive afterward without repeating that step.
const BYPASS_COOKIE_NAME = 'crosssa_maintenance_bypass';
const BYPASS_COOKIE_DAYS = 30;

function refreshBypassCookie() {
  const expires = new Date(Date.now() + BYPASS_COOKIE_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${BYPASS_COOKIE_NAME}=1; path=/; expires=${expires}; SameSite=Lax; Secure`;
}

/**
 * AdminRoute — gates access to the /admin/* route tree.
 *
 * IMPORTANT: unlike the existing "Admin" tab inside SettingsPage.tsx (which
 * currently checks the client-writable user.user_metadata.is_admin), this
 * checks the real educators.is_admin DB column — the same source of truth
 * requireAdmin.js now uses server-side. This is new code, so there's no
 * reason to build it on the spoofable check even though we're deferring the
 * SettingsPage.tsx fix for later.
 *
 * Note: this is a UX gate, not a security boundary — it just avoids
 * flashing the dashboard UI at a non-admin user before redirecting them.
 * The real security boundary is server-side: every admin-*.js Netlify
 * function must independently verify admin status via requireAdmin.js.
 * Never trust this check alone to protect data.
 */
export default function AdminRoute() {
  const { user, loading: authLoading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setChecked(true); return; }
    supabase
      .from('educators')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const admin = !!data?.is_admin;
        setIsAdmin(admin);
        setChecked(true);
        if (admin) refreshBypassCookie();
      });
  }, [user?.id]);

  if (authLoading || !checked) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/home" replace />;

  return <Outlet />;
}
