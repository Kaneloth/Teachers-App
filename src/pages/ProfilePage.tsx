import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Camera, Flame, Save, ArrowLeft, RefreshCw, X, Plus, Phone, Mail, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';

const PROVINCES = ['Gauteng','KwaZulu-Natal','Western Cape','Eastern Cape','Mpumalanga','Limpopo','North West','Free State','Northern Cape'];
const PHASES = ['Foundation','Intermediate','Senior','FET'];
const SUBJECTS = [
  'Mathematics','Mathematical Literacy','Physical Sciences','Life Sciences',
  'English HL','English FAL','Afrikaans HL','Afrikaans FAL',
  'History','Geography','Business Studies','Accounting','Economics',
  'Life Orientation','Computer Applications Technology','Information Technology',
  'Agricultural Sciences','Natural Sciences','Social Sciences',
];

interface Profile {
  id?: string;
  full_name: string;
  email: string;
  phone: string;
  gender: string;
  bio: string;
  sace_number: string;
  current_school: string;
  current_province: string;
  town: string;
  phase: string;
  subjects: string[];
  preferred_provinces: string[];
  available_from: string;
  is_actively_looking: boolean;
  is_sace_verified?: boolean;
  years_experience: string;
  avatar_url: string;
}

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border px-4 py-4 space-y-3.5">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({
    full_name: '', email: '', phone: '', gender: '', bio: '', sace_number: '',
    current_school: '', current_province: '', town: '',
    phase: '', subjects: [], preferred_provinces: [], available_from: '',
    is_actively_looking: false, years_experience: '', avatar_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [provinceToAdd, setProvinceToAdd] = useState('');

  const loadProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('educators')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      toast.error('Failed to load profile');
    } else if (data) {
      setProfile({
        ...data,
        email: data.email ?? user?.email ?? '',
        phone: data.phone ?? '',
        gender: data.gender ?? '',
        years_experience: String(data.years_experience ?? ''),
        subjects: data.subjects ?? [],
        preferred_provinces: data.preferred_provinces ?? [],
        available_from: data.available_from ?? '',
        avatar_url: data.avatar_url ?? '',
        town: data.town ?? '',
      });
    } else {
      // no row yet — pre-fill email from auth
      setProfile(p => ({ ...p, email: user?.email ?? '' }));
    }
    setLoading(false);
  };

  useEffect(() => { loadProfile(); }, [user]);

  const set = (field: keyof Profile, value: unknown) => setProfile(p => ({ ...p, [field]: value }));

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `avatars/${user.id}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      set('avatar_url', urlData.publicUrl);
    } else {
      toast.error('Avatar upload failed');
    }
    setUploading(false);
  };

  const addSubject = () => {
    if (subjectToAdd && !profile.subjects.includes(subjectToAdd)) {
      set('subjects', [...profile.subjects, subjectToAdd]);
    }
    setSubjectToAdd('');
  };

  const removeSubject = (s: string) => set('subjects', profile.subjects.filter(x => x !== s));

  const addProvince = () => {
    if (provinceToAdd && !profile.preferred_provinces.includes(provinceToAdd)) {
      set('preferred_provinces', [...profile.preferred_provinces, provinceToAdd]);
    }
    setProvinceToAdd('');
  };

  const removeProvince = (p: string) => set('preferred_provinces', profile.preferred_provinces.filter(x => x !== p));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { id: _id, is_sace_verified: _sv, ...rest } = profile;
      const yearsExp = profile.years_experience ? parseInt(profile.years_experience, 10) : null;
      const payload = {
        ...rest,
        user_id: user.id,
        years_experience: (yearsExp !== null && !isNaN(yearsExp)) ? yearsExp : null,
        available_from: profile.available_from || null,
      };

      if (profile.id) {
        const { error } = await supabase
          .from('educators')
          .update(payload)
          .eq('id', profile.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('educators')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        if (data) set('id', data.id);
      }
      toast.success('Profile saved!');
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? 'Failed to save profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const initial = profile.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <div className="max-w-2xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <button onClick={handleRefresh} className="p-1 rounded-full hover:bg-muted transition-colors">
          <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <h1 className="text-lg font-bold text-foreground">My Profile</h1>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-2 pb-5">
        <label className="relative cursor-pointer">
          <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              : <span className="text-3xl font-bold text-primary">{initial}</span>
            }
          </div>
          <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background shadow">
            {uploading
              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              : <Camera className="w-3.5 h-3.5 text-white" />
            }
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </label>
        <p className="text-xs text-muted-foreground">Tap camera to change photo</p>
      </div>

      <div className="px-4 space-y-3">
        {/* Actively Looking toggle */}
        <div className="bg-card rounded-2xl border border-border flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Actively Looking</p>
            <p className="text-xs text-muted-foreground">Appear first in search results</p>
          </div>
          <Switch
            checked={profile.is_actively_looking}
            onCheckedChange={v => set('is_actively_looking', v)}
          />
        </div>

        {/* Personal Information */}
        <SectionCard label="Personal Information">
          <Field label="Full Name">
            <Input
              value={profile.full_name}
              onChange={e => set('full_name', e.target.value)}
              placeholder="Your full name"
              className="rounded-xl"
            />
          </Field>
          <Field label="Email Address">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="email"
                value={profile.email}
                onChange={e => set('email', e.target.value)}
                placeholder="you@example.com"
                className="rounded-xl pl-9"
              />
            </div>
          </Field>
          <Field label="Phone Number">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="tel"
                value={profile.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+27 71 000 0000"
                className="rounded-xl pl-9"
              />
            </div>
          </Field>
          <Field label="Gender">
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
              <Select value={profile.gender} onValueChange={v => set('gender', v)}>
                <SelectTrigger className="rounded-xl pl-9">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Non-binary">Non-binary</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Field label="SACE Number">
            <Input
              value={profile.sace_number}
              onChange={e => set('sace_number', e.target.value)}
              placeholder="e.g. 123456"
              className="rounded-xl"
            />
          </Field>
          <Field label="Bio">
            <Textarea
              value={profile.bio}
              onChange={e => set('bio', e.target.value)}
              placeholder="Tell others about yourself..."
              rows={3}
              className="rounded-xl resize-none"
            />
          </Field>
        </SectionCard>

        {/* Current Position */}
        <SectionCard label="Current Position">
          <Field label="Province">
            <Select value={profile.current_province} onValueChange={v => set('current_province', v)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select province" /></SelectTrigger>
              <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Town / District">
            <Input
              value={profile.town}
              onChange={e => set('town', e.target.value)}
              placeholder="e.g. Pretoria"
              className="rounded-xl"
            />
          </Field>
          <Field label="School">
            <Input
              value={profile.current_school}
              onChange={e => set('current_school', e.target.value)}
              placeholder="e.g. Pretoria High School"
              className="rounded-xl"
            />
          </Field>
        </SectionCard>

        {/* Teaching Details */}
        <SectionCard label="Teaching Details">
          <Field label="Phase">
            <Select value={profile.phase} onValueChange={v => set('phase', v)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select phase" /></SelectTrigger>
              <SelectContent>{PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Years of Experience">
            <Input
              type="number"
              value={profile.years_experience}
              onChange={e => set('years_experience', e.target.value)}
              placeholder="e.g. 5"
              className="rounded-xl"
            />
          </Field>
          <Field label="Subjects">
            {profile.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {profile.subjects.map(s => (
                  <span key={s} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full pl-2.5 pr-1.5 py-0.5">
                    {s}
                    <button onClick={() => removeSubject(s)} className="hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Select value={subjectToAdd} onValueChange={setSubjectToAdd}>
                <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder="Add subject" /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.filter(s => !profile.subjects.includes(s)).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="icon" variant="outline" onClick={addSubject} className="rounded-xl shrink-0 h-10 w-10">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </Field>
        </SectionCard>

        {/* Transfer Preferences */}
        <SectionCard label="Transfer Preferences">
          <Field label="Preferred Provinces">
            {profile.preferred_provinces.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {profile.preferred_provinces.map(p => (
                  <span key={p} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full pl-2.5 pr-1.5 py-0.5">
                    {p}
                    <button onClick={() => removeProvince(p)} className="hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Select value={provinceToAdd} onValueChange={setProvinceToAdd}>
                <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder="Add province" /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.filter(p => !profile.preferred_provinces.includes(p)).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="icon" variant="outline" onClick={addProvince} className="rounded-xl shrink-0 h-10 w-10">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </Field>

          <Field label="Available From">
            <Input
              type="date"
              value={profile.available_from}
              onChange={e => set('available_from', e.target.value)}
              className="rounded-xl"
            />
          </Field>
        </SectionCard>
      </div>

      {/* Save button */}
      <div className="px-4 pt-2 pb-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-2xl text-base font-semibold gap-2"
        >
          {saving
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <><Save className="w-5 h-5" /> Save Profile</>
          }
        </Button>
      </div>
    </div>
  );
}
