// netlify/functions/initialize-payment.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, amount, userId, plan } = JSON.parse(event.body);
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'PAYSTACK_SECRET_KEY missing' }) };
  }

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount,
        currency: 'ZAR',
        metadata: { user_id: userId, plan, referrer: 'crosssa' },
      }),
    });

    const data = await response.json();
    if (!data.status) {
      throw new Error(data.message || 'Paystack initialization failed');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
      }),
    };
  } catch (error) {
    console.error('Paystack error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};