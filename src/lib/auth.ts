import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, isAdminRole, type SessionPayload } from "./session";

/** Read the current admin session from the request cookies (server-side). */
export async function getAdminSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload || !isAdminRole(payload.role)) return null;
  return payload;
}

/** Throw if the caller is not an authenticated admin. Use in server actions. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized: admin access required");
  return session;
}
