import { createClient } from '@supabase/supabase-js';
import { getCosts } from './lib/pricing.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[credits] Missing Supabase env vars — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_ equivalents) in Netlify.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Feature-specific ledger descriptions ──────────────────────────────────
// COST_LABELS[type] (from credit_costs) is one generic label per `type`
// column — e.g. every letter_usage deduction reads "Cover letter / AI
// action" regardless of which feature actually triggered it. In reality
// letter_usage is shared by several CV Builder AI actions (import, AI
// summary, bullet improvement, section suggestions) AND actual Cover
// Letters actions, so that one label was misleading users into thinking
// their CV Builder AI usage was "cover letter" spend.
//
// This derives an accurate, feature-specific label from the ref_id prefix
// each caller already sets (see CVBuilderPage.tsx, CVStepPersonal.tsx,
// CVStepExperience.tsx, CVStepExtras.tsx for cvbuild_* prefixes, and
// CoverLettersPage.tsx for ai_letter_*/letter_* prefixes). It's a pure
// display fix — it does NOT change which ref_ids count toward the cv_usage
// discount below (that still requires the 'cvbuild_' prefix specifically).
// Falls back to the generic COST_LABELS[type] whenever ref_id doesn't match
// anything recognized, so nothing here can produce a blank description.
function describeAction(type, ref_id) {
  if (type !== 'letter_usage' || !ref_id) return null;

  if (ref_id.startsWith('cvbuild_import_'))          return 'CV import (AI)';
  if (ref_id.startsWith('cvbuild_freetext_'))         return 'CV import (AI)';
  if (ref_id.startsWith('cvbuild_summary_'))          return 'CV professional summary (AI)';
  if (ref_id.startsWith('ai_summary_'))               return 'CV professional summary (AI)';
  if (ref_id.startsWith('cvbuild_improve_exp_'))      return 'CV experience bullet improvement (AI)';
  if (ref_id.startsWith('cvbuild_suggest_sections_')) return 'CV section suggestions (AI)';
  if (ref_id.startsWith('ai_letter_'))                return 'Cover letter generation (AI)';
  if (ref_id.startsWith('letter_'))                   return 'Cover letter download';

  return null; // unrecognized — caller falls back to the generic label
}

// Costs used to be a hardcoded object here (cv_usage: 90, letter_usage: 20,
// etc.). They now live in the credit_costs table — see lib/pricing.js and
// Admin → Money → Pricing (AdminPricing.tsx) — so admins can retune them
// without a deploy. Fetched fresh per invocation below (const COSTS = ...).
//
// chat_start was removed — messaging is no longer credit-metered. It's
// unlocked by a standalone R150 PayFast payment (see payfast-initiate /
// payfast-webhook, package_id 'chat_unlock'), which writes a
// credit_ledger row with type='messaging_unlock' rather than deducting
// credits here. ChatRoom.tsx checks for that row directly.

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const jwt = (event.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!jwt) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { type, ref_id } = body;

  // Admins bypass all credit gates — log for audit but don't deduct.
  //
  // SECURITY: verified against educators.is_admin (a real DB column,
  // writable only by service-role code) — NOT user.user_metadata.is_admin.
  // user_metadata is client-writable: any signed-in user can call
  // supabase.auth.updateUser({ data: { is_admin: true } }) from their own
  // browser and flip that field for their own account. Trusting it here
  // would let any user grant themselves unlimited free CVs, letters, chats,
  // guide downloads, and ID verifications. See requireAdmin.js for the same
  // fix applied to the admin-*.js functions.
  const { data: educatorRow, error: adminLookupErr } = await supabase
    .from('educators')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminLookupErr) {
    console.error('[deduct-credits] admin lookup failed:', adminLookupErr);
    // Fail closed — if we can't verify admin status, treat as a normal
    // (non-admin) user rather than risk a false bypass.
  }

  const isAdmin = !!educatorRow?.is_admin;

  if (isAdmin) {
    console.log(`[deduct-credits] Admin bypass for ${user.email} — type=${type}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, deducted: 0, new_balance: 999999 }) };
  }

  // Check feature_gates — if the gate for this action is disabled globally
  // or overridden OFF for this user, skip deduction entirely (free for everyone)
  const GATE_MAP = {
    cv_usage:       'cv_credits',
    letter_usage:   'cv_credits',
    guide_download: 'guides_access',
    id_verify:      'id_verification',
  };
  const gateKey = GATE_MAP[type];
  if (gateKey) {
    // Check per-user override first, then global gate
    // Fetch global gate and per-user override separately to avoid NULL comparison issues
    const [globalResult, userResult] = await Promise.all([
      supabase.from('feature_gates').select('enabled').eq('gate_key', gateKey).is('user_id', null).maybeSingle(),
      supabase.from('feature_gates').select('enabled').eq('gate_key', gateKey).eq('user_id', user.id).maybeSingle(),
    ]);

    const globalRow = globalResult.data;
    const userRow   = userResult.data;

    console.log(`[deduct-credits] gate=${gateKey} globalRow=`, JSON.stringify(globalRow), 'globalErr=', globalResult.error?.message, 'userRow=', JSON.stringify(userRow));

    // Per-user override wins over global; global wins over default (true = gate active)
    const gateEnabled = userRow ? userRow.enabled : (globalRow ? globalRow.enabled : true);

    console.log(`[deduct-credits] gateEnabled=${gateEnabled} for type=${type} user=${user.email}`);

    if (!gateEnabled) {
      console.log(`[deduct-credits] Gate '${gateKey}' disabled — free pass for ${user.email}, type=${type}`);
      return { statusCode: 200, body: JSON.stringify({ success: true, deducted: 0, new_balance: 999999 }) };
    }
  }

  const { costs: COSTS, labels: COST_LABELS } = await getCosts(supabase);

  if (!COSTS[type]) {
    return { statusCode: 400, body: JSON.stringify({ error: `Unknown type "${type}"` }) };
  }

  // ── Career tools cap (cv_usage, letter_usage) ─────────────────────────────
  // Educators get 180 free career-tool credits from the signup bonus.
  // Once used, they must top up — UNLESS they have credits from any other
  // source (admin adjustment, monthly pro grant, etc.).
  // The cap is bypassed if:
  //   a) user has ANY non-signup credit entries (purchase, admin, pro grant)
  //   b) the cv_credits gate is disabled for this user (already handled above)
  const CAREER_TOOL_TYPES = ['cv_usage', 'letter_usage'];
  if (CAREER_TOOL_TYPES.includes(type)) {
    // Check for ANY topped-up credits — not just 'purchase' type.
    // Admin adjustments use type='admin_adjustment', pro grants use 'monthly_pro' etc.
    // 'chat_start' is kept here for historical rows from before messaging
    // moved to a standalone R150 unlock — it's no longer an active COSTS
    // type, but old ledger entries with that type should still be
    // excluded from counting as "topped up," same as messaging_unlock.
    const { count: toppedUpCount } = await supabase
      .from('credit_ledger').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('type', 'in', '("signup_bonus","cv_usage","letter_usage","chat_start","guide_download","id_verify","messaging_unlock")');

    if ((toppedUpCount ?? 0) === 0) {
      // No topped-up credits — apply the 180-credit free tier cap
      const { data: careerUsage } = await supabase
        .from('credit_ledger').select('amount')
        .eq('user_id', user.id).in('type', CAREER_TOOL_TYPES);

      const totalCareerSpent = (careerUsage || []).reduce((sum, r) => sum + Math.abs(r.amount), 0);
      if (totalCareerSpent >= 180) {
        const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id });
        return {
          statusCode: 402,
          body: JSON.stringify({
            error: 'career_cap_reached',
            message: "You've used your 180 free career tool credits. Top up to continue generating CVs and cover letters.",
            balance: balance ?? 0,
          }),
        };
      }
    }
  }

  // ── CV download discount: reward prior AI actions on THIS CV ─────────────
  // If the person already spent letter_usage credits on AI actions while
  // building this specific CV (import, AI summary, bullet improvement,
  // section suggestions), that spend counts toward the cv_usage cost
  // instead of stacking on top of it — cost is max(0, cvCost - priorSpend),
  // so heavy AI users can never be charged more than the standard price,
  // and if their AI spend already exceeds it, the download itself is free
  // (not negative — no refund, just zero additional charge).
  //
  // This is computed ENTIRELY server-side from the ledger — the request
  // body carries no discount amount at all, since trusting a client-
  // supplied "charge me less" number would let anyone open dev tools and
  // request a free CV. ref_id prefix 'cvbuild_' identifies AI actions that
  // happened specifically inside the CV Builder wizard (see CVBuilderPage
  // .tsx, CVStepPersonal.tsx, CVStepExperience.tsx, CVStepExtras.tsx) —
  // this deliberately excludes letter_usage spent on the separate Cover
  // Letters feature, which isn't part of building this CV.
  //
  // The cutoff is this user's most recent PRIOR cv_usage charge (if any):
  // AI actions are only "unclaimed" discount credit once, for the very
  // next CV download — once that download happens, the cutoff moves
  // forward, so the same AI spend can't be reused as a discount on a
  // future, unrelated CV.
  let cost = COSTS[type];
  let discountApplied = 0;

  if (type === 'cv_usage') {
    const { data: lastCvUsage } = await supabase
      .from('credit_ledger')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('type', 'cv_usage')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const cutoff = lastCvUsage?.created_at || '1970-01-01T00:00:00Z';

    const { data: aiSpendRows, error: aiSpendErr } = await supabase
      .from('credit_ledger')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'letter_usage')
      .gt('created_at', cutoff)
      .like('ref_id', 'cvbuild_%');

    if (aiSpendErr) {
      // Fail closed on the discount specifically — if we can't verify
      // prior AI spend, charge full price rather than risk an unverified
      // discount. This never blocks the download itself, only how much
      // of a discount it can claim.
      console.error('[deduct-credits] Failed to compute CV discount, charging full price:', aiSpendErr);
    } else {
      const priorAiSpend = (aiSpendRows || []).reduce((sum, r) => sum + Math.abs(r.amount), 0);
      discountApplied = Math.min(priorAiSpend, COSTS[type]);
      cost = Math.max(0, COSTS[type] - discountApplied);
    }
  }

  const actionLabel = describeAction(type, ref_id) || COST_LABELS[type] || type;
  const description = discountApplied > 0
    ? `${actionLabel} (${cost} credits — ${discountApplied} credit discount from prior AI actions on this CV)`
    : `${actionLabel} (${cost} credits)`;

  const { data: newBalance, error: deductErr } = await supabase.rpc('deduct_credits', {
    p_user_id:     user.id,
    p_amount:      cost,
    p_type:        type,
    p_description: description,
    p_ref_id:      ref_id ?? null,
  });

  if (deductErr) {
    if (deductErr.message?.includes('insufficient_credits')) {
      const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id });
      return {
        statusCode: 402,
        body: JSON.stringify({ error: 'insufficient_credits', balance: balance ?? 0, required: cost }),
      };
    }
    console.error('[deduct-credits] error:', deductErr);
    return { statusCode: 500, body: JSON.stringify({ error: deductErr.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, deducted: cost, new_balance: newBalance }),
  };
};