// The seeded people at Kestrel Supply Co.
//
// api/_lib/session.ts holds the same three and is the authority. This copy
// exists only to populate the switcher, because the client has to offer a
// choice before a session exists to read. The ids must match; the audience here
// is what we expect the server to say, never what the client decides.
//
// Nothing verifies these. There are no passwords and this is not a login. The
// server reads a cookie and answers at a depth. See CONTEXT.md on "surface"
// versus "audience".

import type { User } from "@shared/types";

export const DEMO_USERS: User[] = [
  { id: "maya", name: "Maya Okonkwo", role: "Operations", audience: "ops" },
  { id: "priya", name: "Priya Raman", role: "Data Science", audience: "analyst" },
  { id: "tom", name: "Tom Alvarez", role: "Data Platform", audience: "engineer" },
];

export function findUser(id: string | null): User | null {
  if (!id) return null;
  return DEMO_USERS.find((u) => u.id === id) ?? null;
}
