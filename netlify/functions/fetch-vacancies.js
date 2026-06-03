/**
 * fetch-vacancies.js  —  v4
 *
 * Sources (in priority order):
 *   1. Adzuna SA API  — proper REST API, free tier, direct apply links.
 *                       Requires ADZUNA_APP_ID + ADZUNA_APP_KEY env vars.
 *                       Sign up free at https://developer.adzuna.com
 *   2. Careers24      — scrapes multiple listing pages, filters for
 *                       education posts. No API key needed. Results vary.
 *
 * Why the previous sources failed:
 *   - Indeed:   Cloudflare bot detection — returns a "Security Check" page
 *   - DPSA:     Their URL changed — returns 404
 *   - Careers24 category URLs: category filter is client-side JS only;
 *               server returns all jobs regardless of category slug.
 *
 * Trigger: POST /.netlify/functions/fetch-vacancies
 * Auth:    Header  x-admin-secret: <ADMIN_SECRET>
 *
 * Env vars:
 *   VITE_SUPABASE_URL              (required)
 *   VITE_SUPABASE_SERVICE_ROLE_KEY (required)
 *   ADMIN_SECRET                   (required)
 *   ADZUNA_APP_ID                  (optional — enables Adzuna source)
 *   ADZUNA_APP_KEY                 (optional — enables Adzuna source)
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
};

/* ─── Supabase upsert ───────────────────────────────────────────────────── */
async function supabaseUpsert(rows) {
  if (!rows.length) return;
  // ?on_conflict=reference is required — without it Supabase does a plain
  // INSERT and the unique constraint on `reference` throws a 409.
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/vacancies?on_conflict=reference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed (${res.status}): ${await res.text()}`);
}

/* ─── HTTP helper (8 s, browser-like headers) ───────────────────────────── */
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

/* ─── Helpers ───────────────────────────────────────────────────────────── */
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

const PROV = {
  gauteng:'Gauteng','kwazulu-natal':'KwaZulu-Natal',kzn:'KwaZulu-Natal',kwazulu:'KwaZulu-Natal',
  'western cape':'Western Cape','eastern cape':'Eastern Cape',mpumalanga:'Mpumalanga',limpopo:'Limpopo',
  'north west':'North West',northwest:'North West','free state':'Free State','northern cape':'Northern Cape',
};
const normProv = (s='') => { const l=s.toLowerCase(); for(const[k,v]of Object.entries(PROV)){if(l.includes(k))return v;} return s.trim()||null; };

const SUBJECTS = ['Mathematics','Mathematical Literacy','Physical Sciences','Life Sciences','English','Afrikaans','History','Geography','Business Studies','Accounting','Economics','Life Orientation','Computer Applications Technology','Information Technology','Agricultural Sciences','Natural Sciences','Social Sciences','Technology','Visual Arts','Music','Dramatic Arts','Tourism','Hospitality Studies','Engineering Graphics'];
const getSubjects = (t='') => SUBJECTS.filter(s => t.toLowerCase().includes(s.toLowerCase()));

const getPostType = (title='',dept='') => { const t=(title+' '+dept).toLowerCase(); if(t.includes('district'))return'District'; if(t.includes('circuit'))return'Circuit'; if(t.includes('provincial'))return'Provincial'; if(t.includes('national')||t.includes('dbe'))return'National'; return'School-Based'; };
const getPhase = (t='') => { const l=t.toLowerCase(); if(l.includes('foundation')||/grade\s*[r123]\b/i.test(t))return'Foundation Phase'; if(l.includes('intermediate')||/grade\s*[456]\b/i.test(t))return'Intermediate Phase'; if(l.includes('senior')||/grade\s*[789]\b/i.test(t))return'Senior Phase'; if(l.includes('fet')||l.includes('further education')||/grade\s*1[012]\b/i.test(t))return'FET Phase'; return null; };
const getPostLevel = (t='') => { const m=t.match(/post\s*level\s*(\d)/i)||t.match(/\bpl\s*(\d)/i); return m?m[1]:null; };

// Education filter — broad enough to catch lecturer/professor/trainer roles
const isEdu = (t='') => /educat|teacher|school|principal|tutor|grade|phase|curriculum|sace|persal|lecturer|professor|academic|trainer|learning support|head of department|hod|deputy head|department head/i.test(t);

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 1 — Adzuna SA Job API
   Free tier at https://developer.adzuna.com  (takes ~2 min to sign up)
   Returns structured JSON with a direct redirect_url per vacancy.
   This is the most reliable source — no bot blocking, proper pagination,
   and the education category filter actually works.
   ═══════════════════════════════════════════════════════════════════════════ */
async function fetchAdzuna(log) {
  const appId  = process.env.ADZUNA_APP_ID;
  // Accept both ADZUNA_APP_KEY and ADZUNA_API_KEY (Netlify env var name varies)
  const appKey = process.env.ADZUNA_APP_KEY || process.env.ADZUNA_API_KEY;

  if (!appId || !appKey) {
    log.push('Adzuna: skipped — ADZUNA_APP_ID / ADZUNA_APP_KEY not set in Netlify env vars. Sign up free at https://developer.adzuna.com to enable this source.');
    return [];
  }

  const results = [];
  // Three separate keyword searches — no category filter (SA education category
  // tag varies; we rely on the search terms to target education posts).
  // content_type is NOT a valid Adzuna param — removed.
  const queries = [
    'educator teacher school',
    'school principal deputy principal',
    'lecturer professor academic',
  ];

  // Send queries sequentially with a 1.1 s gap — Adzuna free tier allows
  // ~1 request/second; firing them in parallel triggers HTTP 429.
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const settled = [];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(1100);
    const what = queries[i];
    const params = new URLSearchParams({
      app_id:           appId,
      app_key:          appKey,
      what,
      results_per_page: '50',
      sort_by:          'date',
    });
    try {
      const r = await fetch(
        `https://api.adzuna.com/v1/api/jobs/za/search/1?${params}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!r.ok) throw new Error(`Adzuna HTTP ${r.status} for query "${what}"`);
      settled.push({ status: 'fulfilled', value: await r.json() });
    } catch (err) {
      settled.push({ status: 'rejected', reason: err });
    }
  }

  const seen = new Set();
  for (const r of settled) {
    if (r.status !== 'fulfilled') {
      log.push(`Adzuna query error: ${r.reason?.message}`);
      continue;
    }
    const raw = r.value;
    if (raw?.exception) {
      log.push(`Adzuna API error: ${raw.display || raw.exception}`);
      continue;
    }
    const jobs = raw?.results || [];
    log.push(`Adzuna: query returned ${jobs.length} raw results`);
    for (const job of jobs) {
      const id = job.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const title   = strip(job.title || '');
      const company = strip(job.company?.display_name || '');
      // We already searched for education terms — skip the isEdu filter here
      // so we don't discard valid SA teaching posts with unusual titles.
      if (!title) continue;

      const location = [job.location?.display_name, job.location?.area?.[2]].filter(Boolean).join(', ');
      const combined = title + ' ' + company + ' ' + strip(job.description || '');

      results.push({
        title:           title.slice(0, 200),
        institution:     company.slice(0, 200),
        school:          company.slice(0, 200),
        province:        normProv(location),
        district:        null,
        phase:           getPhase(combined),
        post_type:       getPostType(title, company),
        subjects:        getSubjects(combined).length ? getSubjects(combined) : null,
        post_level:      getPostLevel(combined),
        description:     strip(job.description || '').slice(0, 600) || null,
        closing_date:    null,
        source:          'Adzuna',
        reference:       `adzuna-${id}`,
        application_url: job.redirect_url || null,  // ← direct apply link from Adzuna
      });
    }
  }

  log.push(`Adzuna: ${results.length} education posts fetched`);
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 2 — Careers24 (no API key needed)
   Careers24 serves real HTML and returns 200. Category URL filters are
   client-side only (server ignores them), so we fetch many pages of general
   listings and apply our own education filter to keep only relevant posts.
   URL pattern confirmed: /jobs/adverts/[numeric-id]-[slug]-[location]/
   ═══════════════════════════════════════════════════════════════════════════ */
async function fetchCareers24(log) {
  const BASE = 'https://www.careers24.com';
  const seen = new Set();
  const rows = [];

  // Fetch 6 listing pages in parallel to maximise the education job pool
  const listingUrls = [
    `${BASE}/jobs/c-education-training-teaching/`,
    `${BASE}/jobs/c-education-training-teaching/?page=2`,
    `${BASE}/jobs/c-education-training-teaching/?page=3`,
    `${BASE}/jobs/s-educators-and-teachers/`,
    `${BASE}/jobs/s-educators-and-teachers/?page=2`,
    `${BASE}/jobs/?keywords=educator+teacher+principal+school&sort=date`,
  ];

  const pages = await Promise.allSettled(listingUrls.map(u => fetchUrl(u)));
  let rawJobs = 0;

  for (const p of pages) {
    if (p.status !== 'fulfilled') continue;
    const html = p.value;

    // Confirmed working pattern from live tests:
    // href="/jobs/adverts/2365121-financial-manager-haval-kempton-park-gauteng/?jobindex=1"
    const linkRe = /href="(\/jobs\/adverts\/\d+-[a-z0-9][a-z0-9\-]+\/)(?:\?[^"]*)?"/gi;
    const titleRe = /<h2[^>]*>([^<]+)<\/h2>/gi;

    // Walk links and titles in parallel — they appear in the same order
    const links  = [];
    const titles = [];
    let m;
    while ((m = linkRe.exec(html))  !== null) links.push(m[1]);
    while ((m = titleRe.exec(html)) !== null) titles.push(strip(m[1]));

    for (let i = 0; i < Math.min(links.length, titles.length); i++) {
      rawJobs++;
      const title  = titles[i];
      const jobUrl = `${BASE}${links[i]}`;
      if (seen.has(jobUrl)) continue;
      seen.add(jobUrl);

      // Server-side filter: only keep education-related posts
      if (!isEdu(title)) continue;

      const refM = links[i].match(/\/adverts\/(\d+)-/);
      const ref  = `careers24-${refM ? refM[1] : Buffer.from(title).toString('base64').slice(0,16)}`;

      // Extract location from the URL slug (last segment before trailing slash)
      const slugParts = links[i].replace(/\/$/, '').split('-');
      const locSlug   = slugParts.slice(-2).join(' ');
      const province  = normProv(locSlug);

      const combined = title;
      rows.push({
        title:           title.slice(0, 200),
        institution:     null,
        school:          null,
        province,
        district:        null,
        phase:           getPhase(combined),
        post_type:       getPostType(title, ''),
        subjects:        getSubjects(combined).length ? getSubjects(combined) : null,
        post_level:      getPostLevel(combined),
        description:     null,
        closing_date:    null,
        source:          'Careers24',
        reference:       ref,
        application_url: jobUrl,  // ← direct link to this specific vacancy
      });
    }
  }

  log.push(`Careers24: scanned ${rawJobs} total jobs across ${pages.filter(p=>p.status==='fulfilled').length} pages → ${rows.length} education posts kept`);
  return rows;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const secret = event.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
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
      log.push('No posts found. If Adzuna keys are not set, only Careers24 is used — it may return 0 if no education posts appear in the current batch.');
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        total: allRows.length,
        sources: { adzuna: adzuna.length, careers24: careers24.length },
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
