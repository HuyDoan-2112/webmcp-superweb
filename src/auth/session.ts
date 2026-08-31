// Reads and writes the demo session cookie. Identity, not security.
//
// The cookie is the whole mechanism. `api/_lib/session.ts` reads
// `superweb_session`, matches it against its own user list, and decides how
// deep an answer to give. It never refuses a question, so a forged or missing
// cookie costs detail, not access. That is why this is plain `document.cookie`
// with no signing: signing would imply a boundary that does not exist here.
//
// Not HttpOnly, deliberately. The server does not need protecting from this
// value, and the page has to be able to clear it on sign out.

const COOKIE = "superweb_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export function readSessionCookie(): string | null {
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(rest.join("=")) || null;
  }
  return null;
}

/** Write the cookie, or clear it when given null. */
export function writeSessionCookie(id: string | null): void {
  document.cookie =
    id === null
      ? `${COOKIE}=; path=/; max-age=0; SameSite=Lax`
      : `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}
