/**
 * fetch-vacancies.js
 * Fetches teaching vacancies from DPSA and Indeed SA,
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
      'User-Agent': 'Mozilla/5.0 (compatible; EduCrossBot/1.0; +https://educross.app)',
      'Accept': 'text/html,application/xhtml+xml',
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

/* ─── Date parser ───────────────────────────────────────────────────────── */
function parseDate(str) {
  if (!str) return null;
  // Handle "DD Month YYYY", "YYYY-MM-DD", "DD/MM/YYYY"
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
   The page lists weekly circulars as downloadable PDFs. We scrape the HTML
   index to get circular dates and links, then attempt to parse text from
   the most recent HTML-accessible circular pages.
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchDPSA() {
  const results = [];
  try {
    const indexHtml = await fetchHtml('https://www.dpsa.gov.za/dpsa2g/vacancies.asp');

    // Find links to individual vacancy circular pages
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

    // Also try the standard circular URL pattern for recent weeks
    const now = new Date();
    for (let w = 0; w < 2; w++) {
      const d = new Date(now);
      d.setDate(d.getDate() - w * 7);
      // DPSA uses patterns like vacancies230.asp, vacancies231.asp
      // We'll scan the index for these numbers
    }

    for (const circUrl of circularLinks.slice(0, 2)) {
      try {
        const html = await fetchHtml(circUrl);
        // DPSA circular pages list vacancies in tables
        // Each row typically: Department | Post | Salary | Centre | Requirements | Enquiries | Closing date | Post ref
        const tableRowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const stripTags = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        let rowMatch;
        while ((rowMatch = tableRowRe.exec(html)) !== null) {
          const cells = [];
          let cellMatch;
          const cellText = rowMatch[1];
          const cellReCopy = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
          while ((cellMatch = cellReCopy.exec(cellText)) !== null) {
            cells.push(stripTags(cellMatch[1]));
          }
          if (cells.length < 4) continue;

          const dept = cells[0] || '';
          const post = cells[1] || '';
          const salary = cells[2] || '';
          const centre = cells[3] || '';
          const requirements = cells[4] || '';
          const closingRaw = cells[cells.length - 2] || '';
          const ref = cells[cells.length - 1] || '';

          // Only process education-related posts
          const combined = (dept + post + requirements).toLowerCase();
          const isEducation = combined.includes('education') || combined.includes('educator') || combined.includes('teacher') || combined.includes('school') || combined.includes('dbe');
          if (!isEducation || !post || post.length < 5) continue;

          const province = normaliseProvince(centre) || normaliseProvince(dept);
          const closing = parseDate(closingRaw);
          const subjects = extractSubjects(post + ' ' + requirements);
          const postLevel = extractPostLevel(post + ' ' + salary);
          const phase = extractPhase(post + ' ' + requirements);
          const post_type = detectPostType(post, dept);

          // Extract district from centre (often "District: Tshwane North" or just a location)
          let district = null;
          const districtM = centre.match(/district[:\s]+([^,\n]+)/i);
          if (districtM) district = districtM[1].trim();

          results.push({
            title: post.slice(0, 200),
            institution: dept.slice(0, 200),
            school: centre.slice(0, 200),
            province,
            district,
            phase,
            post_type,
            subjects: subjects.length ? subjects : null,
            post_level: postLevel,
            closing_date: closing,
            source: 'DPSA',
            reference: ref.slice(0, 100) || `dpsa-${Buffer.from(post + centre).toString('base64').slice(0, 20)}`,
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
   Scrapes the search results page for job cards.
   Note: Indeed's HTML structure changes periodically — this targets their
   current job card markup. May need updating if Indeed changes their layout.
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
      const html = await fetchHtml(url, {
        'Accept-Language': 'en-ZA,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      });

      // Indeed embeds job data in a window.__initialData or mosaic JSON blob
      // Try JSON blob first (more reliable than HTML scraping)
      const jsonBlobRe = /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{[\s\S]*?\});\s*window/;
      const jsonMatch = html.match(jsonBlobRe);

      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const jobs = data?.metaData?.mosaicProviderJobCardsModel?.results || [];
          for (const job of jobs.slice(0, 30)) {
            const title = job.title || '';
            const company = job.company || '';
            const location = job.formattedLocation || job.jobLocationCity || '';
            const jobKey = job.jobkey || job.jobKey || '';
            const snippet = (job.snippet || '').replace(/<[^>]+>/g, ' ');
            const datePosted = job.pubDate ? new Date(job.pubDate).toISOString().split('T')[0] : null;

            const combined = title + ' ' + company + ' ' + snippet;
            const isEducation = /educat|teacher|school|principal|tutor|grade|phase/i.test(combined);
            if (!isEducation) continue;

            const province = normaliseProvince(location);
            const subjects = extractSubjects(combined);
            const postLevel = extractPostLevel(combined);
            const phase = extractPhase(combined);
            const post_type = detectPostType(title, company);

            results.push({
              title: title.slice(0, 200),
              institution: company.slice(0, 200),
              school: company.slice(0, 200),
              province,
              district: null,
              phase,
              post_type,
              subjects: subjects.length ? subjects : null,
              post_level: postLevel,
              closing_date: null,
              source: 'Indeed',
              reference: `indeed-${jobKey}`,
              application_url: jobKey ? `https://za.indeed.com/viewjob?jk=${jobKey}` : 'https://za.indeed.com',
            });
          }
          continue; // skip HTML parsing if JSON worked
        } catch (e) {
          console.warn('[Indeed] JSON parse failed, falling back to HTML:', e.message);
        }
      }

      // Fallback: HTML card scraping
      // Indeed job cards: <div class="job_seen_beacon"> ... <h2 class="jobTitle"> ... </h2>
      const cardRe = /<div[^>]+class="[^"]*job_seen_beacon[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
      const stripTags = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      let card;
      while ((card = cardRe.exec(html)) !== null) {
        const cardHtml = card[1];

        const titleM = cardHtml.match(/<h2[^>]*jobTitle[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
        const companyM = cardHtml.match(/<span[^>]*company[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const locationM = cardHtml.match(/<div[^>]*recJobLoc[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
        const linkM = cardHtml.match(/href="(\/rc\/clk[^"]+)"/i) || cardHtml.match(/href="(\/pagead[^"]+)"/i);
        const jkM = (linkM?.[1] || '').match(/jk=([a-zA-Z0-9]+)/);

        const title = titleM ? stripTags(titleM[1]) : '';
        const company = companyM ? stripTags(companyM[1]) : '';
        const location = locationM ? stripTags(locationM[1]) : '';

        if (!title || title.length < 3) continue;
        const combined = title + ' ' + company;
        if (!/educat|teacher|school|principal|grade/i.test(combined)) continue;

        results.push({
          title: title.slice(0, 200),
          institution: company.slice(0, 200),
          school: company.slice(0, 200),
          province: normaliseProvince(location),
          district: null,
          phase: extractPhase(combined),
          post_type: detectPostType(title, company),
          subjects: null,
          post_level: null,
          closing_date: null,
          source: 'Indeed',
          reference: jkM ? `indeed-${jkM[1]}` : `indeed-${Buffer.from(title + company).toString('base64').slice(0, 20)}`,
          application_url: jkM ? `https://za.indeed.com/viewjob?jk=${jkM[1]}` : 'https://za.indeed.com',
        });
      }
    } catch (e) {
      console.warn(`[Indeed] Failed for query "${q}":`, e.message);
    }
  }
  return results;
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
    // Run both scrapers in parallel
    const [dpsaRows, indeedRows] = await Promise.allSettled([fetchDPSA(), fetchIndeed()]);

    const dpsa = dpsaRows.status === 'fulfilled' ? dpsaRows.value : [];
    const indeed = indeedRows.status === 'fulfilled' ? indeedRows.value : [];

    if (dpsaRows.status === 'rejected') log.push(`DPSA scraper error: ${dpsaRows.reason?.message}`);
    if (indeedRows.status === 'rejected') log.push(`Indeed scraper error: ${indeedRows.reason?.message}`);

    log.push(`DPSA: ${dpsa.length} posts found`);
    log.push(`Indeed: ${indeed.length} posts found`);

    const allRows = [...dpsa, ...indeed];
    total = allRows.length;

    if (allRows.length > 0) {
      // Batch upsert in chunks of 50
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
        sources: { dpsa: dpsa.length, indeed: indeed.length },
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
