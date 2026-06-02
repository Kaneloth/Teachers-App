import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import type { CVType } from '@/pages/CVBuilderPage';

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

const EDUCATOR_SOFT_SKILLS = [
  'Classroom Management','Curriculum Development','Learner Support',
  'Assessment & Moderation','Parent Communication','Mentoring',
  'Team Collaboration','Adaptability','Critical Thinking',
];

const GENERAL_SOFT_SKILLS = [
  'Communication','Leadership','Problem Solving','Teamwork',
  'Time Management','Adaptability','Critical Thinking','Creativity',
  'Project Management','Customer Service','Attention to Detail',
];

const LANGUAGES = [
  'English','Afrikaans','isiZulu','isiXhosa','Sepedi','Setswana',
  'Sesotho','Xitsonga','Tshivenda','isiNdebele','isiSwati',
];

interface SkillsData { subjects: string[]; soft_skills: string[]; languages: string[] }
interface Props {
  data: SkillsData;
  onChange: (d: SkillsData) => void;
  cvType: CVType;
}

export default function CVStepSkills({ data, onChange, cvType }: Props) {
  const [softInput, setSoftInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [langInput, setLangInput] = useState('');

  const toggle = (list: keyof SkillsData, item: string) => {
    const arr = data[list] || [];
    onChange({ ...data, [list]: arr.includes(item) ? arr.filter((x: string) => x !== item) : [...arr, item] });
  };

  const addSubject = () => {
    const val = subjectInput.trim();
    if (val && !data.subjects?.includes(val)) {
      onChange({ ...data, subjects: [...(data.subjects || []), val] });
      setSubjectInput('');
    }
  };

  const addSoft = () => {
    const val = softInput.trim();
    if (val && !data.soft_skills.includes(val)) {
      onChange({ ...data, soft_skills: [...data.soft_skills, val] });
      setSoftInput('');
    }
  };

  const addSkill = () => {
    const val = skillInput.trim();
    if (val && !data.subjects?.includes(val)) {
      onChange({ ...data, subjects: [...(data.subjects || []), val] });
      setSkillInput('');
    }
  };

  const removeSkill = (item: string) => {
    onChange({ ...data, subjects: (data.subjects || []).filter(s => s !== item) });
  };

  const addLang = () => {
    const val = langInput.trim();
    if (val && !(data.languages || []).includes(val)) {
      onChange({ ...data, languages: [...(data.languages || []), val] });
      setLangInput('');
    }
  };

  const btnClass = (active: boolean) =>
    `text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'}`;

  if (cvType === 'educator') {
    return (
      <div className="space-y-4">
        {/* Subjects Taught */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <Label className="text-sm font-semibold mb-3 block">Subjects Taught</Label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => toggle('subjects', s)} className={btnClass(!!data.subjects?.includes(s))}>{s}</button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Input value={subjectInput} onChange={e => setSubjectInput(e.target.value)} placeholder="Add other subject..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addSubject()} />
            <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSubject}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Professional Skills */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <Label className="text-sm font-semibold mb-3 block">Professional Skills</Label>
          <div className="flex flex-wrap gap-2 mb-3">
            {EDUCATOR_SOFT_SKILLS.map(s => (
              <button key={s} onClick={() => toggle('soft_skills', s)} className={btnClass(!!data.soft_skills?.includes(s))}>{s}</button>
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
          <div className="flex flex-wrap gap-2 mb-3">
            {LANGUAGES.map(l => (
              <button key={l} onClick={() => toggle('languages', l)} className={btnClass(!!data.languages?.includes(l))}>{l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={langInput} onChange={e => setLangInput(e.target.value)} placeholder="Add other language..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addLang()} />
            <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addLang}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    );
  }

  /* ── General CV skills ───────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Key Skills — free-form chip input */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-1 block">Key Skills</Label>
        <p className="text-xs text-muted-foreground mb-3">Add the skills most relevant to the role you're applying for.</p>
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
          <Input value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="e.g. Data Analysis, Budget Management..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addSkill()} />
          <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Professional Skills */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <Label className="text-sm font-semibold mb-3 block">Professional Skills</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {GENERAL_SOFT_SKILLS.map(s => (
            <button key={s} onClick={() => toggle('soft_skills', s)} className={btnClass(!!data.soft_skills?.includes(s))}>{s}</button>
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
        <div className="flex flex-wrap gap-2 mb-3">
          {LANGUAGES.map(l => (
            <button key={l} onClick={() => toggle('languages', l)} className={btnClass(!!data.languages?.includes(l))}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={langInput} onChange={e => setLangInput(e.target.value)} placeholder="Add other language..." className="rounded-xl" onKeyDown={e => e.key === 'Enter' && addLang()} />
          <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={addLang}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}
