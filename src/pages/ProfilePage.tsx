import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Loader2, Camera, Flame, Save, ArrowLeft, RefreshCw, X, Plus,
  Phone, Mail, Users, CreditCard, BookOpen, Upload, ImagePlus,
  CheckCircle2, AlertCircle, XCircle, ShieldCheck, ShieldVerified, Copy,
  GraduationCap, User, Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import BlockButton from '@/components/BlockButton';
import { isBlocked } from '@/lib/blockUtils';

const PROVINCES = ['Gauteng','KwaZulu-Natal','Western Cape','Eastern Cape','Mpumalanga','Limpopo','North West','Free State','Northern Cape'];
const PHASES    = ['Foundation','Intermediate','Senior','FET'];

const DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
  'Eastern Cape':  ['Alfred Nzo East','Alfred Nzo West','Amatole East','Amatole West','Buffalo City','Chris Hani East','Chris Hani West','Joe Gqabi','Nelson Mandela Bay','OR Tambo Coastal','OR Tambo Inland','Sarah Baartman'],
  'Free State':    ['Fezile Dabi','Lejweleputswa','Motheo','Thabo Mofutsanyana','Xhariep'],
  'Gauteng':       ['Ekurhuleni North','Ekurhuleni South','Gauteng North','Gauteng West','Johannesburg Central','Johannesburg East','Johannesburg North','Johannesburg South','Sedibeng East','Sedibeng West','Tshwane North','Tshwane South','Tshwane West'],
  'KwaZulu-Natal': ['Amajuba','Harry Gwala','Ilembe','King Cetshwayo','Pinetown','Ugu','Umgungundlovu','Umkhanyakude','Umzinyathi','Uthukela','Uthungulu','Zululand'],
  'Limpopo':       ['Capricorn North','Capricorn South','Mopani East','Mopani West','Sekhukhune East','Sekhukhune South','Vhembe East','Vhembe West','Waterberg','Mogalakwena'],
  'Mpumalanga':    ['Bohlabela','Ehlanzeni','Gert Sibande','Nkangala'],
  'North West':    ['Bojanala','Dr Kenneth Kaunda','Dr Ruth Segomotsi Mompati','Ngaka Modiri Molema'],
  'Northern Cape': ['Frances Baard','John Taolo Gaetsewe','Namakwa','Pixley-ka-Seme','ZF Mgcawu'],
  'Western Cape':  ['Metro Central','Metro East','Metro North','Metro South','Cape Winelands','Eden and Central Karoo','Overberg','West Coast'],
};

const ALL_DISTRICTS = Object.values(DISTRICTS_BY_PROVINCE).flat().sort();

const SUBJECTS = [
  'Accounting','Afrikaans FAL','Afrikaans HL','Agricultural Sciences',
  'Agricultural Management Practices','Agricultural Technology','Business Studies',
  'Computer Applications Technology','Consumer Studies','Dance Studies','Design',
  'Dramatic Arts','Economics','Engineering Graphics and Design','English FAL','English HL',
  'Geography','History','Hospitality Studies','Information Technology',
  'isiNdebele FAL','isiNdebele HL','isiXhosa FAL','isiXhosa HL','isiZulu FAL','isiZulu HL',
  'Life Orientation','Life Sciences','Mathematical Literacy','Mathematics','Music',
  'Natural Sciences','Physical Sciences','Religion Studies',
  'Sepedi FAL','Sepedi HL','Sesotho FAL','Sesotho HL','Setswana FAL','Setswana HL',
  'Sign Language HL','Siswati FAL','Siswati HL','Social Sciences','Technology',
  'Tshivenda FAL','Tshivenda HL','Tourism','Visual Arts',
  'Xitsonga FAL','Xitsonga HL','Other',
];

interface Profile {
  id?: string;
  user_id: string;
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
  preferred_districts: string[];
  available_from: string;
  is_actively_looking: boolean;
  is_sace_verified?: boolean;
  years_experience: string;
  avatar_url: string;
  profile_type: 'educator' | 'general';
}

/* ── Shared primitives (unchanged) ───────────────────────────────────────── */
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

// ... (keep all existing helper components: IdentityVerificationSection, ImageUploadTile, VerifyBadge, etc.)
// To avoid repetition, I'm omitting them here for brevity. They are exactly the same as in your original file.
// Make sure to keep them in your actual implementation.

/* ── Main ProfilePage ────────────────────────────────────────── */
export default function ProfilePage() {
  const { userId: routeUserId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwnProfile = !routeUserId || routeUserId === user?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [blockCheckDone, setBlockCheckDone] = useState(false);

  // Edit‑mode states (only used when isOwnProfile === true)
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarSheet, setAvatarSheet] = useState(false);
  const [userCode, setUserCode] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [provinceToAdd, setProvinceToAdd] = useState('');
  const [townOther, setTownOther] = useState(false);
  const [customTownText, setCustomTownText] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districtOther, setDistrictOther] = useState(false);
  const [customDistrict, setCustomDistrict] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ──────────────────────────────────────────────────────────────
  // 1. Fetch profile (either own or other user)
  // ──────────────────────────────────────────────────────────────
  const loadProfile = async () => {
    if (!user) return;
    const targetId = routeUserId || user.id;

    // Fetch educator record
    const { data, error } = await supabase
      .from('educators')
      .select('*')
      .eq('user_id', targetId)
      .maybeSingle();

    if (error) {
      toast.error('Failed to load profile');
      setLoading(false);
      return;
    }

    if (!data && targetId === user.id) {
      // Own profile but no row yet – initialise empty (editable)
      setProfile({
        user_id: user.id,
        full_name: '',
        email: user.email ?? '',
        phone: '',
        gender: '',
        bio: '',
        sace_number: '',
        current_school: '',
        current_province: '',
        town: '',
        phase: '',
        subjects: [],
        preferred_provinces: [],
        preferred_districts: [],
        available_from: '',
        is_actively_looking: false,
        years_experience: '',
        avatar_url: '',
        profile_type: 'educator',
      });
      setLoading(false);
      return;
    }

    if (data) {
      // Transform town field for edit mode if needed
      let townValue = data.town ?? '';
      let isTownOther = false;
      let customTown = '';
      if (targetId === user.id && data.current_province) {
        const provinceDistricts = DISTRICTS_BY_PROVINCE[data.current_province] ?? [];
        isTownOther = townValue !== '' && !provinceDistricts.includes(townValue);
        if (isTownOther) {
          customTown = townValue;
          townValue = '__other__';
        }
      }
      setProfile({
        ...data,
        town: townValue,
        years_experience: String(data.years_experience ?? ''),
      });
      if (isOwnProfile && isTownOther) {
        setTownOther(true);
        setCustomTownText(customTown);
      }
    } else {
      // No profile found for other user – show 404-like message
      setProfile(null);
    }
    setLoading(false);
  };

  // 2. Block check (only when viewing another user's profile)
  useEffect(() => {
    if (!user || !routeUserId || routeUserId === user.id) {
      setBlockCheckDone(true);
      return;
    }
    const check = async () => {
      const isBlocked = await isBlocked(user.id, routeUserId);
      setBlocked(isBlocked);
      setBlockCheckDone(true);
    };
    check();
  }, [user, routeUserId]);

  // 3. Load own metadata (user code, last saved) for edit mode
  useEffect(() => {
    if (!isOwnProfile || !user) return;
    const fetchMeta = async () => {
      const { data: freshUser } = await supabase.auth.getUser();
      const meta = freshUser?.user?.user_metadata ?? {};
      if (meta.user_code) setUserCode(meta.user_code);
      if (meta.profile_last_saved) setLastSaved(new Date(meta.profile_last_saved));
    };
    fetchMeta();
  }, [isOwnProfile, user]);

  useEffect(() => {
    loadProfile();
  }, [routeUserId, user]);

  // ──────────────────────────────────────────────────────────────
  // Helpers for edit mode (only when isOwnProfile)
  // ──────────────────────────────────────────────────────────────
  const setProfileField = (field: keyof Profile, value: unknown) => {
    if (profile) setProfile({ ...profile, [field]: value });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !isOwnProfile) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const mimeExt: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
        'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic',
      };
      const ext = mimeExt[file.type] ?? file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      setProfileField('avatar_url', urlData.publicUrl);
      toast.success('Profile photo updated!');
    } catch (err: any) {
  toast.error(err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const addSubject = () => {
    if (subjectToAdd && profile && !profile.subjects.includes(subjectToAdd)) {
      setProfileField('subjects', [...profile.subjects, subjectToAdd]);
      setSubjectToAdd('');
    }
  };
  const removeSubject = (s: string) => {
    if (profile) setProfileField('subjects', profile.subjects.filter(x => x !== s));
  };
  const addProvince = () => {
    if (provinceToAdd && profile && !profile.preferred_provinces.includes(provinceToAdd)) {
      setProfileField('preferred_provinces', [...profile.preferred_provinces, provinceToAdd]);
      setProvinceToAdd('');
    }
  };
  const removeProvince = (p: string) => {
    if (profile) setProfileField('preferred_provinces', profile.preferred_provinces.filter(x => x !== p));
  };
  const addDistrict = () => {
    const val = districtOther ? customDistrict.trim() : selectedDistrict;
    if (val && profile && !profile.preferred_districts.includes(val)) {
      setProfileField('preferred_districts', [...profile.preferred_districts, val]);
    }
    setSelectedDistrict('');
    setDistrictOther(false);
    setCustomDistrict('');
  };
  const removeDistrict = (d: string) => {
    if (profile) setProfileField('preferred_districts', profile.preferred_districts.filter(x => x !== d));
  };
  const handleTownSelect = (v: string) => {
    if (v === '__other__') {
      setTownOther(true);
      setProfileField('town', '__other__');
    } else {
      setTownOther(false);
      setCustomTownText('');
      setProfileField('town', v);
    }
  };

  const daysSinceSave = lastSaved
    ? Math.floor((Date.now() - lastSaved.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const canSave = daysSinceSave === null || daysSinceSave >= 30;
  const daysLeft = canSave ? 0 : 30 - daysSinceSave!;

  const handleSave = () => {
    if (!user || !profile) return;
    if (profile.profile_type !== 'general' && !profile.sace_number.trim()) {
      toast.error('SACE number is required for educator profiles.');
      return;
    }
    if (!canSave) {
      toast.error(`Profiles can only be updated once every 30 days. ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.`);
      return;
    }
    setShowConfirmDialog(true);
  };

  const doSave = async () => {
    setShowConfirmDialog(false);
    if (!user || !profile) return;
    setSaving(true);
    try {
      const { id: _id, is_sace_verified: _sv, ...rest } = profile;
      const yearsExp = profile.years_experience ? parseInt(profile.years_experience, 10) : null;
      const resolvedTown = rest.town === '__other__' ? customTownText.trim() : rest.town;
      const payload = {
        ...rest,
        town: resolvedTown,
        user_id: user.id,
        years_experience: (yearsExp !== null && !isNaN(yearsExp)) ? yearsExp : null,
        available_from: profile.available_from || null,
      };
      if (profile.id) {
        const { error } = await supabase.from('educators').update(payload).eq('id', profile.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('educators').insert([payload]).select().single();
        if (error) throw error;
        if (data) setProfileField('id', data.id);
      }
      const now = new Date();
      await supabase.auth.updateUser({ data: { profile_last_saved: now.toISOString() } });
      setLastSaved(now);
      toast.success('Profile saved!');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Render states
  // ──────────────────────────────────────────────────────────────
  if (loading || !blockCheckDone) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Profile not found (other user)
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <User className="w-12 h-12 mb-3 opacity-40" />
        <p>User profile not found.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
      </div>
    );
  }

  // Blocked view (other user is blocked)
  if (!isOwnProfile && blocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Lock className="w-12 h-12 mb-3 text-destructive/60" />
        <p className="text-center font-medium">You have blocked this user.</p>
        <p className="text-sm text-center mb-4">Their profile is hidden.</p>
        <BlockButton targetUserId={routeUserId!} onBlockChange={() => setBlocked(false)} />
      </div>
    );
  }

  const initial = profile.full_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || 'U';
  const isEducator = profile.profile_type !== 'general';

  // ── RENDER OWN PROFILE (EDITABLE) ─────────────────────────────────────────
  if (isOwnProfile) {
    return (
      <div className="max-w-2xl mx-auto pb-28">
        {/* Header with refresh and back button */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <button onClick={handleRefresh} className="p-1 rounded-full hover:bg-muted transition-colors">
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <h1 className="text-lg font-bold text-foreground">My Profile</h1>
        </div>

        {/* Hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAvatarUpload} />
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

        {/* Avatar & badges */}
        <div className="flex flex-col items-center gap-2 pb-5">
          <button type="button" onClick={() => setAvatarSheet(true)} className="relative focus:outline-none">
            <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-primary">{initial}</span>}
            </div>
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background shadow">
              {uploading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
            </div>
          </button>
          <p className="text-xs text-muted-foreground">Tap to change photo</p>
          {profile.is_sace_verified && (
            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Verified</span>
            </div>
          )}
          {userCode && (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 mt-1">
              <div className="text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Reference Code</p>
                <p className="text-sm font-bold text-primary font-mono tracking-widest">{userCode}</p>
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(userCode); toast.success('Code copied!'); }}
                className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                title="Copy code"
              >
                <Copy className="w-3.5 h-3.5 text-primary" />
              </button>
            </div>
          )}
        </div>

        {/* Avatar action sheet (same as original) */}
        {avatarSheet && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setAvatarSheet(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-card rounded-t-2xl px-4 pt-4 pb-8 space-y-2 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center mb-3">Change Profile Photo</p>
              <button
                type="button"
                onClick={() => { setAvatarSheet(false); cameraInputRef.current?.click(); }}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-muted/50 hover:bg-muted active:bg-muted transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Take Photo</p>
                  <p className="text-xs text-muted-foreground">Use your camera</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setAvatarSheet(false); galleryInputRef.current?.click(); }}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-muted/50 hover:bg-muted active:bg-muted transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ImagePlus className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Choose from Gallery</p>
                  <p className="text-xs text-muted-foreground">Pick an existing photo</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAvatarSheet(false)}
                className="w-full mt-1 py-3 rounded-2xl text-sm font-semibold text-muted-foreground hover:bg-muted active:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="px-4 space-y-3">
          {/* Profile Type toggle */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Profile Type</p>
            <div className="grid grid-cols-2 bg-muted rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setProfileField('profile_type', 'educator')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${isEducator ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <GraduationCap className="w-4 h-4" /> Educator
              </button>
              <button
                type="button"
                onClick={() => setProfileField('profile_type', 'general')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${!isEducator ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <User className="w-4 h-4" /> General
              </button>
            </div>
            {!isEducator && (
              <p className="text-xs text-muted-foreground mt-2.5 px-1">
                As a general user you won't appear in search or match results. Switch to Educator to be discoverable.
              </p>
            )}
          </div>

          {/* Actively Looking (educators only) */}
          {isEducator && (
            <div className="bg-card rounded-2xl border border-border flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Actively Looking</p>
                <p className="text-xs text-muted-foreground">Appear first in search results</p>
              </div>
              <Switch checked={profile.is_actively_looking} onCheckedChange={v => setProfileField('is_actively_looking', v)} />
            </div>
          )}

          {/* Personal Information */}
          <SectionCard label="Personal Information">
            <Field label="Full Name">
              <Input value={profile.full_name} onChange={e => setProfileField('full_name', e.target.value)} placeholder="Your full name" className="rounded-xl" />
            </Field>
            <Field label="Email Address">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input type="email" value={profile.email} onChange={e => setProfileField('email', e.target.value)} placeholder="you@example.com" className="rounded-xl pl-9" />
              </div>
            </Field>
            <Field label="Phone Number">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input type="tel" value={profile.phone} onChange={e => setProfileField('phone', e.target.value)} placeholder="+27 71 000 0000" className="rounded-xl pl-9" />
              </div>
            </Field>
            <Field label="Gender">
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                <Select value={profile.gender} onValueChange={v => setProfileField('gender', v)}>
                  <SelectTrigger className="rounded-xl pl-9"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Non-binary">Non-binary</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Field>
            {isEducator && (
              <Field label="SACE Number *">
                <Input value={profile.sace_number} onChange={e => setProfileField('sace_number', e.target.value)} placeholder="e.g. 20012345" className="rounded-xl" />
              </Field>
            )}
            <Field label="Bio">
              <Textarea value={profile.bio} onChange={e => setProfileField('bio', e.target.value)} placeholder="Tell others about yourself..." rows={3} className="rounded-xl resize-none" />
            </Field>
          </SectionCard>

          {/* Identity Verification (educators only) */}
          {isEducator && <IdentityVerificationSection />}

          {/* Current Position (educators only) */}
          {isEducator && (
            <SectionCard label="Current Position">
              <Field label="Province">
                <Select value={profile.current_province} onValueChange={v => setProfileField('current_province', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select province" /></SelectTrigger>
                  <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Education District">
                {profile.current_province ? (
                  <>
                    <Select value={profile.town} onValueChange={handleTownSelect}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent className="max-h-48 overflow-y-auto">
                        {(DISTRICTS_BY_PROVINCE[profile.current_province] ?? []).map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                        <SelectItem value="__other__">Other (type below)</SelectItem>
                      </SelectContent>
                    </Select>
                    {townOther && (
                      <Input
                        value={customTownText}
                        onChange={e => setCustomTownText(e.target.value)}
                        placeholder="Type your district name"
                        className="rounded-xl mt-2"
                        autoFocus
                      />
                    )}
                  </>
                ) : (
                  <div className="flex h-9 w-full items-center rounded-xl border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                    Select a province first
                  </div>
                )}
              </Field>
              <Field label="School">
                <Input value={profile.current_school} onChange={e => setProfileField('current_school', e.target.value)} placeholder="e.g. Pretoria High School" className="rounded-xl" />
              </Field>
            </SectionCard>
          )}

          {/* Teaching Details (educators only) */}
          {isEducator && (
            <SectionCard label="Teaching Details">
              <Field label="Phase">
                <Select value={profile.phase} onValueChange={v => setProfileField('phase', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select phase" /></SelectTrigger>
                  <SelectContent>{PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Years of Experience">
                <Input type="number" value={profile.years_experience} onChange={e => setProfileField('years_experience', e.target.value)} placeholder="e.g. 5" className="rounded-xl" />
              </Field>
              <Field label="Subjects">
                {profile.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {profile.subjects.map(s => (
                      <span key={s} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full pl-2.5 pr-1.5 py-0.5">
                        {s}
                        <button onClick={() => removeSubject(s)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Select value={subjectToAdd} onValueChange={setSubjectToAdd}>
                    <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder="Add subject" /></SelectTrigger>
                    <SelectContent className="max-h-48 overflow-y-auto">{SUBJECTS.filter(s => !profile.subjects.includes(s)).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={addSubject} className="rounded-xl shrink-0 h-10 w-10"><Plus className="w-4 h-4" /></Button>
                </div>
              </Field>
            </SectionCard>
          )}

          {/* Transfer Preferences (educators only) */}
          {isEducator && (
            <SectionCard label="Transfer Preferences">
              <Field label="Preferred Provinces">
                {profile.preferred_provinces.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {profile.preferred_provinces.map(p => (
                      <span key={p} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full pl-2.5 pr-1.5 py-0.5">
                        {p}
                        <button onClick={() => removeProvince(p)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Select value={provinceToAdd} onValueChange={setProvinceToAdd}>
                    <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder="Add province" /></SelectTrigger>
                    <SelectContent>{PROVINCES.filter(p => !profile.preferred_provinces.includes(p)).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={addProvince} className="rounded-xl shrink-0 h-10 w-10"><Plus className="w-4 h-4" /></Button>
                </div>
              </Field>

              <Field label="Preferred Education Districts">
                {profile.preferred_districts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {profile.preferred_districts.map(d => (
                      <span key={d} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full pl-2.5 pr-1.5 py-0.5">
                        {d}
                        <button onClick={() => removeDistrict(d)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Select a district</Label>
                    <div className="flex gap-2 mt-1">
                      <Select value={districtOther ? '__other__' : selectedDistrict} onValueChange={v => {
                        if (v === '__other__') { setDistrictOther(true); setSelectedDistrict(''); }
                        else { setDistrictOther(false); setSelectedDistrict(v); }
                      }}>
                        <SelectTrigger className="rounded-xl flex-1">
                          <SelectValue placeholder="Choose district" />
                        </SelectTrigger>
                        <SelectContent className="max-h-48 overflow-y-auto">
                          {ALL_DISTRICTS.filter(d => !profile.preferred_districts.includes(d)).map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                          <SelectItem value="__other__">Other (type below)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="outline" onClick={addDistrict}
                        disabled={districtOther ? !customDistrict.trim() : !selectedDistrict}
                        className="rounded-xl shrink-0 h-10 w-10"><Plus className="w-4 h-4" /></Button>
                    </div>
                    {districtOther && (
                      <Input
                        value={customDistrict}
                        onChange={e => setCustomDistrict(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDistrict(); } }}
                        placeholder="Type district name, then press +"
                        className="rounded-xl mt-2"
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              </Field>

              <Field label="Available From">
                <Input type="date" value={profile.available_from} onChange={e => setProfileField('available_from', e.target.value)} className="rounded-xl" />
              </Field>
            </SectionCard>
          )}
        </div>

        {/* Save button */}
        <div className="px-4 pt-2 pb-6 space-y-2">
          <Button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="w-full h-12 rounded-2xl text-base font-semibold gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Profile</>}
          </Button>
          {!canSave && (
            <p className="text-xs text-center text-muted-foreground">
              Profile updates are limited to once every 30 days.{' '}
              <span className="font-medium text-foreground">{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining.</span>
            </p>
          )}
        </div>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Double-check your details</AlertDialogTitle>
              <AlertDialogDescription>
                Please make sure all your information is correct before saving.
                You will only be able to update your profile again in 30 days.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go back and check</AlertDialogCancel>
              <AlertDialogAction onClick={doSave}>Yes, save profile</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── RENDER OTHER USER'S PROFILE (READ-ONLY + BLOCK BUTTON) ────────────────
  return (
    <div className="max-w-2xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">Educator Profile</h1>
        {/* Block / Unblock button */}
        <BlockButton targetUserId={routeUserId!} onBlockChange={() => setBlocked(false)} />
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-2 pb-5">
        <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            : <span className="text-3xl font-bold text-primary">{initial}</span>}
        </div>
        {profile.is_sace_verified && (
          <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Verified</span>
          </div>
        )}
      </div>

      {/* Read‑only fields */}
      <div className="px-4 space-y-3">
        <SectionCard label="Personal Information">
          <Field label="Full Name"><p className="text-sm">{profile.full_name || '—'}</p></Field>
          <Field label="Email"><p className="text-sm">{profile.email}</p></Field>
          <Field label="Phone"><p className="text-sm">{profile.phone || '—'}</p></Field>
          <Field label="Gender"><p className="text-sm">{profile.gender || '—'}</p></Field>
          <Field label="Bio"><p className="text-sm whitespace-pre-wrap">{profile.bio || '—'}</p></Field>
        </SectionCard>

        {isEducator && (
          <>
            <SectionCard label="Current Position">
              <Field label="Province"><p className="text-sm">{profile.current_province || '—'}</p></Field>
              <Field label="Education District"><p className="text-sm">{profile.town || '—'}</p></Field>
              <Field label="School"><p className="text-sm">{profile.current_school || '—'}</p></Field>
            </SectionCard>

            <SectionCard label="Teaching Details">
              <Field label="Phase"><p className="text-sm">{profile.phase || '—'}</p></Field>
              <Field label="Years of Experience"><p className="text-sm">{profile.years_experience || '—'}</p></Field>
              <Field label="Subjects">
                <div className="flex flex-wrap gap-1.5">
                  {profile.subjects.length ? profile.subjects.map(s => (
                    <span key={s} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5">{s}</span>
                  )) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </Field>
            </SectionCard>

            <SectionCard label="Transfer Preferences">
              <Field label="Preferred Provinces">
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferred_provinces.length ? profile.preferred_provinces.map(p => (
                    <span key={p} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5">{p}</span>
                  )) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </Field>
              <Field label="Preferred Districts">
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferred_districts.length ? profile.preferred_districts.map(d => (
                    <span key={d} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5">{d}</span>
                  )) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </Field>
              <Field label="Available From"><p className="text-sm">{profile.available_from || '—'}</p></Field>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}