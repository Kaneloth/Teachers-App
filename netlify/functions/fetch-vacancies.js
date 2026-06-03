/**
 * fetch-vacancies.js  —  v3 (RSS-based, timeout-safe)
 *
 * Sources:
 *   1. Indeed SA  — via RSS feed (reliable, not bot-blocked, direct job links)
 *   2. DPSA       — gov circular pages (no per-vacancy URLs exist; link to circular)
 *   3. Careers24  — listing page only (extracts direct per-vacancy URLs from cards)
 *
 * Trigger: POST /.netlify/functions/fetch-vacancies
 * Auth:    Header  x-admin-secret: <ADMIN_SECRET>
 *
 * Env vars:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
};

/* ─── Supabase upsert ───────────────────────────────────────────────────── */
async function supabaseUpsert(rows) {
  if (!rows.length) return;
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/vacancies`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed (${res.status}): ${await res.text()}`);
}

/* ─── HTTP fetch (8 s timeout, realistic browser headers) ──────────────── */
async function fetchUrl(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-ZA,en;q=0.9',
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

/* ─── Tiny helpers ──────────────────────────────────────────────────────── */
const strip = (s = '') => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

function parseDate(s) {
  if (!s) return null;
  const c = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return c;
  const slash = c.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}`;
  const mon = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const long = c.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (long) { const m = mon[long[2].toLowerCase().slice(0,3)]; if (m) return `${long[3]}-${String(m).padStart(2,'0')}-${long[1].padStart(2,'0')}`; }
  // RSS date: "Mon, 03 Jun 2024 12:00:00 GMT"
  const rss = c.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (rss) { const m = mon[rss[2].toLowerCase().slice(0,3)]; if (m) return `${rss[3]}-${String(m).padStart(2,'0')}-${rss[1].padStart(2,'0')}`; }
  return null;
}

const PROV = { gauteng:'Gauteng', 'kwazulu-natal':'KwaZulu-Natal', kzn:'KwaZulu-Natal', kwazulu:'KwaZulu-Natal', 'western cape':'Western Cape', 'eastern cape':'Eastern Cape', mpumalanga:'Mpumalanga', limpopo:'Limpopo', 'north west':'North West', northwest:'North West', 'free state':'Free State', 'northern cape':'Northern Cape' };
function prov(s) { if (!s) return null; const l = s.toLowerCase(); for (const [k,v] of Object.entries(PROV)) { if (l.includes(k)) return v; } return s.trim() || null; }

const SUBJECTS = ['Mathematics','Mathematical Literacy','Physical Sciences','Life Sciences','English','Afrikaans','History','Geography','Business Studies','Accounting','Economics','Life Orientation','Computer Applications Technology','Information Technology','Agricultural Sciences','Natural Sciences','Social Sciences','Technology','Visual Arts','Music','Dramatic Arts','Tourism','Hospitality Studies','Engineering Graphics'];
const subj = (t='') => SUBJECTS.filter(s => t.toLowerCase().includes(s.toLowerCase()));

function postType(title='',dept='') { const t=(title+' '+dept).toLowerCase(); if(t.includes('district'))return'District'; if(t.includes('circuit'))return'Circuit'; if(t.includes('provincial'))return'Provincial'; if(t.includes('national')||t.includes('dbe'))return'National'; return'School-Based'; }
function phase(t='') { const l=t.toLowerCase(); if(l.includes('foundation')||/grade\s*[r123]/i.test(t))return'Foundation Phase'; if(l.includes('intermediate')||/grade\s*[456]/i.test(t))return'Intermediate Phase'; if(l.includes('senior')||/grade\s*[789]/i.test(t))return'Senior Phase'; if(l.includes('fet')||l.includes('further education')||/grade\s*1[012]/i.test(t))return'FET Phase'; return null; }
function postLevel(t='') { const m=t.match(/post\s*level\s*(\d)/i)||t.match(/\bpl\s*(\d)/i); return m?m[1]:null; }
const isEdu = (t='') => /educat|teacher|school|principal|tutor|grade|phase|curriculum|sace|persal/i.test(t);

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 1 — Indeed SA via RSS
   RSS feed returns structured XML with direct viewjob URLs.
   No bot-blocking, no HTML parsing fragility.
   ═══════════════════════════════════════════════════════════════════════════ */
async function fetchIndeedRSS() {
  const results = [];
  const queries = [
    'educator+teacher+school',
    'mathematics+educator+south+africa',
    'principal+school+south+africa',
    'foundation+phase+educator',
    'high+school+teacher+south+africa',
  ];

  const settled = await Promise.allSettled(
    queries.map(q =>
      fetchUrl(`https://za.indeed.com/rss?q=${q}&l=South+Africa&sort=date&fromage=30`, {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      })
    )
  );

  const seen = new Set();
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    const xml = r.value;

    // Extract <item> blocks
    const itemRe = /<item>([\s\S]*?)<\/item>/gi;
    let item;
    while ((item = itemRe.exec(xml)) !== null) {
      const block = item[1];

      const titleRaw  = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1]
                     || block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
      const linkRaw   = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]
                     || block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] || '';
      const descRaw   = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1]
                     || block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '';
      const pubRaw    = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '';
      const sourceRaw = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || '';

      // Title format on Indeed RSS: "Job Title - Company Name"
      const dashIdx = titleRaw.lastIndexOf(' - ');
      const title   = dashIdx > 0 ? strip(titleRaw.slice(0, dashIdx)) : strip(titleRaw);
      const company = dashIdx > 0 ? strip(titleRaw.slice(dashIdx + 3)) : strip(sourceRaw);

      if (!title || !isEdu(title + ' ' + company)) continue;

      // Extract job key from URL for de-duplication
      const jkMatch = linkRaw.match(/jk=([a-zA-Z0-9]+)/);
      const jobKey  = jkMatch ? jkMatch[1] : '';
      if (!jobKey) continue; // no direct link available — skip
      if (seen.has(jobKey)) continue;
      seen.add(jobKey);

      // Direct URL to this specific job on Indeed
      const applyUrl = `https://za.indeed.com/viewjob?jk=${jobKey}`;

      const descClean = strip(descRaw).slice(0, 500);
      const location  = block.match(/location[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] || '';
      const combined  = title + ' ' + company + ' ' + descClean;

      results.push({
        title:           title.slice(0, 200),
        institution:     company.slice(0, 200),
        school:          company.slice(0, 200),
        province:        prov(location) || prov(descClean),
        district:        null,
        phase:           phase(combined),
        post_type:       postType(title, company),
        subjects:        subj(combined).length ? subj(combined) : null,
        post_level:      postLevel(combined),
        description:     descClean || null,
        closing_date:    null,
        source:          'Indeed',
        reference:       `indeed-${jobKey}`,
        application_url: applyUrl,   // ← direct link to this exact job posting
      });
    }
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 2 — DPSA Government Circular Pages
   DPSA publishes vacancies in weekly HTML circulars — there is NO individual
   URL per post. The circular page IS the direct link. We include the
   reference number in the description so users can Ctrl+F to find their post.
   ═══════════════════════════════════════════════════════════════════════════ */
async function fetchDPSA() {
  const results = [];
  try {
    const indexHtml = await fetchUrl('https://www.dpsa.gov.za/dpsa2g/vacancies.asp');

    // Pull all circular links from the index
    const links = [];
    const re = /href="([^"]*(?:vacancies|circular)[^"]*\.asp[^"]*)"/gi;
    let m;
    while ((m = re.exec(indexHtml)) !== null) {
      const href = m[1];
      const full = href.startsWith('http')
        ? href
        : `https://www.dpsa.gov.za/dpsa2g/${href.replace(/^\/dpsa2g\//, '')}`;
      if (!links.includes(full)) links.push(full);
    }

    // Also try the main index itself as a fallback circular
    if (!links.length) links.push('https://www.dpsa.gov.za/dpsa2g/vacancies.asp');

    // Fetch up to 2 circular pages in parallel
    const pages = await Promise.allSettled(links.slice(0, 2).map(u => fetchUrl(u)));

    for (let pi = 0; pi < pages.length; pi++) {
      if (pages[pi].status !== 'fulfilled') continue;
      const html     = pages[pi].value;
      const circUrl  = links[pi];
      const rowRe    = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let row;

      while ((row = rowRe.exec(html)) !== null) {
        const cells = [];
        const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let cell;
        while ((cell = cellRe.exec(row[1])) !== null) cells.push(strip(cell[1]));
        if (cells.length < 4) continue;

        const dept  = cells[0] || '';
        const post  = cells[1] || '';
        const sal   = cells[2] || '';
        const ctr   = cells[3] || '';
        const reqs  = cells[4] || '';
        const ref   = (cells[cells.length - 1] || '').slice(0, 100);
        const clRaw = cells[cells.length - 2] || '';

        if (!isEdu(dept + post + reqs) || !post || post.length < 5) continue;

        const combined = post + ' ' + reqs;
        const distM    = ctr.match(/district[:\s]+([^,\n]+)/i);
        const searchTerm = ref || post.slice(0, 40);

        results.push({
          title:       post.slice(0, 200),
          institution: dept.slice(0, 200),
          school:      ctr.slice(0, 200),
          province:    prov(ctr) || prov(dept),
          district:    distM ? distM[1].trim() : null,
          phase:       phase(combined),
          post_type:   postType(post, dept),
          subjects:    subj(combined).length ? subj(combined) : null,
          post_level:  postLevel(post + ' ' + sal),
          description: [
            ref   ? `Reference: ${ref}` : null,
            sal   ? `Salary: ${sal}` : null,
            reqs  ? reqs.slice(0, 400) : null,
            `To find this post: open the link, then press Ctrl+F (Windows) or Cmd+F (Mac) and search for "${searchTerm}".`,
          ].filter(Boolean).join('\n\n'),
          closing_date:    parseDate(clRaw),
          source:          'DPSA',
          reference:       ref || `dpsa-${Buffer.from(post + ctr).toString('base64').slice(0, 20)}`,
          application_url: circUrl,   // ← circular page is the direct source; no per-post URLs exist
        });
      }
    }
  } catch (e) {
    console.warn('[DPSA]', e.message);
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOURCE 3 — Careers24
   We scrape the listing page only (not individual detail pages).
   Each job card contains a direct per-vacancy URL — that IS the apply link.
   Careers24 job URLs look like: /jobs/mathematics-educator-12345678/
   ═══════════════════════════════════════════════════════════════════════════ */
async function fetchCareers24() {
  const results  = [];
  const BASE     = 'https://www.careers24.com';
  const seen     = new Set();

  const pages = await Promise.allSettled([
    fetchUrl(`${BASE}/jobs/c-education-training-teaching/`),
    fetchUrl(`${BASE}/jobs/c-education-training-teaching/?page=2`),
  ]);

  for (const p of pages) {
    if (p.status !== 'fulfilled') continue;
    const html = p.value;

    // ── Extract job cards ──────────────────────────────────────────────────
    // Careers24 wraps each card in an <article> or a <div data-listing-id="...">
    // Primary pattern: article elements
    const cardPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<div[^>]+data-listing-id="[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ];

    for (const cardRe of cardPatterns) {
      let card;
      while ((card = cardRe.exec(html)) !== null) {
        const c = card[1];

        // Direct job URL: /jobs/[slug]-[digits]/
        const urlM = c.match(/href="(\/jobs\/[a-z0-9][a-z0-9\-]+-\d+\/?)" /i)
                  || c.match(/href="(\/jobs\/[a-z0-9][a-z0-9\-]+-\d+\/?)">/i)
                  || c.match(/href="(\/jobs\/[a-z0-9][a-z0-9\-]+-\d+\/)"/i);
        if (!urlM) continue;

        const jobUrl = `${BASE}${urlM[1].replace(/\/?$/, '/')}`;
        if (seen.has(jobUrl)) continue;
        seen.add(jobUrl);

        // Title
        const titleM = c.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
                    || c.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)
                    || c.match(/class="[^"]*job[_-]?title[^"]*"[^>]*>([\s\S]*?)<\//i);
        const title = titleM ? strip(titleM[1]) : '';
        if (!title || title.length < 3) continue;
        if (!isEdu(title)) continue;

        // Company
        const coM = c.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i)
                 || c.match(/class="[^"]*employer[^"]*"[^>]*>([\s\S]*?)<\//i);
        const company = coM ? strip(coM[1]) : '';

        // Location
        const locM = c.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i)
                  || c.match(/class="[^"]*city[^"]*"[^>]*>([\s\S]*?)<\//i);
        const location = locM ? strip(locM[1]) : '';

        // Closing date
        const clM = c.match(/closing[^:]*:\s*([^<]{5,25})/i)
                 || c.match(/apply\s*before[^:]*:\s*([^<]{5,25})/i);
        const closing = clM ? parseDate(clM[1]) : null;

        // Reference from URL
        const refM = jobUrl.match(/-(\d+)\/?$/);
        const ref  = `careers24-${refM ? refM[1] : Buffer.from(title).toString('base64').slice(0,16)}`;

        const combined = title + ' ' + company + ' ' + location;
        results.push({
          title:           title.slice(0, 200),
          institution:     company.slice(0, 200),
          school:          company.slice(0, 200),
          province:        prov(location),
          district:        null,
          phase:           phase(combined),
          post_type:       postType(title, company),
          subjects:        subj(combined).length ? subj(combined) : null,
          post_level:      postLevel(combined),
          description:     null,
          closing_date:    closing,
          source:          'Careers24',
          reference:       ref,
          application_url: jobUrl,  // ← direct link to this exact vacancy on Careers24
        });
      }
      if (results.length) break; // one pattern matched — skip the other
    }

    // ── Fallback: extract any /jobs/[slug]-[id]/ href from the full page ──
    if (!results.length) {
      const allLinks = [];
      const linkRe   = /href="(\/jobs\/[a-z0-9][a-z0-9\-]+-\d+\/)"/gi;
      let lm;
      while ((lm = linkRe.exec(html)) !== null) {
        const u = `${BASE}${lm[1]}`;
        if (!seen.has(u)) { seen.add(u); allLinks.push(u); }
      }
      for (const u of allLinks.slice(0, 30)) {
        const refM = u.match(/-(\d+)\/?$/);
        const slug = u.split('/').filter(Boolean).pop() || '';
        const title = slug.replace(/-\d+$/, '').replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        if (!isEdu(title)) continue;
        results.push({
          title:           title.slice(0, 200),
          institution:     null, school: null, province: null, district: null,
          phase:           phase(title), post_type: postType(title, ''),
          subjects:        subj(title).length ? subj(title) : null,
          post_level:      null, description: null, closing_date: null,
          source:          'Careers24',
          reference:       `careers24-${refM ? refM[1] : slug}`,
          application_url: u,
        });
      }
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

  const secret = event.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing Supabase env vars' }) };
  }

  const log = [];

  try {
    // All three scrapers run in parallel
    const [indeedRes, dpsaRes, c24Res] = await Promise.allSettled([
      fetchIndeedRSS(),
      fetchDPSA(),
      fetchCareers24(),
    ]);

    const indeed    = indeedRes.status === 'fulfilled' ? indeedRes.value : [];
    const dpsa      = dpsaRes.status   === 'fulfilled' ? dpsaRes.value   : [];
    const careers24 = c24Res.status    === 'fulfilled' ? c24Res.value    : [];

    if (indeedRes.status !== 'fulfilled') log.push(`Indeed RSS error: ${indeedRes.reason?.message}`);
    if (dpsaRes.status   !== 'fulfilled') log.push(`DPSA error: ${dpsaRes.reason?.message}`);
    if (c24Res.status    !== 'fulfilled') log.push(`Careers24 error: ${c24Res.reason?.message}`);

    log.push(`Indeed RSS: ${indeed.length} posts (direct viewjob links)`);
    log.push(`DPSA: ${dpsa.length} posts`);
    log.push(`Careers24: ${careers24.length} posts (direct per-vacancy links)`);

    const allRows = [...indeed, ...dpsa, ...careers24];

    if (allRows.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < allRows.length; i += CHUNK) {
        await supabaseUpsert(allRows.slice(i, i + CHUNK));
      }
      log.push(`Upserted ${allRows.length} rows total`);
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        total: allRows.length,
        sources: { indeed: indeed.length, dpsa: dpsa.length, careers24: careers24.length },
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
