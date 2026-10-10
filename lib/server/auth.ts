import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or insufficiently strong in environment variables");
  }
  return new TextEncoder().encode(secret);
};

export async function signToken(userId: string | ObjectId): Promise<string> {
  const secret = getJwtSecret();
  const alg = "HS256";
  const expiresIn = process.env.JWT_EXPIRES_IN || "1d";

  return new SignJWT({})
    .setProtectedHeader({ alg })
    .setSubject(userId.toString())
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieName = process.env.AUTH_COOKIE_NAME || "earthlens_token";
  const isSecure = process.env.AUTH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  
  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: (process.env.AUTH_COOKIE_SAME_SITE as "lax" | "strict" | "none") || "lax",
    path: process.env.AUTH_COOKIE_PATH || "/",
    maxAge: 60 * 60 * 24, // 1 day
  });
}

export async function removeAuthCookie() {
  const cookieName = process.env.AUTH_COOKIE_NAME || "earthlens_token";
  const isSecure = process.env.AUTH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  
  const cookieStore = await cookies();
  cookieStore.set(cookieName, "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: (process.env.AUTH_COOKIE_SAME_SITE as "lax" | "strict" | "none") || "lax",
    path: process.env.AUTH_COOKIE_PATH || "/",
    maxAge: 0,
  });
}

export async function getAuthenticatedUserId(): Promise<ObjectId | null> {
  const cookieName = process.env.AUTH_COOKIE_NAME || "earthlens_token";
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  
  if (!token) return null;
  
  const userIdStr = await verifyToken(token);
  if (!userIdStr) return null;
  
  try {
    return new ObjectId(userIdStr);
  } catch {
    return null;
  }
}

/**
 * Validates the Origin or Referer header against the allowed base URL to prevent CSRF.
 * Required for state-changing endpoints (POST, PUT, DELETE) that rely on cookie authentication.
 */
export function verifyCsrfOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") || request.headers.get("referer");
  if (!origin) {
    // If no origin/referer is present, block it to be safe
    return false;
  }
  
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  try {
    const originUrl = new URL(origin);
    const expectedUrl = new URL(baseUrl);
    return originUrl.origin === expectedUrl.origin;
  } catch {
    return false;
  }
}

