import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SEARCH_QUERIES = [
  'South Africa teaching educator vacancies 2025 2026 DBE "post level" site:education.gov.za OR site:pnet.co.za OR site:careerjunction.co.za OR site:indeed.com',
  'South Africa educator vacancies Gauteng KwaZulu-Natal Western Cape 2026 "SACE" school teacher post level 1 2',
  'South Africa district office education vacancies 2026 circuit manager subject advisor HOD deputy principal principal',
  'South Africa foundation phase intermediate senior FET educator vacancy 2026 school post',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled automation (no user) and admin manual trigger
    let isAutomation = false;
    try {
      const body = await req.clone().json();
      if (body?.automation) isAutomation = true;
    } catch (_) {}

    if (!isAutomation) {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    const allVacancies = [];

    // Run all search queries in parallel
    const results = await Promise.all(
      SEARCH_QUERIES.map(query =>
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a South African education job aggregator. Search the web for real, current teaching and education vacancies in South Africa.

Search query context: "${query}"

Extract up to 8 real vacancies from public sources. For each vacancy return structured data.

TODAY'S DATE: ${new Date().toLocaleDateString('en-ZA')}

IMPORTANT RULES:
- Only include REAL vacancies you can find with source URLs
- Include both school-based posts (educators, HOD, deputy principal, principal) and district/circuit-based posts (subject advisors, circuit managers, education specialists)
- If closing date is not found, estimate 30 days from today
- Post level: "Post Level 1" = educator, "Post Level 2" = HOD, "Post Level 3" = Deputy Principal, "Post Level 4" = Principal, "District" = district/circuit posts
- post_type: "School-Based" for school posts, "District-Based" for district/circuit, "Circuit-Based" for circuit posts
- For subjects: use official CAPS subject names
- source_url must be a real, working URL to the vacancy or the source site

Return ONLY a JSON object with a "vacancies" array.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              vacancies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    school: { type: 'string' },
                    district: { type: 'string' },
                    province: { type: 'string' },
                    phase: { type: 'string' },
                    subjects: { type: 'array', items: { type: 'string' } },
                    post_level: { type: 'string' },
                    post_type: { type: 'string' },
                    closing_date: { type: 'string' },
                    reference: { type: 'string' },
                    requirements: { type: 'string' },
                    source: { type: 'string' },
                    source_url: { type: 'string' },
                  },
                },
              },
            },
          },
        })
      )
    );

    for (const result of results) {
      if (result?.vacancies && Array.isArray(result.vacancies)) {
        allVacancies.push(...result.vacancies);
      }
    }

    if (allVacancies.length === 0) {
      return Response.json({ success: true, message: 'No vacancies found in this run', count: 0 });
    }

    // Deduplicate by title+school combo
    const seen = new Set();
    const unique = allVacancies.filter(v => {
      const key = `${(v.title || '').toLowerCase().trim()}|${(v.school || '').toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Mark all existing vacancies as inactive first
    const existing = await base44.asServiceRole.entities.Vacancy.list();
    await Promise.all(
      existing.map(v => base44.asServiceRole.entities.Vacancy.update(v.id, { is_active: false }))
    );

    // Upsert new vacancies
    const VALID_PROVINCES = ['Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Mpumalanga', 'Limpopo', 'North West', 'Free State', 'Northern Cape'];
    const VALID_PHASES = ['Foundation', 'Intermediate', 'Senior', 'FET', 'District/Admin', 'Any'];
    const VALID_POST_TYPES = ['School-Based', 'District-Based', 'Circuit-Based', 'Other'];

    const created = await Promise.all(
      unique.map(v => {
        const record = {
          title: v.title || 'Untitled Post',
          school: v.school || 'Unknown',
          district: v.district || '',
          province: VALID_PROVINCES.includes(v.province) ? v.province : 'Gauteng',
          phase: VALID_PHASES.includes(v.phase) ? v.phase : 'Any',
          subjects: Array.isArray(v.subjects) ? v.subjects : [],
          post_level: v.post_level || 'Post Level 1',
          post_type: VALID_POST_TYPES.includes(v.post_type) ? v.post_type : 'School-Based',
          closing_date: v.closing_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          reference: v.reference || '',
          requirements: v.requirements || '',
          source: v.source || 'Web',
          source_url: v.source_url || '',
          is_active: true,
          fetched_at: now,
        };
        return base44.asServiceRole.entities.Vacancy.create(record);
      })
    );

    return Response.json({ success: true, count: created.length, message: `Fetched and saved ${created.length} vacancies` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});