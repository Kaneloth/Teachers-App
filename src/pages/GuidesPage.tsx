import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ChevronDown, ChevronRight, FileText, CheckCircle2, AlertCircle, X, Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import SubscriptionModal from '@/components/SubscriptionModal';
import { useAuth } from '@/lib/AuthContext';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, LevelFormat, BorderStyle, WidthType, ShadingType, HeadingLevel, PageBreak } from 'docx';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EducatorProfile {
  full_name: string;
  current_school: string;
  current_province: string;
  phone: string;
  email: string;
  personal_number?: string;
  post_level?: string;
}

// ── Docx generation (client-side, using the docx npm package) ─────────────────
async function generateDocx(templateType: string, profile: EducatorProfile): Promise<Blob> {

  const today = new Date().toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const name    = profile.full_name    || '[Full Name]';
  const school  = profile.current_school || '[Current School Name]';
  const province = profile.current_province || '[Province]';
  const phone   = profile.phone        || '[Phone Number]';
  const email   = profile.email        || '[Email Address]';
  const persNo  = profile.personal_number || '[Personal/Persal Number]';
  const postLvl = profile.post_level   || '[Post Level, e.g. PL1]';

  // ── Shared styles ────────────────────────────────────────────────────────
  const styles = {
    default: {
      document: { run: { font: 'Arial', size: 24 } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: '1F4E79' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
      },
    ],
  };

  const numbering = {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  };

  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

  function p(text: string, opts?: { bold?: boolean; size?: number; align?: typeof AlignmentType[keyof typeof AlignmentType]; spacing?: { before?: number; after?: number }; color?: string }) {
    return new Paragraph({
      alignment: opts?.align,
      spacing: opts?.spacing ?? { before: 0, after: 160 },
      children: [new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 24,
        font: 'Arial',
        color: opts?.color,
      })],
    });
  }

  function blank() {
    return new Paragraph({ children: [new TextRun({ text: '', font: 'Arial', size: 24 })] });
  }

  function field(label: string, value: string) {
    return new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({ text: `${label}: `, bold: true, font: 'Arial', size: 24 }),
        new TextRun({ text: value, font: 'Arial', size: 24 }),
      ],
    });
  }

  function sectionHeading(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text, bold: true, font: 'Arial', size: 28, color: '1F4E79' })],
    });
  }

  function signatureLine(label: string) {
    return [
      blank(),
      p('_'.repeat(40)),
      p(label, { bold: true }),
      p('Date: ________________________'),
      blank(),
    ];
  }

  // ── REQUEST LETTER ───────────────────────────────────────────────────────
  if (templateType === 'request') {
    const doc = new Document({
      styles,
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          p(name, { bold: true }),
          p(school),
          p(province),
          p(phone),
          p(email),
          p(`Persal No: ${persNo}`),
          blank(),
          p(today),
          blank(),
          p('The Principal & School Governing Body', { bold: true }),
          p(school),
          blank(),
          sectionHeading('REQUEST FOR CROSS-TRANSFER'),
          blank(),
          p('Dear Principal and Members of the School Governing Body,'),
          blank(),
          p('I, the undersigned, hereby formally request a cross-transfer from my current position at [Current School] to [Receiving School]. I respectfully request your support and endorsement of this application.'),
          blank(),
          p('Details of Transfer Request:', { bold: true }),
          field('Full Name', name),
          field('Current School', school),
          field('Post Level', postLvl),
          field('Persal Number', persNo),
          field('Receiving School', '[Receiving School Name]'),
          field('Reason for Transfer', '[State your reason, e.g. proximity to home, personal circumstances, mutual benefit]'),
          blank(),
          p('I have ensured that a suitable candidate is available for a mutual transfer agreement and that both schools are in agreement. I am committed to ensuring a smooth handover of my responsibilities.'),
          blank(),
          p('I attach the following supporting documents:', { bold: true }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Copy of ID document', font: 'Arial', size: 24 })] }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Proof of address', font: 'Arial', size: 24 })] }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Latest performance appraisal (IQMS/PMDS)', font: 'Arial', size: 24 })] }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Acceptance letter from receiving school', font: 'Arial', size: 24 })] }),
          blank(),
          p('I trust that this request will be considered favourably.'),
          blank(),
          p('Yours sincerely,'),
          ...signatureLine(`${name} (Applicant)`),
        ],
      }],
      numbering,
    });
    return Packer.toBlob(doc);
  }

  // ── RELEASE LETTER ───────────────────────────────────────────────────────
  if (templateType === 'release') {
    const doc = new Document({
      styles,
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          p('[Current School Letterhead]', { bold: true, align: AlignmentType.CENTER, color: '1F4E79' }),
          p('[School Address]', { align: AlignmentType.CENTER }),
          p('[Tel] | [Email]', { align: AlignmentType.CENTER }),
          blank(),
          p(today),
          blank(),
          p('The Principal', { bold: true }),
          p('[Receiving School Name]'),
          p('[Receiving School Address]'),
          blank(),
          sectionHeading('RELEASE LETTER — CROSS-TRANSFER APPLICATION'),
          blank(),
          p('Dear Principal,'),
          blank(),
          p(`This letter serves to confirm that ${name}, currently employed at ${school} as an educator at Post Level ${postLvl} (Persal No: ${persNo}), has been granted conditional release to pursue a cross-transfer to your institution.`),
          blank(),
          p('The release is subject to the following conditions:', { bold: true }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'The transfer is of a mutual/cross nature, with a suitable replacement educator being transferred to our school simultaneously.', font: 'Arial', size: 24 })] }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'All outstanding work, reports, and administrative duties are completed before the transfer date.', font: 'Arial', size: 24 })] }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Final approval is obtained from the relevant education district office and Provincial Department of Education.', font: 'Arial', size: 24 })] }),
          blank(),
          p('We confirm that the SGB has been consulted and has endorsed this release.'),
          blank(),
          p('We wish the educator well in the new posting and trust that the transition will benefit both institutions.'),
          blank(),
          ...signatureLine('Principal — Current School'),
          ...signatureLine('Chairperson, School Governing Body'),
          p('Official School Stamp:', { bold: true }),
        ],
      }],
      numbering,
    });
    return Packer.toBlob(doc);
  }

  // ── ACCEPTANCE LETTER ────────────────────────────────────────────────────
  if (templateType === 'acceptance') {
    const doc = new Document({
      styles,
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          p('[Receiving School Letterhead]', { bold: true, align: AlignmentType.CENTER, color: '1F4E79' }),
          p('[School Address]', { align: AlignmentType.CENTER }),
          p('[Tel] | [Email]', { align: AlignmentType.CENTER }),
          blank(),
          p(today),
          blank(),
          p(name, { bold: true }),
          p(school),
          blank(),
          sectionHeading('ACCEPTANCE LETTER — CROSS-TRANSFER APPLICATION'),
          blank(),
          p(`Dear ${name},`),
          blank(),
          p(`This letter serves to confirm that [Receiving School Name] has accepted your cross-transfer application. We welcome you to our school community and look forward to your contribution.`),
          blank(),
          p('Details of Acceptance:', { bold: true }),
          field('Applicant', name),
          field('Current School', school),
          field('Persal Number', persNo),
          field('Anticipated Start Date', '[Date, subject to district approval]'),
          field('Post / Subject(s)', '[Subject(s) to be taught]'),
          blank(),
          p('This acceptance is conditional upon:', { bold: true }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Formal approval from the Provincial Department of Education and the relevant district.', font: 'Arial', size: 24 })] }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Receipt of a release letter from your current school signed by the principal and SGB.', font: 'Arial', size: 24 })] }),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Completion of all paperwork including the official provincial cross-transfer form (Annexure A).', font: 'Arial', size: 24 })] }),
          blank(),
          p('Please submit all required documents to the education district office at your earliest convenience.'),
          blank(),
          ...signatureLine('Principal — Receiving School'),
          ...signatureLine('Chairperson, School Governing Body'),
          p('Official School Stamp:', { bold: true }),
        ],
      }],
      numbering,
    });
    return Packer.toBlob(doc);
  }

  // ── ANNEXURE A ───────────────────────────────────────────────────────────
  if (templateType === 'annexure') {
    const row = (label: string, value = '') => new TableRow({
      children: [
        new TableCell({
          borders: cellBorders, margins: cellMargins,
          width: { size: 4500, type: WidthType.DXA },
          shading: { fill: 'EBF3FF', type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 22 })] })],
        }),
        new TableCell({
          borders: cellBorders, margins: cellMargins,
          width: { size: 4500, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: value || ' ', font: 'Arial', size: 22 })] })],
        }),
      ],
    });

    const doc = new Document({
      styles,
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          p('GAUTENG DEPARTMENT OF EDUCATION', { bold: true, size: 28, align: AlignmentType.CENTER, color: '1F4E79' }),
          p('CROSS-TRANSFER APPLICATION FORM', { bold: true, size: 26, align: AlignmentType.CENTER }),
          p('ANNEXURE A (Reference Template — Verify current form with your district)', {
            align: AlignmentType.CENTER,
            color: 'CC0000',
          }),
          blank(),

          sectionHeading('SECTION A: APPLICANT DETAILS'),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            columnWidths: [4500, 4500],
            rows: [
              row('Surname', name.split(' ').slice(-1)[0]),
              row('First Name(s)', name.split(' ').slice(0, -1).join(' ')),
              row('ID Number', '[ID Number]'),
              row('Persal / Personnel Number', persNo),
              row('Race', '[Race — EEA requirement]'),
              row('Gender', '[Gender]'),
              row('Cell Phone', phone),
              row('Email Address', email),
              row('Physical Address', '[Home Address]'),
            ],
          }),
          blank(),

          sectionHeading('SECTION B: CURRENT POST DETAILS'),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            columnWidths: [4500, 4500],
            rows: [
              row('Current School Name', school),
              row('School EMIS Number', '[EMIS Number]'),
              row('District', '[Provincial DoE District]'),
              row('Post Level', postLvl),
              row('Rank / Designation', '[e.g. Educator, HoD, Deputy Principal]'),
              row('Subject(s) Taught', '[Subjects]'),
              row('Phase', '[Foundation / Intermediate / Senior / FET]'),
              row('Years at Current School', '[Number of years]'),
            ],
          }),
          blank(),

          sectionHeading('SECTION C: REQUESTED POST DETAILS'),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            columnWidths: [4500, 4500],
            rows: [
              row('Receiving School Name', '[Receiving School Name]'),
              row('School EMIS Number', '[EMIS Number]'),
              row('District', '[Provincial DoE District]'),
              row('Post Level', '[Post Level]'),
              row('Rank / Designation', '[Designation at new school]'),
              row('Subject(s) to be Taught', '[Subjects]'),
              row('Mutual Transfer Partner Name', '[Name of educator transferring to current school]'),
            ],
          }),
          blank(),

          sectionHeading('SECTION D: MOTIVATION'),
          p('State clearly the reason(s) for the requested cross-transfer:'),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            columnWidths: [9000],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders, margins: cellMargins,
                    width: { size: 9000, type: WidthType.DXA },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: '[Write your motivation here — e.g. proximity to home, family circumstances, professional development]', font: 'Arial', size: 22, color: '888888' })] }),
                      blank(), blank(), blank(),
                    ],
                  }),
                ],
              }),
            ],
          }),
          blank(),

          sectionHeading('SECTION E: DECLARATIONS & SIGNATURES'),
          p('I hereby declare that the information provided above is true and correct to the best of my knowledge.'),
          blank(),
          ...signatureLine(`${name} (Applicant)`),
          ...signatureLine('Principal — Current School'),
          ...signatureLine('Chairperson, SGB — Current School'),
          ...signatureLine('Principal — Receiving School'),
          ...signatureLine('Chairperson, SGB — Receiving School'),

          blank(),
          p('FOR DISTRICT OFFICE USE ONLY', { bold: true, color: '1F4E79' }),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            columnWidths: [4500, 4500],
            rows: [
              row('Received By', ''),
              row('Date Received', ''),
              row('Reference Number', ''),
              row('Recommended / Not Recommended', ''),
              row('Comments', ''),
            ],
          }),
          blank(),
          p('DISCLAIMER: This is a reference template. Always obtain and use the official, current form from your your education education district office. Requirements may change.', { color: 'CC0000' }),
        ],
      }],
      numbering,
    });
    return Packer.toBlob(doc);
  }

  throw new Error(`Unknown template type: ${templateType}`);
}

// ── Step data ─────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 1,
    title: 'Confirm your match',
    icon: '🤝',
    bullets: [
      'Go to the Matches tab and verify that both you and the other educator have confirmed the mutual transfer.',
      'Ensure both schools are in agreement — the transfer requires a willing exchange between two educators.',
      'Note the other educator\'s name, school, and contact details for your application documents.',
    ],
  },
  {
    id: 2,
    title: 'Write a request letter to your principal & SGB',
    icon: '✉️',
    bullets: [
      'Download the Request Letter template below and fill in your details.',
      'Submit it formally to your current principal and School Governing Body (SGB).',
      'Keep a copy with an acknowledgement of receipt (date stamp or email confirmation).',
      'Allow at least 5–10 working days for the SGB to meet and respond.',
    ],
    templateKey: 'request',
    templateLabel: 'Download Request Letter',
  },
  {
    id: 3,
    title: 'Obtain a release letter from your current school',
    icon: '📄',
    bullets: [
      'Once the principal and SGB have approved, request that they issue an official Release Letter on the school\'s letterhead.',
      'The release letter must be signed by both the principal and the SGB chairperson, with the school stamp.',
      'Use the Release Letter template as a reference — your school may use their own format.',
      'This letter confirms your school releases you subject to district approval.',
    ],
    templateKey: 'release',
    templateLabel: 'Download Release Letter Template',
  },
  {
    id: 4,
    title: 'Obtain an acceptance letter from the receiving school',
    icon: '🏫',
    bullets: [
      'The receiving school must issue a formal Acceptance Letter indicating they agree to receive you.',
      'This letter must also be signed by the receiving principal and SGB chairperson.',
      'Share the Acceptance Letter template with the receiving school for reference.',
    ],
    templateKey: 'acceptance',
    templateLabel: 'Download Acceptance Letter Template',
  },
  {
    id: 5,
    title: 'Complete the official Annexure A form',
    icon: '📋',
    bullets: [
      'Download the Annexure A reference template below — it mirrors the official provincial cross-transfer form.',
      'Obtain the current official form from your education district office (forms are updated periodically).',
      'Fill in all fields including personal details, current and receiving school details, and motivation.',
      'Both principals and SGB chairpersons from both schools must sign.',
    ],
    templateKey: 'annexure',
    templateLabel: 'Download Annexure A Template',
  },
  {
    id: 6,
    title: 'Submit all documents to both principals & education district office',
    icon: '📬',
    bullets: [
      'Compile a complete set of documents: Request Letter, Release Letter, Acceptance Letter, Annexure A, ID copy, and any supporting documents.',
      'Submit one set to your current principal and one set to the receiving principal.',
      'Submit the original set to your your education education district office — confirm the correct submission address with your school.',
      'Request an official acknowledgement of receipt with a reference number.',
    ],
  },
  {
    id: 7,
    title: 'Follow up with district and HR',
    icon: '📞',
    bullets: [
      'After submission, follow up with your education district office (HR) every 2–3 weeks.',
      'Quote your reference number in all communications.',
      'The process typically takes 1–3 months depending on the district\'s workload.',
      'Do not leave your current post until you receive official written confirmation from Provincial DoE.',
      'Keep copies of all correspondence for your records.',
    ],
  },
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function GuidesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<EducatorProfile>({
    full_name: '', current_school: '', current_province: '',
    phone: '', email: '', personal_number: '', post_level: '',
  });
  const [openStep, setOpenStep]       = useState<number | null>(1);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [lightbox, setLightbox]       = useState<string | null>(null);
  const [isPro, setIsPro]             = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      const meta = u?.user_metadata ?? {};
      const { data: edu } = await supabase
        .from('educators')
        .select('full_name, phone, current_school, current_province, personal_number, post_level')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      setProfile({
        full_name:        edu?.full_name        || (meta.full_name as string)  || '',
        current_school:   edu?.current_school   || '',
        current_province: edu?.current_province || '',
        phone:            edu?.phone            || '',
        email:            u?.email              || '',
        personal_number:  edu?.personal_number  || '',
        post_level:       edu?.post_level       || '',
      });

      // ── Subscription check (mirrors MatchesPage pattern) ──────────────
      const metaPlan = u?.user_metadata?.subscription_plan as string | undefined;
      const metaEnd  = u?.user_metadata?.subscription_end  as string | undefined;
      const isProMeta = metaPlan && metaPlan !== 'free' && metaEnd && new Date(metaEnd) > new Date();
      if (isProMeta) {
        setIsPro(true);
      } else {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('subscription_plan, subscription_end')
          .eq('id', user.id)
          .single();
        const proFromDb =
          profileRow?.subscription_plan &&
          profileRow.subscription_plan !== 'free' &&
          profileRow.subscription_end &&
          new Date(profileRow.subscription_end) > new Date();
        setIsPro(!!proFromDb);
      }
    };
    load();
  }, [user]);

  const handleDownload = async (templateKey: string, templateLabel: string) => {
    setDownloading(templateKey);
    try {
      const blob = await generateDocx(templateKey, profile);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${templateLabel.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template generation failed:', err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Transfer Guides</h1>
          <p className="text-xs text-muted-foreground">Provincial DoE Cross-Transfer Process & Templates</p>
        </div>
      </div>

      {/* Disclaimer banner */}
      <div className="flex gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 mb-4">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          This guide is for general reference only and reflects typical cross-transfer procedures.
          Always confirm current requirements with your <strong>your education education district office</strong> before submitting.
          Official forms may be updated — obtain the latest version from your district.
        </p>
      </div>

      {/* Profile pre-fill notice */}
      {profile.full_name && (
        <div className="flex gap-2 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 mb-4">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-primary leading-relaxed">
            Templates will be pre-filled with your details: <strong>{profile.full_name}</strong>
            {profile.current_school ? ` · ${profile.current_school}` : ''}
          </p>
        </div>
      )}

      {/* Overview badges */}
      <div className="flex gap-2 flex-wrap mb-5">
        <Badge variant="secondary">7 Steps</Badge>
        <Badge variant="secondary">4 Downloadable Templates</Badge>
        <Badge variant="outline">Provincial DoE</Badge>
        <Badge variant="outline">Cross-Transfer</Badge>
      </div>

      {/* ── Upgrade banner for free users ── */}
      {!isPro && (
        <div className="bg-primary/5 border border-primary/30 rounded-2xl px-4 py-4 mb-4 flex gap-3 items-start">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground mb-0.5">Pro Feature</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upgrade to Pro to unlock all transfer steps, download templates, and get your documents pre-filled with your details.
            </p>
            <button
              onClick={() => setShowSubModal(true)}
              className="mt-2.5 flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Zap className="w-3 h-3" /> Upgrade to Pro
            </button>
          </div>
        </div>
      )}

      {/* Step-by-step accordion */}
      <div className="space-y-2 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Step-by-Step Process</h2>
        {STEPS.map(step => {
          const isOpen = openStep === step.id;
          // Free users: only step 1 is openable (teaser), rest are locked
          const isLocked = !isPro && step.id > 1;
          return (
            <div key={step.id} className={`bg-card border rounded-2xl overflow-hidden transition-colors ${isLocked ? 'border-border opacity-75' : 'border-border'}`}>
              <button
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isLocked ? 'cursor-default' : 'hover:bg-muted/50'}`}
                onClick={() => isLocked ? setShowSubModal(true) : setOpenStep(isOpen ? null : step.id)}
              >
                <span className="text-lg shrink-0">{step.icon}</span>
                <span className="flex-1 text-sm font-semibold text-foreground">
                  <span className="text-muted-foreground font-normal mr-1.5">Step {step.id}.</span>
                  {step.title}
                </span>
                {isLocked
                  ? <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  : isOpen
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                }
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <ul className="space-y-2">
                    {step.bullets.map((bullet, i) => (
                      <li key={i} className="flex gap-2 items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span className="text-sm text-muted-foreground leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  {'templateKey' in step && step.templateKey && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 rounded-xl mt-1"
                      disabled={downloading === step.templateKey}
                      onClick={() => handleDownload(step.templateKey!, step.templateLabel!)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {downloading === step.templateKey ? 'Generating…' : step.templateLabel}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Templates quick-access section */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">All Templates</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'request',    label: 'Request Letter',     desc: 'To your principal & SGB',        icon: '✉️' },
            { key: 'release',    label: 'Release Letter',     desc: 'From your current school',        icon: '📄' },
            { key: 'acceptance', label: 'Acceptance Letter',  desc: 'From the receiving school',       icon: '🏫' },
            { key: 'annexure',   label: 'Annexure A',         desc: 'Official Provincial DoE reference form',     icon: '📋' },
          ].map(t => (
            <button
              key={t.key}
              disabled={downloading === t.key}
              onClick={() => isPro ? handleDownload(t.key, t.label) : setShowSubModal(true)}
              className={`bg-card border rounded-2xl p-4 text-left transition-all ${isPro ? "border-border hover:border-primary/50 hover:bg-primary/5" : "border-border/60 opacity-70"}`}
            >
              <div className="text-2xl mb-2">{t.icon}</div>
              <div className="text-sm font-semibold text-foreground">{t.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
              <div className="flex items-center gap-1 mt-2 text-xs font-medium text-primary">
                {!isPro
                  ? <><Lock className="w-3 h-3" /> Pro only</>
                  : downloading === t.key
                    ? <><FileText className="w-3 h-3" /> Generating…</>
                    : <><Download className="w-3 h-3" /> Download .docx</>
                }
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tips section */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">💡 Helpful Tips</h2>
        <ul className="space-y-2">
          {[
            'Keep a dedicated folder (physical and digital) for all transfer documents.',
            'Communicate openly with both principals — surprises derail applications.',
            'The mutual transfer partner\'s application must be submitted simultaneously.',
            'Your Persal number is on your payslip — it\'s required on all Provincial DoE forms.',
            'District offices differ — some accept walk-ins, others require email submissions.',
            'SACE registration must be up to date before any transfer can be approved.',
          ].map((tip, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
              <span className="text-sm text-muted-foreground leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Contact prompt */}
      <div className="bg-muted rounded-2xl px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">
          Questions about the process? Contact your <strong>Your Education District Office</strong> directly
          or visit{' '}
          <a href="https://www.education.gov.za" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            www.education.gov.za
          </a>
        </p>
      </div>

      <SubscriptionModal open={showSubModal} onClose={() => setShowSubModal(false)} />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={lightbox} alt="Sample" className="max-w-full max-h-full rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
