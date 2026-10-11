import { NextResponse } from "next/server";
import { getAuthenticatedUserId, verifyCsrfOrigin } from "@/lib/server/auth";
import { analyzeImageWithAI } from "@/lib/server/ai";
import { searchINaturalist } from "@/lib/server/inaturalist";
import { getDb } from "@/lib/server/mongodb";
import { getDailyQuest, evaluateQuestMatch } from "@/lib/server/quests";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_MB = parseInt(process.env.AI_MAX_IMAGE_SIZE_MB || "8", 10);
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export async function POST(request: Request) {
  // 1. Verify CSRF for mutating endpoints
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Invalid Origin or Referer" } }, { status: 403 });
  }

  // 2. Authenticate
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    // 3. Parse FormData
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const notes = formData.get("notes") as string | null;
    const description = formData.get("description") as string | null;
    
    if (!image) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "No image provided" } }, { status: 400 });
    }

    if (image.size === 0) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Image file is empty" } }, { status: 400 });
    }

    // 4. Validate Image
    if (!ALLOWED_MIME_TYPES.includes(image.type)) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Unsupported image format. Use JPEG, PNG, or WebP." } }, { status: 400 });
    }
    
    if (image.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: { code: "PAYLOAD_TOO_LARGE", message: `Image exceeds the ${MAX_IMAGE_SIZE_MB}MB limit.` } }, { status: 413 });
    }

    // Extract genuine user text: notes first, or description if not synthetic boilerplate
    let userText: string | undefined = undefined;
    if (notes && notes.trim()) {
      userText = notes.trim();
    } else if (description && description.trim()) {
      const trimmed = description.trim();
      if (trimmed.includes("Notes: ")) {
        const extracted = trimmed.split("Notes: ")[1]?.trim();
        if (extracted) userText = extracted;
      } else if (!trimmed.startsWith("Category:")) {
        userText = trimmed;
      }
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    
    // 5. Call AI Provider with in-memory buffer (No server filesystem storage)
    const analysis = await analyzeImageWithAI(buffer, image.type, userText);

    // 6. Search iNaturalist for references if we have a candidate name
    let references: unknown[] = [];
    if (analysis.candidateScientificName || analysis.candidateCommonName) {
      const query = analysis.candidateScientificName || analysis.candidateCommonName || "";
      try {
        references = await searchINaturalist(query);
      } catch (externalTaxonError) {
        console.warn("External taxonomic search unavailable:", externalTaxonError);
        references = [];
      }
    }

    // 7. Evaluate and Synchronize Today's Nature Quest Match
    const category = (formData.get("category") as string) || "plant";
    const todayQuest = await getDailyQuest();
    const questMatch = await evaluateQuestMatch(todayQuest, analysis, { category, description: userText || "" });

    // Synchronize into complete contract
    analysis.questMatch = {
      score: questMatch.score,
      status: questMatch.questMatchStatus,
      matchedRequirements: questMatch.matchedRequirements,
      missingRequirements: questMatch.missingRequirements,
      explanation: questMatch.matchExplanation,
      retrySuggestion: questMatch.retrySuggestion,
    };

    // 8. Calculate XP: 50 base XP + quest bonus if matched (70-100%)
    let xpAwarded = 50;
    if (questMatch.matched) {
      xpAwarded += questMatch.bonusXp;
    }

    // 9. Update user XP on cloud account without persisting local discoveries to server
    if (userId) {
      try {
        const db = await getDb();
        await db.collection("users").updateOne(
          { _id: userId },
          { $inc: { xp: xpAwarded, discoveriesCount: 1 }, $set: { updatedAt: new Date() } }
        );
      } catch (dbErr) {
        console.warn("Failed to increment user XP:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        references,
        questMatch,
        xpAwarded,
      }
    });

  } catch (error) {
    console.error("API Analyze Error:", error);
    const message = (error as Error).message;
    
    if (message.includes("rate limit")) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message } }, { status: 429 });
    }
    
    if (message.includes("timed out")) {
      return NextResponse.json({ success: false, error: { code: "GATEWAY_TIMEOUT", message } }, { status: 504 });
    }

    if (message.includes("AI provider error") || message.includes("malformed output")) {
      return NextResponse.json({ success: false, error: { code: "BAD_GATEWAY", message } }, { status: 502 });
    }

    if (message.includes("Missing required Cloudflare")) {
      return NextResponse.json({ success: false, error: { code: "NOT_IMPLEMENTED", message: "AI provider is not configured properly." } }, { status: 501 });
    }

    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: message || "Failed to analyze image." } }, { status: 500 });
  }
}
