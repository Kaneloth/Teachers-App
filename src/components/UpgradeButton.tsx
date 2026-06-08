// src/lib/payment.ts
import { supabase } from '@/lib/supabase';

export const handleUpgrade = async (plan: 'monthly' | 'semi_annual' | 'annual') => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = '/login';
    return;
  }

  let amount = 0;
  let planName = '';

  switch (plan) {
    case 'monthly':
      amount = 5900;          // R59
      planName = 'pro_monthly';
      break;
    case 'semi_annual':
      amount = 23400;         // R234
      planName = 'pro_semi_annual';
      break;
    case 'annual':
      amount = 34800;         // R348
      planName = 'pro_annual';
      break;
  }

  const response = await fetch('/.netlify/functions/initialize-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      amount,
      userId: user.id,
      plan: planName,
    }),
  });

  const data = await response.json();
  if (data.authorization_url) {
    window.location.href = data.authorization_url;
  } else {
    console.error('Payment init failed', data);
  }
};