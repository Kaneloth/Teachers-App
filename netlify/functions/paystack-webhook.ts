import { PaystackClient } from 'paystack-sdk-node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const payload = JSON.parse(event.body);

  if (payload.event !== 'charge.success') {
    return { statusCode: 200, body: 'OK' };
  }

  const transactionReference = payload.data.reference;
  const userId = payload.data.metadata.user_id;
  const plan = payload.data.metadata.plan;

  // Verify transaction with Paystack
  const client = new PaystackClient({ apiKey: process.env.PAYSTACK_SECRET_KEY });
  const verification = await client.transactions.verify(transactionReference);

  if (verification.data.status !== 'success') {
    return { statusCode: 400, body: 'Invalid transaction' };
  }

  // Calculate subscription expiry
  const expiresAt = new Date();
  if (plan === 'pro_monthly') expiresAt.setMonth(expiresAt.getMonth() + 1);
  if (plan === 'pro_annual') expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  // Update user’s subscription in Supabase (adjust table/column names)
  await supabase
    .from('educators')
    .update({ subscription_plan: plan, subscription_end: expiresAt.toISOString() })
    .eq('user_id', userId);

  return { statusCode: 200, body: 'OK' };
};