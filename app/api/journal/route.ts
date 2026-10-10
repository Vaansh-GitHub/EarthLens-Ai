import { NextResponse } from "next/server";
import { getAuthenticatedUserId, verifyCsrfOrigin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/mongodb";
import { z } from "zod";

const JournalEntrySchema = z.object({
  observation: z.object({
    description: z.string().optional(),
    category: z.string().optional(),
    photoUrl: z.string().optional(),
    photoKey: z.string().optional(),
  }),
  analysis: z.record(z.string(), z.any()).optional(), // We accept the validated AI analysis payload
  references: z.array(z.any()).optional(),
  memoryCard: z.object({
    title: z.string().optional(),
    quote: z.string().optional(),
    template: z.string().optional(),
    showPhoto: z.boolean().optional(),
    pngKey: z.string().optional(),
    pngUrl: z.string().optional(),
  }).optional(),
});

export async function POST(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Invalid Origin or Referer" } }, { status: 403 });
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = JournalEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid payload format" } }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("discoveries").insertOne({
      userId,
      ...parsed.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Increment user's experience points for completing a discovery
    await db.collection("users").updateOne(
      { _id: userId },
      { $inc: { xp: 50 }, $set: { updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, data: { _id: result.insertedId, id: result.insertedId.toString() } }, { status: 201 });
  } catch (error) {
    console.error("Journal POST Error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to save journal entry" } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const category = searchParams.get("category");

    const query: Record<string, unknown> = { userId };
    if (category) {
      query["observation.category"] = category;
    }

    const db = await getDb();
    const discoveries = await db.collection("discoveries")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({ success: true, data: discoveries });
  } catch (error) {
    console.error("Journal GET Error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch journal entries" } }, { status: 500 });
  }
}
