import { SignJWT, jwtVerify } from "jose";

// Short-lived token issued after a successful OTP, proving phone ownership so a
// user can edit/unsubscribe without an account (and without re-entering OTP per
// action). Signed with AUTH_SECRET, like the admin session.

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signManageToken(phone: string): Promise<string> {
  return new SignJWT({ phone, purpose: "manage" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey());
}

/** Returns the phone if the token is a valid, unexpired manage token, else null. */
export async function verifyManageToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== "manage" || typeof payload.phone !== "string") return null;
    return payload.phone;
  } catch {
    return null;
  }
}
