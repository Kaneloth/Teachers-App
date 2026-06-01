import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export default function GeneralSettings() {
  const { logout, user } = useAuth();

  const { data: educator } = useQuery({
    queryKey: ['my-educator-settings'],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('educators').select('full_name').eq('user_id', user.id).single();
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">{educator?.full_name || 'Educator'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Link to="/profile">
          <Button variant="outline" className="w-full rounded-xl h-11">Edit Profile</Button>
        </Link>
      </div>

      <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-4 py-4 text-destructive hover:bg-muted/50 transition-colors w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Log Out</span>
        </button>
      </div>

      <p className="text-xs text-center text-muted-foreground">EduCross v1.0 · South Africa</p>
    </div>
  );
}
