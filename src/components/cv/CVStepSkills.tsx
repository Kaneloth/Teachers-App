import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';

const SOFT_SKILLS = [
  'Communication', 'Leadership', 'Problem Solving', 'Teamwork',
  'Time Management', 'Adaptability', 'Critical Thinking', 'Creativity',
  'Project Management', 'Customer Service', 'Attention to Detail',
  'Classroom Management', 'Curriculum Development', 'Mentoring',
  'Assessment & Moderation', 'Learner Support', 'Parent Communication',
];

const LANGUAGES = [
  'English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sepedi', 'Setswana',
  'Sesotho', 'Xitsonga', 'Tshivenda', 'isiNdebele', 'isiSwati',
];

interface SkillsData { subjects: string[]; soft_skills: string[]; languages: string[] }
interface Props { data: SkillsData; onChange: (d: SkillsData) => void }

export default function CVStepSkills({ data, onChange }: Props) {
  const [skillInput, setSkillInput] = useState('');
  const [softInput,  setSoftInput]  = useState('');
  const [langInput,  setLangInput]  = useState('');

  const toggleSoft = (item: string) => {
    const arr = data.soft_skills || [];
    onChange({ ...data, soft_skills: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item] });
  };
  const toggleLang = (item: string) => {
    const arr = data.languages || [];
    onChange({ ...data, languages: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item] });
  };

  const addSkill = () => {
    const val = skillInput.trim();
    if (val && !(data.subjects || []).includes(val)) {
      onChange({ ...data, subjects: [...(data.subjects || []), val] });
      setSkillInput('');
    }
  };
  const removeSkill = (item: string) => onChange({ ...data, subjects: (data.subjects || []).filter(s => s !== item) });

  const addSoft = () => {
    const val = softInput.trim();
    if (val && !(data.soft_skills || []).includes(val)) {
      onChange({ ...data, soft_skills: [...(data.soft_skills || []), val] });
      setSoftInput('');
    }
  };

  const addLang = () => {
    const val = langInput.trim();
    if (val && !(data.languages || []).includes(val)) {
      onChange({ ...data, languages: [...(data.languages || []), val] });
      setLangInput('');
    }
  };

  const chip = (active: boolean) =>
    `text-xs px-3 py-1.5 rounded-full border transition-colors text-center flex items-center justify-center ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'
    }`;

  return (
    <div className="space-y-4">

      {/* Key Skills — free-form chips */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-1 block">Key Skills</Label>
        <p className="text-xs text-muted-foreground mb-3">
          Add technical skills, tools, subjects taught, or any competencies relevant to the role.
        </p>
        {(data.subjects || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(data.subjects || []).map(s => (
              <span key={s} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                {s}
                <button onClick={() => removeSkill(s)} className="ml-0.5 hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={skillInput} onChange={e => setSkillInput(e.target.value)}
            placeholder="e.g. Mathematics, Data Analysis, Budget Management..."
            className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addSkill()} />
          <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Professional Skills */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-3 block">Professional Skills</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {SOFT_SKILLS.map(s => (
            <button key={s} onClick={() => toggleSoft(s)} className={chip(!!(data.soft_skills || []).includes(s))}>{s}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={softInput} onChange={e => setSoftInput(e.target.value)}
            placeholder="Add a custom skill..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addSoft()} />
          <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSoft}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Languages */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-3 block">Languages</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {LANGUAGES.map(l => (
            <button key={l} onClick={() => toggleLang(l)} className={chip(!!(data.languages || []).includes(l))}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={langInput} onChange={e => setLangInput(e.target.value)}
            placeholder="Add other language..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addLang()} />
          <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addLang}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

    </div>
  );
}
