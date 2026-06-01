import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Lock, Camera, X, Loader2, ImageIcon } from 'lucide-react';

export default function CVStepPersonal({ data, onChange }) {
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    Promise.all([base44.auth.me(), base44.entities.Educator.filter({})]).then(([user, educators]) => {
      const profile = educators?.find(e => e.created_by_id === user.id) || educators?.[0];
      onChange({
        full_name: profile?.full_name || user.full_name || '',
        email: user.email || '',
        phone: profile?.phone || '',
        address: profile?.current_school
          ? `${profile.current_school}${profile.current_province ? ', ' + profile.current_province : ''}`
          : '',
        bio: profile?.bio || data.bio || '',
      });
      setLoaded(true);
    });
  }, []);

  const set = (field, value) => onChange({ ...data, [field]: value });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('photo_url', file_url);
    setUploading(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Personal Information</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
          <Lock className="w-3 h-3" />
          Locked to profile
        </div>
      </div>

      {/* Photo upload */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {data.photo_url ? (
            <img src={data.photo_url} alt="CV photo" className="w-20 h-20 rounded-xl object-cover border border-border" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-muted border border-border flex items-center justify-center">
              <Camera className="w-7 h-7 text-muted-foreground" />
            </div>
          )}
          {data.photo_url && (
            <button
              onClick={() => set('photo_url', '')}
              className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground mb-1">Profile Photo <span className="text-muted-foreground font-normal">(optional)</span></p>
          <p className="text-xs text-muted-foreground mb-2">A professional headshot looks great on modern templates.</p>
          <div className="flex gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
              {uploading ? 'Uploading...' : 'Camera'}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <ImageIcon className="w-3 h-3" />
              Gallery
            </button>
          </div>
          {/* Gallery picker — any image */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          {/* Camera — opens front camera directly on mobile */}
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoUpload} />
        </div>
      </div>

      <LockedField label="Full Name" value={data.full_name} />
      <LockedField label="Email Address" value={data.email} />
      <LockedField label="Phone Number" value={data.phone} />
      <LockedField label="Current School / Province" value={data.address} />

      {/* Bio is editable — it's a professional summary the user can tailor per CV */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Professional Summary</Label>
        <Textarea
          value={data.bio}
          onChange={e => set('bio', e.target.value)}
          placeholder="A brief overview of your teaching career and goals..."
          rows={3}
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">This field is editable — tailor it per CV.</p>
      </div>

      <p className="text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2">
        To update your name, email, phone or ID, go to your <strong>Profile page</strong>. Changes require re-verification.
      </p>
    </div>
  );
}

function LockedField({ label, value }) {
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