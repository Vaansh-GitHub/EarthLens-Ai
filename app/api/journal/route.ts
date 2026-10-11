import { NextResponse } from "next/server";
import { getAuthenticatedUserId, verifyCsrfOrigin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/mongodb";
import { getDailyQuest, evaluateQuestMatch } from "@/lib/server/quests";
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

    // Check if /api/analyze already saved this discovery for this user
    let existingDiscovery = null;
    if (parsed.data.observation?.photoUrl) {
      existingDiscovery = await db.collection("discoveries").findOne({
        userId,
        "observation.photoUrl": parsed.data.observation.photoUrl,
      });
    }

    if (existingDiscovery) {
      if (parsed.data.memoryCard) {
        await db.collection("discoveries").updateOne(
          { _id: existingDiscovery._id },
          { $set: { memoryCard: parsed.data.memoryCard, updatedAt: new Date() } }
        );
      }
      return NextResponse.json({
        success: true,
        data: {
          _id: existingDiscovery._id,
          id: existingDiscovery._id.toString(),
          xpAwarded: 0,
          questMatch: existingDiscovery.questMatch,
        }
      }, { status: 200 });
    }

    // Evaluate if the discovery matches today's daily quest (70% - 100% threshold)
    const todayQuest = await getDailyQuest();
    const questMatch = await evaluateQuestMatch(todayQuest, parsed.data.analysis, parsed.data.observation);

    // Standard discovery gives 50 XP; matching the quest (70-100%) adds the quest reward (e.g. +50 XP)
    let xpAwarded = 50;
    if (questMatch.matched) {
      xpAwarded += questMatch.bonusXp;
    }

    const result = await db.collection("discoveries").insertOne({
      userId,
      ...parsed.data,
      questMatch: {
        questDate: todayQuest.date,
        questTitle: todayQuest.title,
        score: questMatch.score,
        matched: questMatch.matched,
        bonusXp: questMatch.bonusXp,
        reason: questMatch.reason,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Increment user's experience points
    await db.collection("users").updateOne(
      { _id: userId },
      { $inc: { xp: xpAwarded }, $set: { updatedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      data: {
        _id: result.insertedId,
        id: result.insertedId.toString(),
        xpAwarded,
        questMatch,
      }
    }, { status: 201 });
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
