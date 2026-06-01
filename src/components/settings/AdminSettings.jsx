import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Shield, UserX, CheckCircle, ChevronRight, Loader2, Save, FileCheck, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  banned: 'bg-red-100 text-red-700',
};

export default function AdminSettings() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedEducator, setSelectedEducator] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [statusAction, setStatusAction] = useState({ open: false, educator: null, status: '', reason: '' });
  const [idVerifyTab, setIdVerifyTab] = useState(false);
  const [verifyingUserId, setVerifyingUserId] = useState(null);
  const queryClient = useQueryClient();

  const { data: educators = [], isLoading } = useQuery({
    queryKey: ['admin-educators'],
    queryFn: () => base44.entities.Educator.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.User.list(),
  });

  // Users with passport pending review
  const pendingIdUsers = users.filter(u => u.id_verification_status === 'needs_review');

  const handleAdminVerifyId = async (targetUserId, action) => {
    setVerifyingUserId(targetUserId + action);
    try {
      await base44.functions.invoke('adminVerifyId', { target_user_id: targetUserId, action });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(action === 'verify' ? 'Identity verified.' : 'Identity rejected.');
    } catch {
      toast.error('Action failed. Please try again.');
    }
    setVerifyingUserId(null);
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Educator.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-educators'] });
      toast.success('Profile updated successfully');
      setSelectedEducator(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Educator.update(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-educators'] });
      toast.success(`Account ${vars.data.account_status === 'active' ? 'reinstated' : vars.data.account_status}`);
      setStatusAction({ open: false, educator: null, status: '', reason: '' });
    },
  });

  const filtered = educators.filter(e => {
    if (e.created_by_id === user?.id) return false;
    if (!search) return true;
    return e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.current_school?.toLowerCase().includes(search.toLowerCase());
  });

  const getUserEmail = (educator) => {
    const user = users.find(u => u.id === educator.created_by_id);
    return user?.email || '—';
  };

  const openEdit = (educator) => {
    setSelectedEducator(educator);
    setEditForm({ ...educator });
  };

  const openStatusAction = (educator, status) => {
    setStatusAction({ open: true, educator, status, reason: educator.status_reason || '' });
  };

  const handleSaveProfile = () => {
    updateMutation.mutate({ id: selectedEducator.id, data: editForm });
  };

  const handleStatusChange = () => {
    statusMutation.mutate({
      id: statusAction.educator.id,
      data: { account_status: statusAction.status, status_reason: statusAction.reason },
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
        <Shield className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700">Admin panel — changes here affect real user accounts.</p>
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-xl bg-muted p-1">
        <button
          onClick={() => setIdVerifyTab(false)}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${!idVerifyTab ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
        >
          Educators
        </button>
        <button
          onClick={() => setIdVerifyTab(true)}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${idVerifyTab ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
        >
          ID Verification
          {pendingIdUsers.length > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {pendingIdUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* ID Verification Queue */}
      {idVerifyTab ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{pendingIdUsers.length} passport{pendingIdUsers.length !== 1 ? 's' : ''} awaiting review</p>
          {pendingIdUsers.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No pending verifications</p>
          )}
          {pendingIdUsers.map(u => (
            <div key={u.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">ID: {u.id_number}</p>
                </div>
                <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px] shrink-0">Passport</Badge>
              </div>

              {/* Passport images */}
              <div className="grid grid-cols-2 gap-2">
                {u.passport_front_url ? (
                  <a href={u.passport_front_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border">
                    <img src={u.passport_front_url} alt="Passport front" className="w-full h-28 object-cover" />
                    <p className="text-[10px] text-center text-muted-foreground py-1 bg-muted">Photo/Bio page</p>
                  </a>
                ) : (
                  <div className="rounded-lg border border-dashed border-border h-28 flex items-center justify-center text-xs text-muted-foreground">No front</div>
                )}
                {u.passport_back_url ? (
                  <a href={u.passport_back_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border">
                    <img src={u.passport_back_url} alt="Passport back" className="w-full h-28 object-cover" />
                    <p className="text-[10px] text-center text-muted-foreground py-1 bg-muted">Back/Details page</p>
                  </a>
                ) : (
                  <div className="rounded-lg border border-dashed border-border h-28 flex items-center justify-center text-xs text-muted-foreground">No back</div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-primary hover:bg-primary/90 gap-1.5"
                  onClick={() => handleAdminVerifyId(u.id, 'verify')}
                  disabled={!!verifyingUserId}
                >
                  {verifyingUserId === u.id + 'verify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                  onClick={() => handleAdminVerifyId(u.id, 'reject')}
                  disabled={!!verifyingUserId}
                >
                  {verifyingUserId === u.id + 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or school..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} educator{filtered.length !== 1 ? 's' : ''}</p>

      <div className="space-y-2">
        {filtered.map(educator => (
          <div key={educator.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {educator.avatar_url
                ? <img src={educator.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                : <span className="text-sm font-semibold text-primary">{educator.full_name?.[0] || '?'}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{educator.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{getUserEmail(educator)}</p>
            </div>
            <Badge className={`text-xs shrink-0 ${STATUS_COLORS[educator.account_status || 'active']}`}>
              {educator.account_status || 'active'}
            </Badge>
            <button onClick={() => openEdit(educator)} className="p-1 hover:bg-muted rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No educators found</p>
        )}
      </div>
      </>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={!!selectedEducator} onOpenChange={open => !open && setSelectedEducator(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile — {selectedEducator?.full_name}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
                <Input value={editForm.full_name || ''} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
                <Input value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Current School</label>
                <Input value={editForm.current_school || ''} onChange={e => setEditForm(f => ({ ...f, current_school: e.target.value }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">SACE Number</label>
                <Input value={editForm.sace_number || ''} onChange={e => setEditForm(f => ({ ...f, sace_number: e.target.value }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Bio</label>
                <Textarea value={editForm.bio || ''} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} className="rounded-xl" rows={3} />
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-foreground mb-2">Account Status</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => openStatusAction(selectedEducator, 'active')}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Reinstate
                  </Button>
                  <Button size="sm" variant="outline" className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                    onClick={() => openStatusAction(selectedEducator, 'suspended')}>
                    <UserX className="w-3.5 h-3.5 mr-1" /> Suspend
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-50"
                    onClick={() => openStatusAction(selectedEducator, 'banned')}>
                    <Shield className="w-3.5 h-3.5 mr-1" /> Ban
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-row gap-2 sm:justify-end">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setSelectedEducator(null)}>Cancel</Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSaveProfile} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Action Dialog */}
      <Dialog open={statusAction.open} onOpenChange={open => !open && setStatusAction(s => ({ ...s, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {statusAction.status === 'active' ? 'Reinstate' : statusAction.status === 'suspended' ? 'Suspend' : 'Ban'} Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {statusAction.status === 'active'
                ? `Restore full access for ${statusAction.educator?.full_name}?`
                : `This will ${statusAction.status === 'suspended' ? 'suspend' : 'permanently ban'} ${statusAction.educator?.full_name}. They will see a notice when logging in.`}
            </p>
            {statusAction.status !== 'active' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Reason (shown to user)</label>
                <Textarea
                  value={statusAction.reason}
                  onChange={e => setStatusAction(s => ({ ...s, reason: e.target.value }))}
                  placeholder="e.g. Violation of community guidelines..."
                  className="rounded-xl"
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-row gap-2 sm:justify-end">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setStatusAction(s => ({ ...s, open: false }))}>Cancel</Button>
            <Button className="flex-1 sm:flex-none"
              onClick={handleStatusChange}
              disabled={statusMutation.isPending || (statusAction.status !== 'active' && !statusAction.reason.trim())}
              className={statusAction.status === 'banned' ? 'bg-destructive hover:bg-destructive/90' : statusAction.status === 'suspended' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
            >
              {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}