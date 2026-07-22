// Schedule is declared in netlify.toml:
//   [functions."monthly-pro-credits"]
//   schedule = "0 2 1 * *"
//
// Monthly Pro credit grants have been removed under the credits-only
// funding model. This function is a no-op — kept deployed only so the
// netlify.toml schedule entry above doesn't point at a missing function
// (Netlify errors on a scheduled function that doesn't exist).
//
// The original grant logic (fetch active Pro subscribers, add_credits per
// user, idempotent via a credit_ledger ref_id) used to sit below this
// comment as unreachable "kept for reference" code. It's been removed
// entirely instead of kept dead: a stray unclosed brace in that block —
// an inner `const __handler = async (event) => { ... }` whose closing
// `};` was mistaken for the outer handler's — broke the whole build with
// "Unexpected end of file". If you ever need the monthly-grant behavior
// back, it's preserved in git history / earlier deploys.
export const handler = async () => {
  console.log('[monthly-pro-credits] Disabled — credits-only model, no monthly grants.');
  return { statusCode: 200, body: JSON.stringify({ granted: 0, reason: 'disabled' }) };
};
