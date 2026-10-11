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
 * Validates the Origin or Referer header against the allowed base URL or incoming request host to prevent CSRF.
 * Required for state-changing endpoints (POST, PUT, DELETE) that rely on cookie authentication.
 */
export function verifyCsrfOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") || request.headers.get("referer");
  if (!origin) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host.toLowerCase();

    // 1. Direct host & x-forwarded-host match (standard same-origin check for modern proxies & Vercel)
    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (hostHeader) {
      const cleanHost = hostHeader.split(",")[0].trim().toLowerCase();
      if (originHost === cleanHost) {
        return true;
      }
    }

    // 2. Request URL match
    const requestUrlHost = new URL(request.url).host.toLowerCase();
    if (originHost === requestUrlHost) {
      return true;
    }

    // 3. Configured APP_BASE_URL (if provided)
    if (process.env.APP_BASE_URL) {
      try {
        const baseUrlHost = new URL(process.env.APP_BASE_URL).host.toLowerCase();
        if (originHost === baseUrlHost) {
          return true;
        }
      } catch {
        // ignore invalid URL format
      }
    }

    // 4. Vercel deployment domains (automatic preview & production URLs)
    if (process.env.VERCEL_URL && originHost === process.env.VERCEL_URL.toLowerCase()) {
      return true;
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL && originHost === process.env.VERCEL_PROJECT_PRODUCTION_URL.toLowerCase()) {
      return true;
    }
    if (originHost.endsWith(".vercel.app")) {
      return true;
    }

    // 5. Localhost fallback for local development
    if (originHost.startsWith("localhost:") || originHost === "localhost" || originHost.startsWith("127.0.0.1")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

