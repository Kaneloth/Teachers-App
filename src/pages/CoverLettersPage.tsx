import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, RotateCcw, Check, Sparkles, FileText, Coins, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useCredits } from '@/hooks/useCredits';
import { supabase } from '@/lib/supabase';

/* ── Template definitions ────────────────────────────────────── */
interface Template {
  label: string;
  emoji: string;
  orgLabel: string;
  posPlaceholder: string;
  orgPlaceholder: string;
  body: (name: string, pos: string, org: string, date: string) => string;
}

const TEMPLATES: Record<string, Template> = {
  education: {
    label: 'Education',
    emoji: '🎓',
    orgLabel: 'School / Institution',
    posPlaceholder: 'e.g. Mathematics Teacher',
    orgPlaceholder: 'e.g. Greenfield High School',
    body: (name, pos, org, date) =>
`${date}

Dear Principal / Hiring Manager,

RE: Application for ${pos || 'Advertised Educator Position'}

I am writing to express my interest in the ${pos || 'advertised position'} at ${org || 'your school'}. As a qualified and dedicated educator, I am passionate about nurturing learner potential and fostering a positive classroom environment.

I hold the required qualifications and am registered with the South African Council for Educators (SACE). Throughout my career I have developed strong competencies in curriculum planning, outcomes-based assessment, classroom management, and learner support. I am equally committed to professional development and collaborate effectively with colleagues, parents, and the broader school community.

I am enthusiastic about contributing to the goals and values of ${org || 'your institution'} and believe my skills align well with the requirements of this role.

Please find my CV attached for your consideration. I welcome the opportunity to discuss my application at your convenience.

Yours sincerely,

${name || '[Your Name]'}`,
  },

  admin: {
    label: 'Admin',
    emoji: '🗂️',
    orgLabel: 'Company / Organisation',
    posPlaceholder: 'e.g. Administrative Assistant',
    orgPlaceholder: 'e.g. City of Cape Town',
    body: (name, pos, org, date) =>
`${date}

Dear Hiring Manager,

RE: Application for ${pos || 'Administrative Position'}

I am pleased to submit my application for the ${pos || 'administrative role'} at ${org || 'your organisation'}. With a strong background in office administration, document management, and stakeholder coordination, I am confident I can contribute meaningfully to your team.

My experience includes scheduling, records management, correspondence drafting, and supporting senior management. I am proficient in Microsoft Office and take pride in delivering accurate, timely work in fast-paced environments.

I am eager to bring my organisational skills and professional work ethic to ${org || 'your organisation'} and would welcome the opportunity to speak with you further.

Yours faithfully,

${name || '[Your Name]'}`,
  },

  finance: {
    label: 'Finance',
    emoji: '💰',
    orgLabel: 'Company',
    posPlaceholder: 'e.g. Financial Analyst',
    orgPlaceholder: 'e.g. Nedbank',
    body: (name, pos, org, date) =>
`${date}

Dear Hiring Manager,

RE: Application for ${pos || 'Finance Position'}

I write to apply for the ${pos || 'position'} at ${org || 'your organisation'}. With a solid foundation in financial analysis, reporting, and compliance, I am well-prepared to add value to your finance team.

I have experience working with financial statements, budgeting processes, and regulatory reporting. I am detail-oriented, proficient in Excel and accounting software, and committed to maintaining the highest standards of accuracy and integrity in financial management.

I would welcome the opportunity to discuss how my qualifications and experience align with the needs of ${org || 'your team'}.

Yours sincerely,

${name || '[Your Name]'}`,
  },

  healthcare: {
    label: 'Healthcare',
    emoji: '🏥',
    orgLabel: 'Hospital / Clinic',
    posPlaceholder: 'e.g. Registered Nurse',
    orgPlaceholder: 'e.g. Groote Schuur Hospital',
    body: (name, pos, org, date) =>
`${date}

Dear HR Manager,

RE: Application for ${pos || 'Healthcare Position'}

I am writing to apply for the ${pos || 'position'} at ${org || 'your facility'}. As a dedicated healthcare professional committed to patient-centred care, I am confident I will be a valuable addition to your team.

My background includes clinical care delivery, patient assessment, and interdisciplinary collaboration. I hold the relevant registration with the appropriate South African health council and am committed to upholding ethical and professional standards in all aspects of patient care.

I would be honoured to serve the patients and staff at ${org || 'your facility'} and look forward to the opportunity to discuss my application further.

Yours sincerely,

${name || '[Your Name]'}`,
  },

  technology: {
    label: 'Technology',
    emoji: '💻',
    orgLabel: 'Company',
    posPlaceholder: 'e.g. Software Developer',
    orgPlaceholder: 'e.g. Discovery Ltd',
    body: (name, pos, org, date) =>
`${date}

Dear Hiring Manager,

RE: Application for ${pos || 'Technology Position'}

I am excited to apply for the ${pos || 'role'} at ${org || 'your company'}. With a strong technical background and a passion for building scalable, user-centric solutions, I am confident I can contribute effectively to your engineering team.

My experience spans software development, system architecture, and collaborative agile delivery. I stay current with emerging technologies and best practices, and I thrive in environments that value innovation and continuous learning.

I would welcome the opportunity to discuss how my skills and experience can support the goals of ${org || 'your organisation'}.

Yours sincerely,

${name || '[Your Name]'}`,
  },

  retail: {
    label: 'Retail / Sales',
    emoji: '🛍️',
    orgLabel: 'Store / Company',
    posPlaceholder: 'e.g. Sales Consultant',
    orgPlaceholder: 'e.g. Woolworths',
    body: (name, pos, org, date) =>
`${date}

Dear Store Manager / HR,

RE: Application for ${pos || 'Retail / Sales Position'}

I am writing to apply for the ${pos || 'position'} at ${org || 'your store'}. I have a strong customer service background and a natural ability to build rapport with customers, understand their needs, and deliver exceptional shopping experiences.

I am target-driven, reliable, and thrive in team environments. I am experienced in stock management, point-of-sale systems, and visual merchandising, and I am committed to upholding the values and standards of ${org || 'your brand'}.

I look forward to the opportunity to contribute to your team and discuss my application further.

Kind regards,

${name || '[Your Name]'}`,
  },

  hospitality: {
    label: 'Hospitality',
    emoji: '🏨',
    orgLabel: 'Hotel / Restaurant',
    posPlaceholder: 'e.g. Front Desk Receptionist',
    orgPlaceholder: 'e.g. Sun International',
    body: (name, pos, org, date) =>
`${date}

Dear HR Manager,

RE: Application for ${pos || 'Hospitality Position'}

I am pleased to apply for the ${pos || 'position'} at ${org || 'your establishment'}. I have a genuine passion for hospitality and a proven ability to create memorable guest experiences through attentive, professional service.

My background includes guest relations, event coordination, and maintaining high service standards in fast-paced environments. I am a team player with a positive attitude and dedicated to representing ${org || 'your brand'} with pride.

I would love the opportunity to bring my hospitality skills to your team and discuss this role further.

Kind regards,

${name || '[Your Name]'}`,
  },

  general: {
    label: 'General',
    emoji: '📋',
    orgLabel: 'Company / Organisation',
    posPlaceholder: 'e.g. Operations Manager',
    orgPlaceholder: 'e.g. Pick n Pay',
    body: (name, pos, org, date) =>
`${date}

Dear Hiring Manager,

RE: Application for ${pos || 'Advertised Position'}

I am writing to apply for the ${pos || 'position'} at ${org || 'your organisation'}. With a well-rounded professional background and a strong commitment to delivering results, I am confident I would be a valuable addition to your team.

Throughout my career I have demonstrated adaptability, a collaborative spirit, and the ability to perform effectively under pressure. I bring sound problem-solving skills, attention to detail, and a proactive approach to every role I take on.

I am eager to contribute to the success of ${org || 'your organisation'} and would welcome the chance to discuss my suitability for this role.

Yours faithfully,

${name || '[Your Name]'}`,
  },
};

const CATEGORY_KEYS = Object.keys(TEMPLATES);

/* ── Main component ──────────────────────────────────────────── */
export default function CoverLettersPage() {
  const { user } = useAuth();

  /* ── Credits ───────────────────────────────────────────────── */
  const { balance, loading: creditsLoading, deduct } = useCredits();

  /* ── Letter state ───────────────────────────────────────────── */
  const [category,   setCategory]  = useState<string>('education');
  const [position,   setPosition]  = useState('');
  const [org,        setOrg]       = useState('');
  const [recipient,  setRecipient] = useState('');
  const [body,       setBody]      = useState('');
  const [userName,   setUserName]  = useState('');
  const [generating,    setGenerating]    = useState(false);
  const [jobDesc,       setJobDesc]        = useState('');
  const [aiGenerating,  setAiGenerating]   = useState(false);
  const [aiUsed,        setAiUsed]         = useState(false); // credit already spent on AI generation
  const [lastCvData,    setLastCvData]     = useState<Record<string, unknown> | null>(null);

  const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!user) return;
    supabase
      .from('educators')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setUserName(data?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? '');
      });

    // Refresh the session before reading last_cv_data from user_metadata.
    // user_metadata is updated server-side whenever a CV is generated
    // (see CVBuilderPage.tsx's handleCVGenerated), but the in-memory
    // `user` object here can be stale if it was loaded earlier in the
    // session — e.g. the user built a CV, then navigated to Cover Letters
    // without a full page reload in between. Without this refresh, the AI
    // cover letter generator would silently fall back to no CV context,
    // producing a generic letter with no visible error anywhere — exactly
    // what happened during testing before a full logout/login fixed it.
    // This makes that manual workaround unnecessary going forward.
    supabase.auth.refreshSession().then(({ data: refreshed, error }) => {
      if (error) {
        console.warn('[CoverLettersPage] Session refresh failed, using existing session data:', error);
        const savedMeta = user.user_metadata?.last_cv_data as Record<string, unknown> | undefined;
        if (savedMeta) setLastCvData(savedMeta);
        return;
      }
      const freshUser = refreshed?.user ?? user;
      const savedMeta = freshUser.user_metadata?.last_cv_data as Record<string, unknown> | undefined;
      if (savedMeta) setLastCvData(savedMeta);
    });
  }, [user]);

  const rebuildBody = useCallback(() => {
    const tpl = TEMPLATES[category];
    if (tpl) { setBody(tpl.body(userName, position, org, today)); setAiUsed(false); }
  }, [category, userName, position, org, today]);

  useEffect(() => { rebuildBody(); }, [rebuildBody]);

  /* ── AI Generate ───────────────────────────────────────────── */
  const generateWithAI = async () => {
    if (!jobDesc.trim()) {
      toast.error('Please paste the job description first.');
      return;
    }

    // ── Deduct 1 credit BEFORE calling the AI ────────────────────────────
    // This prevents abuse — the credit is spent on the AI call itself.
    // If AI succeeds, download is free for this letter (aiUsed = true).
    const aiRef = `ai_letter_${category}_${Date.now()}`;
    const ok = await deduct('letter_usage', aiRef);
    if (!ok) return; // insufficient credits — toast already shown

    setAiGenerating(true);
    try {
      const res = await fetch('/.netlify/functions/enhance-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_cover_letter',
          jobDescription: jobDesc,
          cvData: lastCvData || null,
          meta: {
            name:     userName,
            position: position,
            org:      org,
            category: category,
          },
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'AI generation failed');
      setBody(result.letter);
      setAiUsed(true); // credit spent — download is now free for this letter
      toast.success('Cover letter generated! Download is free — your credit was used for the AI.');
    } catch (err: any) {
      // AI failed — the credit was already deducted. We can't easily refund
      // automatically, but we flag it so the user knows.
      toast.error((err as any).message || 'AI generation failed. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  /* ── Download ───────────────────────────────────────────────── */
  const handleDownload = async () => {
    if (!body.trim()) { toast.error('Letter body is empty.'); return; }

    // ── Credit logic ──────────────────────────────────────────────────────
    // If user already paid 1 credit for AI generation → download is free.
    // If user is using a plain template → deduct 1 credit now.
    if (!aiUsed) {
      const letterRef = `letter_${category}_${Date.now()}`;
      const ok = await deduct('letter_usage', letterRef);
      if (!ok) return; // insufficient credits — toast already shown
    }

    setGenerating(true);
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const { saveAs } = await import('file-saver');

      const tpl = TEMPLATES[category];
      const subject = `Application for ${position || 'Advertised Position'}`;

      const paragraphs = body.split('\n').map(line =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 24, font: 'Calibri' })],
          spacing: { after: line.trim() === '' ? 160 : 0 },
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: subject, font: 'Calibri', bold: true, size: 28, color: '1e2a3a' })],
              spacing: { after: 320 },
            }),
            ...(recipient ? [
              new Paragraph({
                children: [new TextRun({ text: `To: ${recipient}`, font: 'Calibri', size: 22, italics: true, color: '666666' })],
                spacing: { after: 320 },
              }),
            ] : []),
            ...paragraphs,
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const filename = `Cover_Letter_${(position || tpl.label).replace(/\s+/g, '_')}.docx`;
      saveAs(blob, filename);
      toast.success('Cover letter downloaded as Word document!');
    } catch (err) {
      console.error(err);
      toast.error('Download failed. Ensure docx and file-saver packages are installed.');
    } finally {
      setGenerating(false);
    }
  };

  const tpl = TEMPLATES[category];

  /* ── Full content ───────────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Cover Letters</h1>
          <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-semibold">
            <Coins className="w-3 h-3" />
            {creditsLoading ? '…' : balance}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pick a category, customise the letter, download as Word.
        </p>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
        {CATEGORY_KEYS.map(key => {
          const t = TEMPLATES[key];
          const active = category === key;
          return (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all shrink-0 ${
                active
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={category}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="px-4 space-y-3"
        >
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Position / Job Title</Label>
              <Input value={position} onChange={e => setPosition(e.target.value)} placeholder={tpl.posPlaceholder} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{tpl.orgLabel}</Label>
              <Input value={org} onChange={e => setOrg(e.target.value)} placeholder={tpl.orgPlaceholder} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Recipient Name <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="e.g. Mr Dlamini, Principal" className="rounded-xl" />
            </div>
          </div>

          {/* Job Description + AI generation */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <Label className="text-sm font-semibold">Job Description</Label>
              <span className="text-xs text-muted-foreground">(optional — for AI tailoring)</span>
            </div>
            <Textarea
              value={jobDesc}
              onChange={e => setJobDesc(e.target.value)}
              rows={5}
              placeholder="Paste the job advertisement or description here… The AI will tailor your cover letter to match the specific requirements and keywords."
              className="rounded-xl text-sm resize-none"
            />
            {lastCvData && (
              <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 rounded-lg px-2.5 py-1.5">
                <Check className="w-3 h-3 shrink-0" />
                Your CV is on file — the AI will use your experience and skills to personalise the letter.
              </div>
            )}
            <button
              onClick={generateWithAI}
              disabled={aiGenerating || !jobDesc.trim() || (!creditsLoading && balance < 1)}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50 hover:bg-primary/90"
            >
              {aiGenerating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating tailored letter…</>
                : <><Sparkles className="w-4 h-4" /> Generate with AI · 1 credit</>
              }
            </button>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Letter Body</Label>
              <button onClick={rebuildBody} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                <RotateCcw className="w-3 h-3" /> Reset template
              </button>
            </div>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={20}
              className="rounded-xl font-mono text-sm leading-relaxed resize-none"
              placeholder="Your letter will appear here…"
            />
            <p className="text-xs text-muted-foreground">
              Edit freely — this is exactly what will be saved into the Word document.
            </p>
          </div>

          {/* Low credit warning */}
          {!creditsLoading && balance < 1 && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                You need 1 credit to download a cover letter.{' '}
                <a href="/credits" className="underline font-medium">Buy credits</a>
              </p>
            </div>
          )}

          <Button
            onClick={handleDownload}
            disabled={generating || !body.trim() || (!aiUsed && !creditsLoading && balance < 1)}
            className="w-full h-12 rounded-2xl text-base font-semibold gap-2"
          >
            {generating
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating…</>
              : aiUsed
                ? <><Download className="w-5 h-5" /> Download as Word (.docx) · Free</>
                : <><Download className="w-5 h-5" /> Download as Word (.docx) · 1 credit</>
            }
          </Button>

          <p className="text-xs text-center text-muted-foreground pb-2">
            The .docx file can be opened in Microsoft Word, Google Docs, or LibreOffice.
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
