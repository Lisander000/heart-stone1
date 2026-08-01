// Canonical URL of the live app, used for auth email links (invite / magic link).
// Order of preference:
//   1) VITE_SITE_URL — the fixed production URL. Set this so invite links always land
//      on the live app, even when the invite is triggered from a local dev server.
//   2) window.location.origin — automatic fallback: correct for local dev, and for a
//      deployed app that is used in place.
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() || window.location.origin
).replace(/\/+$/, "");

/** Where auth email links (invite / magic link) return the user to. */
export const authRedirectUrl = () => `${SITE_URL}/auth`;
