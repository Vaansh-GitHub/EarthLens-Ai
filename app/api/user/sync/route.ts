import { NextResponse } from "next/server";
import { getAuthenticatedUserId, verifyCsrfOrigin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/mongodb";
import { z } from "zod";

const SyncSchema = z.object({
  discoveriesCount: z.number().int().nonnegative().optional(),
  increment: z.boolean().optional(),
  decrement: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Invalid Origin or Referer" } },
      { status: 403 }
    );
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = SyncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Invalid payload format" } },
        { status: 400 }
      );
    }

    const db = await getDb();
    const { discoveriesCount, increment, decrement } = parsed.data;

    if (typeof discoveriesCount === "number") {
      await db.collection("users").updateOne(
        { _id: userId },
        { 
          $set: { 
            discoveriesCount, 
            updatedAt: new Date() 
          } 
        }
      );
      return NextResponse.json({ success: true, data: { discoveriesCount } });
    }

    if (increment) {
      await db.collection("users").updateOne(
        { _id: userId },
        { 
          $inc: { discoveriesCount: 1 }, 
          $set: { updatedAt: new Date() } 
        }
      );
      const user = await db.collection("users").findOne({ _id: userId });
      return NextResponse.json({ 
        success: true, 
        data: { discoveriesCount: user?.discoveriesCount ?? 1 } 
      });
    }

    if (decrement) {
      const user = await db.collection("users").findOne({ _id: userId });
      const current = user?.discoveriesCount ?? 1;
      const nextCount = Math.max(0, current - 1);
      await db.collection("users").updateOne(
        { _id: userId },
        { 
          $set: { 
            discoveriesCount: nextCount, 
            updatedAt: new Date() 
          } 
        }
      );
      return NextResponse.json({ success: true, data: { discoveriesCount: nextCount } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("User stats sync error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to sync user stats" } },
      { status: 500 }
    );
  }
}
