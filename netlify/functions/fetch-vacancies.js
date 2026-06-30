/**
 * fetch-vacancies.js  —  v5
 *
 * Sources:
 *   1. Adzuna SA API  — proper REST API, free tier, direct apply links.
 *                       Requires ADZUNA_APP_ID + ADZUNA_APP_KEY env vars.
 *                       Sign up free at https://developer.adzuna.com
 *   2. Careers24      — scrapes multiple category listing pages.
 *                       No API key needed. Now covers all job categories.
 *
 * v5 changes vs v4:
 *   - Expanded to fetch ALL job categories (not just education).
 *   - Added detectCategory() to auto-tag each job with a job_category.
 *   - Adzuna now runs 4 broad search queries covering all sectors.
 *   - Careers24 now fetches from 10 category pages (education + others).
 *   - Education filter removed from Careers24 — all valid jobs are kept.
 *
 * Trigger: POST /.netlify/functions/fetch-vacancies
 * Auth:    Header  Authorization: Bearer <user's Supabase session JWT>
 *          Any logged-in user may trigger this (not admin-only) — the
 *          refresh button is exposed to all users so vacancies can be
 *          kept fresh even when the admin isn't available to do it.
 *          Verified via a direct call to Supabase's auth REST endpoint
 *          (no @supabase/supabase-js dependency needed, consistent with
 *          the rest of this file's raw-fetch approach).
 *
 * Env vars:
 *   VITE_SUPABASE_URL              (required)
 *   VITE_SUPABASE_SERVICE_ROLE_KEY (required)
 *   ADZUNA_APP_ID                  (optional — enables Adzuna source)
 *   ADZUNA_APP_KEY                 (optional — enables Adzuna source)
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/* ─── Auth: verify the caller's Supabase session JWT ────────────────────── */
async function verifyUser(event) {
  const jwt = (event.headers['authorization'] || event.headers['Authorization'] || '')
    .replace('Bearer ', '').trim();
  if (!jwt) return { error: 'Unauthorized — please log in' };

  try {
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!res.ok) return { error: 'Invalid or expired session — please log in again' };
    const user = await res.json();
    return { user };
  } catch (e) {
    return { error: `Auth check failed: ${e.message}` };
  }
}

/* ─── Supabase upsert ───────────────────────────────────────────────────── */
async function supabaseUpsert(rows) {
  if (!rows.length) return;
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/vacancies?on_conflict=reference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=minimal', // merge so category/data corrections apply to existing rows on refresh
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed (${res.status}): ${await res.text()}`);
}

/* ─── HTTP helper ────────────────────────────────────────────────────────── */
async function fetchUrl(url, opts = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'en-ZA,en;q=0.9',
      ...opts.headers,
    },
    signal: AbortSignal.timeout(opts.timeout || 8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

/* ─── Text helpers ───────────────────────────────────────────────────────── */
const strip = (s = '') =>
  s.replace(/<[^>]+>/g, ' ')
   .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
   .replace(/\s+/g,' ').trim();

function parseDate(s) {
  if (!s) return null;
  const c = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return c;
  const sl = c.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (sl) return `${sl[3]}-${sl[2].padStart(2,'0')}-${sl[1].padStart(2,'0')}`;
  const mon = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const lg = c.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (lg) { const m = mon[lg[2].toLowerCase().slice(0,3)]; if (m) return `${lg[3]}-${String(m).padStart(2,'0')}-${lg[1].padStart(2,'0')}`; }
  return null;
}

/* ─── Province normalisation ─────────────────────────────────────────────── */
const PROV = {
  gauteng:'Gauteng','kwazulu-natal':'KwaZulu-Natal',kzn:'KwaZulu-Natal',kwazulu:'KwaZulu-Natal',
  'western cape':'Western Cape','eastern cape':'Eastern Cape',mpumalanga:'Mpumalanga',limpopo:'Limpopo',
  'north west':'North West',northwest:'North West','free state':'Free State','northern cape':'Northern Cape',
};
const normProv = (s='') => { const l=s.toLowerCase(); for(const[k,v]of Object.entries(PROV)){if(l.includes(k))return v;} return s.trim()||null; };

/* ─── Education metadata helpers ─────────────────────────────────────────── */
const SUBJECTS = ['Mathematics','Mathematical Literacy','Physical Sciences','Life Sciences','English','Afrikaans','History','Geography','Business Studies','Accounting','Economics','Life Orientation','Computer Applications Technology','Information Technology','Agricultural Sciences','Natural Sciences','Social Sciences','Technology','Visual Arts','Music','Dramatic Arts','Tourism','Hospitality Studies','Engineering Graphics'];
const getSubjects = (t='') => SUBJECTS.filter(s => t.toLowerCase().includes(s.toLowerCase()));
const getPostType = (title='',dept='') => { const t=(title+' '+dept).toLowerCase(); if(t.includes('district'))return'District'; if(t.includes('circuit'))return'Circuit'; if(t.includes('provincial'))return'Provincial'; if(t.includes('national')||t.includes('dbe'))return'National'; return'School-Based'; };
const getPhase = (t='') => { const l=t.toLowerCase(); if(l.includes('foundation')||/grade\s*[r123]\b/i.test(t))return'Foundation Phase'; if(l.includes('intermediate')||/grade\s*[456]\b/i.test(t))return'Intermediate Phase'; if(l.includes('senior')||/grade\s*[789]\b/i.test(t))return'Senior Phase'; if(l.includes('fet')||l.includes('further education')||/grade\s*1[012]\b/i.test(t))return'FET Phase'; return null; };
const getPostLevel = (t='') => { const m=t.match(/post\s*level\s*(\d)/i)||t.match(/\bpl\s*(\d)/i); return m?m[1]:null; };

/* ─── Job category detection ─────────────────────────────────────────────── */
// IMPORTANT: category patterns are checked in TITLE-FIRST priority — the job
// TITLE is checked against every category before falling back to scanning the
// full description. Common compliance/buzzword phrases like "health and
// safety", "academic qualifications", "school of thought" appear in job
// DESCRIPTIONS across every sector and previously caused false matches when
// the whole text (title + description) was scanned with generic single-word
// patterns. Now: specific job-title words only, no generic compliance terms.
const CATEGORY_PATTERNS = [
  ['Education',    /\beducator\b|\bteacher\b|teaching\s+(post|position|vacancy|staff)|school\s+(principal|teacher|educator)|\btutor\b|\bgrade\s*[r\d]\b.*\b(teacher|educator|class)|phase\b.*\b(teacher|educator)|\bcurriculum\b.*\b(teacher|educator|school)|\bSACE\b|\blecturer\b|\blearning support\b|head of department.*\bschool\b|\bHOD\b.*\bschool\b|deputy head.*\bschool\b|\bclassroom\b|CAPS curriculum|matric.*pass rate|Department of (Basic |Higher )?Education/i],
  ['Technology',   /\bdeveloper\b|software|programmer|full.?stack|front.?end|back.?end|devops|cloud computing|cyber security|network admin|systems admin|web dev|\bIT\b|information technology|\bQA\b engineer|scrum master|data engineer|data scientist|machine learning|artificial intelligence|javascript|python developer|java developer|\.net\b|react developer|angular developer|node\.?js/i],
  ['Finance',      /\baccountant\b|financial manager|\bauditor\b|bookkeeper|\btax\b (consultant|advisor|practitioner)|payroll (clerk|administrator|officer)|actuari|investment (banker|analyst|manager)|treasury (analyst|manager)|credit analyst|\bCFO\b|\bFD\b\b|accounts payable|accounts receivable|financial controller|Department of (Finance|Treasury)/i],
  ['Healthcare',   /\bnurse\b|\bdoctor\b|medical (officer|practitioner|aid)|\bhealthcare\b|pharmacy (assistant|technician)|\bclinical\b (nurse|officer|psychologist)|\btherapist\b|physiother|occupational ther|radiograph|\bdental\b (assistant|technician|hygienist)|\bmatron\b|hospital (staff|administrator)|\bparamedic\b|dietitian|social worker|Department of Health/i],
  ['Engineering',  /mechanical eng|electrical eng|civil eng|structural eng|industrial eng|chemical eng|process eng|instrumentation|\bfitter\b|\bwelder\b|boilermaker|\bartisan\b|\btechnician\b|draughtsman|construction manager|mining eng|\bHVAC\b|project eng/i],
  ['Retail',       /\bretail\b (assistant|manager|associate)|\bcashier\b|shop assistant|store manager|sales rep|sales consultant|merchandis|inventory control|stock control|\bbuyer\b|procurement (officer|manager)|fashion (buyer|retail)|pos system|point of sale/i],
  ['Admin',        /\badministrator\b|receptionist|secretary|office manager|office admin|data entry (clerk|operator)|executive assistant|personal assistant|\bPA\b to|filing clerk|switchboard operator|front desk/i],
  ['Hospitality',  /\bhotel\b (manager|staff|receptionist)|\brestaurant\b (manager|staff)|\bchef\b|catering (manager|staff)|tourism (officer|consultant)|hospitality (manager|industry)|kitchen manager|food and beverage|housekeeping|front office|concierge|game reserve/i],
  ['Logistics',    /\blogistics\b (manager|coordinator|officer)|supply chain (manager|analyst)|warehouse (manager|supervisor|staff)|truck driver|transport (manager|coordinator)|delivery driver|\bcourier\b|distribution (manager|centre)|dispatch (controller|clerk)|fleet (manager|controller)|forklift operator|freight (forwarder|controller)|(site manager|operations manager).*\b(truck|driver|dispatch|fleet|delivery|warehouse|logistics|scrap metal|diesel)\b/i],
];

/**
 * Returns the best-matching category for a job, or 'Other' if none match.
 * Checks Education first so teaching posts always win even if they overlap
 * with a generic pattern (e.g. "school administrator" → Education).
 */
function detectCategory(title = '', description = '') {
  // Pass 1: check TITLE ONLY first — the job title is far more reliable than
  // scattered description text. A "Site Manager" title mentioning "health and
  // safety" once in the description body should never become Healthcare.
  for (const [cat, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(title)) return cat;
  }
  // Pass 2: title alone didn't match — try title + first 300 chars of
  // description together. This catches ambiguous titles like "Operations
  // Manager" that need context (e.g. "...warehouse and fleet logistics...")
  // while still avoiding deep boilerplate text later in long postings.
  const combined = title + ' ' + description.slice(0, 300);
  for (const [cat, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(combined)) return cat;
  }
  return 'Other';
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 1 — Adzuna SA Job API
   4 broad queries cover all major sectors. Education query goes first so
   educator-specific metadata (phase, subjects) is applied correctly.
   ═══════════════════════════════════════════════════════════════════════════ */
async function fetchAdzuna(log) {
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY || process.env.ADZUNA_API_KEY;

  if (!appId || !appKey) {
    log.push('Adzuna: skipped — ADZUNA_APP_ID / ADZUNA_APP_KEY not set. Sign up free at https://developer.adzuna.com');
    return [];
  }

  // 4 broad queries that collectively cover all major sectors.
  // Keep to 4 to stay within the Netlify function timeout even with 1.1 s gaps.
  // NOTE: Adzuna's `what` parameter does AND matching across all words in the
  // phrase (job must contain every word) — that's why 5-word phrases like
  // "educator teacher school principal lecturer" previously returned 0 results.
  // `what_or` does OR matching, which is what broad category sweeps need.
  const queries = [
    'educator teacher school principal lecturer',              // Education
    'software developer engineer IT programmer analyst',       // Technology + Engineering
    'accountant finance nurse medical admin retail sales',     // Finance + Healthcare + Retail + Admin
    'manager director coordinator driver logistics hospitality', // Management + Logistics + Hospitality
  ];

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const settled = [];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(1100);
    const what = queries[i];
    const params = new URLSearchParams({
      app_id:           appId,
      app_key:          appKey,
      what_or:          what,   // OR matching — `what` would require ALL words to match (returns 0 results)
      results_per_page: '50',
      sort_by:          'date',
    });
    try {
      const r = await fetch(
        `https://api.adzuna.com/v1/api/jobs/za/search/1?${params}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
      );
      if (!r.ok) throw new Error(`Adzuna HTTP ${r.status} for query "${what}"`);
      settled.push({ status: 'fulfilled', value: await r.json(), query: what });
    } catch (err) {
      settled.push({ status: 'rejected', reason: err, query: what });
    }
  }

  const seen    = new Set();
  const results = [];

  for (const r of settled) {
    if (r.status !== 'fulfilled') {
      log.push(`Adzuna query error ("${r.query}"): ${r.reason?.message}`);
      continue;
    }
    const raw = r.value;
    if (raw?.exception) {
      log.push(`Adzuna API error: ${raw.display || raw.exception}`);
      continue;
    }
    const jobs = raw?.results || [];
    log.push(`Adzuna query "${r.query}": ${jobs.length} results`);

    for (const job of jobs) {
      const id = job.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const title    = strip(job.title || '');
      const company  = strip(job.company?.display_name || '');
      if (!title) continue;

      const location = [job.location?.display_name, job.location?.area?.[2]].filter(Boolean).join(', ');
      const combined = title + ' ' + company + ' ' + strip(job.description || '');
      const cat      = detectCategory(title, strip(job.description || ''));

      results.push({
        title:           title.slice(0, 200),
        institution:     company.slice(0, 200),
        school:          company.slice(0, 200),
        province:        normProv(location),
        district:        null,
        phase:           cat === 'Education' ? getPhase(combined)    : null,
        post_type:       cat === 'Education' ? getPostType(title, company) : null,
        subjects:        cat === 'Education' && getSubjects(combined).length ? getSubjects(combined) : null,
        post_level:      cat === 'Education' ? getPostLevel(combined) : null,
        description:     strip(job.description || '').slice(0, 600) || null,
        closing_date:    null,
        source:          'Adzuna',
        reference:       `adzuna-${id}`,
        application_url: job.redirect_url || null,
        job_category:    cat,
      });
    }
  }

  log.push(`Adzuna: ${results.length} total posts fetched across all categories`);
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 2 — Careers24 (no API key needed)
   Fetches from 10 category pages covering all major sectors.
   Category filter URLs are client-side only but the slugs still help
   narrow the page content down to the right job type in practice.
   ═══════════════════════════════════════════════════════════════════════════ */
async function fetchCareers24(log) {
  const BASE = 'https://www.careers24.com';
  const seen = new Set();
  const rows = [];

  const listingUrls = [
    // Education
    `${BASE}/jobs/c-education-training-teaching/`,
    `${BASE}/jobs/c-education-training-teaching/?page=2`,
    `${BASE}/jobs/s-educators-and-teachers/`,
    // Technology
    `${BASE}/jobs/c-it-internet/`,
    `${BASE}/jobs/c-it-internet/?page=2`,
    // Finance
    `${BASE}/jobs/c-finance/`,
    // Healthcare
    `${BASE}/jobs/c-medical-health-care/`,
    // Retail + Admin
    `${BASE}/jobs/c-retail/`,
    `${BASE}/jobs/c-administration-office/`,
    // General (catches everything else — sorted by date)
    `${BASE}/jobs/?sort=date`,
  ];

  const pages = await Promise.allSettled(listingUrls.map(u => fetchUrl(u)));
  let rawJobs = 0;

  for (const p of pages) {
    if (p.status !== 'fulfilled') continue;
    const html = p.value;

    const linkRe  = /href="(\/jobs\/adverts\/\d+-[a-z0-9][a-z0-9\-]+\/)(?:\?[^"]*)?"/gi;
    const titleRe = /<h2[^>]*>([^<]+)<\/h2>/gi;

    const links  = [];
    const titles = [];
    let m;
    while ((m = linkRe.exec(html))  !== null) links.push(m[1]);
    while ((m = titleRe.exec(html)) !== null) titles.push(strip(m[1]));

    for (let i = 0; i < Math.min(links.length, titles.length); i++) {
      rawJobs++;
      const title  = titles[i];
      const jobUrl = `${BASE}${links[i]}`;
      if (seen.has(jobUrl) || !title) continue;
      seen.add(jobUrl);

      const refM = links[i].match(/\/adverts\/(\d+)-/);
      const ref  = `careers24-${refM ? refM[1] : Buffer.from(title).toString('base64').slice(0, 16)}`;

      const slugParts = links[i].replace(/\/$/, '').split('-');
      const locSlug   = slugParts.slice(-2).join(' ');
      const province  = normProv(locSlug);
      const cat       = detectCategory(title, '');

      rows.push({
        title:           title.slice(0, 200),
        institution:     null,
        school:          null,
        province,
        district:        null,
        phase:           cat === 'Education' ? getPhase(title)    : null,
        post_type:       cat === 'Education' ? getPostType(title, '') : null,
        subjects:        cat === 'Education' && getSubjects(title).length ? getSubjects(title) : null,
        post_level:      cat === 'Education' ? getPostLevel(title) : null,
        description:     null,
        closing_date:    null,
        source:          'Careers24',
        reference:       ref,
        application_url: jobUrl,
        job_category:    cat,
      });
    }
  }

  log.push(`Careers24: scanned ${rawJobs} jobs across ${pages.filter(p=>p.status==='fulfilled').length} pages → ${rows.length} posts kept`);
  return rows;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Any logged-in user may trigger this — verified via their own Supabase
  // session JWT (no shared secret baked into frontend code, which would be
  // visible to anyone via browser dev tools since it's a VITE_-bundled var).
  const auth = await verifyUser(event);
  if (auth.error) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: auth.error }) };
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing Supabase env vars' }) };
  }

  const log = [];

  try {
    const [adzunaRes, careers24Res] = await Promise.allSettled([
      fetchAdzuna(log),
      fetchCareers24(log),
    ]);

    const adzuna    = adzunaRes.status    === 'fulfilled' ? adzunaRes.value    : [];
    const careers24 = careers24Res.status === 'fulfilled' ? careers24Res.value : [];

    if (adzunaRes.status    !== 'fulfilled') log.push(`Adzuna error: ${adzunaRes.reason?.message}`);
    if (careers24Res.status !== 'fulfilled') log.push(`Careers24 error: ${careers24Res.reason?.message}`);

    const allRows = [...adzuna, ...careers24];

    if (allRows.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < allRows.length; i += CHUNK) {
        await supabaseUpsert(allRows.slice(i, i + CHUNK));
      }
      log.push(`Upserted ${allRows.length} rows total`);
    } else {
      log.push('No posts found. Check that ADZUNA_APP_ID / ADZUNA_APP_KEY are set in Netlify env vars.');
    }

    // Summary by category
    const catSummary = {};
    for (const row of allRows) {
      catSummary[row.job_category] = (catSummary[row.job_category] || 0) + 1;
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        total: allRows.length,
        sources: { adzuna: adzuna.length, careers24: careers24.length },
        categories: catSummary,
        log,
      }),
    };
  } catch (e) {
    console.error('[fetch-vacancies] Fatal:', e);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, error: e.message, log }),
    };
  }
};
