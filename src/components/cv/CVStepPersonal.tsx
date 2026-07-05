import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import AutoGrowTextarea from '@/components/AutoGrowTextarea';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState, useRef } from 'react';
import { Lock, Camera, X, Loader2, ImageIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';

function publicStorageUrl(bucket: string, path: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

interface PersonalData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  bio: string;
  photo_url?: string;
  id_number?: string;
  job_title?: string;
}

interface Props {
  data: PersonalData;
  fullCvData?: {
    education?: { institution: string; qualification: string; year: string }[];
    experience?: { school: string; role: string; from: string; to: string; description: string }[];
    skills?: { subjects: string[]; soft_skills: string[]; languages: string[] };
  };
  onChange: (d: PersonalData) => void;
  onAiUsed?: () => void;
  jobDescription?: string;
}

export default function CVStepPersonal({ data, fullCvData, onChange, onAiUsed, jobDescription }: Props) {
  const { user } = useAuth();
  const isAdmin = !!(user?.user_metadata?.is_admin);
  const { balance, loading: creditsLoading, deduct } = useCredits();
  const [uploading,         setUploading]         = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    if (data.full_name && data.email) return;
    supabase.from('educators').select('full_name, phone, bio, town, current_province')
      .eq('user_id', user.id).maybeSingle()
      .then(({ data: profile }) => {
        const location = [profile?.town, profile?.current_province].filter(Boolean).join(', ');
        onChange({
          ...data,
          full_name: data.full_name || profile?.full_name || user.user_metadata?.full_name || '',
          email:     data.email     || user.email || '',
          phone:     data.phone     || profile?.phone || user.user_metadata?.phone || '',
          address:   data.address   || location || '',
          bio:       data.bio       || profile?.bio || '',
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const set = (field: keyof PersonalData, value: string) => onChange({ ...data, [field]: value });

  const generateSummary = async () => {
    const aiRef = `ai_summary_${Date.now()}`;
    if (!isAdmin) {
      const ok = await deduct('letter_usage', aiRef);
      if (!ok) return;
    }

    setGeneratingSummary(true);
    const MAX_ATTEMPTS = 3;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 3000));
        const res = await fetch('/.netlify/functions/enhance-cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_summary',
            cvData: {
              personal:   data,
              education:  fullCvData?.education  ?? [],
              experience: fullCvData?.experience ?? [],
              skills:     fullCvData?.skills      ?? { subjects: [], soft_skills: [], languages: [] },
            },
            userBlurb: data.bio || '',
            jobDescription: jobDescription || '',
          }),
        });
        const result = await res.json();
        const isRateLimit = res.status === 429 || res.status === 503 ||
          result.error?.toLowerCase().includes('rate') ||
          result.error?.toLowerCase().includes('busy') ||
          result.error?.toLowerCase().includes('limit');
        if (isRateLimit && attempt < MAX_ATTEMPTS - 1) continue;
        if (!res.ok || !result.success) throw new Error(result.error || 'AI failed');
        set('bio', result.summary);
        if (onAiUsed) onAiUsed();
        toast.success('Professional summary generated! 2 credits used.');
        setGeneratingSummary(false);
        return;
      } catch (err: any) {
        const isRateLimit = err?.message?.toLowerCase().includes('rate') ||
          err?.message?.toLowerCase().includes('busy') ||
          err?.message?.toLowerCase().includes('limit');
        if (isRateLimit && attempt < MAX_ATTEMPTS - 1) continue;
        toast.error(err?.message?.includes('credits') || err?.message?.includes('insufficient')
          ? err.message
          : 'Could not generate summary — please try again in a moment.');
        break;
      }
    }
    setGeneratingSummary(false);
  };

  const toJpeg = (file: File, maxPx = 800, q = 0.85): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const s = Math.min(1, maxPx / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width  = Math.round(img.width  * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', q);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) { toast.error('You must be signed in to upload a photo.'); return; }
    setUploading(true);
    try {
      const jpeg = await toJpeg(file);
      const path = `${user.id}/cv-photo-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
      if (error) { toast.error(`Photo upload failed: ${error.message}`); }
      else        { set('photo_url', publicStorageUrl('avatars', path)); toast.success('Photo added!'); }
    } catch (err: any) {
      toast.error('Could not process photo: ' + (err?.message ?? 'Unknown error'));
    }
    e.target.value = '';
    setUploading(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Personal Information</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
          <Lock className="w-3 h-3" /> Locked to profile
        </div>
      </div>

      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {data.photo_url
            ? <img src={data.photo_url} alt="CV photo" className="w-20 h-20 rounded-xl object-cover border border-border" />
            : <div className="w-20 h-20 rounded-xl bg-muted border border-border flex items-center justify-center"><Camera className="w-7 h-7 text-muted-foreground" /></div>}
          {data.photo_url && (
            <button onClick={() => set('photo_url', '')} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground mb-1">Profile Photo <span className="text-muted-foreground font-normal">(optional)</span></p>
          <p className="text-xs text-muted-foreground mb-2">A professional headshot looks great on modern templates.</p>
          <div className="flex gap-2">
            <button onClick={() => cameraRef.current?.click()} disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
              {uploading ? 'Uploading...' : 'Camera'}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50">
              <ImageIcon className="w-3 h-3" /> Gallery
            </button>
          </div>
          <input ref={fileRef}   type="file" accept="image/*"          className="hidden" onChange={handlePhotoUpload} />
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoUpload} />
        </div>
      </div>

      {/* Locked fields */}
      <LockedField label="Full Name"     value={data.full_name} />
      <LockedField label="Email Address" value={data.email} />
      <LockedField label="Phone Number"  value={data.phone} />

      {/* Current Job Title — shown as the heading subtitle on some templates */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Current Job Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input value={data.job_title ?? ''} onChange={e => set('job_title', e.target.value)}
          placeholder="e.g. Mathematics Educator" className="rounded-xl" />
        <p className="text-xs text-muted-foreground">This appears under your name on some templates. Leave blank to use your most recent role automatically.</p>
      </div>

      {/* Editable location */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Location</Label>
        <AutoGrowTextarea value={data.address} onChange={v => set('address', v)}
          placeholder="e.g. Cape Town, Western Cape" />
      </div>

      {/* ID / Passport */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">ID / Passport Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input value={data.id_number ?? ''} onChange={e => set('id_number', e.target.value)}
          placeholder="Leave blank to omit from your CV" className="rounded-xl" />
        <p className="text-xs text-muted-foreground">Only include this if you want it printed on your CV.</p>
      </div>

      {/* Professional Summary */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Professional Summary</Label>
          <button type="button" onClick={generateSummary}
            disabled={generatingSummary || (!isAdmin && !creditsLoading && balance < 2)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50">
            {generatingSummary
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
              : <><Sparkles className="w-3 h-3" /> Generate with AI · 2 credits</>}
          </button>
        </div>
        <Textarea value={data.bio} onChange={e => set('bio', e.target.value)}
          placeholder="A brief overview of your professional background, experience, and career goals..."
          rows={4} className="rounded-xl" />
        <p className="text-xs text-muted-foreground">Tap "Generate with AI" for a suggested summary, then edit to personalise it.</p>
      </div>

      <p className="text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2">
        To update your name, email or phone, go to your <strong>Profile page</strong>.
      </p>
    </div>
  );
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-muted/50 text-sm text-foreground">
        <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{value || <span className="text-muted-foreground italic">Not set on profile</span>}</span>
      </div>
    </div>
  );
}
