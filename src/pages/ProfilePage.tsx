import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Loader2, Camera, Flame, Save, ArrowLeft, RefreshCw, X, Plus,
  Phone, Mail, Users, CreditCard, BookOpen, Upload, ImagePlus,
  CheckCircle2, AlertCircle, XCircle, ShieldCheck, ShieldCheck as ShieldVerified,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';

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
}

/* ── Shared primitives ───────────────────────────────────────── */
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

/* ── Identity verification helpers ──────────────────────────── */
type DocType    = 'id' | 'passport';
type VerifyState = 'idle' | 'verified' | 'unverified' | 'error';

function validateSAIdFormat(id: string): { valid: boolean; message: string } {
  if (!/^\d{13}$/.test(id)) return { valid: false, message: 'ID must be exactly 13 digits.' };
  const month = parseInt(id.slice(2, 4));
  const day   = parseInt(id.slice(4, 6));
  if (month < 1 || month > 12) return { valid: false, message: 'Invalid birth month in ID number.' };
  if (day   < 1 || day   > 31) return { valid: false, message: 'Invalid birth day in ID number.'   };
  let sum = 0, alt = false;
  for (let i = id.length - 1; i >= 0; i--) {
    let n = parseInt(id[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  if (sum % 10 !== 0) return { valid: false, message: 'ID number checksum is invalid. Please check for typos.' };
  return { valid: true, message: '' };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImageUploadTile({ label, file, onChange, onClear }: {
  label: string; file: File | null; onChange: (f: File) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview  = file ? URL.createObjectURL(file) : null;
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt={label} className="w-full h-28 object-cover" />
          <button type="button" onClick={onClear}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full h-28 rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors flex flex-col items-center justify-center gap-2">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Tap to upload photo</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) onChange(e.target.files[0]); }} />
    </div>
  );
}

function VerifyBadge({ state, message }: { state: VerifyState; message: string }) {
  if (state === 'idle' || !message) return null;
  const styles: Record<Exclude<VerifyState, 'idle'>, string> = {
    verified:   'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    unverified: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    error:      'bg-red-50   text-red-700   dark:bg-red-900/20   dark:text-red-400',
  };
  const icons: Record<Exclude<VerifyState, 'idle'>, React.ReactElement> = {
    verified:   <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />,
    unverified: <AlertCircle  className="w-4 h-4 mt-0.5 shrink-0" />,
    error:      <XCircle      className="w-4 h-4 mt-0.5 shrink-0" />,
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${styles[state as Exclude<VerifyState, 'idle'>]}`}>
      {icons[state as Exclude<VerifyState, 'idle'>]}
      <span>{message}</span>
    </div>
  );
}

/* ── Identity Verification section ──────────────────────────── */
function IdentityVerificationSection() {
  const { user } = useAuth();
  const meta = user?.user_metadata ?? {};

  const [docType,        setDocType]        = useState<DocType>((meta.doc_type as DocType) || 'id');
  const [idNumber,       setIdNumber]       = useState<string>(meta.id_number || '');
  const [passportNumber, setPassportNumber] = useState<string>(meta.passport_number || '');
  const [passportFront,  setPassportFront]  = useState<File | null>(null);
  const [passportBack,   setPassportBack]   = useState<File | null>(null);

  const [idVerifyState,       setIdVerifyState]       = useState<VerifyState>(meta.doc_verified && docType === 'id' ? 'verified' : 'idle');
  const [idVerifyMsg,         setIdVerifyMsg]         = useState<string>(meta.doc_verified && docType === 'id' ? 'Identity verified with Home Affairs records.' : '');
  const [passportVerifyState, setPassportVerifyState] = useState<VerifyState>(meta.doc_verified && docType === 'passport' ? 'verified' : 'idle');
  const [passportVerifyMsg,   setPassportVerifyMsg]   = useState<string>(meta.doc_verified && docType === 'passport' ? 'Passport documents verified.' : '');
  const [verifyLoading,       setVerifyLoading]       = useState(false);

  const switchDocType = (t: DocType) => {
    setDocType(t);
    setIdVerifyState('idle');       setIdVerifyMsg('');
    setPassportVerifyState('idle'); setPassportVerifyMsg('');
    setPassportFront(null); setPassportBack(null);
  };

  const handleIdChange = (val: string) => {
    setIdNumber(val.replace(/\D/g, ''));
    setIdVerifyState('idle'); setIdVerifyMsg('');
  };
  const handlePassportNumChange = (val: string) => {
    setPassportNumber(val.toUpperCase());
    setPassportVerifyState('idle'); setPassportVerifyMsg('');
  };
  const clearFront = () => { setPassportFront(null); setPassportVerifyState('idle'); setPassportVerifyMsg(''); };
  const clearBack  = () => { setPassportBack(null);  setPassportVerifyState('idle'); setPassportVerifyMsg(''); };

  /* Persist verification result to user metadata AND educators table */
  const saveVerifiedMeta = async (docTypeVal: DocType, docNumber: string, verified: boolean) => {
    await supabase.auth.updateUser({
      data: {
        doc_type: docTypeVal,
        doc_verified: verified,
        ...(docTypeVal === 'id' ? { id_number: docNumber } : { passport_number: docNumber }),
      },
    });
    if (user?.id) {
      await supabase
        .from('educators')
        .update({ is_sace_verified: verified })
        .eq('user_id', user.id);
    }
  };

  /* ── Verify SA ID ─────────────────────────────────────────── */
  const handleVerifyId = async () => {
    const local = validateSAIdFormat(idNumber);
    if (!local.valid) {
      setIdVerifyState('error'); setIdVerifyMsg(local.message);
      toast.error(local.message); return;
    }
    setVerifyLoading(true);
    try {
      const res  = await fetch('/.netlify/functions/verify-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idNumber, documentType: 'sa_id' }),
      });
      let data: { verified?: boolean; message?: string } = {};
      try { data = await res.json(); } catch { /* ignore */ }

      if (data.verified) {
        setIdVerifyState('verified');
        setIdVerifyMsg(data.message || 'Identity verified with Home Affairs records.');
        toast.success('SA ID verified successfully.');
        await saveVerifiedMeta('id', idNumber, true);
      } else {
        setIdVerifyState('unverified');
        setIdVerifyMsg((data.message || 'ID could not be confirmed.') + ' You may try again later.');
        toast.warning(data.message || 'ID verification inconclusive.');
        await saveVerifiedMeta('id', idNumber, false);
      }
    } catch {
      setIdVerifyState('unverified');
      setIdVerifyMsg('Verification service unreachable. Try again later.');
      toast.warning('Verification service unreachable.');
    } finally {
      setVerifyLoading(false);
    }
  };

  /* ── Verify Passport ──────────────────────────────────────── */
  const handleVerifyPassport = async () => {
    if (!passportNumber.trim()) { toast.error('Please enter your passport number.'); return; }
    if (!passportFront || !passportBack) { toast.error('Please upload both passport photos.'); return; }
    setVerifyLoading(true);
    try {
      const [frontBase64, backBase64] = await Promise.all([fileToBase64(passportFront), fileToBase64(passportBack)]);
      const res  = await fetch('/.netlify/functions/verify-passport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportNumber, frontBase64, frontType: passportFront.type, backBase64, backType: passportBack.type }),
      });
      let data: { verified?: boolean; message?: string } = {};
      try { data = await res.json(); } catch { /* ignore */ }

      if (data.verified) {
        setPassportVerifyState('verified');
        setPassportVerifyMsg(data.message || 'Passport verified successfully.');
        toast.success('Passport verified successfully.');
        await saveVerifiedMeta('passport', passportNumber, true);
        // Upload images to Supabase storage after successful verification
        if (user) {
          const uploads = [
            supabase.storage.from('documents').upload(`${user.id}/passport-front.${passportFront.name.split('.').pop()}`, passportFront, { upsert: true }),
            supabase.storage.from('documents').upload(`${user.id}/passport-back.${passportBack.name.split('.').pop()}`, passportBack, { upsert: true }),
          ];
          const results = await Promise.all(uploads);
          if (results.some(r => r.error)) toast.warning('Images saved locally but upload to storage failed.');
        }
      } else {
        setPassportVerifyState('unverified');
        setPassportVerifyMsg((data.message || 'Passport could not be confirmed.') + ' Try again later.');
        toast.warning(data.message || 'Passport verification inconclusive.');
        await saveVerifiedMeta('passport', passportNumber, false);
      }
    } catch {
      setPassportVerifyState('unverified');
      setPassportVerifyMsg('Verification service unreachable. Try again later.');
      toast.warning('Verification service unreachable.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const idBtnDone       = idVerifyState       === 'verified' || idVerifyState       === 'unverified';
  const passportBtnDone = passportVerifyState === 'verified' || passportVerifyState === 'unverified';

  return (
    <SectionCard label="Identity Verification">
      {/* Current status banner */}
      {meta.doc_verified && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2.5">
          <ShieldVerified className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Identity verified · {meta.doc_type === 'id' ? 'SA ID' : 'Passport'}
          </p>
        </div>
      )}

      {/* Doc type toggle */}
      <div className="grid grid-cols-2 bg-muted rounded-xl p-1 gap-1">
        <button type="button" onClick={() => switchDocType('id')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${docType === 'id' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
          <CreditCard className="w-4 h-4" /> SA ID
        </button>
        <button type="button" onClick={() => switchDocType('passport')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${docType === 'passport' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
          <BookOpen className="w-4 h-4" /> Passport
        </button>
      </div>

      {/* ── SA ID ── */}
      {docType === 'id' && (
        <div className="space-y-2">
          <Field label="SA ID Number">
            <Input
              value={idNumber}
              onChange={e => handleIdChange(e.target.value)}
              placeholder="8001015009087"
              className={`rounded-xl font-mono tracking-wider
                ${idVerifyState === 'verified'   ? 'border-green-500 focus-visible:ring-green-500' : ''}
                ${idVerifyState === 'unverified' ? 'border-amber-500 focus-visible:ring-amber-500' : ''}
                ${idVerifyState === 'error'      ? 'border-red-500   focus-visible:ring-red-500'   : ''}`}
              inputMode="numeric" maxLength={13}
            />
            <p className="text-xs text-muted-foreground pl-1">13-digit South African ID number</p>
          </Field>
          <VerifyBadge state={idVerifyState} message={idVerifyMsg} />
          <Button
            type="button"
            variant={idBtnDone ? 'outline' : 'default'}
            onClick={handleVerifyId}
            disabled={idNumber.length !== 13 || verifyLoading || idBtnDone}
            className={`w-full h-10 rounded-xl gap-2 font-medium
              ${idVerifyState === 'verified'   ? 'border-green-500 text-green-700 dark:text-green-400' : ''}
              ${idVerifyState === 'unverified' ? 'border-amber-500 text-amber-700 dark:text-amber-400' : ''}`}
          >
            {verifyLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : idVerifyState === 'verified'   ? <><CheckCircle2 className="w-4 h-4" /> ID Verified</>
              : idVerifyState === 'unverified' ? <><AlertCircle  className="w-4 h-4" /> Verification Inconclusive</>
              :                                  <><ShieldCheck  className="w-4 h-4" /> Verify ID Number (Optional)</>}
          </Button>
          {idBtnDone && (
            <button type="button" onClick={() => { setIdVerifyState('idle'); setIdVerifyMsg(''); }}
              className="w-full text-xs text-muted-foreground underline text-center">
              Try again with a different number
            </button>
          )}
        </div>
      )}

      {/* ── Passport ── */}
      {docType === 'passport' && (
        <div className="space-y-3">
          <Field label="Passport Number">
            <Input
              value={passportNumber}
              onChange={e => handlePassportNumChange(e.target.value)}
              placeholder="A12345678"
              className={`rounded-xl font-mono tracking-wider
                ${passportVerifyState === 'verified'   ? 'border-green-500 focus-visible:ring-green-500' : ''}
                ${passportVerifyState === 'unverified' ? 'border-amber-500 focus-visible:ring-amber-500' : ''}
                ${passportVerifyState === 'error'      ? 'border-red-500   focus-visible:ring-red-500'   : ''}`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <ImageUploadTile label="Passport — Front" file={passportFront}
              onChange={f => { setPassportFront(f); setPassportVerifyState('idle'); setPassportVerifyMsg(''); }}
              onClear={clearFront} />
            <ImageUploadTile label="Passport — Back" file={passportBack}
              onChange={f => { setPassportBack(f); setPassportVerifyState('idle'); setPassportVerifyMsg(''); }}
              onClear={clearBack} />
          </div>
          <p className="text-xs text-muted-foreground pl-1">Upload clear photos of both sides of your passport.</p>
          <VerifyBadge state={passportVerifyState} message={passportVerifyMsg} />
          <Button
            type="button"
            variant={passportBtnDone ? 'outline' : 'default'}
            onClick={handleVerifyPassport}
            disabled={verifyLoading || passportBtnDone}
            className={`w-full h-10 rounded-xl gap-2 font-medium
              ${passportVerifyState === 'verified'   ? 'border-green-500 text-green-700 dark:text-green-400' : ''}
              ${passportVerifyState === 'unverified' ? 'border-amber-500 text-amber-700 dark:text-amber-400' : ''}`}
          >
            {verifyLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : passportVerifyState === 'verified'   ? <><CheckCircle2 className="w-4 h-4" /> Passport Verified</>
              : passportVerifyState === 'unverified' ? <><AlertCircle  className="w-4 h-4" /> Verification Inconclusive</>
              :                                        <><ShieldCheck  className="w-4 h-4" /> Verify Passport Documents (Optional)</>}
          </Button>
          {passportBtnDone && (
            <button type="button" onClick={() => { setPassportVerifyState('idle'); setPassportVerifyMsg(''); setPassportFront(null); setPassportBack(null); }}
              className="w-full text-xs text-muted-foreground underline text-center">
              Try again with different documents
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/* ── Main ProfilePage ────────────────────────────────────────── */
export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({
    full_name: '', email: '', phone: '', gender: '', bio: '', sace_number: '',
    current_school: '', current_province: '', town: '',
    phase: '', subjects: [], preferred_provinces: [], preferred_districts: [],
    available_from: '', is_actively_looking: false, years_experience: '', avatar_url: '',
  });
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [avatarSheet, setAvatarSheet] = useState(false);

  const [subjectToAdd,  setSubjectToAdd]  = useState('');
  const [provinceToAdd, setProvinceToAdd] = useState('');

  // Current-position district: track when "Other" is selected
  const [townOther,     setTownOther]     = useState(false);
  const [customTownText, setCustomTownText] = useState('');

  // Preferred districts picker state (simplified – single dropdown with all districts)
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districtOther,    setDistrictOther]    = useState(false);
  const [customDistrict,   setCustomDistrict]   = useState('');

  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('educators').select('*').eq('user_id', user.id).maybeSingle();
    if (error) { toast.error('Failed to load profile'); }
    else if (data) {
      const savedTown = data.town ?? '';
      const provinceDistricts = data.current_province ? (DISTRICTS_BY_PROVINCE[data.current_province] ?? []) : [];
      const townIsCustom = savedTown !== '' && !provinceDistricts.includes(savedTown);
      if (townIsCustom) { setTownOther(true); setCustomTownText(savedTown); }
      setProfile({
        ...data,
        email:                data.email               ?? user?.email ?? '',
        phone:                data.phone               ?? '',
        gender:               data.gender              ?? '',
        years_experience:     String(data.years_experience ?? ''),
        subjects:             data.subjects             ?? [],
        preferred_provinces:  data.preferred_provinces  ?? [],
        preferred_districts:  data.preferred_districts  ?? [],
        available_from:       data.available_from       ?? '',
        avatar_url:           data.avatar_url           ?? '',
        town:                 townIsCustom ? '__other__' : savedTown,
      });
    } else {
      setProfile(p => ({ ...p, email: user?.email ?? '' }));
    }
    setLoading(false);
  };

  useEffect(() => { loadProfile(); }, [user]);

  const set = (field: keyof Profile, value: unknown) => setProfile(p => ({ ...p, [field]: value }));

  const handleRefresh = async () => { setRefreshing(true); await loadProfile(); setRefreshing(false); };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    // Reset the input so the same file can be re-selected if needed
    e.target.value = '';
    setUploading(true);
    try {
      // Derive extension from MIME type (camera files often have no extension)
      const mimeExt: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
        'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic',
      };
      const ext = mimeExt[file.type] ?? file.name.split('.').pop() ?? 'jpg';
      // Path must start with user.id/ so Supabase RLS policy (foldername[1] = auth.uid) passes
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
      } else {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        set('avatar_url', urlData.publicUrl);
        toast.success('Profile photo updated!');
      }
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const addSubject  = () => { if (subjectToAdd  && !profile.subjects.includes(subjectToAdd))            set('subjects',            [...profile.subjects, subjectToAdd]);           setSubjectToAdd('');  };
  const addProvince = () => { if (provinceToAdd && !profile.preferred_provinces.includes(provinceToAdd)) set('preferred_provinces', [...profile.preferred_provinces, provinceToAdd]); setProvinceToAdd(''); };
  const removeSubject  = (s: string) => set('subjects',            profile.subjects.filter(x => x !== s));
  const removeProvince = (p: string) => set('preferred_provinces', profile.preferred_provinces.filter(x => x !== p));

  const addDistrict = () => {
    const val = districtOther ? customDistrict.trim() : selectedDistrict;
    if (val && !profile.preferred_districts.includes(val)) {
      set('preferred_districts', [...profile.preferred_districts, val]);
    }
    setSelectedDistrict('');
    setDistrictOther(false);
    setCustomDistrict('');
  };
  const removeDistrict = (d: string) => set('preferred_districts', profile.preferred_districts.filter(x => x !== d));

  const handleTownSelect = (v: string) => {
    if (v === '__other__') { setTownOther(true); set('town', '__other__'); }
    else                   { setTownOther(false); setCustomTownText(''); set('town', v); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { id: _id, is_sace_verified: _sv, ...rest } = profile;
      const yearsExp = profile.years_experience ? parseInt(profile.years_experience, 10) : null;
      // Resolve the __other__ sentinel before saving
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
        if (data) set('id', data.id);
      }
      toast.success('Profile saved!');
    } catch (e: unknown) {
      toast.error((e as { message?: string }).message ?? 'Failed to save profile');
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
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

      {/* Hidden file inputs */}
      <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAvatarUpload} />
      <input ref={galleryInputRef} type="file" accept="image/*"                       className="hidden" onChange={handleAvatarUpload} />

      {/* Avatar */}
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
      </div>

      {/* Avatar action sheet */}
      {avatarSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setAvatarSheet(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-card rounded-t-2xl px-4 pt-4 pb-8 space-y-2 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
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
        {/* Actively Looking */}
        <div className="bg-card rounded-2xl border border-border flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Actively Looking</p>
            <p className="text-xs text-muted-foreground">Appear first in search results</p>
          </div>
          <Switch checked={profile.is_actively_looking} onCheckedChange={v => set('is_actively_looking', v)} />
        </div>

        {/* Personal Information */}
        <SectionCard label="Personal Information">
          <Field label="Full Name">
            <Input value={profile.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Your full name" className="rounded-xl" />
          </Field>
          <Field label="Email Address">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input type="email" value={profile.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" className="rounded-xl pl-9" />
            </div>
          </Field>
          <Field label="Phone Number">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input type="tel" value={profile.phone} onChange={e => set('phone', e.target.value)} placeholder="+27 71 000 0000" className="rounded-xl pl-9" />
            </div>
          </Field>
          <Field label="Gender">
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
              <Select value={profile.gender} onValueChange={v => set('gender', v)}>
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
          <Field label="SACE Number">
            <Input value={profile.sace_number} onChange={e => set('sace_number', e.target.value)} placeholder="e.g. 123456" className="rounded-xl" />
          </Field>
          <Field label="Bio">
            <Textarea value={profile.bio} onChange={e => set('bio', e.target.value)} placeholder="Tell others about yourself..." rows={3} className="rounded-xl resize-none" />
          </Field>
        </SectionCard>

        {/* Identity Verification */}
        <IdentityVerificationSection />

        {/* Current Position */}
        <SectionCard label="Current Position">
          <Field label="Province">
            <Select value={profile.current_province} onValueChange={v => set('current_province', v)}>
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
                  <SelectContent>
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
            <Input value={profile.current_school} onChange={e => set('current_school', e.target.value)} placeholder="e.g. Pretoria High School" className="rounded-xl" />
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
            <Input type="number" value={profile.years_experience} onChange={e => set('years_experience', e.target.value)} placeholder="e.g. 5" className="rounded-xl" />
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
                <SelectContent>{SUBJECTS.filter(s => !profile.subjects.includes(s)).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" size="icon" variant="outline" onClick={addSubject} className="rounded-xl shrink-0 h-10 w-10"><Plus className="w-4 h-4" /></Button>
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
            <Input type="date" value={profile.available_from} onChange={e => set('available_from', e.target.value)} className="rounded-xl" />
          </Field>
        </SectionCard>
      </div>

      {/* Save button */}
      <div className="px-4 pt-2 pb-6">
        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl text-base font-semibold gap-2">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Profile</>}
        </Button>
      </div>
    </div>
  );
}
