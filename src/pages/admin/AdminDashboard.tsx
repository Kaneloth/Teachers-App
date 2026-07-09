import { useEffect, useState } from 'react';
import { Users, GraduationCap, Coins, Star, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Stats {
  totalUsers: number;
  educators: number;
  creditPurchases: number;
  pendingTestimonials: number;
}

function StatCard({ icon: Icon, label, value, loading }: { icon: React.ElementType; label: string; value: number; loading: boolean }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      {loading
        ? <Loader2 className="w-5 h-5 animate-spin text-primary" />
        : <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const [
          totalUsersRes,
          educatorsRes,
          creditPurchasesRes,
          pendingTestimonialsRes,
        ] = await Promise.all([
          supabase.from('educators').select('id', { count: 'exact', head: true }),
          supabase.from('educators').select('id', { count: 'exact', head: true }).eq('profile_type', 'educator'),
          supabase.from('credit_ledger').select('id', { count: 'exact', head: true }).eq('type', 'purchase'),
          supabase.from('testimonials').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);

        // Surface the first error encountered rather than silently showing
        // zeroes — a failed count and a genuine zero look identical otherwise.
        const firstError =
          totalUsersRes.error || educatorsRes.error ||
          creditPurchasesRes.error || pendingTestimonialsRes.error;
        if (firstError) throw firstError;

        if (!cancelled) {
          setStats({
            totalUsers:          totalUsersRes.count ?? 0,
            educators:           educatorsRes.count ?? 0,
            creditPurchases:     creditPurchasesRes.count ?? 0,
            pendingTestimonials: pendingTestimonialsRes.count ?? 0,
          });
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load dashboard stats.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStats();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform overview</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
          Couldn't load stats: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} loading={loading} />
        <StatCard icon={GraduationCap} label="Educators" value={stats?.educators ?? 0} loading={loading} />
        <StatCard icon={Coins} label="Credit Purchases" value={stats?.creditPurchases ?? 0} loading={loading} />
        <StatCard icon={Star} label="Pending Testimonials" value={stats?.pendingTestimonials ?? 0} loading={loading} />
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          More sections (Users, Credits, Educators, etc.) migrate in next, one at a time.
        </p>
      </div>
    </div>
  );
}
