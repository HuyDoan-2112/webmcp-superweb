// Signing in, signing out, and changing who is asking.
//
// One door for all three, because the cookie and the store have to move
// together. The cookie decides what the server answers; the store decides which
// tools are registered and what the page shows. If they drift, the agent gets a
// dashboard it cannot get depth for, or depth for a page it cannot see.
//
// This is not a tool and will not become one. Signing in is the human's move,
// and it is the move that swaps one tool surface for the other. An agent that
// could call it could grant itself the internal surface, which would make the
// swap a thing the page does to itself rather than a thing a person does.

import { setState, setSurface } from "@/store";
import { readSessionCookie, writeSessionCookie } from "./session";
import { DEMO_USERS, findUser } from "./users";

/**
 * Sign in as one of the seeded people.
 *
 * Defaults to the first, which is what the header's button does. The audience
 * recorded here is the client's expectation; every answer that depends on it
 * still comes from the server reading the cookie.
 */
export function signIn(userId: string = DEMO_USERS[0].id): void {
  const user = findUser(userId) ?? DEMO_USERS[0];
  writeSessionCookie(user.id);
  setState({ audience: user.audience });
  setSurface("internal");
}

/** Back to the catalogue, and back to anonymous. */
export function signOut(): void {
  writeSessionCookie(null);
  setState({ audience: null });
  setSurface("public");
}

/**
 * Restore the session on load.
 *
 * The cookie outlives the tab. Without this a reload would drop back to the
 * catalogue while the browser kept sending a session the page was not showing,
 * so the answers would carry a depth nothing on screen accounted for.
 */
export function restoreSession(): void {
  const user = findUser(readSessionCookie());
  if (!user) return;
  setState({ audience: user.audience });
  setSurface("internal");
}

/** Who the cookie currently says is asking. Null when anonymous. */
export function currentUser() {
  return findUser(readSessionCookie());
}
