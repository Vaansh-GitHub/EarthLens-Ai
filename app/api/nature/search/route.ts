import { NextResponse } from "next/server";
import { searchINaturalist } from "@/lib/server/inaturalist";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Query parameter 'q' is required" } }, { status: 400 });
    }

    const results = await searchINaturalist(query);
    
    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error("Nature Search Error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to search nature database" } }, { status: 500 });
  }
}
