import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/types";
import { getDb } from "@/lib/server/mongodb";
import { signToken, setAuthCookie, verifyCsrfOrigin } from "@/lib/server/auth";
import bcrypt from "bcryptjs";

// Rate limiting (simple in-memory for MVP)
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export async function POST(request: Request) {
  try {
    if (!verifyCsrfOrigin(request)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Invalid Origin or Referer" } },
        { status: 403 }
      );
    }
    
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000");
    const limit = parseInt(process.env.AUTH_RATE_LIMIT_MAX || "5");
    
    let rateLimit = rateLimitMap.get(ip);
    if (!rateLimit || rateLimit.expiresAt < now) {
      rateLimit = { count: 0, expiresAt: now + windowMs };
    }
    
    if (rateLimit.count >= limit) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
        { status: 429 }
      );
    }
    
    rateLimit.count += 1;
    rateLimitMap.set(ip, rateLimit);

    const body = await request.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: result.error.issues[0].message } },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    const db = await getDb();
    const user = await db.collection("users").findOne({ email });

    // Use generic error for both missing user and bad password
    const invalidCredentialsError = { 
      success: false, 
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } 
    };

    if (!user) {
      return NextResponse.json(invalidCredentialsError, { status: 401 });
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return NextResponse.json(invalidCredentialsError, { status: 401 });
    }

    const token = await signToken(user._id);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email }
    }, { status: 200 });
    
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
