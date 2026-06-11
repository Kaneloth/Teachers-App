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
6. NEVER invent information — only use what is provided
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

CV TYPE: ${cvType === 'educator' ? 'South African Educator CV' : 'General Professional CV'}

TASK: Extract, restructure, and enhance this information into the JSON structure below.

RULES:
1. RESTRUCTURE intelligently based on the person's actual profession:
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

4. GENERATE a professional bio/summary (3-4 sentences) in first person, tailored to:
   - The person's actual industry and role level
   - Their years of experience
   - Their key strengths and notable achievements
   - The South African job market context

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
    ? 'This person is an educator — mention subjects taught, phase/grade level, and teaching strengths.'
    : 'This person works in a professional field — mention their industry, role level, key technical skills, and career achievements.';

  return `You are a professional CV writer specialising in South African CVs for ALL industries and professions.

Write a compelling Professional Summary (bio) for a CV. It must be:
- 3 to 4 sentences
- Written in first person ("I am...", "I have...")
- Professional and confident in tone
- Tailored to this person's ACTUAL profession and industry — not generic
- Specific — mention role, years of experience, key skills/achievements where available
- Appropriate for the South African job market

${professionHint}

INFORMATION ABOUT THE PERSON:
Name: ${name}
${expList   ? `Work Experience: ${expList}` : ''}
${subjects  ? `Subjects/Specialisation: ${subjects}` : ''}
${softSkills ? `Key Skills: ${softSkills}` : ''}
${eduList   ? `Education: ${eduList}` : ''}
${userBlurb ? `In their own words: "${userBlurb}"` : ''}
${cvData?.personal?.bio ? `Existing summary (improve this): "${cvData.personal.bio}"` : ''}

Return ONLY the summary paragraph. No labels, no JSON, no preamble. Just the 3-4 sentence professional summary.`;
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
        const prompt  = buildStructurePrompt(body.text, body.cvType || 'educator', true);
        const content = await callGroq(prompt, true);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, data: JSON.parse(content) }),
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
  let cvType = 'educator';

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
