import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "kemenag_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface AppSession extends JWTPayload {
  sid: string;
  role: "staff";
}

function sessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET wajib minimal 32 karakter.");
  }
  return new TextEncoder().encode(secret);
}

export function sessionConfigured(): boolean {
  return Boolean(process.env.SESSION_SECRET?.trim() && process.env.SESSION_SECRET.trim().length >= 32);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "staff", sid: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .setIssuer("kemenag-depok-press-release")
    .setAudience("kemenag-depok-staff")
    .sign(sessionSecret());
}

export async function verifySessionToken(token: string): Promise<AppSession | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      issuer: "kemenag-depok-press-release",
      audience: "kemenag-depok-staff",
    });
    if (payload.role !== "staff" || typeof payload.sid !== "string") return null;
    return payload as AppSession;
  } catch {
    return null;
  }
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function getRequestSession(request: Request): Promise<AppSession | null> {
  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  return token ? verifySessionToken(token) : null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
