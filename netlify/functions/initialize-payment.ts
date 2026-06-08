import { PaystackClient } from 'paystack-sdk-node';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, amount, userId, plan } = JSON.parse(event.body);
  const client = new PaystackClient({ apiKey: process.env.PAYSTACK_SECRET_KEY });

  try {
    const response = await client.transactions.initialize({
      email,
      amount,           // in cents (e.g., 5900 for R59)
      currency: 'ZAR',
      metadata: {
        user_id: userId,
        plan: plan,
        referrer: 'crosssa'   // 👈 Added for Hookdeck filtering
      },
    });
    return {
      statusCode: 200,
      body: JSON.stringify({
        authorization_url: response.data.authorization_url,
        reference: response.data.reference,
      }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};