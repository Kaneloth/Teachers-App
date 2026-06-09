import { useState, useEffect } from 'react';   // ← added useEffect
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { blockUser, unblockUser, isBlocked } from '@/lib/blockUtils';
import { useAuth } from '@/lib/AuthContext';
import { Loader2 } from 'lucide-react';

export default function BlockButton({ targetUserId, onBlockChange }: { targetUserId: string; onBlockChange?: () => void }) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    isBlocked(user.id, targetUserId).then(setBlocked);
  }, [user, targetUserId]);

  const handleBlock = async () => {
    if (!user) return;
    setLoading(true);
    const success = await blockUser(targetUserId);
    if (success) {
      setBlocked(true);
      toast.success('User blocked');
      onBlockChange?.();
    } else {
      toast.error('Failed to block user');
    }
    setLoading(false);
  };

  const handleUnblock = async () => {
    if (!user) return;
    setLoading(true);
    const success = await unblockUser(targetUserId);
    if (success) {
      setBlocked(false);
      toast.success('User unblocked');
      onBlockChange?.();
    } else {
      toast.error('Failed to unblock user');
    }
    setLoading(false);
  };

  if (blocked === null) return null;
  return blocked ? (
    <Button variant="outline" onClick={handleUnblock} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
      Unblock User
    </Button>
  ) : (
    <Button variant="destructive" onClick={handleBlock} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
      Block User
    </Button>
  );
}