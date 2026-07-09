import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

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
        setIsAdmin(!!data?.is_admin);
        setChecked(true);
      });
  }, [user?.id]);

  if (authLoading || !checked) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/home" replace />;

  return <Outlet />;
}
