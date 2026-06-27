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

function buildStructurePrompt(inputText, cvType, isFreeText = false, jobDescription) {
  jobDescription = jobDescription || "";
  const inputLabel = isFreeText
    ? 'FREE-FORM USER INPUT (the user has typed information about themselves in their own words)'
    : 'CV DOCUMENT TEXT (extracted from an uploaded PDF or Word document)';

  return `${SYSTEM_PROMPT}

${inputLabel}:
"""
${inputText}
"""

CV TYPE (app context — a HINT only, not a fact): ${cvType === 'educator' ? 'South African Educator CV' : 'General Professional CV'}
${jobDescription ? `\nTARGET JOB DESCRIPTION (the role this CV is being built for):\n"""\n${jobDescription.slice(0, 1500)}\n"""\nWhen writing the bio/summary and structuring experience descriptions, naturally incorporate keywords from the job description WHERE THEY HONESTLY APPLY to the person's actual background. Do NOT fabricate skills, qualifications, or experience to match the job. Honest alignment only — leave out anything that does not genuinely apply.` : ''}

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

function buildSummaryPrompt(cvData, userBlurb, jobDescription) {
  jobDescription = jobDescription || "";
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
- 3 to 5 sentences for someone with work experience, 1 to 2 sentences for someone with no work experience
- Written in first person ("I am...", "I have...")
- Professional and clear in tone
- Based STRICTLY on the real information given below — NEVER use generic filler phrases

MANDATORY CONTENT RULES — you MUST include ALL of the following that exist in the data below:
1. The person's ACTUAL JOB TITLE(S) from their work experience — e.g. "Mathematics Educator", "ICT Coordinator", "Acting HoD"
2. The ACTUAL NAME(S) of employers/schools/organisations they have worked at — e.g. "Sgodiphola Secondary School", "ABSA Trust", "Deloitte"
3. The ACTUAL YEARS OF EXPERIENCE — only if dates are given and support a count
4. The ACTUAL SUBJECTS TAUGHT or TECHNICAL SKILLS — e.g. "Mathematics and Computer Applications Technology"
5. The ACTUAL QUALIFICATIONS and INSTITUTION NAMES — e.g. "BEd Honours from UNISA", "Bachelor of Education from University of Pretoria"
6. Any NOTABLE ACHIEVEMENTS explicitly mentioned — e.g. "100% matric pass rate", "National Teaching Awards nomination", "developed a system used across all schools". Include 1-2 standout achievements if they exist — they make the summary memorable and specific.

FORBIDDEN — you must NEVER:
- Say "motivated individual eager to begin my career" or ANY similar generic phrase when the person HAS work experience
- Say "strong foundation in my field of study" when actual qualifications are listed — name them
- Replace a real employer name with "a reputable organisation" or "a leading company"
- Replace a real qualification with "my studies" or "my qualifications"
- Claim the person has NO experience when experience IS listed below
- Use ANY generic filler that ignores the specific real details provided

${professionHint}

ABSOLUTE RULE — DO NOT VIOLATE THIS UNDER ANY CIRCUMSTANCES:
You must NEVER invent, assume, exaggerate, or upgrade ANY fact that is not explicitly present in the information below. This includes (but is not limited to):
- Job titles or seniority levels (e.g. do not call someone a "Manager", "Director", "Senior X", or "Head of Y" unless that exact title or an unambiguous equivalent appears in their work experience below)
- Years of experience (e.g. do not state "X years of experience" unless dates are given that actually support that number — and if no work experience is listed at all, do NOT claim any years of experience)
- Skills, achievements, or responsibilities not listed below
- Industry expertise beyond what the listed experience/education actually supports

If the person has NO work experience listed (e.g. a recent graduate or first-time job seeker), the summary must reflect that honestly — for example, describing them as a motivated graduate or candidate eager to begin their career, based on their education/skills only. Do NOT describe them as experienced, do NOT invent a job title, and do NOT claim years of experience they do not have. A short, honest, well-written summary for someone with no experience is the correct and expected output — it is NOT a failure to be "compelling".

CRITICAL — SPECIFICITY IS REQUIRED, NOT OPTIONAL:
"Don't invent information" does NOT mean "stay vague". You MUST name the actual, specific details given below — never replace a real fact with a vague generic phrase. Specifically:
- ALWAYS name the actual employer(s) or organisation(s) from their work experience (e.g. "Sgodiphola Secondary School", "Deloitte", "Netcare"). Never say "a leading organisation" or "a reputable company".
- ALWAYS name the actual institution(s) from their education (e.g. "UNISA", "University of Pretoria"). Never say "a tertiary institution".
- ALWAYS name the actual qualification(s) (e.g. "B.Ed", "B.Com in Accounting", "National Diploma in IT"). Never say "my studies" or "my qualification".
- ALWAYS name the actual subjects, skills, or specialisations (e.g. "Mathematics and Physical Sciences", "Python and AWS"). Never say "technical skills" or "my area of expertise".
- If a skill, subject, or qualification is explicitly listed, USE ITS ACTUAL NAME. Vagueness when specific real information is available is just as wrong as fabrication — both fail to represent the person accurately.
- Being brief (for someone with little experience) and being specific (naming real employers, qualifications, subjects) are NOT in conflict — even a one-sentence summary should name what is actually there.

When in doubt about whether a detail is supported by the information given, LEAVE IT OUT. Truthful and brief is always correct; impressive-sounding but fabricated is always wrong, even if it reads better. But when a detail IS supported and explicitly given, name it specifically — do not water it down into a vague paraphrase.

INFORMATION ABOUT THE PERSON (this is the ONLY source of facts you may use):
Name: ${name}
${expList   ? `Work Experience: ${expList}` : 'Work Experience: None provided — do not imply or invent any work history.'}
${subjects  ? `Subjects/Specialisation: ${subjects}` : ''}
${softSkills ? `Key Skills: ${softSkills}` : ''}
${eduList   ? `Education: ${eduList}` : ''}
${userBlurb ? `In their own words: "${userBlurb}"` : ''}
${cvData?.personal?.bio ? `Existing summary (improve the WRITING of this without adding new unsupported facts): "${cvData.personal.bio}"` : ''}

${jobDescription ? `\nTARGET JOB DESCRIPTION (the role this person is applying for):\n"""\n${jobDescription.slice(0, 1500)}\n"""\n\nCRITICAL RULE WHEN A JOB DESCRIPTION IS PROVIDED:\nThe summary MUST be written FROM THE PERSPECTIVE of someone applying for that specific job — not as a general career summary.\n\nSTEP 1: Read the job description and identify the 2-3 most important skills/experience it requires.\nSTEP 2: Find where the person's REAL background matches those requirements.\nSTEP 3: Open the summary with those matching skills/experience — even if they are NOT the person's primary job title.\n\nEXAMPLE: Person is a teacher applying for an IT Support job. The job needs device management, LAN/WAN, hardware config. The person has 6 years of ICT coordination managing devices. CORRECT: open with the device/ICT experience. WRONG: open with "I am a dedicated educator".\n\nPRIORITY ORDER:\n1. Lead with the experience most relevant to the TARGET JOB — name the real employer and role specifically\n2. Name real qualifications and institutions\n3. Include 1-2 standout achievements relevant to the role\n4. Use the job description's own language where it honestly matches the person's background\n5. Never invent anything not in the person's data above` : ''}

EXAMPLE (showing exactly what is expected when a job description is provided):

EXAMPLE PERSON'S DATA:
- Work Experience: ICT Coordinator & Educator at Sgodiphola Secondary School (2014–present); Administrator Assistant at ABSA Trust (2008–2009)
- Education: BEd Honours in Mathematics Education, UNISA (2017); Bachelor of Education, University of Pretoria (2013); BSc Computing, UNISA (current)
- Skills: Device management, Google Admin console, Microsoft Office, LAN/WAN, hardware/software configuration, Mathematics, CAT
- Achievements: Developed online spreadsheet for GDE device monitoring adopted across all schools; 100% CAT matric pass rate

EXAMPLE TARGET JOB: IT Support Technician at Hanani Project Management Solutions — configuring/reimaging laptops and desktops, hardware diagnostics, LAN/WAN support, device deployment

EXAMPLE CORRECT OUTPUT:
"I am an experienced ICT Coordinator at Sgodiphola Secondary School with over 6 years managing GDE classroom devices, including hardware configuration, software imaging, Google Admin console administration, and LAN/WAN oversight. I hold a BEd Honours in Mathematics Education from UNISA and a Bachelor of Education from the University of Pretoria, and am currently completing a BSc in Computing at UNISA. I developed an online device monitoring spreadsheet that was adopted across all GDE schools, demonstrating my ability to create scalable IT solutions. My hands-on experience coordinating device roll-outs, conducting quality assurance, and providing first-level technical support aligns directly with this IT Support Technician role at Hanani Project Management Solutions."

EXAMPLE WRONG OUTPUT (do NOT produce this):
"I am a motivated individual eager to begin my career, with a strong foundation in my field of study."
(WRONG because: ignores 10+ years of real experience, names no employer, names no qualification, uses generic filler)

ANOTHER WRONG OUTPUT (do NOT produce this):
"I am a dedicated educator with experience as an ICT Coordinator at Sgodiphola Secondary School."
(WRONG when applying for an IT job because: leads with "educator" identity instead of the ICT/IT skills most relevant to the target role)

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

  // Determine the applicant's highest/most relevant qualification
  // explicitly in CODE rather than relying on the model to judge this —
  // smaller/faster models (this uses Llama 3.3 via Groq) have repeatedly
  // failed to reliably name a specific qualification even when told to,
  // across multiple attempts at stronger prompt wording. Giving the model
  // a literal, ready-made sentence fragment to use is far more reliable
  // than asking it to recall and insert the fact itself.
  const QUAL_RANK = [
    /doctor|phd/i, /master/i, /honours|honors/i, /bachelor|b\.?com|b\.?sc|b\.?a\.?|b\.?ed/i,
    /diploma/i, /certificate/i, /matric|grade ?12/i,
  ];
  const eduEntries = (cvData?.education || []).filter(e => e.qualification);
  const rankOf = (q) => { const i = QUAL_RANK.findIndex(re => re.test(q)); return i === -1 ? QUAL_RANK.length : i; };
  const topQual = eduEntries.sort((a, b) => rankOf(a.qualification) - rankOf(b.qualification))[0];
  const topQualPhrase = topQual
    ? `my ${topQual.qualification}${topQual.institution ? ` from ${topQual.institution}` : ''}`
    : null;
  const skills = [
    ...(cvData?.skills?.subjects || []),
    ...(cvData?.skills?.soft_skills || []),
  ].slice(0, 12).join(', ');
  const bio = cvData?.personal?.bio || '';

  const hasCv = expList || eduList || skills || bio;

  return {
    prompt: `You are an expert South African cover letter writer. Write a compelling, tailored cover letter for a job application.

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
4. ${topQualPhrase ? `Use the applicant's CV data above to personalise.
   MANDATORY — NOT OPTIONAL: somewhere in the opening or second paragraph, you MUST include this exact phrase, adapted only enough to fit the sentence grammatically: "${topQualPhrase}". Do not paraphrase it into something vaguer like "my qualification" or "my field of study" — use the real qualification name and institution as given. Build a natural sentence around this phrase (e.g. "With ${topQualPhrase}, I have developed..."), but the phrase itself must appear close to verbatim.` : (hasCv ? "Use the applicant's CV data above to personalise — mention their actual experience and skills." : 'Write a compelling letter based on the position and job description')}
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

Return ONLY the letter text. No labels, no JSON, no preamble or postamble. Just the letter.`,
    topQualPhrase,
  };
}

// Models tried in order — fallback on rate-limit or error
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',   // primary
  'openai/gpt-oss-20b',        // smaller non-reasoning fallback
  'llama-3.1-8b-instant',      // fast last resort
  // Note: reasoning models (qwen3, gpt-oss-120b) excluded — they emit <think> blocks
  // that interfere with plain text CV generation
];

async function callGroq(prompt, jsonMode = true) {
  let lastError;
  for (const model of GROQ_MODELS) {
    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      // Rate limited or model unavailable — try next model
      if (response.status === 429 || response.status === 503 || data.error?.code === 'rate_limit_exceeded') {
        console.warn(`[enhance-cv] Model ${model} rate-limited or unavailable, trying next...`);
        lastError = new Error(data.error?.message || `Model ${model} unavailable`);
        continue;
      }

      if (!response.ok) throw new Error(data.error?.message || 'Groq API error');
      const raw = data.choices[0].message.content || '';
      // Strip <think> blocks from reasoning models — find last </think> and take what's after
      const thinkClose = '</think>';
      const thinkEnd = raw.lastIndexOf(thinkClose);
      if (thinkEnd !== -1) {
        const afterThink = raw.slice(thinkEnd + thinkClose.length).trim();
        if (afterThink.length > 20) return afterThink;
        // All content was inside think block — strip open/close tags and return inner text
        return raw.split('<think>').join('').split(thinkClose).join('').trim();
      }
      return raw.trim();
    } catch (err) {
      lastError = err;
      // Only continue on rate-limit related errors
      if (err.message?.includes('rate') || err.message?.includes('limit') || err.message?.includes('unavailable')) {
        console.warn(`[enhance-cv] Model ${model} failed: ${err.message}, trying next...`);
        continue;
      }
      throw err; // Non-rate-limit error — fail immediately
    }
  }
  throw lastError || new Error('All Groq models rate-limited. Please try again later.');
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
        const jobDesc = body.jobDescription || '';
        const prompt  = buildSummaryPrompt(body.cvData, body.userBlurb || '', jobDesc);
        let summary   = (await callGroq(prompt, false)).trim();
        if (!summary) throw new Error('Empty summary from AI');


        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, summary }),
        };
      }

      // ── Mode 2: Process free-text "tell us about yourself" ─────────────
      if (body.action === 'process_freetext') {
        const prompt  = buildStructurePrompt(body.text, body.cvType || 'general', true, body.jobDescription || '');
        const content = await callGroq(prompt, true);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, data: JSON.parse(content) }),
        };
      }

      // ── Mode 4: Pick the best-fitting icon for an arbitrary, user-defined
      // custom CV section title (e.g. "Training & Workshops",
      // "Publications", "Volunteer Work") — these aren't standard CV
      // sections, so a fixed keyword list can't cover every possible
      // title. The model picks from a FIXED, CLOSED list of icon keys
      // (matching exactly what's available in the embedded PDF icon
      // font) — never free text — so the response can't reference an
      // icon that doesn't actually exist.
      if (body.action === 'pick_section_icon') {
        const title = (body.title || '').trim();
        if (!title) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Missing title' }) };
        }
        const AVAILABLE_ICONS = [
          'graduationCap', 'briefcase', 'fileText', 'trophy', 'cogs',
          'globe', 'user', 'envelope', 'phone', 'mapMarker', 'book', 'none',
        ];
        const prompt = `A CV/resume has a custom section titled: "${title}"

Pick the ONE icon from this exact list that best represents this section's content. Reply with ONLY the icon key, nothing else — no punctuation, no explanation.

Available icons:
- graduationCap: education, qualifications, courses, training, certifications, learning
- briefcase: work, employment, professional roles, internships
- fileText: documents, summaries, written content, publications, reports
- trophy: awards, achievements, honours, recognition, competitions won
- cogs: skills, technical abilities, tools, competencies
- globe: languages, international, travel, global experience
- user: people, references, personal interests, volunteering involving people
- envelope: contact-related content
- phone: contact-related content
- mapMarker: locations, places lived/worked
- book: reading, research, academic publications, knowledge
- none: nothing fits well — better to show no icon than a misleading one

Reply with exactly one of: ${AVAILABLE_ICONS.join(', ')}`;

        try {
          const raw = await callGroq(prompt, false);
          const key = raw.trim().replace(/[^a-zA-Z]/g, '');
          const matched = AVAILABLE_ICONS.find(k => k.toLowerCase() === key.toLowerCase());
          return {
            statusCode: 200,
            body: JSON.stringify({ success: true, icon: matched && matched !== 'none' ? matched : null }),
          };
        } catch (err) {
          // Never let an icon-picking failure be treated as a real error
          // by the caller — falling back to "no icon" (plain bar) is
          // always a safe, non-broken result.
          return { statusCode: 200, body: JSON.stringify({ success: true, icon: null }) };
        }
      }

      // ── Mode 3: Generate AI cover letter tailored to job description ────
      if (body.action === 'generate_cover_letter') {
        const { prompt, topQualPhrase } = buildCoverLetterPrompt(
          body.jobDescription || '',
          body.cvData || null,
          body.meta || {}
        );
        let letter = (await callGroq(prompt, false)).trim();

        // Safety net: the underlying model (Llama 3.3 via Groq) has
        // repeatedly failed to reliably follow the "name the real
        // qualification" instruction across multiple rounds of prompt
        // strengthening, even when given the literal phrase to use. Rather
        // than keep tightening prose that the model may continue to
        // ignore, verify the phrase actually made it into the output —
        // if not, insert a sentence containing it directly into the
        // letter so the user's real qualification is never silently
        // dropped.
        if (topQualPhrase) {
          const qualWords = topQualPhrase.replace(/^my /, '').split(' ').filter(w => w.length > 3);
          const mentioned = qualWords.some(w => letter.toLowerCase().includes(w.toLowerCase()));
          if (!mentioned) {
            const insertSentence = `With ${topQualPhrase}, I bring a relevant academic foundation to this role. `;
            // Insert after the first paragraph (first double-newline), or
            // after the first sentence if the letter has no clear
            // paragraph break, so it reads naturally rather than being
            // tacked on at the very end.
            const firstBreak = letter.indexOf('\n\n');
            if (firstBreak !== -1) {
              const secondParaStart = firstBreak + 2;
              letter = letter.slice(0, secondParaStart) + insertSentence + letter.slice(secondParaStart);
            } else {
              const firstSentenceEnd = letter.indexOf('. ') + 2;
              letter = letter.slice(0, firstSentenceEnd) + insertSentence + letter.slice(firstSentenceEnd);
            }
          }
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, letter }),
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
  let jobDescription = '';

  await new Promise((resolve, reject) => {
    const bb = busboy({ headers: { 'content-type': contentType } });
    bb.on('file', (name, file, info) => {
      fileMimeType = info.mimeType;
      const chunks = [];
      file.on('data', chunk => chunks.push(chunk));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });
    bb.on('field', (name, value) => {
      if (name === 'cvType') cvType = value;
      if (name === 'jobDescription') jobDescription = value;
    });
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
    const prompt   = buildStructurePrompt(rawText, cvType, false, jobDescription);
    const rawJson  = await callGroq(prompt, true);
    const parsed   = JSON.parse(rawJson);


    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: parsed }),
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
