import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RefreshCw, Flame, Save, Plus, X, ArrowLeft, Camera, Loader2, Image, SwitchCamera, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const PROVINCES = [
  'Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape',
  'Mpumalanga', 'Limpopo', 'North West', 'Free State', 'Northern Cape'
];

const SUBJECTS = [
  'Accounting',
  'Afrikaans FAL',
  'Afrikaans HL',
  'Agricultural Sciences',
  'Agricultural Management Practices',
  'Agricultural Technology',
  'Business Studies',
  'Computer Applications Technology',
  'Consumer Studies',
  'Dance Studies',
  'Design',
  'Dramatic Arts',
  'Economics',
  'Engineering Graphics and Design',
  'English FAL',
  'English HL',
  'Geography',
  'History',
  'Hospitality Studies',
  'Information Technology',
  'isiNdebele FAL',
  'isiNdebele HL',
  'isiXhosa FAL',
  'isiXhosa HL',
  'isiZulu FAL',
  'isiZulu HL',
  'Life Orientation',
  'Life Sciences',
  'Mathematical Literacy',
  'Mathematics',
  'Music',
  'Natural Sciences',
  'Physical Sciences',
  'Religion Studies',
  'Sepedi FAL',
  'Sepedi HL',
  'Sesotho FAL',
  'Sesotho HL',
  'Setswana FAL',
  'Setswana HL',
  'Sign Language HL',
  'Siswati FAL',
  'Siswati HL',
  'Social Sciences',
  'Technology',
  'Tshivenda FAL',
  'Tshivenda HL',
  'Tourism',
  'Visual Arts',
  'Xitsonga FAL',
  'Xitsonga HL',
  'Other',
];

const PHASES = ['Foundation', 'Intermediate', 'Senior', 'FET'];

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [prefProvToAdd, setPrefProvToAdd] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-educator-profile'],
    queryFn: async () => {
      const u = await base44.auth.me();
      const profiles = await base44.entities.Educator.filter({ created_by_id: u.id });
      return profiles[0] || null;
    },
  });

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
    sace_number: '',
    current_school: '',
    current_province: '',
    current_district: '',
    subjects: [],
    phase: '',
    years_experience: '',
    is_actively_looking: false,
    preferred_provinces: [],
    available_from: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || user?.full_name || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
        sace_number: profile.sace_number || '',
        current_school: profile.current_school || '',
        current_province: profile.current_province || '',
        current_district: profile.current_district || '',
        subjects: profile.subjects || [],
        phase: profile.phase || '',
        years_experience: profile.years_experience || '',
        is_actively_looking: profile.is_actively_looking || false,
        preferred_provinces: profile.preferred_provinces || [],
        available_from: profile.available_from || '',
      });
    } else if (user) {
      setForm(f => ({ ...f, full_name: user.full_name || '' }));
    }
  }, [profile, user]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...form,
        years_experience: form.years_experience ? Number(form.years_experience) : undefined,
      };
      if (profile) {
        return base44.entities.Educator.update(profile.id, data);
      }
      return base44.entities.Educator.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-educator-profile'] });
      toast.success('Profile saved!');
    },
  });

  const addSubject = () => {
    const subject = subjectToAdd === 'Other' ? customSubject.trim() : subjectToAdd;
    if (subject && !form.subjects.includes(subject)) {
      setForm(f => ({ ...f, subjects: [...f.subjects, subject] }));
      setSubjectToAdd('');
      setCustomSubject('');
    }
  };

  const removeSubject = (s) => {
    setForm(f => ({ ...f, subjects: f.subjects.filter(x => x !== s) }));
  };

  const addPrefProv = () => {
    if (prefProvToAdd && !form.preferred_provinces.includes(prefProvToAdd)) {
      setForm(f => ({ ...f, preferred_provinces: [...f.preferred_provinces, prefProvToAdd] }));
      setPrefProvToAdd('');
    }
  };

  const removePrefProv = (p) => {
    setForm(f => ({ ...f, preferred_provinces: f.preferred_provinces.filter(x => x !== p) }));
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, avatar_url: file_url }));
    setUploadingAvatar(false);
    toast.success('Photo updated!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <RefreshCw className="w-5 h-5 text-primary" strokeWidth={2.5} />
        <h1 className="text-xl font-bold text-foreground">My Profile</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-primary/20 overflow-hidden bg-muted flex items-center justify-center">
              {form.avatar_url
                ? <img src={form.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-primary/50">{form.full_name?.[0]?.toUpperCase() || '?'}</span>
              }
            </div>
            <button
              type="button"
              onClick={() => !uploadingAvatar && setShowPhotoMenu(true)}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors"
            >
              {uploadingAvatar
                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                : <Camera className="w-4 h-4 text-white" />
              }
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Tap camera to change photo</p>
          {user?.user_code && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(user.user_code);
                toast.success('User code copied!');
              }}
              className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 hover:bg-primary/15 transition-colors"
            >
              <span className="text-sm font-bold text-primary tracking-widest">{user.user_code}</span>
              <Copy className="w-3.5 h-3.5 text-primary/70" />
            </button>
          )}
          {user?.user_code && (
            <p className="text-[11px] text-muted-foreground -mt-1">Your support code — quote this when contacting support</p>
          )}
        </div>

        {/* Photo source picker */}
        {showPhotoMenu && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowPhotoMenu(false)}>
            <div className="w-full bg-card rounded-t-2xl border-t border-border p-4 space-y-2" onClick={e => e.stopPropagation()}>
              <p className="text-center text-sm font-semibold text-foreground mb-3">Change Profile Photo</p>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-muted hover:bg-secondary cursor-pointer transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <SwitchCamera className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-sm text-foreground">Take Photo</span>
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { setShowPhotoMenu(false); handleAvatarChange(e); }} />
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-muted hover:bg-secondary cursor-pointer transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Image className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-sm text-foreground">Choose from Gallery</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { setShowPhotoMenu(false); handleAvatarChange(e); }} />
              </label>
              <button
                onClick={() => setShowPhotoMenu(false)}
                className="w-full mt-1 p-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Transfer Status Toggle */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.is_actively_looking ? 'bg-accent/15' : 'bg-muted'}`}>
                <Flame className={`w-5 h-5 ${form.is_actively_looking ? 'text-accent' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Actively Looking</p>
                <p className="text-xs text-muted-foreground">Appear first in search results</p>
              </div>
            </div>
            <Switch
              checked={form.is_actively_looking}
              onCheckedChange={(v) => setForm(f => ({ ...f, is_actively_looking: v }))}
            />
          </div>
        </div>

        {/* Personal Info */}
        <Section title="Personal Information">
          <Field label="Full Name">
            <Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} className="rounded-xl" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+27 XX XXX XXXX" className="rounded-xl" />
          </Field>
          <Field label="SACE Number">
            <Input value={form.sace_number} onChange={(e) => setForm(f => ({ ...f, sace_number: e.target.value }))} placeholder="e.g. 123456" className="rounded-xl" />
          </Field>
          <Field label="Bio">
            <Textarea value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell others about yourself..." rows={3} className="rounded-xl" />
          </Field>
        </Section>

        {/* Current Position */}
        <Section title="Current Position">
          <Field label="Province">
            <Select value={form.current_province} onValueChange={(v) => setForm(f => ({ ...f, current_province: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select province" /></SelectTrigger>
              <SelectContent>
                {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="District">
            <Input value={form.current_district} onChange={(e) => setForm(f => ({ ...f, current_district: e.target.value }))} placeholder="e.g. Tshwane South" className="rounded-xl" />
          </Field>
          <Field label="School">
            <Input value={form.current_school} onChange={(e) => setForm(f => ({ ...f, current_school: e.target.value }))} placeholder="e.g. Pretoria High School" className="rounded-xl" />
          </Field>
        </Section>

        {/* Teaching */}
        <Section title="Teaching Details">
          <Field label="Phase">
            <Select value={form.phase} onValueChange={(v) => setForm(f => ({ ...f, phase: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select phase" /></SelectTrigger>
              <SelectContent>
                {PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Years Experience">
            <Input type="number" value={form.years_experience} onChange={(e) => setForm(f => ({ ...f, years_experience: e.target.value }))} placeholder="e.g. 5" className="rounded-xl" />
          </Field>
          <Field label="Subjects">
            <div className="flex gap-2 mb-2">
              <Select value={subjectToAdd} onValueChange={v => { setSubjectToAdd(v); setCustomSubject(''); }}>
                <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder="Add subject" /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.filter(s => !form.subjects.includes(s)).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSubject} disabled={!subjectToAdd || (subjectToAdd === 'Other' && !customSubject.trim())}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {subjectToAdd === 'Other' && (
              <Input
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubject()}
                placeholder="Type subject name..."
                className="rounded-xl h-11 mb-2"
                autoFocus
              />
            )}
            <div className="flex flex-wrap gap-1.5">
              {form.subjects.map(s => (
                <Badge key={s} variant="secondary" className="gap-1 pr-1">
                  {s}
                  <button onClick={() => removeSubject(s)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </Field>
        </Section>

        {/* Transfer Preferences */}
        <Section title="Transfer Preferences">
          <Field label="Preferred Provinces">
            <div className="flex gap-2 mb-2">
              <Select value={prefProvToAdd} onValueChange={setPrefProvToAdd}>
                <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder="Add province" /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.filter(p => !form.preferred_provinces.includes(p)).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addPrefProv}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.preferred_provinces.map(p => (
                <Badge key={p} variant="secondary" className="gap-1 pr-1">
                  {p}
                  <button onClick={() => removePrefProv(p)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </Field>
          <Field label="Available From">
            <Input type="date" value={form.available_from} onChange={(e) => setForm(f => ({ ...f, available_from: e.target.value }))} className="rounded-xl" />
          </Field>
        </Section>

        {/* Save */}
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full h-12 rounded-xl text-base font-semibold gap-2"
        >
          <Save className="w-5 h-5" />
          {saveMutation.isPending ? 'Saving...' : 'Save Profile'}
        </Button>


      </motion.div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}