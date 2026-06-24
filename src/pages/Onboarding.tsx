import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, ChevronRight, ChevronLeft, GraduationCap, User, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

const PROVINCES = ['Gauteng','KwaZulu-Natal','Western Cape','Eastern Cape','Mpumalanga','Limpopo','North West','Free State','Northern Cape'];
const PHASES = ['Foundation','Intermediate','Senior','FET'];
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

type ProfileType = 'educator' | 'general';

/** Generates a unique Crosssa reference code: CR-DDDDLLL (4 digits + 3 uppercase letters) */
function generateUserCode(): string {
  const digits  = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const letters = Array.from({ length: 3 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  return `CR-${digits}${letters}`;
}

/* ── Educator steps ──────────────────────────────────────────── */
const EDU_STEPS = ['Personal', 'School', 'Teaching', 'Transfer'];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileType, setProfileType] = useState<ProfileType | null>(null);

  // If this user has explicitly completed onboarding before, skip straight
  // to /home. We deliberately do NOT check `user_code` here — a database
  // trigger (handle_new_user) sets user_code automatically for every new
  // signup (email AND Google), so checking it would redirect brand-new
  // users away before they ever see the role selector. `onboarding_completed`
  // is only ever set by this component, once the user has actually chosen
  // a role and either finished or skipped the detail form.
  useEffect(() => {
    if (user?.user_metadata?.onboarding_completed === true) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  /* Educator multi-step state */
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    full_name:           user?.user_metadata?.full_name || '',
    sace_number:         '',
    bio:                 '',
    current_school:      '',
    current_province:    '',
    district:            '',
    town:                '',
    phase:               '',
    subjects:            [] as string[],
    years_experience:    '',
    preferred_provinces: [] as string[],
    is_actively_looking: false,
  });

  /* General single-step state */
  const [genForm, setGenForm] = useState({
    full_name: user?.user_metadata?.full_name || '',
    bio:       '',
  });

  const set    = (field: string, value: unknown) => setForm(p => ({ ...p, [field]: value }));
  const setGen = (field: string, value: string)  => setGenForm(p => ({ ...p, [field]: value }));

  /* ── Skip for now ─────────────────────────────────────────────
     Even when skipping, every new user gets a user code and welcome
     email so they are properly registered in the system.          */
  // ── Skip remaining details (role must already be chosen) ────────────────
  // Even when skipping the detail form, we still persist a minimal
  // `educators` row recording the chosen profile_type, so the rest of
  // the app knows whether this user is an educator or general user.
  // Grant signup credits — called once per user after role is chosen.
  // Keeping this here (not in a webhook/trigger) ensures credits are only
  // granted to users who have actually completed onboarding and chosen a role.
  const grantSignupCredits = async (userId: string, email: string, profileType: 'educator' | 'general' = 'general') => {
    try {
      await fetch('/.netlify/functions/grant-signup-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          email,
          profile_type: profileType,
          device_fingerprint: navigator.userAgent + screen.width + screen.height,
        }),
      });
    } catch {
      // Non-fatal — user can still use the app without the bonus
      console.warn('[onboarding] signup credit grant failed silently');
    }
  };

  const handleSkip = async () => {
    if (!user || !profileType) { navigate('/home'); return; }

    // Ensure a minimal educators row exists recording the chosen profile_type
    const { data: existing } = await supabase
      .from('educators')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('educators').insert([{
        user_id:             user.id,
        full_name:           user.user_metadata?.full_name || '',
        profile_type:        profileType,
        is_actively_looking: false,
        preferred_provinces: [],
      }]);
    }

    // user_code may already exist (set automatically by a DB trigger on
    // signup) — only generate a new one if it's genuinely missing.
    const userCode = user.user_metadata?.user_code ?? generateUserCode();
    const isNewCode = !user.user_metadata?.user_code;

    // onboarding_completed is the flag this component actually relies on.
    await supabase.auth.updateUser({
      data: { user_code: userCode, onboarding_completed: true },
    });

    if (isNewCode) {
      supabase.functions
        .invoke('sendWelcomeEmail', {
          body: {
            email:        user.email ?? '',
            full_name:    user.user_metadata?.full_name || '',
            user_code:    userCode,
            profile_type: user.user_metadata?.profile_type ?? 'general',
          },
        })
        .catch(() => {});
    }

    // Send straight to the profile editor — skipping the detail form means
    // key fields (town, subjects, etc.) are still empty, which matters for
    // search/matching.
    // Grant signup credits now that role is confirmed
    grantSignupCredits(user.id, user.email ?? '', (user.user_metadata?.profile_type as 'educator' | 'general') ?? 'general').catch(() => {});

    toast('Add a few details to your profile to get better matches.');
    navigate('/profile');
  };

  const toggleSubject  = (s: string) => set('subjects',            form.subjects.includes(s)            ? form.subjects.filter(x => x !== s)            : [...form.subjects, s]);
  const toggleProvince = (p: string) => set('preferred_provinces', form.preferred_provinces.includes(p) ? form.preferred_provinces.filter(x => x !== p) : [...form.preferred_provinces, p]);

  /* ── Finish for general users ──────────────────────────────── */
  const handleFinishGeneral = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('educators').insert([{
        user_id:             user?.id,
        full_name:           genForm.full_name,
        bio:                 genForm.bio,
        profile_type:        'general',
        is_actively_looking: false,
        preferred_provinces: [],
      }]);
      if (error) throw error;

      const userCode  = user?.user_metadata?.user_code ?? generateUserCode();
      const isNewCode = !user?.user_metadata?.user_code;
      await supabase.auth.updateUser({ data: { user_code: userCode, onboarding_completed: true } });

      if (isNewCode) {
        supabase.functions
          .invoke('sendWelcomeEmail', { body: { email: user?.email ?? '', full_name: genForm.full_name || user?.user_metadata?.full_name || '', user_code: userCode, profile_type: 'general' } })
          .catch(() => {});
      }

      // Grant signup credits now that role is confirmed
      grantSignupCredits(user?.id ?? '', user?.email ?? '', 'general').catch(() => {});

      toast.success('Profile created! Welcome to Crosssa!');
      toast('Tip: add a profile photo and bio to help others recognize you.');
      navigate('/profile');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  /* ── Finish for educators ──────────────────────────────────── */
  const handleFinishEducator = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('educators').insert([{
        ...form,
        user_id:          user?.id,
        profile_type:     'educator',
        years_experience: form.years_experience ? parseInt(form.years_experience, 10) : null,
      }]);
      if (error) throw error;

      const userCode  = user?.user_metadata?.user_code ?? generateUserCode();
      const isNewCode = !user?.user_metadata?.user_code;
      await supabase.auth.updateUser({ data: { user_code: userCode, onboarding_completed: true } });

      if (isNewCode) {
        supabase.functions
          .invoke('sendWelcomeEmail', { body: { email: user?.email ?? '', full_name: form.full_name || user?.user_metadata?.full_name || '', user_code: userCode, profile_type: 'educator' } })
          .catch(() => {});
      }

      // Grant signup credits now that role is confirmed
      grantSignupCredits(user?.id ?? '', user?.email ?? '', 'educator').catch(() => {});

      toast.success('Profile created! Welcome to Crosssa!');
      toast('Add your current town to improve your search results and matches.');
      navigate('/profile');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  /* ── Type selector screen ──────────────────────────────────── */
  if (!profileType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground">Welcome to Crosssa</h1>
            <p className="text-sm text-muted-foreground mt-1">How would you like to use the app?</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setProfileType('educator')}
              className="w-full flex items-start gap-4 bg-card rounded-2xl border-2 border-border px-4 py-4 hover:border-primary hover:shadow-sm transition-all text-left group"
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">I'm an Educator</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Set up a full educator profile — appear in search results, get matched with transfer partners, and build teacher CVs.
                </p>
              </div>
            </button>

            <button
              onClick={() => setProfileType('general')}
              className="w-full flex items-start gap-4 bg-card rounded-2xl border-2 border-border px-4 py-4 hover:border-primary hover:shadow-sm transition-all text-left group"
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">General User</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Access app resources like the CV builder without educator-specific features. You won't appear in search or match results.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── General user: single-step setup ──────────────────────── */
  if (profileType === 'general') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground">Set Up Your Profile</h1>
            <p className="text-sm text-muted-foreground mt-1">Just the basics to get you started</p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <Field label="Full Name">
              <Input value={genForm.full_name} onChange={e => setGen('full_name', e.target.value)} placeholder="Your full name" className="rounded-xl" />
            </Field>
            <Field label="Bio / Short Introduction">
              <Textarea value={genForm.bio} onChange={e => setGen('bio', e.target.value)} placeholder="A few words about yourself..." rows={3} className="rounded-xl" />
            </Field>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setProfileType(null)} className="flex-1 rounded-xl gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button onClick={handleFinishGeneral} disabled={loading} className="flex-1 rounded-xl font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finish Setup'}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            <button onClick={handleSkip} className="hover:underline">Skip for now</button>
          </p>
        </div>
      </div>
    );
  }

  /* ── Educator: multi-step setup ────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Set Up Your Educator Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Step {step + 1} of {EDU_STEPS.length}: {EDU_STEPS[step]}</p>
          <div className="flex gap-1 mt-4 justify-center">
            {EDU_STEPS.map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-primary w-8' : 'bg-muted w-4'}`} />)}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          {step === 0 && (
            <>
              <Field label="Full Name"><Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Thabo Pretorius" className="rounded-xl" /></Field>
              <Field label="SACE Number *"><Input value={form.sace_number} onChange={e => set('sace_number', e.target.value)} placeholder="e.g. 20012345" className="rounded-xl" /></Field>
              <Field label="Bio / Professional Summary">
                <Textarea value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Tell other educators about yourself..." rows={3} className="rounded-xl" />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Current School"><Input value={form.current_school} onChange={e => set('current_school', e.target.value)} placeholder="e.g. Pretoria High School" className="rounded-xl" /></Field>
              <Field label="Province">
                <SearchableSelect
                  value={form.current_province}
                  onValueChange={v => { set('current_province', v); set('district', ''); set('town', ''); }}
                  options={PROVINCES}
                  placeholder="Select province"
                  searchPlaceholder="Search province…"
                />
              </Field>
              <Field label="District">
<SearchableSelect
                  value={form.district}
                  onValueChange={v => { set('district', v); set('town', ''); }}
                  options={DISTRICTS_BY_PROVINCE[form.current_province] ?? []}
                  placeholder={form.current_province ? 'Select district' : 'Select province first'}
                  searchPlaceholder="Search district…"
                  disabled={!form.current_province}
                />
              </Field>
              <Field label="Town / City">
<SearchableSelect
                  value={form.town}
                  onValueChange={v => set('town', v)}
                  options={TOWNS_BY_DISTRICT[form.district] ?? []}
                  placeholder={form.district ? 'Select town' : 'Select district first'}
                  searchPlaceholder="Search town…"
                  disabled={!form.district}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Phase">
                <Select value={form.phase} onValueChange={v => set('phase', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select phase" /></SelectTrigger>
                  <SelectContent>{PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Years of Experience"><Input type="number" value={form.years_experience} onChange={e => set('years_experience', e.target.value)} placeholder="e.g. 5" className="rounded-xl" /></Field>
              <Field label="Subjects (select all that apply)">
                {form.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.subjects.map(s => (
                      <span key={s} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full pl-2.5 pr-1.5 py-0.5">
                        {s}
                        <button type="button" onClick={() => toggleSubject(s)} className="hover:text-destructive transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <SearchableSelect
                  value=""
                  onValueChange={v => { if (v) toggleSubject(v); }}
                  options={SUBJECTS.filter(s => !form.subjects.includes(s))}
                  placeholder="Add a subject…"
                  searchPlaceholder="Search subjects…"
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Preferred Transfer Provinces (select all)">
                <div className="flex flex-wrap gap-2 mt-1">
                  {PROVINCES.map(p => (
                    <button key={p} onClick={() => toggleProvince(p)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.preferred_provinces.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'}`}
                    >{p}</button>
                  ))}
                </div>
              </Field>
              <div className="flex items-center justify-between bg-muted/50 rounded-xl p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Actively looking for transfer?</p>
                  <p className="text-xs text-muted-foreground">Shows "Actively Looking" badge on your profile</p>
                </div>
                <button onClick={() => set('is_actively_looking', !form.is_actively_looking)}
                  className={`w-12 h-6 rounded-full transition-colors ${form.is_actively_looking ? 'bg-primary' : 'bg-border'} relative`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_actively_looking ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          {step === 0 ? (
            <Button variant="outline" onClick={() => setProfileType(null)} className="flex-1 rounded-xl gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStep(p => p - 1)} className="flex-1 rounded-xl gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {step < EDU_STEPS.length - 1 ? (
            <Button
              onClick={() => {
                if (step === 0 && !form.sace_number.trim()) {
                  toast.error('SACE number is required to continue.');
                  return;
                }
                setStep(p => p + 1);
              }}
              className="flex-1 rounded-xl gap-2"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleFinishEducator} disabled={loading} className="flex-1 rounded-xl font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finish Setup'}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <button onClick={handleSkip} className="hover:underline">Skip for now</button>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
