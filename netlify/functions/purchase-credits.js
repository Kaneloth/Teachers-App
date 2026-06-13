const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PACKAGES = {
  single:   { credits: 6,   price_zar: 19,  label: 'Single CV Pack' },
  standard: { credits: 30,  price_zar: 49,  label: 'Standard Credit Pack' },
  pro_pack: { credits: 60,  price_zar: 79,  label: 'Pro Credit Pack' },
  business: { credits: 200, price_zar: 199, label: 'Business Credit Pack' },
};

exports.handler = async (event) => {
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

  const { package_id, payment_ref } = body;
  const pkg = PACKAGES[package_id];

  if (!pkg) return { statusCode: 400, body: JSON.stringify({ error: `Unknown package "${package_id}"` }) };
  if (!payment_ref) return { statusCode: 400, body: JSON.stringify({ error: 'payment_ref required' }) };

  // Idempotency — prevent double-crediting the same payment
  const { data: existing } = await supabase
    .from('credit_ledger')
    .select('id')
    .eq('ref_id', payment_ref)
    .eq('type', 'purchase')
    .maybeSingle();

  if (existing) {
    return { statusCode: 200, body: JSON.stringify({ success: true, credits: pkg.credits, reason: 'already_processed' }) };
  }

  // TODO: replace with your Paystack / Yoco / PayFast verification
  // You already have paystack-sdk-node installed — example:
  //
  // const Paystack = require('paystack-sdk-node');
  // const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);
  // const verification = await paystack.transaction.verify(payment_ref);
  // if (verification.data.status !== 'success') {
  //   return { statusCode: 402, body: JSON.stringify({ error: 'payment_not_verified' }) };
  // }
  // if (verification.data.amount !== pkg.price_zar * 100) {
  //   return { statusCode: 402, body: JSON.stringify({ error: 'amount_mismatch' }) };
  // }

  const { data: newBalance, error: creditErr } = await supabase.rpc('add_credits', {
    p_user_id:     user.id,
    p_amount:      pkg.credits,
    p_type:        'purchase',
    p_description: `${pkg.label} — R${pkg.price_zar}`,
    p_ref_id:      payment_ref,
  });

  if (creditErr) {
    console.error('purchase-credits: add_credits failed:', creditErr);
    return { statusCode: 500, body: JSON.stringify({ error: creditErr.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, credits: pkg.credits, new_balance: newBalance, package: pkg.label }),
  };
};
