/**
 * Netlify Function: landing-stats
 *
 * Public, unauthenticated. Returns real aggregate counts for display on
 * the landing page hero card — total educators/job seekers, CVs created,
 * and vacancies listed. No per-user or identifying data is ever returned;
 * counts only.
 *
 * Deploy path: netlify/functions/landing-stats.js
 *
 * GET /.netlify/functions/landing-stats
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing Supabase env vars' }) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Total educators + job seekers — every row in `educators` regardless
    // of profile_type, since "general" (job seeker) profiles are also
    // stored there.
    const usersPromise = supabase
      .from('educators')
      .select('id', { count: 'exact', head: true });

    // CVs created — every credit_ledger row where a CV was generated/
    // downloaded (type = 'cv_usage'). This counts CV downloads, which is
    // a reasonable proxy for "CVs created" since every download follows
    // a generation.
    const cvsPromise = supabase
      .from('credit_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'cv_usage');

    // Vacancies currently listed.
    const vacanciesPromise = supabase
      .from('vacancies')
      .select('id', { count: 'exact', head: true });

    const [usersRes, cvsRes, vacanciesRes] = await Promise.all([usersPromise, cvsPromise, vacanciesPromise]);

    if (usersRes.error)     throw usersRes.error;
    if (cvsRes.error)       throw cvsRes.error;
    if (vacanciesRes.error) throw vacanciesRes.error;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        users:      usersRes.count ?? 0,
        cvs:        cvsRes.count ?? 0,
        vacancies:  vacanciesRes.count ?? 0,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};
