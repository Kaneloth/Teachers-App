/**
 * packages — single source of truth for credit pack pricing
 * Place at: netlify/functions/lib/packages.js
 *
 * Used by both payfast-initiate.js (to build the payment form) and
 * payfast-webhook.js (to grant the correct number of credits).
 *
 * NOTE: credit amounts are x10 of the "real" unit (cosmetic overhaul to
 * match Skootlink's larger, more prominent credit numbers) — price_zar is
 * unchanged. Per-action costs elsewhere (CV/letter/chat/etc.) must also be
 * x10'd to keep purchasing power identical — see wherever those are
 * actually deducted server-side.
 */

export const PACKAGES = {
  single:   { credits: 150,  price_zar: 39,  label: 'Starter Pack' },
  standard: { credits: 300,  price_zar: 59,  label: 'Standard Credit Pack' },
  pro_pack: { credits: 600,  price_zar: 99,  label: 'Pro Credit Pack' },
  business: { credits: 2000, price_zar: 199, label: 'Business Credit Pack' },
};
