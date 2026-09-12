/**
 * atsScore.ts — pure client-side heuristic for "how ATS-friendly is this
 * CV likely to be." Deliberately NOT an AI call: this needs to update
 * instantly as someone types or switches templates, which an async credit-
 * gated AI request can't do without feeling laggy and costing money for
 * something that should be free, constant feedback.
 *
 * Based on the current (2026) consensus on what actually breaks Applicant
 * Tracking System parsing — single-column layout, no tables/text boxes for
 * core content, a real Skills section, bullet points rather than dense
 * paragraphs, and quantifiable achievements. This is a heuristic, not a
 * real ATS simulation — it can't know what a specific employer's actual
 * ATS software does, and should be presented to users as a helpful
 * indicator, not a guarantee.
 */

export interface ATSCheck {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  tip: string; // shown when NOT passed — what to actually do about it
}

export interface ATSResult {
  score: number; // 0–100
  checks: ATSCheck[];
}

// None of the 10 real templates currently use a multi-column/sidebar
// layout — this list exists so the check still means something if a
// future template ever reintroduces one, rather than silently always
// passing regardless of what's actually shipped.
const MULTI_COLUMN_TEMPLATES = new Set<string>([]);

function hasDigit(text: string): boolean {
  return /\d/.test(text);
}

export function computeATSScore(data: any): ATSResult {
  const personal = data?.personal || {};
  const education: any[] = (data?.education || []).filter((e: any) => e?.institution);
  const experience: any[] = (data?.experience || []).filter((e: any) => e?.school);
  const skills = data?.skills || {};
  const customSections: any[] = data?.custom_sections || [];
  const template = data?.template || 'classic';

  const totalSkillsCount = (skills.subjects?.length || 0) + (skills.soft_skills?.length || 0);

  const allBulletLines: string[] = experience.flatMap((e: any) =>
    String(e.description || '').split('\n').map((l: string) => l.trim()).filter(Boolean)
  );
  // A "bulleted" description has multiple short lines; a single very long
  // line is almost certainly one dense paragraph typed without line
  // breaks, which is exactly the pattern ATS parsers handle worst.
  const experienceIsBulleted = experience.length === 0 || experience.every((e: any) => {
    const lines = String(e.description || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
    return lines.length === 0 || lines.every(l => l.length < 220);
  });

  const totalContentLength =
    (personal.bio || '').length +
    experience.reduce((sum, e) => sum + (e.description || '').length, 0);

  const hasTableSection = customSections.some((s: any) => s.type === 'table' && (s.rows || []).length > 0);

  const checks: ATSCheck[] = [
    {
      id: 'single_column',
      label: 'Single-column layout',
      weight: 15,
      passed: !MULTI_COLUMN_TEMPLATES.has(template),
      tip: 'Multi-column and sidebar layouts are the leading cause of ATS parsing errors — switch to a single-column template.',
    },
    {
      id: 'no_tables',
      label: 'No tables in custom sections',
      weight: 10,
      passed: !hasTableSection,
      tip: 'Tables can scramble reading order for some ATS parsers — use a bullet list or paragraph instead.',
    },
    {
      id: 'summary',
      label: 'Professional summary included',
      weight: 15,
      passed: (personal.bio || '').trim().length >= 40,
      tip: 'Add a short professional summary (2–3 sentences) — it gives the ATS keyword context right at the top.',
    },
    {
      id: 'contact_complete',
      label: 'Complete contact details',
      weight: 10,
      passed: !!(personal.full_name && personal.email && personal.phone),
      tip: 'Make sure your name, email, and phone number are all filled in on the Personal step.',
    },
    {
      id: 'experience_present',
      label: 'Work experience listed',
      weight: 10,
      passed: experience.length > 0,
      tip: 'Add at least one work experience entry — most ATS scoring weighs this heavily.',
    },
    {
      id: 'bullets_not_paragraphs',
      label: 'Bullet points, not dense paragraphs',
      weight: 10,
      passed: experienceIsBulleted,
      tip: 'Break long experience descriptions into short bullet points — one achievement per line.',
    },
    {
      id: 'quantifiable',
      label: 'At least one measurable achievement',
      weight: 10,
      passed: allBulletLines.length === 0 || allBulletLines.some(hasDigit),
      tip: 'Add a number where you can — team size, percentage, rand value, years — measurable results stand out to both ATS keyword matching and human reviewers.',
    },
    {
      id: 'education_present',
      label: 'Education listed',
      weight: 5,
      passed: education.length > 0,
      tip: 'Add your highest qualification on the Education step.',
    },
    {
      id: 'skills_populated',
      label: 'Skills section has real content',
      weight: 15,
      passed: totalSkillsCount >= 3,
      tip: 'List at least 3–5 relevant skills — this is one of the most heavily keyword-matched sections.',
    },
    {
      id: 'dates_complete',
      label: 'Experience dates filled in',
      weight: 5,
      passed: experience.length === 0 || experience.every((e: any) => e.from && e.to),
      tip: 'Fill in a "from" and "to" date for every work experience entry — missing dates can look like an unexplained gap.',
    },
    {
      id: 'no_photo',
      label: 'No profile photo',
      weight: 5,
      passed: !personal.photo_url,
      tip: "Photos are usually ignored by ATS parsers but are worth removing for the most conservative, parser-safe version of your CV — this is a minor, optional caution, not a hard rule.",
    },
    {
      id: 'reasonable_length',
      label: 'Reasonable content length',
      weight: 5,
      passed: totalContentLength >= 120,
      tip: 'Your summary and experience descriptions look quite thin — add a bit more detail so there\'s enough content for keyword matching.',
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks.filter(c => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  return { score, checks };
}
