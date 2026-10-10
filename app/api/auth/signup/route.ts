import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/types";
import { getDb, initializeDatabase } from "@/lib/server/mongodb";
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
    const result = signupSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: result.error.issues[0].message } },
        { status: 400 }
      );
    }

    const { name, email, password } = result.data;

    await initializeDatabase();
    const db = await getDb();
    
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const passwordHash = await bcrypt.hash(password, rounds);
    
    const nowTime = new Date();
    
    try {
      const insertResult = await db.collection("users").insertOne({
        name,
        email,
        passwordHash,
        createdAt: nowTime,
        updatedAt: nowTime,
      });

      const token = await signToken(insertResult.insertedId);
      await setAuthCookie(token);

      return NextResponse.json({
        success: true,
        user: { id: insertResult.insertedId, name, email }
      }, { status: 201 });
      
    } catch (error: unknown) {
      // Handle MongoDB Duplicate Key Error for unique email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 11000) {
        return NextResponse.json(
          { success: false, error: { code: "DUPLICATE_EMAIL", message: "Email is already registered" } },
          { status: 409 }
        );
      }
      throw error;
    }
    
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
