import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X } from 'lucide-react';
import type { CVType } from '@/pages/CVBuilderPage';

interface ExpEntry { school: string; role: string; from: string; to: string; description: string }
interface Props {
  data: ExpEntry[];
  onChange: (d: ExpEntry[]) => void;
  cvType: CVType;
}

export default function CVStepExperience({ data, onChange, cvType }: Props) {
  const add    = () => onChange([...data, { school: '', role: '', from: '', to: '', description: '' }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const set    = (i: number, field: keyof ExpEntry, value: string) => {
    const updated = [...data];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  const isEducator = cvType === 'educator';

  /** Parse the newline-separated description into an array of bullet strings. */
  const getBullets = (desc: string): string[] => {
    const lines = desc.split('\n').map(l => l.trimStart());
    return lines.length > 0 ? lines : [''];
  };

  /** Rebuild the description string from bullets array. */
  const setBullets = (entryIndex: number, bullets: string[]) => {
    set(entryIndex, 'description', bullets.join('\n'));
  };

  const addBullet    = (entryIndex: number, bullets: string[]) => setBullets(entryIndex, [...bullets, '']);
  const removeBullet = (entryIndex: number, bullets: string[], bulletIndex: number) => {
    const updated = bullets.filter((_, i) => i !== bulletIndex);
    setBullets(entryIndex, updated.length > 0 ? updated : ['']);
  };
  const editBullet   = (entryIndex: number, bullets: string[], bulletIndex: number, value: string) => {
    const updated = [...bullets];
    updated[bulletIndex] = value;
    setBullets(entryIndex, updated);
  };

  return (
    <div className="space-y-3">
      {data.map((entry, i) => {
        const bullets = getBullets(entry.description);
        return (
          <div key={i} className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">
                {isEducator ? `Position ${i + 1}` : `Experience ${i + 1}`}
              </h3>
              {data.length > 1 && (
                <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <Field label={isEducator ? 'School / Institution' : 'Company / Organisation'}>
              <Input
                value={entry.school}
                onChange={e => set(i, 'school', e.target.value)}
                placeholder={isEducator ? 'e.g. Pretoria High School' : 'e.g. Acme Corporation, City of Joburg'}
                className="rounded-xl"
              />
            </Field>

            <Field label={isEducator ? 'Role / Post' : 'Job Title / Role'}>
              <Input
                value={entry.role}
                onChange={e => set(i, 'role', e.target.value)}
                placeholder={isEducator ? 'e.g. Mathematics Educator' : 'e.g. Software Developer, Accountant, Nurse'}
                className="rounded-xl"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Input value={entry.from} onChange={e => set(i, 'from', e.target.value)} placeholder="Jan 2020" className="rounded-xl" />
              </Field>
              <Field label="To">
                <Input value={entry.to} onChange={e => set(i, 'to', e.target.value)} placeholder="Present" className="rounded-xl" />
              </Field>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isEducator ? 'Key Responsibilities' : 'Key Responsibilities / Achievements'}
              </Label>
              <p className="text-xs text-muted-foreground -mt-0.5">Each point will appear as a bullet on your CV</p>
              <div className="space-y-2">
                {bullets.map((bullet, bi) => (
                  <div key={bi} className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm shrink-0 w-4 text-center">•</span>
                    <Input
                      value={bullet}
                      onChange={e => editBullet(i, bullets, bi, e.target.value)}
                      placeholder={
                        isEducator
                          ? bi === 0 ? 'e.g. Teaching, assessing and reporting' : 'Add another responsibility...'
                          : bi === 0 ? 'e.g. Managed a team of 5 staff members'  : 'Add another achievement or responsibility...'
                      }
                      className="rounded-xl flex-1 text-sm"
                    />
                    {bullets.length > 1 && (
                      <button
                        onClick={() => removeBullet(i, bullets, bi)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => addBullet(i, bullets)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add point
              </button>
            </div>
          </div>
        );
      })}
      <Button variant="outline" onClick={add} className="w-full rounded-xl gap-2">
        <Plus className="w-4 h-4" />
        {isEducator ? 'Add Position' : 'Add Work Experience'}
      </Button>
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
