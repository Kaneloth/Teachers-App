import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelect from '@/components/ui/SearchableSelect';
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
  GraduationCap, User, Lock, MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import BlockButton from '@/components/BlockButton';
import { isBlocked } from '@/lib/blockUtils';
import { geocodeLocation } from '@/lib/geocode';

const PROVINCES = ['Gauteng','KwaZulu-Natal','Western Cape','Eastern Cape','Mpumalanga','Limpopo','North West','Free State','Northern Cape'];
const PHASES    = ['Foundation','Intermediate','Senior','FET'];

// Town list per province — used for the Current Position "Town" dropdown.
// Source: Skootlink onboarding (SA_PROVINCE_CITIES). An "Other" option is
// always appended so users in towns not listed here can type their own.
const DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
  'Eastern Cape':  ['Alfred Nzo East','Alfred Nzo West','Amatole East','Amatole West','Buffalo City','Chris Hani East','Chris Hani West','Joe Gqabi','Nelson Mandela Bay','OR Tambo Coastal','OR Tambo Inland','Sarah Baartman','Other'],
  'Free State':    ['Fezile Dabi','Lejweleputswa','Motheo','Thabo Mofutsanyana','Xhariep','Other'],
  'Gauteng':       ['Ekurhuleni North','Ekurhuleni South','Gauteng North','Gauteng West','Johannesburg Central','Johannesburg East','Johannesburg North','Johannesburg South','Sedibeng East','Sedibeng West','Tshwane North','Tshwane South','Tshwane West','Other'],
  'KwaZulu-Natal': ['Amajuba','Harry Gwala','Ilembe','King Cetshwayo','Pinetown','Ugu','Umgungundlovu','Umkhanyakude','Umzinyathi','Uthukela','Uthungulu','Zululand','Other'],
  'Limpopo':       ['Capricorn North','Capricorn South','Mopani East','Mopani West','Sekhukhune East','Sekhukhune South','Vhembe East','Vhembe West','Waterberg','Mogalakwena','Other'],
  'Mpumalanga':    ['Bohlabela','Ehlanzeni','Gert Sibande','Nkangala','Other'],
  'North West':    ['Bojanala','Dr Kenneth Kaunda','Dr Ruth Segomotsi Mompati','Ngaka Modiri Molema','Other'],
  'Northern Cape': ['Frances Baard','John Taolo Gaetsewe','Namakwa','Pixley-ka-Seme','ZF Mgcawu','Other'],
  'Western Cape':  ['Metro Central','Metro East','Metro North','Metro South','Cape Winelands','Eden and Central Karoo','Overberg','West Coast','Other'],
};

// Towns grouped by district — both dropdowns together eliminate spelling errors
const TOWNS_BY_DISTRICT: Record<string, string[]> = {
  'Alfred Nzo East': ['Bizana','Flagstaff','Other'],'Alfred Nzo West': ['Mount Frere','Matatiele','Maluti','Other'],
  'Amatole East': ['Butterworth','Idutywa','Ngqamakhwe','Other'],'Amatole West': ['East London','King Williams Town','Stutterheim','Komani','Other'],
  'Buffalo City': ['East London','Mdantsane','Bhisho','Other'],'Chris Hani East': ['Queenstown','Komani','Cofimvaba','Other'],'Chris Hani West': ['Cradock','Middelburg EC','Tarkastad','Other'],
  'Joe Gqabi': ['Aliwal North','Sterkstroom','Burgersdorp','Other'],'Nelson Mandela Bay': ['Port Elizabeth','Uitenhage','Kariega','Other'],
  'OR Tambo Coastal': ['Port St Johns','Lusikisiki','Ingquza','Other'],'OR Tambo Inland': ['Mthatha','Qumbu','Tsolo','Other'],'Sarah Baartman': ['Grahamstown','Port Alfred','Humansdorp','Jeffreys Bay','Other'],
  'Fezile Dabi': ['Sasolburg','Parys','Viljoenskroon','Other'],'Lejweleputswa': ['Welkom','Odendaalsrus','Virginia','Other'],
  'Motheo': ['Bloemfontein','Botshabelo','Thaba Nchu','Other'],'Thabo Mofutsanyana': ['Phuthaditjhaba','Harrismith','Bethlehem','Other'],'Xhariep': ['Springfontein','Trompsburg','Philippolis','Other'],
  'Ekurhuleni North': ['Tembisa','Kempton Park','Edenvale','Other'],'Ekurhuleni South': ['Alberton','Germiston','Boksburg','Other'],
  'Gauteng North': ['Pretoria North','Soshanguve','Mabopane','Other'],'Gauteng West': ['Krugersdorp','Randfontein','Westonaria','Other'],
  'Johannesburg Central': ['Johannesburg CBD','Soweto','Orlando','Other'],'Johannesburg East': ['Bedfordview','Edenvale','Katlehong','Other'],
  'Johannesburg North': ['Sandton','Randburg','Midrand','Other'],'Johannesburg South': ['Lenasia','Ennerdale','Orange Farm','Other'],
  'Sedibeng East': ['Vereeniging','Vanderbijlpark','Sebokeng','Other'],'Sedibeng West': ['Heidelberg GP','Balfour','Other'],
  'Tshwane North': ['Pretoria North','Soshanguve','Hammanskraal','Other'],'Tshwane South': ['Centurion','Pretoria East','Other'],'Tshwane West': ['Atteridgeville','Ga-Rankuwa','Other'],
  'Amajuba': ['Newcastle','Utrecht','Dannhauser','Other'],'Harry Gwala': ['Ixopo','Kokstad','Umzimkulu','Other'],
  'Ilembe': ['KwaDukuza','Stanger','Mandeni','Other'],'King Cetshwayo': ['Richards Bay','Empangeni','Nkandla','Other'],
  'Pinetown': ['Pinetown','Westville','Kloof','Other'],'Ugu': ['Port Shepstone','Margate','Hibiscus Coast','Other'],
  'Umgungundlovu': ['Pietermaritzburg','Howick','Camperdown','Other'],'Umkhanyakude': ['Jozini','Hluhluwe','Mkuze','Other'],
  'Umzinyathi': ['Dundee','Greytown','Nqutu','Other'],'Uthukela': ['Ladysmith','Estcourt','Bergville','Other'],
  'Uthungulu': ['Richards Bay','Empangeni','Mthunzini','Other'],'Zululand': ['Ulundi','Vryheid','Nongoma','Other'],
  'Capricorn North': ['Bela-Bela','Mokopane','Other'],'Capricorn South': ['Polokwane','Seshego','Other'],
  'Mopani East': ['Tzaneen','Letsitele','Other'],'Mopani West': ['Phalaborwa','Giyani','Other'],
  'Sekhukhune East': ['Marble Hall','Groblersdal','Other'],'Sekhukhune South': ['Burgersfort','Jane Furse','Other'],
  'Vhembe East': ['Thohoyandou','Malamulele','Other'],'Vhembe West': ['Louis Trichardt','Musina','Other'],
  'Waterberg': ['Mokopane','Lephalale','Thabazimbi','Other'],'Mogalakwena': ['Mokopane','Mahwelereng','Other'],
  'Bohlabela': ['Bushbuckridge','Acornhoek','Other'],'Ehlanzeni': ['Mbombela','White River','Hazyview','Other'],
  'Gert Sibande': ['Ermelo','Secunda','Standerton','Other'],'Nkangala': ['Witbank','Middelburg MP','Bronkhorstspruit','Other'],
  'Bojanala': ['Rustenburg','Brits','Phokeng','Other'],'Dr Kenneth Kaunda': ['Klerksdorp','Orkney','Stilfontein','Other'],
  'Dr Ruth Segomotsi Mompati': ['Vryburg','Schweizer-Reneke','Other'],'Ngaka Modiri Molema': ['Mafikeng','Zeerust','Lichtenburg','Other'],
  'Frances Baard': ['Kimberley','Barkly West','Other'],'John Taolo Gaetsewe': ['Kuruman','Kathu','Other'],
  'Namakwa': ['Springbok','Calvinia','Other'],'Pixley-ka-Seme': ['De Aar','Prieska','Victoria West','Other'],'ZF Mgcawu': ['Upington','Kakamas','Other'],
  'Metro Central': ['Cape Town CBD','Bellville','Parow','Other'],'Metro East': ['Mitchells Plain','Khayelitsha','Strand','Other'],
  'Metro North': ['Durbanville','Kraaifontein','Brackenfell','Other'],'Metro South': ['Wynberg','Retreat','Muizenberg','Other'],
  'Cape Winelands': ['Stellenbosch','Paarl','Worcester','Franschhoek','Other'],
  'Eden and Central Karoo': ['George','Mossel Bay','Knysna','Oudtshoorn','Other'],
  'Overberg': ['Hermanus','Bredasdorp','Swellendam','Other'],'West Coast': ['Moorreesburg','Malmesbury','Vredenburg','Other'],
};

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
  district: string;
  town: string;
  phase: string;
  subjects: string[];
  preferred_provinces: string[];
  preferred_districts: string[];
  available_from: string;
  is_actively_looking: boolean;
  is_hidden: boolean;
  is_sace_verified?: boolean;
  years_experience: string;
  avatar_url: string;
  profile_type: 'educator' | 'general';
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

/* ── Identity verification helpers (unchanged) ──────────────────────────── */
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

  const saveVerifiedMeta = async (docTypeVal: DocType, docNumber: string, verified: boolean) => {
    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        doc_type: docTypeVal,
        doc_verified: verified,
        ...(docTypeVal === 'id' ? { id_number: docNumber } : { passport_number: docNumber }),
      },
    });
    if (metaError) {
      console.error('[saveVerifiedMeta] auth.updateUser failed:', metaError.message);
      toast.error('Could not save verification status. Please try again.');
      return;
    }
    if (user?.id) {
      const { error: dbError } = await supabase
        .from('educators')
        .upsert({ user_id: user.id, is_sace_verified: verified }, { onConflict: 'user_id' });
      if (dbError) {
        console.error('[saveVerifiedMeta] educators upsert failed:', dbError.message);
        toast.error('Verification saved to account but profile badge could not be updated: ' + dbError.message);
      }
    }
  };

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
        if (user) {
          const uploads = [
            supabase.storage.from('documents').upload(`${user.id}/passport-front.${passportFront.name.split('.').pop()}`, passportFront, { upsert: true }),
            supabase.storage.from('documents').upload(`${user.id}/passport-back.${passportBack.name.split('.').pop()}`, passportBack, { upsert: true }),
          ];
          await Promise.all(uploads);
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
      {meta.doc_verified && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2.5">
          <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Identity verified · {meta.doc_type === 'id' ? 'SA ID' : 'Passport'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 bg-muted rounded-xl p-1 gap-1">
        <button type="button" onClick={() => !meta.doc_verified && switchDocType('id')}
          disabled={!!meta.doc_verified}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${docType === 'id' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'} ${meta.doc_verified ? 'cursor-not-allowed opacity-60' : ''}`}>
          <CreditCard className="w-4 h-4" /> SA ID
        </button>
        <button type="button" onClick={() => !meta.doc_verified && switchDocType('passport')}
          disabled={!!meta.doc_verified}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${docType === 'passport' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'} ${meta.doc_verified ? 'cursor-not-allowed opacity-60' : ''}`}>
          <BookOpen className="w-4 h-4" /> Passport
        </button>
      </div>

      {docType === 'id' && (
        <div className="space-y-2">
          <Field label="SA ID Number">
            <Input
              value={idNumber}
              onChange={e => !meta.doc_verified && handleIdChange(e.target.value)}
              readOnly={!!meta.doc_verified}
              placeholder="8001015009087"
              className="rounded-xl font-mono tracking-wider"
            />
            <p className="text-xs text-muted-foreground pl-1">
              {meta.doc_verified ? 'ID number is locked after verification.' : '13-digit South African ID number'}
            </p>
          </Field>
          <VerifyBadge state={idVerifyState} message={idVerifyMsg} />
          <Button
            type="button"
            variant={idBtnDone ? 'outline' : 'default'}
            onClick={handleVerifyId}
            disabled={idNumber.length !== 13 || verifyLoading || idBtnDone}
            className="w-full h-10 rounded-xl gap-2 font-medium"
          >
            {verifyLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : idVerifyState === 'verified'   ? <><CheckCircle2 className="w-4 h-4" /> ID Verified</>
              : idVerifyState === 'unverified' ? <><AlertCircle  className="w-4 h-4" /> Verification Inconclusive</>
              :                                  <><ShieldCheck  className="w-4 h-4" /> Verify ID Number (Optional)</>}
          </Button>
          {idBtnDone && !meta.doc_verified && (
            <button type="button" onClick={() => { setIdVerifyState('idle'); setIdVerifyMsg(''); }}
              className="w-full text-xs text-muted-foreground underline text-center">
              Try again with a different number
            </button>
          )}
        </div>
      )}

      {docType === 'passport' && (
        <div className="space-y-3">
          <Field label="Passport Number">
            <Input
              value={passportNumber}
              onChange={e => !meta.doc_verified && handlePassportNumChange(e.target.value)}
              readOnly={!!meta.doc_verified}
              placeholder="A12345678"
              className="rounded-xl font-mono tracking-wider"
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
            className="w-full h-10 rounded-xl gap-2 font-medium"
          >
            {verifyLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : passportVerifyState === 'verified'   ? <><CheckCircle2 className="w-4 h-4" /> Passport Verified</>
              : passportVerifyState === 'unverified' ? <><AlertCircle  className="w-4 h-4" /> Verification Inconclusive</>
              :                                        <><ShieldCheck  className="w-4 h-4" /> Verify Passport Documents (Optional)</>}
          </Button>
          {passportBtnDone && !meta.doc_verified && (
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
  const { userId: routeUserId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwnProfile = !routeUserId || routeUserId === user?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [blockCheckDone, setBlockCheckDone] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarSheet, setAvatarSheet] = useState(false);
  const [userCode, setUserCode] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [provinceToAdd, setProvinceToAdd] = useState('');

  // ── Current town: dropdown (filtered by province) + "Other" free text ─────

  const [townGeocoding, setTownGeocoding] = useState(false);
  const [townCoords, setTownCoords] = useState<{ latitude: number; longitude: number; displayName: string } | null>(null);
  const [townGeocodeTarget, setTownGeocodeTarget] = useState('');
  const lastGeocodedTownRef = useRef('');

  // ── Preferred town input (Transfer Preferences) ────────────────────────────
  const [prefTownInput, setPrefTownInput] = useState('');
  const [prefTownGeocoding, setPrefTownGeocoding] = useState(false);
  const [prefTownCoords, setPrefTownCoords] = useState<{ latitude: number; longitude: number; displayName: string } | null>(null);
  const [prefTownGeocodeTarget, setPrefTownGeocodeTarget] = useState('');
  const lastGeocodedPrefTownRef = useRef('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    if (!user) return;
    const targetId = routeUserId || user.id;

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
        district: '',
        town: '',
        phase: '',
        subjects: [],
        preferred_provinces: [],
        preferred_districts: [],
        available_from: '',
        is_actively_looking: false,
        is_hidden: false,
        years_experience: '',
        avatar_url: '',
        profile_type: 'educator',
      });
      setLoading(false);
      return;
    }

    if (data) {
      const townValue = data.town ?? '';

      setProfile({
        ...data,
        district: data.district ?? '',
        town: townValue,
        years_experience: String(data.years_experience ?? ''),
      });

      if (isOwnProfile && townValue) {
        lastGeocodedTownRef.current = townValue;
        setTownGeocoding(true);
        geocodeLocation(townValue).then(coords => {
          setTownCoords(coords ?? null);
        }).finally(() => setTownGeocoding(false));
      }
    } else {
      setProfile(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user || !routeUserId || routeUserId === user.id) {
      setBlockCheckDone(true);
      return;
    }
    const check = async () => {
      const blockedStatus = await isBlocked(user.id, routeUserId);
      setBlocked(blockedStatus);
      setBlockCheckDone(true);
    };
    check();
  }, [user, routeUserId]);

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

  const setProfileField = (field: keyof Profile, value: unknown) => {
    if (profile) setProfile({ ...profile, [field]: value });
  };

  // Writes is_actively_looking immediately — independent of the 30-day
  // save cooldown. This is the only field that can be changed at any time.
  const handleToggleActive = async (value: boolean) => {
    if (!user || !profile) return;
    setTogglingActive(true);
    setProfileField('is_actively_looking', value); // optimistic UI update
    const { error } = await supabase
      .from('educators')
      .update({ is_actively_looking: value })
      .eq('user_id', user.id);
    if (error) {
      setProfileField('is_actively_looking', !value); // revert on error
      toast.error('Failed to update status. Please try again.');
    } else {
      toast.success(value
        ? 'You are now Actively Looking — other educators can message you.'
        : 'Actively Looking turned off — you will no longer receive new messages.'
      );
    }
    setTogglingActive(false);
  };

  // Hides/shows profile in general browse lists.
  // Hidden profiles still appear in filtered searches (province, subject, etc.)
  const handleToggleHidden = async (value: boolean) => {
    if (!user) return;
    setProfileField('is_hidden', value);
    const { error } = await supabase
      .from('educators')
      .update({ is_hidden: value })
      .eq('user_id', user.id);
    if (error) {
      setProfileField('is_hidden', !value);
      toast.error('Could not update visibility: ' + error.message);
    } else {
      toast.success(value
        ? "Profile hidden — you won't appear in general browse lists."
        : "Profile visible — you'll appear in browse and search results again.");
    }
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

  // Current province determines which towns are offered — reset the town
  // selection when it changes, since the previous town may not be in the
  // new province's list.
  const handleProvinceChange = (v: string) => {
    if (!profile) return;
    // Merge both changes into a single setProfile call — setProfileField
    // uses the stale `profile` closure, so two sequential calls here would
    // have the second overwrite the first (current_province would be lost).
    setProfile({ ...profile, current_province: v, district: '', town: '' });
    setTownCoords(null);
    setTownGeocodeTarget('');
    lastGeocodedTownRef.current = '';
  };

  const handleDistrictSelect = (v: string) => {
    setProfileField('district', v);
    setProfileField('town', ''); // reset town when district changes
    setTownCoords(null);
    setTownGeocodeTarget('');
    lastGeocodedTownRef.current = '';
  };

  const handleTownSelect = (v: string) => {
    setProfileField('town', v);
    if (v && v !== 'Other') {
      const target = `${v}, ${profile.district}, ${profile.current_province}, South Africa`;
      setTownGeocodeTarget(target);
    }
  };

  // ── Current town: geocode on blur/Enter (debounced — not every keystroke) ──
  useEffect(() => {
    const target = townGeocodeTarget.trim();
    if (target === lastGeocodedTownRef.current.trim()) return;

    if (target.length < 3) {
      lastGeocodedTownRef.current = target;
      setTownCoords(null);
      return;
    }

    let cancelled = false;
    setTownGeocoding(true);
    geocodeLocation(target).then(coords => {
      if (cancelled) return;
      lastGeocodedTownRef.current = target;
      setTownCoords(coords ?? null);
    }).finally(() => { if (!cancelled) setTownGeocoding(false); });

    return () => { cancelled = true; };
  }, [townGeocodeTarget]);

  // ── Preferred town input: geocode on blur/Enter ────────────────────────────
  useEffect(() => {
    const target = prefTownGeocodeTarget.trim();
    if (target === lastGeocodedPrefTownRef.current.trim()) return;

    if (target.length < 3) {
      lastGeocodedPrefTownRef.current = target;
      setPrefTownCoords(null);
      return;
    }

    let cancelled = false;
    setPrefTownGeocoding(true);
    geocodeLocation(target).then(coords => {
      if (cancelled) return;
      lastGeocodedPrefTownRef.current = target;
      setPrefTownCoords(coords ?? null);
    }).finally(() => { if (!cancelled) setPrefTownGeocoding(false); });

    return () => { cancelled = true; };
  }, [prefTownGeocodeTarget]);

  const addPreferredTown = () => {
    const val = prefTownInput.trim();
    if (val && profile && !profile.preferred_districts.includes(val)) {
      setProfileField('preferred_districts', [...profile.preferred_districts, val]);
    }
    setPrefTownInput('');
    setPrefTownCoords(null);
    setPrefTownGeocodeTarget('');
    lastGeocodedPrefTownRef.current = '';
  };
  const removePreferredTown = (d: string) => {
    if (profile) setProfileField('preferred_districts', profile.preferred_districts.filter(x => x !== d));
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
      const townText = rest.town.trim();
      const payload = {
        ...rest,
        town: townText,
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

      // Geocode the current town and persist coordinates for radius search.
      // Reuse the coords already resolved during editing if the text hasn't
      // changed since; otherwise geocode fresh at save time. Non-fatal if
      // geocoding fails — text-match search (town name) still works.
      if (townText) {
        try {
          const coords = (lastGeocodedTownRef.current === townText && townCoords)
            ? townCoords
            : await geocodeLocation(townText);
          if (coords) {
            const { error: geoErr } = await supabase.rpc('set_educator_geo_location', {
              p_user_id: user.id,
              p_lng:     coords.longitude,
              p_lat:     coords.latitude,
            });
            if (geoErr) console.error('[ProfilePage] set_educator_geo_location error:', geoErr);
          }
        } catch (geoErr) {
          console.error('[ProfilePage] geocode error:', geoErr);
        }
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

  if (loading || !blockCheckDone) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <User className="w-12 h-12 mb-3 opacity-40" />
        <p>User profile not found.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
      </div>
    );
  }

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

  // ID verification is restricted to Pro educators only.
  // - General users never need it (no educator-specific features)
  // - Free users cannot verify (Pro gate keeps the feature premium)
  const _metaPlan = user?.user_metadata?.subscription_plan as string | undefined;
  const _metaEnd  = user?.user_metadata?.subscription_end  as string | undefined;
  const isPro = !!(
    _metaPlan && _metaPlan !== 'free' &&
    _metaEnd  && new Date(_metaEnd) > new Date()
  );

  if (isOwnProfile) {
    return (
      <div className="max-w-2xl mx-auto pb-28">
        <div className="flex items-center gap-2 px-4 pt-4 pb-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <button onClick={handleRefresh} className="p-1 rounded-full hover:bg-muted transition-colors">
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <h1 className="text-lg font-bold text-foreground">My Profile</h1>
        </div>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAvatarUpload} />
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

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
          {/* Role switcher removed – users cannot change their role here */}

          {isEducator && (
            <div className={`rounded-2xl border-2 px-4 py-4 transition-all ${
              profile.is_actively_looking
                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
            }`}>
              {/* Header row */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  profile.is_actively_looking ? 'bg-green-100 dark:bg-green-800' : 'bg-amber-100 dark:bg-amber-800'
                }`}>
                  <Flame className={`w-5 h-5 ${profile.is_actively_looking ? 'text-green-600 dark:text-green-400' : 'text-amber-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${profile.is_actively_looking ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {profile.is_actively_looking ? 'Actively Looking — On' : 'Actively Looking — Off'}
                  </p>
                </div>
                <Switch checked={profile.is_actively_looking} onCheckedChange={handleToggleActive} disabled={togglingActive} />
              </div>
              {/* State-aware explanation */}
              {profile.is_actively_looking ? (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-green-800 dark:text-green-300">
                    ✅ Other educators can see you are open to a transfer and can send you messages.
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Turn this off if you are no longer looking or want to stop receiving messages.
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    ⚠️ You appear in search results but cannot be messaged.
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Turn this on to allow other educators to send you messages about transfer opportunities. You can turn it off at any time.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Profile visibility toggle — available to all profile types */}
          <div className={`rounded-2xl border-2 px-4 py-4 transition-all ${
            profile.is_hidden
              ? 'bg-slate-50 dark:bg-slate-900/20 border-slate-300 dark:border-slate-700'
              : 'bg-card border-border'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                profile.is_hidden ? 'bg-slate-100 dark:bg-slate-800' : 'bg-primary/10'
              }`}>
                <EyeOff className={`w-5 h-5 ${profile.is_hidden ? 'text-slate-500' : 'text-primary'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${profile.is_hidden ? 'text-slate-700 dark:text-slate-300' : 'text-foreground'}`}>
                  {profile.is_hidden ? 'Profile Hidden' : 'Profile Visible'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profile.is_hidden
                    ? "You won't appear in browse lists — but you still show in filtered searches."
                    : "You appear in search and browse results normally."}
                </p>
              </div>
              <Switch checked={!!profile.is_hidden} onCheckedChange={handleToggleHidden} />
            </div>
          </div>

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

          {isEducator && isPro && <IdentityVerificationSection />}

          {isEducator && (
            <SectionCard label="Current Position">
              <Field label="Province">
                <SearchableSelect
                  value={profile.current_province}
                  onValueChange={handleProvinceChange}
                  options={PROVINCES}
                  placeholder="Select province"
                  searchPlaceholder="Search province…"
                />
              </Field>
              <Field label="District">
                <SearchableSelect
                  value={profile.district}
                  onValueChange={handleDistrictSelect}
                  options={DISTRICTS_BY_PROVINCE[profile.current_province] ?? []}
                  placeholder={profile.current_province ? 'Select district' : 'Select province first'}
                  searchPlaceholder="Search district…"
                  disabled={!profile.current_province}
                />
              </Field>
              <Field label="Town / City">
                <SearchableSelect
                  value={profile.town}
                  onValueChange={handleTownSelect}
                  options={TOWNS_BY_DISTRICT[profile.district] ?? []}
                  placeholder={profile.district ? 'Select town' : 'Select district first'}
                  searchPlaceholder="Search town…"
                  disabled={!profile.district}
                />
                {townGeocoding ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Locating…
                  </p>
                ) : townCoords ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                    <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                    Located: {townCoords.displayName || profile.town}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1.5">Used for distance-based search and matching.</p>
                )}
              </Field>
              <Field label="School">
                <Input value={profile.current_school} onChange={e => setProfileField('current_school', e.target.value)} placeholder="e.g. Pretoria High School" className="rounded-xl" />
              </Field>
            </SectionCard>
          )}

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
                <SearchableSelect
                  value=""
                  onValueChange={v => {
                    if (v && !profile.subjects.includes(v))
                      setProfileField('subjects', [...profile.subjects, v]);
                  }}
                  options={SUBJECTS.filter(s => !profile.subjects.includes(s))}
                  placeholder="Add a subject…"
                  searchPlaceholder="Search subjects…"
                />
              </Field>
            </SectionCard>
          )}

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

              <Field label="Preferred Town(s)">
                {profile.preferred_districts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {profile.preferred_districts.map(d => (
                      <span key={d} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full pl-2.5 pr-1.5 py-0.5">
                        {d}
                        <button onClick={() => removePreferredTown(d)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={prefTownInput}
                      onChange={e => setPrefTownInput(e.target.value)}
                      onBlur={e => setPrefTownGeocodeTarget(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); setPrefTownGeocodeTarget(e.currentTarget.value); addPreferredTown(); }
                      }}
                      placeholder="e.g. Polokwane"
                      className="rounded-xl pl-9"
                    />
                  </div>
                  <Button type="button" size="icon" variant="outline" onClick={addPreferredTown}
                    disabled={!prefTownInput.trim()}
                    className="rounded-xl shrink-0 h-10 w-10"><Plus className="w-4 h-4" /></Button>
                </div>
                {prefTownGeocoding ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Looking up "{prefTownInput}"…
                  </p>
                ) : prefTownCoords ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                    <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                    Found: {prefTownCoords.displayName || `${prefTownCoords.latitude.toFixed(4)}°, ${prefTownCoords.longitude.toFixed(4)}°`}
                  </p>
                ) : prefTownInput.trim().length >= 3 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">Place not found — check the spelling.</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1.5">Add one or more towns you'd consider transferring to.</p>
                )}
              </Field>

              <Field label="Available From">
                <Input type="date" value={profile.available_from} onChange={e => setProfileField('available_from', e.target.value)} className="rounded-xl" />
              </Field>
            </SectionCard>
          )}
        </div>

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

  // Other user's profile (read-only + block button)
  return (
    <div className="max-w-2xl mx-auto pb-28">
      <div className="flex items-center gap-2 px-4 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">Educator Profile</h1>
        <BlockButton targetUserId={routeUserId!} onBlockChange={() => setBlocked(false)} />
      </div>

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
              <Field label="District"><p className="text-sm">{profile.district || '—'}</p></Field>
              <Field label="Town / City"><p className="text-sm">{profile.town || '—'}</p></Field>
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
              <Field label="Preferred Town(s)">
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