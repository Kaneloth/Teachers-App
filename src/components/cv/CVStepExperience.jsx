import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

export default function CVStepExperience({ data, onChange }) {
  const add = () => onChange([...data, { school: '', role: '', from: '', to: '', description: '' }]);
  const remove = (i) => onChange(data.filter((_, idx) => idx !== i));
  const set = (i, field, value) => {
    const updated = [...data];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {data.map((entry, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">Position {i + 1}</h3>
            {data.length > 1 && (
              <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <Field label="School / Institution">
            <Input value={entry.school} onChange={e => set(i, 'school', e.target.value)} placeholder="e.g. Pretoria High School" className="rounded-xl" />
          </Field>
          <Field label="Role / Post">
            <Input value={entry.role} onChange={e => set(i, 'role', e.target.value)} placeholder="e.g. Mathematics Educator" className="rounded-xl" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input value={entry.from} onChange={e => set(i, 'from', e.target.value)} placeholder="Jan 2020" className="rounded-xl" />
            </Field>
            <Field label="To">
              <Input value={entry.to} onChange={e => set(i, 'to', e.target.value)} placeholder="Present" className="rounded-xl" />
            </Field>
          </div>
          <Field label="Key Responsibilities">
            <Textarea value={entry.description} onChange={e => set(i, 'description', e.target.value)} placeholder="Describe your key duties and achievements..." rows={2} className="rounded-xl" />
          </Field>
        </div>
      ))}
      <Button variant="outline" onClick={add} className="w-full rounded-xl gap-2">
        <Plus className="w-4 h-4" /> Add Position
      </Button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}