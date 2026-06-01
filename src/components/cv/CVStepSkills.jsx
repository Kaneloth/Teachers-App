import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';

const SUBJECTS = [
  'Mathematics', 'Mathematical Literacy', 'Physical Sciences', 'Life Sciences',
  'English HL', 'English FAL', 'Afrikaans HL', 'Afrikaans FAL', 'History', 'Geography',
  'Business Studies', 'Accounting', 'Economics', 'Life Orientation',
  'Computer Applications Technology', 'Information Technology',
  'Agricultural Sciences', 'Agricultural Management Practices', 'Agricultural Technology',
  'Natural Sciences', 'Social Sciences', 'Technology',
  'isiZulu HL', 'isiZulu FAL', 'isiXhosa HL', 'isiXhosa FAL',
  'Sepedi HL', 'Sepedi FAL', 'Setswana HL', 'Setswana FAL',
  'Sesotho HL', 'Sesotho FAL', 'Xitsonga HL', 'Xitsonga FAL',
  'Tshivenda HL', 'Tshivenda FAL', 'Siswati HL', 'Siswati FAL',
  'isiNdebele HL', 'isiNdebele FAL', 'Sign Language HL',
  'Visual Arts', 'Music', 'Dramatic Arts', 'Dance Studies', 'Design',
  'Engineering Graphics and Design', 'Consumer Studies', 'Hospitality Studies',
  'Tourism', 'Religion Studies',
];

const SOFT_SKILLS = [
  'Classroom Management', 'Curriculum Development', 'Learner Support',
  'Assessment & Moderation', 'Parent Communication', 'Mentoring',
  'Team Collaboration', 'Adaptability', 'Critical Thinking',
];

const LANGUAGES = ['English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sepedi', 'Setswana', 'Sesotho', 'Xitsonga', 'Tshivenda'];

export default function CVStepSkills({ data, onChange }) {
  const [softInput, setSoftInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');

  const toggleItem = (list, item) => {
    const arr = data[list] || [];
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  };

  const set = (field, value) => onChange({ ...data, [field]: value });

  const addSubject = () => {
    if (subjectInput.trim() && !data.subjects?.includes(subjectInput.trim())) {
      set('subjects', [...(data.subjects || []), subjectInput.trim()]);
      setSubjectInput('');
    }
  };

  const addSoft = () => {
    if (softInput.trim() && !data.soft_skills.includes(softInput.trim())) {
      set('soft_skills', [...data.soft_skills, softInput.trim()]);
      setSoftInput('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Subjects */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-3 block">Subjects Taught</Label>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map(s => (
            <button
              key={s}
              onClick={() => set('subjects', toggleItem('subjects', s))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                data.subjects?.includes(s)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Input value={subjectInput} onChange={e => setSubjectInput(e.target.value)} placeholder="Add other subject..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addSubject()} />
          <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSubject}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Soft Skills */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-3 block">Professional Skills</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {SOFT_SKILLS.map(s => (
            <button
              key={s}
              onClick={() => set('soft_skills', toggleItem('soft_skills', s))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                data.soft_skills?.includes(s)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={softInput} onChange={e => setSoftInput(e.target.value)} placeholder="Add custom skill..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addSoft()} />
          <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSoft}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Languages */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-3 block">Languages</Label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(l => (
            <button
              key={l}
              onClick={() => set('languages', toggleItem('languages', l))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                data.languages?.includes(l)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}