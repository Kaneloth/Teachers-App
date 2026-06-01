import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Camera, Save, Loader2, MapPin, BookOpen, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PROVINCES, SUBJECTS, PHASES } from '@/lib/constants';

export default function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<any>(null);

  const { data: educator, isLoading } = useQuery({
    queryKey: ['my-educator-full'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('educators').select('*').eq('user_id', user.id).single();
      return data;
    },
  });

  useEffect(() => {
    if (educator) setForm({ ...educator });
  }, [educator]);

  const update = useMutation({
    mutationFn: async (values: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase.from('educators').update(values).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-educator-full'] });
      qc.invalidateQueries({ queryKey: ['my-educator-profile'] });
      qc.invalidateQueries({ queryKey: ['educators-search'] });
      toast.success('Profile updated!');
    },
    onError: (err: any) => toast.error(err.message || 'Update failed'),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !educator) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `avatars/${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('educators').update({ avatar_url: publicUrl }).eq('user_id', user.id);
      setForm((f: any) => ({ ...f, avatar_url: publicUrl }));
      qc.invalidateQueries({ queryKey: ['my-educator-full'] });
      toast.success('Photo updated!');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!form) return;
    const { id, user_id, created_at, updated_at, ...rest } = form;
    update.mutate(rest);
  };

  const toggle = (field: string) => setForm((f: any) => ({ ...f, [field]: !f[field] }));
  const setField = (field: string, val: any) => setForm((f: any) => ({ ...f, [field]: val }));

  const toggleArray = (field: string, val: string) => {
    setForm((f: any) => {
      const arr = f[field] || [];
      return { ...f, [field]: arr.includes(val) ? arr.filter((x: string) => x !== val) : [...arr, val] };
    });
  };

  if (isLoading) return <div className="flex justify-center pt-16"><Loader2 className="w-6 h-6 text-muted-foreground animate-spin" /></div>;
  if (!educator || !form) return null;

  return (
    <div className="px-4 pt-6 pb-10">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/home')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <User className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">My Profile</h1>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-4 border-card shadow-sm">
            {form.avatar_url
              ? <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-primary">{form.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
            }
          </div>
          <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors">
            {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
          </label>
        </div>
        <p className="text-sm text-muted-foreground mt-2">Tap to change photo</p>
      </div>

      <div className="space-y-5">
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Personal Info</h2>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={form.full_name || ''} onChange={e => setField('full_name', e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={form.bio || ''} onChange={e => setField('bio', e.target.value)} rows={3} placeholder="Tell educators a bit about yourself..." />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
            <div>
              <p className="text-sm font-medium">Actively Looking</p>
              <p className="text-xs text-muted-foreground">Show as available for exchange</p>
            </div>
            <Switch checked={form.is_actively_looking || false} onCheckedChange={() => toggle('is_actively_looking')} />
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Location & Province
          </h2>
          <div className="space-y-2">
            <Label>Current Province</Label>
            <Select value={form.current_province || ''} onValueChange={val => setField('current_province', val)}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select province" /></SelectTrigger>
              <SelectContent>
                {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Current School</Label>
            <Input value={form.current_school || ''} onChange={e => setField('current_school', e.target.value)} className="h-11" placeholder="School name" />
          </div>
          <div className="space-y-2">
            <Label>Town / City</Label>
            <Input value={form.town || ''} onChange={e => setField('town', e.target.value)} className="h-11" placeholder="e.g. Cape Town" />
          </div>
          <div>
            <Label className="mb-2 block">Preferred Provinces (for exchange)</Label>
            <div className="flex flex-wrap gap-2">
              {PROVINCES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleArray('preferred_provinces', p)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${(form.preferred_provinces || []).includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:border-primary'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Teaching
          </h2>
          <div className="space-y-2">
            <Label>Phase</Label>
            <Select value={form.phase || ''} onValueChange={val => setField('phase', val)}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select phase" /></SelectTrigger>
              <SelectContent>
                {PHASES.map(ph => <SelectItem key={ph} value={ph}>{ph}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Subjects</Label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleArray('subjects', s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${(form.subjects || []).includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:border-primary'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Years Experience</Label>
            <Input type="number" min={0} max={50} value={form.years_experience || ''} onChange={e => setField('years_experience', Number(e.target.value))} className="h-11" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={update.isPending} className="w-full h-12 rounded-xl font-semibold text-base">
          {update.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
        </Button>
      </div>
    </div>
  );
}
