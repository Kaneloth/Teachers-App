import busboy from 'busboy';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

async function extractTextFromBuffer(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    throw new Error('Unsupported file type. Please upload PDF or DOCX.');
  }
}

// ── Shared system prompt used for both CV file parsing and free-text parsing ──
const SYSTEM_PROMPT = `You are an expert South African CV writer and HR specialist with deep knowledge of all industries and professions. You assist ALL job seekers equally — educators, nurses, engineers, accountants, IT professionals, retail workers, managers, and any other profession.

Your expertise includes:
- ALL South African industries: education, healthcare, finance, IT, engineering, retail, hospitality, legal, government, NGO, mining, agriculture, and more
- The South African education sector specifically (GDE, SACE, DBE, CAPS, phases, subject codes) — but only when the person is an educator
- South African professional context: NQF levels, SAQA qualifications, professional bodies (SAICA, ECSA, HPCSA, SACE, etc.)
- How to identify and classify unstructured career information into proper CV sections for ANY profession

Your job is to take raw text (either from an uploaded CV or free-form user input) and:
1. Intelligently extract and RESTRUCTURE all information into the correct CV sections
2. Identify experience entries even when not clearly labelled — for ANY industry or role
3. Identify skills, qualifications, and languages from unstructured text across ALL professions
4. Generate a professional, polished bio/summary appropriate to the person's actual profession
5. Classify miscellaneous info (awards, training, publications, certifications) into custom_sections
6. NEVER invent information. This is an absolute rule: do not add job titles, seniority levels (e.g. "Manager", "Senior", "Director"), years of experience, skills, achievements, or qualifications that are not explicitly present in the input text. If someone has no work experience, the experience array should be empty — do not fabricate a role to fill it. If information is sparse, the output should be sparse and honest, not padded with plausible-sounding invented detail.
7. NEVER assume someone is an educator unless they explicitly mention teaching, schools, or education`;

function buildStructurePrompt(inputText, cvType, isFreeText = false) {
  const inputLabel = isFreeText
    ? 'FREE-FORM USER INPUT (the user has typed information about themselves in their own words)'
    : 'CV DOCUMENT TEXT (extracted from an uploaded PDF or Word document)';

  return `${SYSTEM_PROMPT}

${inputLabel}:
"""
${inputText}
"""

CV TYPE (app context — a HINT only, not a fact): ${cvType === 'educator' ? 'South African Educator CV' : 'General Professional CV'}

IMPORTANT: The CV TYPE above reflects which section of the app the user is in, NOT necessarily their actual profession. The TEXT ABOVE is the only real source of truth about who this person is and what they do. If the input text contains no mention of teaching, schools, learners, or education-related work, do NOT frame this person as an educator, regardless of the CV TYPE hint — base the bio and all framing strictly on what the text actually says about their field (e.g. accounting, IT, retail, etc.) or their studies if they have no work experience yet.

TASK: Extract, restructure, and enhance this information into the JSON structure below.

RULES:
1. RESTRUCTURE intelligently based on the person's actual profession AS STATED IN THE TEXT ABOVE — never based on the CV TYPE hint alone:
   - Educator: "I taught Maths at Sandton High from 2018 to 2022" → role="Mathematics Educator", school="Sandton High School"
   - Nurse: "I worked in ICU at Netcare since 2019" → role="ICU Nurse", school="Netcare [Hospital]", from="2019"
   - Accountant: "I've been a CA at Deloitte for 5 years" → role="Chartered Accountant", school="Deloitte"
   - IT: "I was a senior dev at Takealot building APIs" → role="Senior Software Developer", school="Takealot"
   - Any profession: extract role title, employer/organisation, dates from ANY description

2. IDENTIFY skills based on the person's actual field:
   - For educators: subjects go in skills.subjects (e.g. "Mathematics", "Physical Sciences")
   - For ALL professions: technical skills, tools, certifications go in skills.soft_skills
   - Examples: nurses → "Patient Care, ICU, Trauma", accountants → "IFRS, Tax, Audit", IT → "React, Python, AWS"
   - The "subjects" array is ONLY for school subjects taught by educators. For all other professions, use soft_skills.

3. IDENTIFY soft/professional skills from context for ANY job:
   - "I managed a team" → "Team Leadership"
   - "I handled client accounts" → "Client Relationship Management"  
   - "I did budgets" → "Budget Management"
   - "I supervised staff" → "Staff Supervision"

4. GENERATE a professional bio/summary appropriate to:
   - The person's actual industry and role level — based ONLY on what's in the input text above
   - Their years of experience — ONLY if dates/duration are actually stated; never estimate or assume
   - Their key strengths and notable achievements — ONLY ones explicitly mentioned
   - The South African job market context
   Length should match how much real information is available: 1 sentence is correct and sufficient for someone with little/no stated experience. NEVER invent a job title, seniority level, years of experience, or achievement that isn't directly supported by the input text. A short, honest summary is always correct; an embellished one is always wrong.
   IMPORTANT: "don't invent" does not mean "stay vague" — if specific subjects, qualifications, or skills ARE mentioned in the input text (e.g. "Mathematics", "Accounting", "B.Com"), name them explicitly in the bio. Never substitute a real, given detail with a generic phrase like "my field of study" — that is just as inaccurate as fabrication, since it fails to represent what the person actually told you.

5. PRESERVE all bullet points in experience descriptions — join them with newlines.

6. PUT miscellaneous info into custom_sections with appropriate titles:
   - Professional certifications → "Certifications"
   - Training courses → "Training & Development"  
   - Awards/recognition → "Awards & Achievements"
   - Volunteer work → "Volunteer Experience"
   - Publications → "Publications"

7. For dates: use formats like "Jan 2018", "2018", "Present" — whatever is clearest.
8. drivers_licence: array of SA licence codes like ["Code 8", "Code 10"] or [] if not mentioned.
9. If input is unstructured, be generous in interpreting intent — extract maximum useful information.
10. The "school" field in experience entries means the EMPLOYER/ORGANISATION for non-educators (company, hospital, firm, etc.).

CUSTOM SECTIONS format:
{
  "title": "Training & Workshops",   // or "Awards", "Certifications", "Publications", etc.
  "type": "bullets",                 // always "bullets" for lists, "text" for paragraphs
  "content": "Item 1\nItem 2\nItem 3" // newline-separated bullet points
}

Return ONLY valid JSON matching this exact structure:
{
  "personal": {
    "full_name": "",
    "email": "",
    "phone": "",
    "address": "",
    "bio": "",
    "id_number": "",
    "gender": "",
    "population_group": "",
    "citizenship": "",
    "drivers_licence": []
  },
  "education": [
    { "institution": "", "qualification": "", "year": "" }
  ],
  "experience": [
    { "school": "", "role": "", "from": "", "to": "", "description": "" }
  ],
  "skills": {
    "subjects": [],
    "soft_skills": [],
    "languages": []
  },
  "references": [
    { "name": "", "title": "", "organisation": "", "phone": "", "email": "", "relationship": "" }
  ],
  "custom_sections": []
}`;
}

function buildSummaryPrompt(cvData, userBlurb) {
  const name     = cvData?.personal?.full_name || 'the applicant';
  // Determine profession from experience roles — don't assume educator
  const roles    = (cvData?.experience || []).filter(e => e.role).map(e => e.role);
  const isEducator = roles.some(r => /teach|educat|school|lectur|tutor|instructor/i.test(r));
  const expList  = (cvData?.experience || [])
    .filter(e => e.school || e.role)
    .map(e => `${e.role || 'Professional'} at ${e.school || 'organisation'} (${e.from || ''}–${e.to || ''})`)
    .join('; ');
  const subjects   = (cvData?.skills?.subjects   || []).join(', ');
  const softSkills = (cvData?.skills?.soft_skills || []).join(', ');
  const eduList    = (cvData?.education || [])
    .filter(e => e.qualification)
    .map(e => `${e.qualification} from ${e.institution} (${e.year})`)
    .join('; ');

  const professionHint = isEducator
    ? 'Based on their work experience, this person is an educator — mention subjects taught, phase/grade level, and teaching strengths.'
    : 'This person works in a non-education professional field (or has no work experience yet) — mention their actual industry/field of study, role level, key technical skills, and career achievements. Do NOT describe them as an educator, teacher, or anything education-related unless their work experience explicitly says so.';

  return `You are a professional CV writer specialising in South African CVs for ALL industries and professions.

Write a Professional Summary (bio) for a CV. It must be:
- 1 to 4 sentences — length depends ENTIRELY on how much real information is provided below. A person with little or no work history should get a SHORT summary (even just 1 sentence). Do not pad a short summary with invented detail to reach 3-4 sentences.
- Written in first person ("I am...", "I have...")
- Professional and clear in tone
- Based STRICTLY on the information given below — nothing else

${professionHint}

ABSOLUTE RULE — DO NOT VIOLATE THIS UNDER ANY CIRCUMSTANCES:
You must NEVER invent, assume, exaggerate, or upgrade ANY fact that is not explicitly present in the information below. This includes (but is not limited to):
- Job titles or seniority levels (e.g. do not call someone a "Manager", "Director", "Senior X", or "Head of Y" unless that exact title or an unambiguous equivalent appears in their work experience below)
- Years of experience (e.g. do not state "X years of experience" unless dates are given that actually support that number — and if no work experience is listed at all, do NOT claim any years of experience)
- Skills, achievements, or responsibilities not listed below
- Industry expertise beyond what the listed experience/education actually supports

If the person has NO work experience listed (e.g. a recent graduate or first-time job seeker), the summary must reflect that honestly — for example, describing them as a motivated graduate or candidate eager to begin their career, based on their education/skills only. Do NOT describe them as experienced, do NOT invent a job title, and do NOT claim years of experience they do not have. A short, honest, well-written summary for someone with no experience is the correct and expected output — it is NOT a failure to be "compelling".

CRITICAL — SPECIFICITY IS REQUIRED, NOT OPTIONAL:
"Don't invent information" does NOT mean "stay vague". You MUST name the actual, specific details given below — never replace a real fact with a vague generic phrase. For example:
- If the qualification is "B.Com in Accounting" or the subjects are "Mathematics, Accounting", say exactly that — NEVER write a vague substitute like "my field of study" or "my area of expertise" when the real subject/qualification name is sitting right there in the information below.
- If a skill, subject, or qualification is explicitly listed, USE ITS ACTUAL NAME in the summary. Vagueness when specific real information is available is just as wrong as fabrication — both fail to represent the person accurately.
- Being brief (for someone with little experience) and being specific (naming the real subjects/qualifications/skills they do have) are NOT in conflict — a one-sentence summary should still name the actual field of study or subjects if those are provided, rather than describing them in generic terms.

When in doubt about whether a detail is supported by the information given, LEAVE IT OUT. Truthful and brief is always correct; impressive-sounding but fabricated is always wrong, even if it reads better. But when a detail IS supported and explicitly given, name it specifically — do not water it down into a vague paraphrase.

INFORMATION ABOUT THE PERSON (this is the ONLY source of facts you may use):
Name: ${name}
${expList   ? `Work Experience: ${expList}` : 'Work Experience: None provided — do not imply or invent any work history.'}
${subjects  ? `Subjects/Specialisation: ${subjects}` : ''}
${softSkills ? `Key Skills: ${softSkills}` : ''}
${eduList   ? `Education: ${eduList}` : ''}
${userBlurb ? `In their own words: "${userBlurb}"` : ''}
${cvData?.personal?.bio ? `Existing summary (improve the WRITING of this without adding new unsupported facts): "${cvData.personal.bio}"` : ''}

Return ONLY the summary paragraph. No labels, no JSON, no preamble. Just the summary, as short or as long as the real information above actually supports.`;
}


function buildCoverLetterPrompt(jobDescription, cvData, meta) {
  const name       = cvData?.personal?.full_name || meta?.name || '[Applicant Name]';
  const position   = meta?.position || '[Position]';
  const org        = meta?.org || '[Organisation]';
  const category   = meta?.category || 'general';

  // Build CV summary for context
  const expList = (cvData?.experience || [])
    .filter(e => e.role || e.school)
    .map(e => `${e.role || ''} at ${e.school || ''} (${[e.from, e.to].filter(Boolean).join('–')})${e.description ? ': ' + e.description.split('\n').slice(0,2).join('; ') : ''}`)
    .join('\n');
  const eduList = (cvData?.education || [])
    .filter(e => e.qualification)
    .map(e => `${e.qualification} — ${e.institution} (${e.year})`)
    .join('; ');
  const skills = [
    ...(cvData?.skills?.subjects || []),
    ...(cvData?.skills?.soft_skills || []),
  ].slice(0, 12).join(', ');
  const bio = cvData?.personal?.bio || '';

  const hasCv = expList || eduList || skills || bio;

  return `You are an expert South African cover letter writer. Write a compelling, tailored cover letter for a job application.

APPLICANT DETAILS:
Name: ${name}
${bio ? `Professional Summary: ${bio}` : ''}
${expList ? `Work Experience:\n${expList}` : ''}
${eduList ? `Education: ${eduList}` : ''}
${skills ? `Key Skills: ${skills}` : ''}

JOB DETAILS:
Position applied for: ${position || 'the advertised position'}
Organisation: ${org || 'the organisation'}
Industry/Category: ${category}

JOB DESCRIPTION PROVIDED BY APPLICANT:
"""
${jobDescription}
"""

INSTRUCTIONS:
1. Write a professional cover letter tailored SPECIFICALLY to this job description
2. Reference specific requirements, skills, or keywords from the job description — but ONLY where they genuinely connect to something true about this applicant. Do NOT echo back a JD keyword/phrase (e.g. an industry, a tool, a certification) as something the applicant is interested in or experienced with unless their CV data above actually supports that connection. Sounding aligned with the posting is never a reason to imply something not grounded in the applicant's real background.
3. Match the applicant's experience/skills to the job requirements — be specific, and be honest about gaps (see rule 8)
4. ${hasCv ? "Use the applicant's CV data above to personalise. CRITICAL: name their qualification(s) and field of study EXPLICITLY by their real name (e.g. \"my BCom in Accounting\", \"my Bridging Certificate in the Theory of Accounting\") wherever relevant to the role — never refer to it vaguely as \"my field of study\" or \"my qualification\" when the actual qualification name is available above. A specific, named qualification (especially one that relates to the role, e.g. an accounting degree for a payroll/finance role) is often a genuine point in the applicant's favour and should be stated plainly, not generically." : 'Write a compelling letter based on the position and job description'}
5. The letter must be appropriate for the South African job market
6. Format:
   - Date line at top: ${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
   - Salutation (use recipient name if provided, otherwise "Dear Hiring Manager")
   - RE: line referencing the position
   - 3-4 paragraphs: opening interest, relevant experience/skills matched to JD, value proposition, closing
   - "Yours sincerely," closing
   - Applicant name at the bottom
7. Length: 3-4 paragraphs, professional and concise
8. NEVER fabricate experience, job titles, seniority, years of experience, or qualifications not explicitly present in the CV data above. If the applicant has limited experience or is early-career, write a genuine, honest letter that focuses on their real strengths (education, transferable skills, enthusiasm) rather than inventing achievements to sound more impressive. A short, honest letter is correct; an embellished one is not.
9. If no CV data is provided, write a strong generic letter for the role based on the JD

Return ONLY the letter text. No labels, no JSON, no preamble or postamble. Just the letter.`;
}

async function callGroq(prompt, jsonMode = true) {
  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Groq API error');
  return data.choices[0].message.content;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const contentType = event.headers['content-type'] || '';

  // ── Mode 1: Generate / improve Professional Summary ──────────────────────
  // Called with JSON body: { action: 'generate_summary', cvData: {...}, userBlurb: '...' }
  if (contentType.includes('application/json')) {
    try {
      const body = JSON.parse(event.body || '{}');

      if (body.action === 'generate_summary') {
        const prompt  = buildSummaryPrompt(body.cvData, body.userBlurb || '');
        const summary = await callGroq(prompt, false);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, summary: summary.trim() }),
        };
      }

      // ── Mode 2: Process free-text "tell us about yourself" ─────────────
      if (body.action === 'process_freetext') {
        const prompt  = buildStructurePrompt(body.text, body.cvType || 'general', true);
        const content = await callGroq(prompt, true);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, data: JSON.parse(content) }),
        };
      }

      // ── Mode 3: Generate AI cover letter tailored to job description ────
      if (body.action === 'generate_cover_letter') {
        const prompt = buildCoverLetterPrompt(
          body.jobDescription || '',
          body.cvData || null,
          body.meta || {}
        );
        const letter = await callGroq(prompt, false);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, letter: letter.trim() }),
        };
      }

      return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
    } catch (err) {
      console.error('JSON mode error:', err);
      return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
    }
  }

  // ── Mode 3: Parse uploaded CV file (multipart/form-data) ─────────────────
  if (!contentType.includes('multipart/form-data')) {
    return { statusCode: 400, body: 'Expected multipart/form-data or application/json' };
  }

  let fileBuffer = null;
  let fileMimeType = null;
  let cvType = 'general';

  await new Promise((resolve, reject) => {
    const bb = busboy({ headers: { 'content-type': contentType } });
    bb.on('file', (name, file, info) => {
      fileMimeType = info.mimeType;
      const chunks = [];
      file.on('data', chunk => chunks.push(chunk));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });
    bb.on('field', (name, value) => { if (name === 'cvType') cvType = value; });
    bb.on('finish', resolve);
    bb.on('error', reject);
    bb.end(Buffer.from(event.body, 'base64'));
  });

  if (!fileBuffer) {
    return { statusCode: 400, body: 'No file uploaded' };
  }

  let rawText;
  try {
    rawText = await extractTextFromBuffer(fileBuffer, fileMimeType);
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }

  try {
    const prompt  = buildStructurePrompt(rawText, cvType, false);
    const content = await callGroq(prompt, true);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: JSON.parse(content) }),
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
