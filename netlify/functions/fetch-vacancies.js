/**
 * fetch-vacancies.js
 * Fetches teaching vacancies from DPSA, Indeed SA, and Careers24,
 * normalises them into the vacancies table shape, and upserts into Supabase.
 *
 * Trigger: POST /.netlify/functions/fetch-vacancies
 * Auth:    Expects header  x-admin-secret: <ADMIN_SECRET env var>
 *
 * Env vars required:
 *   VITE_SUPABASE_URL              — your Supabase project URL
 *   VITE_SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
 *   ADMIN_SECRET                   — shared secret so only the admin button can call this
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
};

/* ─── Supabase REST helper (no SDK needed in Netlify functions) ─────────── */
async function supabaseUpsert(rows) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/vacancies`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed (${res.status}): ${text}`);
  }
}

/* ─── HTML fetch helper ─────────────────────────────────────────────────── */
async function fetchHtml(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-ZA,en;q=0.9',
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

/* ─── Strip HTML tags ───────────────────────────────────────────────────── */
function stripTags(s = '') {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ─── Date parser ───────────────────────────────────────────────────────── */
function parseDate(str) {
  if (!str) return null;
  const clean = str.trim();
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return clean;
  const slash = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}`;
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const long = clean.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (long) {
    const m = months[long[2].toLowerCase().slice(0,3)];
    if (m) return `${long[3]}-${String(m).padStart(2,'0')}-${long[1].padStart(2,'0')}`;
  }
  return null;
}

/* ─── Province normaliser ───────────────────────────────────────────────── */
const PROVINCE_MAP = {
  'gauteng': 'Gauteng',
  'kwazulu': 'KwaZulu-Natal', 'kzn': 'KwaZulu-Natal', 'kwazulu-natal': 'KwaZulu-Natal',
  'western cape': 'Western Cape', 'wc': 'Western Cape',
  'eastern cape': 'Eastern Cape', 'ec': 'Eastern Cape',
  'mpumalanga': 'Mpumalanga',
  'limpopo': 'Limpopo',
  'north west': 'North West', 'northwest': 'North West',
  'free state': 'Free State', 'fs': 'Free State',
  'northern cape': 'Northern Cape', 'nc': 'Northern Cape',
};

function normaliseProvince(str) {
  if (!str) return null;
  const lower = str.toLowerCase().trim();
  for (const [key, val] of Object.entries(PROVINCE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return str.trim();
}

/* ─── Post type detector ────────────────────────────────────────────────── */
function detectPostType(title = '', department = '') {
  const text = (title + ' ' + department).toLowerCase();
  if (text.includes('district')) return 'District';
  if (text.includes('circuit')) return 'Circuit';
  if (text.includes('provincial')) return 'Provincial';
  if (text.includes('national') || text.includes('dbe') || text.includes('department of basic education')) return 'National';
  return 'School-Based';
}

/* ─── Subject extractor ─────────────────────────────────────────────────── */
const KNOWN_SUBJECTS = [
  'Mathematics','Mathematical Literacy','Physical Sciences','Life Sciences',
  'English','Afrikaans','History','Geography','Business Studies','Accounting',
  'Economics','Life Orientation','Computer Applications Technology',
  'Information Technology','Agricultural Sciences','Natural Sciences',
  'Social Sciences','Technology','Visual Arts','Music','Dramatic Arts',
  'Tourism','Hospitality Studies','Engineering Graphics',
];

function extractSubjects(text = '') {
  return KNOWN_SUBJECTS.filter(s => text.toLowerCase().includes(s.toLowerCase()));
}

/* ─── Post level extractor ──────────────────────────────────────────────── */
function extractPostLevel(text = '') {
  const m = text.match(/post\s*level\s*(\d)/i) || text.match(/\bpl\s*(\d)/i) || text.match(/level\s*(\d)/i);
  return m ? m[1] : null;
}

/* ─── Phase extractor ───────────────────────────────────────────────────── */
function extractPhase(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('foundation phase') || lower.includes('grade r') || lower.includes('grade 1') || lower.includes('grade 2') || lower.includes('grade 3')) return 'Foundation Phase';
  if (lower.includes('intermediate phase') || lower.includes('grade 4') || lower.includes('grade 5') || lower.includes('grade 6')) return 'Intermediate Phase';
  if (lower.includes('senior phase') || lower.includes('grade 7') || lower.includes('grade 8') || lower.includes('grade 9')) return 'Senior Phase';
  if (lower.includes('further education') || lower.includes('fet') || lower.includes('grade 10') || lower.includes('grade 11') || lower.includes('grade 12')) return 'FET Phase';
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 1 — DPSA Vacancy Circulars
   URL: https://www.dpsa.gov.za/dpsa2g/vacancies.asp
   DPSA has NO individual per-vacancy URLs — their vacancies are published in
   weekly circular pages (HTML tables). The circular page URL IS the direct
   link. We include the reference number in the description so the user can
   press Ctrl+F on the page to jump straight to their post.
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchDPSA() {
  const results = [];
  try {
    const indexHtml = await fetchHtml('https://www.dpsa.gov.za/dpsa2g/vacancies.asp');

    const circularLinks = [];
    const linkRe = /href="([^"]*vacancies[^"]*\.asp[^"]*)"/gi;
    let m;
    while ((m = linkRe.exec(indexHtml)) !== null) {
      const href = m[1];
      const full = href.startsWith('http') ? href : `https://www.dpsa.gov.za/dpsa2g/${href.replace(/^\/dpsa2g\//, '')}`;
      if (!circularLinks.includes(full) && circularLinks.length < 3) {
        circularLinks.push(full);
      }
    }

    for (const circUrl of circularLinks.slice(0, 2)) {
      try {
        const html = await fetchHtml(circUrl);
        const tableRowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch;
        while ((rowMatch = tableRowRe.exec(html)) !== null) {
          const cells = [];
          let cellMatch;
          const cellReCopy = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
          while ((cellMatch = cellReCopy.exec(rowMatch[1])) !== null) {
            cells.push(stripTags(cellMatch[1]));
          }
          if (cells.length < 4) continue;

          const dept         = cells[0] || '';
          const post         = cells[1] || '';
          const salary       = cells[2] || '';
          const centre       = cells[3] || '';
          const requirements = cells[4] || '';
          const closingRaw   = cells[cells.length - 2] || '';
          const ref          = cells[cells.length - 1] || '';

          const combined = (dept + post + requirements).toLowerCase();
          const isEducation = combined.includes('education') || combined.includes('educator') || combined.includes('teacher') || combined.includes('school') || combined.includes('dbe');
          if (!isEducation || !post || post.length < 5) continue;

          const refClean  = ref.slice(0, 100);
          const province  = normaliseProvince(centre) || normaliseProvince(dept);
          const closing   = parseDate(closingRaw);
          const subjects  = extractSubjects(post + ' ' + requirements);
          const postLevel = extractPostLevel(post + ' ' + salary);
          const phase     = extractPhase(post + ' ' + requirements);
          const post_type = detectPostType(post, dept);

          let district = null;
          const districtM = centre.match(/district[:\s]+([^,\n]+)/i);
          if (districtM) district = districtM[1].trim();

          // Help the user locate the post: include reference + Ctrl+F hint
          const searchTerm = refClean || post.slice(0, 40);
          const descParts = [];
          if (refClean) descParts.push(`Reference: ${refClean}`);
          if (salary)   descParts.push(`Salary: ${salary}`);
          if (requirements) descParts.push(requirements.slice(0, 400));
          descParts.push(`To find this post: click "View on DPSA", then press Ctrl+F (Windows) or Cmd+F (Mac) and search for "${searchTerm}".`);

          results.push({
            title:        post.slice(0, 200),
            institution:  dept.slice(0, 200),
            school:       centre.slice(0, 200),
            province,
            district,
            phase,
            post_type,
            subjects:     subjects.length ? subjects : null,
            post_level:   postLevel,
            description:  descParts.join('\n\n'),
            closing_date: closing,
            source:       'DPSA',
            reference:    refClean || `dpsa-${Buffer.from(post + centre).toString('base64').slice(0, 20)}`,
            // DPSA has no per-vacancy URL — the circular page is the direct source
            application_url: circUrl,
          });
        }
      } catch (e) {
        console.warn(`[DPSA] Failed to parse circular ${circUrl}:`, e.message);
      }
    }
  } catch (e) {
    console.warn('[DPSA] Index fetch failed:', e.message);
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 2 — Indeed SA
   URL: https://za.indeed.com/jobs?q=educator+teacher&l=South+Africa&sort=date
   When a job key (jk=) is captured we build:
     https://za.indeed.com/viewjob?jk=<jobKey>  ← direct link to that post
   Posts without a real job key are SKIPPED — we never fall back to the
   Indeed homepage or any generic URL.
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchIndeed() {
  const results = [];
  const queries = [
    'educator+teacher+school&l=South+Africa',
    'mathematics+educator&l=South+Africa',
    'principal+deputy+principal+school&l=South+Africa',
  ];

  for (const q of queries) {
    try {
      const url = `https://za.indeed.com/jobs?q=${q}&sort=date&fromage=14`;
      const html = await fetchHtml(url, { 'Accept-Encoding': 'gzip, deflate, br' });

      // Indeed embeds job data in a mosaic JSON blob — try it first
      const jsonBlobRe = /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{[\s\S]*?\});\s*window/;
      const jsonMatch = html.match(jsonBlobRe);

      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const jobs = data?.metaData?.mosaicProviderJobCardsModel?.results || [];
          for (const job of jobs.slice(0, 30)) {
            const jobKey = job.jobkey || job.jobKey || '';
            // No job key → no direct link → skip entirely
            if (!jobKey || jobKey.length < 4) continue;

            const title   = job.title || '';
            const company = job.company || '';
            const location = job.formattedLocation || job.jobLocationCity || '';
            const snippet  = (job.snippet || '').replace(/<[^>]+>/g, ' ');

            const combined = title + ' ' + company + ' ' + snippet;
            if (!/educat|teacher|school|principal|tutor|grade|phase/i.test(combined)) continue;

            const subjects  = extractSubjects(combined);
            const postLevel = extractPostLevel(combined);
            const phase     = extractPhase(combined);

            results.push({
              title:        title.slice(0, 200),
              institution:  company.slice(0, 200),
              school:       company.slice(0, 200),
              province:     normaliseProvince(location),
              district:     null,
              phase,
              post_type:    detectPostType(title, company),
              subjects:     subjects.length ? subjects : null,
              post_level:   postLevel,
              description:  snippet.slice(0, 500) || null,
              closing_date: null,
              source:       'Indeed',
              reference:    `indeed-${jobKey}`,
              // Direct link to this specific posting on Indeed
              application_url: `https://za.indeed.com/viewjob?jk=${jobKey}`,
            });
          }
          continue; // JSON worked — skip HTML fallback
        } catch (e) {
          console.warn('[Indeed] JSON parse failed, falling back to HTML:', e.message);
        }
      }

      // Fallback: HTML card scraping
      const cardRe = /<div[^>]+class="[^"]*job_seen_beacon[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
      let card;
      while ((card = cardRe.exec(html)) !== null) {
        const cardHtml = card[1];

        // Extract job key — skip if absent (can't build a direct link)
        const jkM = cardHtml.match(/jk=([a-zA-Z0-9]{8,})/);
        if (!jkM) continue;
        const jobKey = jkM[1];

        const titleM    = cardHtml.match(/<h2[^>]*jobTitle[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
        const companyM  = cardHtml.match(/<span[^>]*company[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const locationM = cardHtml.match(/<div[^>]*recJobLoc[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);

        const title   = titleM    ? stripTags(titleM[1])    : '';
        const company = companyM  ? stripTags(companyM[1])  : '';
        const location = locationM ? stripTags(locationM[1]) : '';

        if (!title || title.length < 3) continue;
        if (!/educat|teacher|school|principal|grade/i.test(title + ' ' + company)) continue;

        results.push({
          title:        title.slice(0, 200),
          institution:  company.slice(0, 200),
          school:       company.slice(0, 200),
          province:     normaliseProvince(location),
          district:     null,
          phase:        extractPhase(title + ' ' + company),
          post_type:    detectPostType(title, company),
          subjects:     null,
          post_level:   null,
          description:  null,
          closing_date: null,
          source:       'Indeed',
          reference:    `indeed-${jobKey}`,
          // Direct link to this specific posting on Indeed
          application_url: `https://za.indeed.com/viewjob?jk=${jobKey}`,
        });
      }
    } catch (e) {
      console.warn(`[Indeed] Failed for query "${q}":`, e.message);
    }
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 3 — Careers24
   URL: https://www.careers24.com/jobs/c-education-training-teaching/
   Careers24 is a major South African job board. Every job has its own page
   with a unique URL — clicking "View/Apply" takes the user directly to that
   specific vacancy, no searching required.
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchCareers24() {
  const results  = [];
  const BASE     = 'https://www.careers24.com';
  const seenUrls = new Set();

  const listingPages = [
    `${BASE}/jobs/c-education-training-teaching/`,
    `${BASE}/jobs/c-education-training-teaching/?page=2`,
  ];

  for (const pageUrl of listingPages) {
    try {
      const html = await fetchHtml(pageUrl);

      // Job cards link to pages like /jobs/mathematics-educator-12345678/
      const jobLinkRe = /href="(\/jobs\/[a-z0-9][a-z0-9\-]+-\d+\/)"/gi;
      const jobUrls   = [];
      let m;
      while ((m = jobLinkRe.exec(html)) !== null) {
        const full = `${BASE}${m[1]}`;
        if (!seenUrls.has(full)) {
          seenUrls.add(full);
          jobUrls.push(full);
        }
      }

      // Fetch detail pages in batches of 5 to avoid hitting rate limits
      for (let i = 0; i < Math.min(jobUrls.length, 20); i += 5) {
        const batch   = jobUrls.slice(i, i + 5);
        const settled = await Promise.allSettled(batch.map(u => fetchJobDetailCareers24(u)));
        for (const r of settled) {
          if (r.status === 'fulfilled' && r.value) results.push(r.value);
        }
      }
    } catch (e) {
      console.warn(`[Careers24] Failed to fetch listing page ${pageUrl}:`, e.message);
    }
  }

  return results;
}

async function fetchJobDetailCareers24(jobUrl) {
  try {
    const html = await fetchHtml(jobUrl);

    // Title
    const titleM = html.match(/<h1[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
                || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleM ? stripTags(titleM[1]) : '';
    if (!title || title.length < 3) return null;

    // Only education-related posts
    if (!/educat|teacher|school|principal|tutor|grade|phase|curriculum/i.test(title)) return null;

    // Company
    const companyM = html.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i)
                  || html.match(/"employer"\s*:\s*"([^"]+)"/i);
    const company = companyM ? stripTags(companyM[1]) : '';

    // Location
    const locationM = html.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i)
                   || html.match(/"addressRegion"\s*:\s*"([^"]+)"/i);
    const location = locationM ? stripTags(locationM[1]) : '';

    // Closing date
    const closingM = html.match(/closing\s*date[^:]*:\s*([^<\n]{5,30})/i)
                  || html.match(/apply\s*before[^:]*:\s*([^<\n]{5,30})/i)
                  || html.match(/expires?\s*:?\s*([^<\n]{5,30})/i);
    const closing = closingM ? parseDate(closingM[1].trim()) : null;

    // Description
    const descM = html.match(/<div[^>]*class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
               || html.match(/<div[^>]*id="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const description = descM ? stripTags(descM[1]).slice(0, 600) : null;

    // Unique reference from the numeric ID in the slug
    const refM      = jobUrl.match(/-(\d+)\/?$/);
    const reference = `careers24-${refM ? refM[1] : Buffer.from(title + company).toString('base64').slice(0, 20)}`;

    const combined  = title + ' ' + company + ' ' + (description || '');
    const subjects  = extractSubjects(combined);
    const postLevel = extractPostLevel(combined);
    const phase     = extractPhase(combined);

    return {
      title:        title.slice(0, 200),
      institution:  company.slice(0, 200),
      school:       company.slice(0, 200),
      province:     normaliseProvince(location),
      district:     null,
      phase,
      post_type:    detectPostType(title, company),
      subjects:     subjects.length ? subjects : null,
      post_level:   postLevel,
      description:  description || null,
      closing_date: closing,
      source:       'Careers24',
      reference,
      // This IS the exact vacancy page — clicking View/Apply lands right here
      application_url: jobUrl,
    };
  } catch (e) {
    console.warn(`[Careers24] Failed to parse ${jobUrl}:`, e.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Auth check
  const secret = event.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing Supabase env vars' }) };
  }

  const log = [];
  let total = 0;

  try {
    // Run all three scrapers in parallel
    const [dpsaRes, indeedRes, careers24Res] = await Promise.allSettled([
      fetchDPSA(),
      fetchIndeed(),
      fetchCareers24(),
    ]);

    const dpsa      = dpsaRes.status      === 'fulfilled' ? dpsaRes.value      : [];
    const indeed    = indeedRes.status    === 'fulfilled' ? indeedRes.value    : [];
    const careers24 = careers24Res.status === 'fulfilled' ? careers24Res.value : [];

    if (dpsaRes.status      === 'rejected') log.push(`DPSA error: ${dpsaRes.reason?.message}`);
    if (indeedRes.status    === 'rejected') log.push(`Indeed error: ${indeedRes.reason?.message}`);
    if (careers24Res.status === 'rejected') log.push(`Careers24 error: ${careers24Res.reason?.message}`);

    log.push(`DPSA: ${dpsa.length} posts found`);
    log.push(`Indeed: ${indeed.length} posts found (direct links only — skipped posts without a job key)`);
    log.push(`Careers24: ${careers24.length} posts found (each links directly to its vacancy page)`);

    const allRows = [...dpsa, ...indeed, ...careers24];
    total = allRows.length;

    if (allRows.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < allRows.length; i += CHUNK) {
        await supabaseUpsert(allRows.slice(i, i + CHUNK));
      }
      log.push(`Upserted ${allRows.length} rows into vacancies table`);
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        total,
        sources: { dpsa: dpsa.length, indeed: indeed.length, careers24: careers24.length },
        log,
      }),
    };
  } catch (e) {
    console.error('[fetch-vacancies] Fatal error:', e);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, error: e.message, log }),
    };
  }
};
