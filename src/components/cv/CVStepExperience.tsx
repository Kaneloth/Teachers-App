import { Input } from '@/components/ui/input';
import AutoGrowTextarea from '@/components/AutoGrowTextarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X } from 'lucide-react';

interface ExpEntry { school: string; role: string; from: string; to: string; description: string }
interface Props { data: ExpEntry[]; onChange: (d: ExpEntry[]) => void }

export default function CVStepExperience({ data, onChange }: Props) {
  const add    = () => onChange([...data, { school: '', role: '', from: '', to: '', description: '' }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const set    = (i: number, field: keyof ExpEntry, value: string) => {
    const updated = [...data];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  const getBullets  = (desc: string) => { const l = desc.split('\n').map(s => s.trimStart()); return l.length > 0 ? l : ['']; };
  const setBullets  = (i: number, bullets: string[]) => set(i, 'description', bullets.join('\n'));
  const addBullet   = (i: number, b: string[]) => setBullets(i, [...b, '']);
  const remBullet   = (i: number, b: string[], bi: number) => { const u = b.filter((_,x) => x !== bi); setBullets(i, u.length > 0 ? u : ['']); };
  const editBullet  = (i: number, b: string[], bi: number, val: string) => { const u = [...b]; u[bi] = val; setBullets(i, u); };

  return (
    <div className="space-y-3">
      {data.map((entry, i) => {
        const bullets = getBullets(entry.description);
        return (
          <div key={i} className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">Experience {i + 1}</h3>
              {data.length > 1 && (
                <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <Field label="Company / Organisation">
              <AutoGrowTextarea value={entry.school} onChange={v => set(i, 'school', v)}
                placeholder="e.g. Acme Corporation, City of Joburg, WCED" />
            </Field>

            <Field label="Job Title / Role">
              <AutoGrowTextarea value={entry.role} onChange={v => set(i, 'role', v)}
                placeholder="e.g. Software Developer, Accountant, Mathematics Educator" />
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
              <Label className="text-sm font-medium">Key Responsibilities / Achievements</Label>
              <p className="text-xs text-muted-foreground -mt-0.5">Each point will appear as a bullet on your CV</p>
              <div className="space-y-2">
                {bullets.map((bullet, bi) => (
                  <div key={bi} className="flex items-start gap-2">
                    <span className="text-muted-foreground text-sm shrink-0 w-4 text-center pt-2">•</span>
                    <AutoGrowTextarea value={bullet} onChange={v => editBullet(i, bullets, bi, v)}
                      placeholder={bi === 0 ? 'e.g. Managed a team of 5 staff members' : 'Add another achievement or responsibility...'}
                      className="flex-1 text-sm" />
                    {bullets.length > 1 && (
                      <button onClick={() => remBullet(i, bullets, bi)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 pt-2">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => addBullet(i, bullets)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1">
                <Plus className="w-3.5 h-3.5" /> Add point
              </button>
            </div>
          </div>
        );
      })}
      <Button variant="outline" onClick={add} className="w-full rounded-xl gap-2">
        <Plus className="w-4 h-4" /> Add Work Experience
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
