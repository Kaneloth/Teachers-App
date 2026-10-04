import FingerprintJS from '@fingerprintjs/fingerprintjs';

// Cached across calls within a page load — generating the agent has a
// small one-time cost (canvas/WebGL/font probing), no reason to redo it if
// called more than once in the same session (e.g. a retry after a failed
// network request).
let cachedPromise: Promise<string> | null = null;

/**
 * Produces a device fingerprint used ONLY for the signup-bonus anti-abuse
 * check (grant-signup-credits.js → device_fingerprints table) — never used
 * to identify or track a user for any other purpose.
 *
 * Replaces the old `navigator.userAgent + screen.width + screen.height`
 * scheme (previously inlined in Onboarding.tsx's grantSignupCredits),
 * which looked like real entropy but wasn't: it changes whenever the SAME
 * physical device opens the site through a different browser context —
 * e.g. regular Chrome one day, a link opened inside the Facebook app's
 * in-app browser (FB_IAB) the next — because the User-Agent string itself
 * differs between those contexts even though it's the same phone. That let
 * someone re-trigger the signup bonus just by switching how they opened
 * the link, with no deliberate evasion required. (Confirmed against two
 * real accounts that shared an IP: different User-Agent strings — one
 * plain Chrome on Android 10, one Facebook in-app browser on Android 15 —
 * made it impossible to tell from device_fingerprints alone whether they
 * were the same person on the same phone or two different people.)
 *
 * FingerprintJS's open-source "visitorId" instead combines canvas, WebGL,
 * audio, installed fonts, hardware concurrency and other OS/GPU-level
 * signals that mostly come from the underlying rendering engine rather
 * than the wrapping app — on Android, both Chrome and most in-app browsers
 * (Facebook's included) render through the same system WebView/engine, so
 * this tends to stay stable across exactly that scenario, which the old
 * UA-based approach did not.
 *
 * Not foolproof — no client-side fingerprint is, against someone
 * deliberately using a different real browser, incognito mode, or a VPN —
 * but it closes the accidental, no-effort gap, and is used here only as
 * one of three independent layers in grant-signup-credits.js (alongside
 * phone fingerprint and IP rate limiting), not as the sole anti-fraud
 * check.
 *
 * Falls back to the old UA+screen scheme if the library fails to load for
 * any reason (ad blocker, offline, etc.) — a signup should never be
 * blocked by this; worst case it's just a weaker signal for that one user.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        return result.visitorId;
      } catch (err) {
        console.warn('[deviceFingerprint] FingerprintJS failed, falling back to UA-based fingerprint:', err);
        return navigator.userAgent + screen.width + screen.height;
      }
    })();
  }
  return cachedPromise;
}
