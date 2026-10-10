import { NextResponse } from "next/server";
import { getAuthenticatedUserId, verifyCsrfOrigin } from "@/lib/server/auth";
import { analyzeImageWithAI } from "@/lib/server/ai";
import { searchINaturalist } from "@/lib/server/inaturalist";
import { uploadImageBuffer, cleanupLocalFile } from "@/lib/server/storage";

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

  let savedImage: { key: string; url: string } | null = null;

  try {
    // 3. Parse FormData
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
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

    const buffer = Buffer.from(await image.arrayBuffer());
    
    // Save image locally (or configured provider)
    try {
      savedImage = await uploadImageBuffer(buffer, image.type, "discoveries");
    } catch (uploadError) {
      return NextResponse.json({
        success: false,
        error: { code: "BAD_REQUEST", message: (uploadError as Error).message }
      }, { status: 400 });
    }

    // 5. Call AI Provider
    let analysis;
    try {
      analysis = await analyzeImageWithAI(buffer, image.type, description || undefined);
    } catch (aiError) {
      // Clean up orphaned file if AI analysis fails
      if (savedImage?.url) {
        await cleanupLocalFile(savedImage.url);
      }
      throw aiError;
    }

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

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        references,
        image: savedImage
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

    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to analyze image." } }, { status: 500 });
  }
}
