// Who is asking, and how deep an answer they should get.
//
// This is identity, not security. There are no passwords and nothing here
// refuses anyone. It decides the depth of an answer, never whether a question
// may be asked.

import type { Audience, Session, User } from "../../shared/types.js";

/** The seeded people at Kestrel Supply Co. */
export const USERS: User[] = [
  { id: "maya", name: "Maya Okonkwo", role: "Operations", audience: "ops" },
  { id: "priya", name: "Priya Raman", role: "Owner", audience: "analyst" },
  { id: "tom", name: "Tom Alvarez", role: "Data Platform", audience: "engineer" },
];

const COOKIE = "superweb_session";

/** The anonymous visitor. Not an error state, and never refused. */
export const ANONYMOUS: Session = { user: null, audience: "public" };

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function getSession(request: Request): Session {
  const id = readCookie(request.headers.get("cookie"), COOKIE);
  if (!id) return ANONYMOUS;
  const user = USERS.find((u) => u.id === id);
  return user ? { user, audience: user.audience } : ANONYMOUS;
}

/** True when this audience should see table names and row counts. */
export function wantsTechnicalDetail(audience: Audience): boolean {
  return audience === "analyst" || audience === "engineer";
}
