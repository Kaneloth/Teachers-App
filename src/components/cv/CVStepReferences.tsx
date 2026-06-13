import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

export interface RefEntry {
  name: string;
  title: string;
  organisation: string;
  phone: string;
  email: string;
  relationship: string;
}

interface Props { data: RefEntry[]; onChange: (d: RefEntry[]) => void }

const empty = (): RefEntry => ({ name: '', title: '', organisation: '', phone: '', email: '', relationship: '' });

export default function CVStepReferences({ data, onChange }: Props) {
  const add    = () => onChange([...data, empty()]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const set    = (i: number, field: keyof RefEntry, value: string) => {
    const updated = [...data];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-0.5">
        Add at least two professional references. They may be contacted by prospective employers.
      </p>

      {data.map((ref, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">Reference {i + 1}</h3>
            {data.length > 1 && (
              <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <Field label="Full Name">
            <Input value={ref.name} onChange={e => set(i, 'name', e.target.value)}
              placeholder="e.g. Ms Nomvula Dlamini" className="rounded-xl" />
          </Field>

          <Field label="Job Title / Position">
            <Input value={ref.title} onChange={e => set(i, 'title', e.target.value)}
              placeholder="e.g. Principal, HR Manager, Director" className="rounded-xl" />
          </Field>

          <Field label="Company / Organisation">
            <Input value={ref.organisation} onChange={e => set(i, 'organisation', e.target.value)}
              placeholder="e.g. Soweto High School, Acme Corp" className="rounded-xl" />
          </Field>

          <Field label="Relationship to You">
            <Input value={ref.relationship} onChange={e => set(i, 'relationship', e.target.value)}
              placeholder="e.g. Direct Supervisor, Former Manager, Principal" className="rounded-xl" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={ref.phone} onChange={e => set(i, 'phone', e.target.value)}
                placeholder="071 000 0000" className="rounded-xl" type="tel" inputMode="tel" />
            </Field>
            <Field label="Email">
              <Input value={ref.email} onChange={e => set(i, 'email', e.target.value)}
                placeholder="ref@email.co.za" className="rounded-xl" type="email" />
            </Field>
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={add} className="w-full rounded-xl gap-2">
        <Plus className="w-4 h-4" /> Add Reference
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
