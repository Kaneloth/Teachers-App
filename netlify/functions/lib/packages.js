/**
 * packages — single source of truth for credit pack pricing
 * Place at: netlify/functions/lib/packages.js
 *
 * Used by both payfast-initiate.js (to build the payment form) and
 * payfast-webhook.js (to grant the correct number of credits).
 */

export const PACKAGES = {
  single:   { credits: 6,   price_zar: 19,  label: 'Single CV Pack' },
  standard: { credits: 30,  price_zar: 49,  label: 'Standard Credit Pack' },
  pro_pack: { credits: 60,  price_zar: 79,  label: 'Pro Credit Pack' },
  business: { credits: 200, price_zar: 199, label: 'Business Credit Pack' },
};
