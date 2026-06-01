import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

const SUBJECTS = [
  'Mathematics','Mathematical Literacy','Physical Sciences','Life Sciences',
  'English HL','English FAL','Afrikaans HL','Afrikaans FAL','History','Geography',
  'Business Studies','Accounting','Economics','Life Orientation',
  'Computer Applications Technology','Information Technology',
  'Agricultural Sciences','Agricultural Management Practices','Agricultural Technology',
  'Natural Sciences','Social Sciences','Technology',
  'isiZulu HL','isiZulu FAL','isiXhosa HL','isiXhosa FAL',
  'Sepedi HL','Sepedi FAL','Setswana HL','Setswana FAL',
  'Sesotho HL','Sesotho FAL','Xitsonga HL','Xitsonga FAL',
  'Tshivenda HL','Tshivenda FAL','Siswati HL','Siswati FAL',
  'isiNdebele HL','isiNdebele FAL','Sign Language HL',
  'Visual Arts','Music','Dramatic Arts','Dance Studies','Design',
  'Engineering Graphics and Design','Consumer Studies','Hospitality Studies',
  'Tourism','Religion Studies',
];

const SOFT_SKILLS = [
  'Classroom Management','Curriculum Development','Learner Support',
  'Assessment & Moderation','Parent Communication','Mentoring',
  'Team Collaboration','Adaptability','Critical Thinking',
];

const LANGUAGES = ['English','Afrikaans','isiZulu','isiXhosa','Sepedi','Setswana','Sesotho','Xitsonga','Tshivenda'];

interface SkillsData { subjects: string[]; soft_skills: string[]; languages: string[] }
interface Props { data: SkillsData; onChange: (d: SkillsData) => void }

export default function CVStepSkills({ data, onChange }: Props) {
  const [softInput, setSoftInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');

  const toggle = (list: keyof SkillsData, item: string) => {
    const arr = data[list] || [];
    onChange({ ...data, [list]: arr.includes(item) ? arr.filter((x: string) => x !== item) : [...arr, item] });
  };

  const addSubject = () => {
    if (subjectInput.trim() && !data.subjects?.includes(subjectInput.trim())) {
      onChange({ ...data, subjects: [...(data.subjects || []), subjectInput.trim()] });
      setSubjectInput('');
    }
  };

  const addSoft = () => {
    if (softInput.trim() && !data.soft_skills.includes(softInput.trim())) {
      onChange({ ...data, soft_skills: [...data.soft_skills, softInput.trim()] });
      setSoftInput('');
    }
  };

  const btnClass = (active: boolean) =>
    `text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'}`;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-3 block">Subjects Taught</Label>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map(s => <button key={s} onClick={() => toggle('subjects', s)} className={btnClass(!!data.subjects?.includes(s))}>{s}</button>)}
        </div>
        <div className="flex gap-2 mt-3">
          <Input value={subjectInput} onChange={e => setSubjectInput(e.target.value)} placeholder="Add other subject..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addSubject()} />
          <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSubject}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-3 block">Professional Skills</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {SOFT_SKILLS.map(s => <button key={s} onClick={() => toggle('soft_skills', s)} className={btnClass(!!data.soft_skills?.includes(s))}>{s}</button>)}
        </div>
        <div className="flex gap-2">
          <Input value={softInput} onChange={e => setSoftInput(e.target.value)} placeholder="Add custom skill..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addSoft()} />
          <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSoft}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-3 block">Languages</Label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(l => <button key={l} onClick={() => toggle('languages', l)} className={btnClass(!!data.languages?.includes(l))}>{l}</button>)}
        </div>
      </div>
    </div>
  );
}
