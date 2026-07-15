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
 *
 * pro_pack (R99, messaging unlocked via a 600-credit purchase threshold)
 * has been removed. Messaging is now unlocked exclusively via the R150
 * direct payment below.
 *
 * chat_unlock is NOT a credit pack — it's a standalone R150 payment that
 * unlocks messaging and grants 0 credits. It's here only so
 * payfast-initiate.js can look up its price/label the same way it does
 * for real packages. payfast-webhook.js special-cases this id: instead of
 * adding credits, it writes a credit_ledger row with
 * type='messaging_unlock' (0 amount), which is what ChatRoom.tsx checks
 * to grant messaging access. It's deliberately left out of the general
 * credit-packages UI (CreditBalance.tsx) since general users don't use
 * in-app chat — it's only ever initiated from ChatRoom.tsx's upsell modal.
 */

export const PACKAGES = {
  single:      { credits: 150,  price_zar: 39,  label: 'Starter Pack' },
  standard:    { credits: 300,  price_zar: 59,  label: 'Standard Credit Pack' },
  business:    { credits: 2000, price_zar: 199, label: 'Business Credit Pack' },
  chat_unlock: { credits: 0,    price_zar: 150, label: 'Messaging Unlock' },
};
