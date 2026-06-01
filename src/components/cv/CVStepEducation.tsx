import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface EduEntry { institution: string; qualification: string; year: string }
interface Props { data: EduEntry[]; onChange: (d: EduEntry[]) => void }

export default function CVStepEducation({ data, onChange }: Props) {
  const add = () => onChange([...data, { institution: '', qualification: '', year: '' }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const set = (i: number, field: keyof EduEntry, value: string) => {
    const updated = [...data];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {data.map((entry, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">Qualification {i + 1}</h3>
            {data.length > 1 && <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>}
          </div>
          <Field label="Institution"><Input value={entry.institution} onChange={e => set(i, 'institution', e.target.value)} placeholder="e.g. UNISA" className="rounded-xl" /></Field>
          <Field label="Qualification"><Input value={entry.qualification} onChange={e => set(i, 'qualification', e.target.value)} placeholder="e.g. B.Ed (FET)" className="rounded-xl" /></Field>
          <Field label="Year Completed"><Input value={entry.year} onChange={e => set(i, 'year', e.target.value)} placeholder="e.g. 2018" className="rounded-xl" /></Field>
        </div>
      ))}
      <Button variant="outline" onClick={add} className="w-full rounded-xl gap-2"><Plus className="w-4 h-4" /> Add Qualification</Button>
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
