import { cookies } from "next/headers";
import { customAlphabet } from "nanoid";

// Each judge gets a private demo space (a cookie), so demo campaigns, reuse detection,
// lists and the radar never collide between people testing the hosted app at once.

export const SPACE_COOKIE = "em_space";
const nano = customAlphabet("0123456789abcdefghijkmnopqrstuvwxyz", 12);
export const newSpace = () => `demo_${nano()}`;
export const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 14 };

/** The current visitor's demo space, if they have one. */
export async function demoSpace(): Promise<string | null> {
  const v = (await cookies()).get(SPACE_COOKIE)?.value;
  return v && /^demo_[a-z0-9]{12}$/.test(v) ? v : null;
}

/** Spaces this visitor should see: real campaigns plus their own demo space. */
export async function visibleSpaces(): Promise<string[]> {
  const d = await demoSpace();
  return d ? ["main", d] : ["main"];
}

/** Get the visitor's demo space, creating one (and setting the cookie) if needed. */
export async function ensureDemoSpace(): Promise<string> {
  const existing = await demoSpace();
  if (existing) return existing;
  const s = newSpace();
  (await cookies()).set(SPACE_COOKIE, s, cookieOpts);
  return s;
}
