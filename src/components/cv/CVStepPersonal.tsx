import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState, useRef } from 'react';
import { Lock, Camera, X, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import type { CVType } from '@/pages/CVBuilderPage';

// Builds the correct public storage URL — getPublicUrl() sometimes omits /public/
// depending on Supabase JS client version, causing 400 errors on fetch.
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
}

interface Props {
  data: PersonalData;
  onChange: (d: PersonalData) => void;
  cvType: CVType;
}

export default function CVStepPersonal({ data, onChange, cvType }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [idLabel, setIdLabel] = useState('ID / Passport Number');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      /* Always fetch fresh metadata so we get the latest doc verification state */
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      const meta = freshUser?.user_metadata ?? {};
      const docType = meta.doc_type as string | undefined;
      setIdLabel(docType === 'passport' ? 'Passport Number' : 'ID Number');

      const { data: educators } = await supabase
        .from('educators')
        .select('full_name, phone, bio, current_school, current_province, town')
        .eq('user_id', user.id)
        .limit(1);
      const profile = educators?.[0];

      if (cvType === 'educator') {
        onChange({
          full_name: profile?.full_name || user.user_metadata?.full_name || '',
          email: user.email || '',
          phone: profile?.phone || '',
          address: profile?.current_school
            ? `${profile.current_school}${profile.current_province ? ', ' + profile.current_province : ''}`
            : '',
          bio: profile?.bio || data.bio || '',
          id_number: data.id_number ?? '',
        });
      } else {
        const location = [profile?.town, profile?.current_province].filter(Boolean).join(', ');
        onChange({
          full_name: profile?.full_name || user.user_metadata?.full_name || '',
          email: user.email || '',
          phone: profile?.phone || '',
          address: location,
          bio: profile?.bio || data.bio || '',
          id_number: data.id_number ?? '',
        });
      }
    }
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvType]);

  const set = (field: keyof PersonalData, value: string) => onChange({ ...data, [field]: value });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) { toast.error('You must be signed in to upload a photo.'); return; }
    setUploading(true);

    /* Derive extension from MIME type so camera-captured images (which
       often arrive as "image" with no dot-extension in their filename)
       still get a valid path like ".jpg" instead of ".image". */
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
      'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
    };
    const ext = mimeToExt[file.type] ?? (file.name.includes('.') ? file.name.split('.').pop() : 'jpg');
    const path = `${user.id}/cv-photo-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: true });
    if (error) {
      toast.error('Photo upload failed: ' + error.message);
    } else {
      set('photo_url', publicStorageUrl('avatars', path));
      toast.success('Photo added!');
    }

    /* Reset the input so the same file can be re-selected if needed */
    e.target.value = '';
    setUploading(false);
  };

  const addressLabel = cvType === 'educator' ? 'Current School / Province' : 'Location';
  const summaryPlaceholder = cvType === 'educator'
    ? 'A brief overview of your teaching career and goals...'
    : 'A brief overview of your professional background and goals...';

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Personal Information</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
          <Lock className="w-3 h-3" /> Locked to profile
        </div>
      </div>

      {/* Photo upload */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {data.photo_url
            ? <img src={data.photo_url} alt="CV photo" className="w-20 h-20 rounded-xl object-cover border border-border" />
            : <div className="w-20 h-20 rounded-xl bg-muted border border-border flex items-center justify-center"><Camera className="w-7 h-7 text-muted-foreground" /></div>
          }
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
            <button onClick={() => cameraRef.current?.click()} disabled={uploading} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
              {uploading ? 'Uploading...' : 'Camera'}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50">
              <ImageIcon className="w-3 h-3" /> Gallery
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoUpload} />
        </div>
      </div>

      {/* Locked fields */}
      <LockedField label="Full Name" value={data.full_name} />
      <LockedField label="Email Address" value={data.email} />
      <LockedField label="Phone Number" value={data.phone} />

      {/* Address — editable so users can tailor it per CV */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{addressLabel}</Label>
        <Input
          value={data.address}
          onChange={e => set('address', e.target.value)}
          placeholder={cvType === 'educator' ? 'e.g. Greenfield High, Western Cape' : 'e.g. Cape Town, Western Cape'}
          className="rounded-xl"
        />
      </div>

      {/* ID / Passport — optional, user chooses to include */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          {idLabel} <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={data.id_number ?? ''}
          onChange={e => set('id_number', e.target.value)}
          placeholder="Leave blank to omit from your CV"
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">Only include this if you want it printed on your CV.</p>
      </div>

      {/* Professional Summary — editable on both types */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Professional Summary</Label>
        <Textarea
          value={data.bio}
          onChange={e => set('bio', e.target.value)}
          placeholder={summaryPlaceholder}
          rows={3}
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">This field is editable — tailor it per CV.</p>
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
