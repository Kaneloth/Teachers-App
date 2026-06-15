/**
 * subscriptions — Pro plan definitions for PayFast recurring billing
 * Place at: netlify/functions/lib/subscriptions.js
 *
 * Used by both payfast-initiate-subscription.js (to build the recurring
 * payment form) and payfast-webhook.js (to apply the correct subscription
 * length when an ITN for a subscription payment arrives).
 *
 * PayFast frequency codes: 1=Daily 2=Weekly 3=Monthly 4=Quarterly
 *                           5=Biannually(6mo) 6=Annual
 */

export const SUB_PLANS = {
  monthly:     { amount: 59,  frequency: 3, cycleMonths: 1,  label: 'Crosssa Pro — Monthly' },
  semi_annual: { amount: 234, frequency: 5, cycleMonths: 6,  label: 'Crosssa Pro — Semi-Annual' },
  annual:      { amount: 348, frequency: 6, cycleMonths: 12, label: 'Crosssa Pro — Annual' },
};
