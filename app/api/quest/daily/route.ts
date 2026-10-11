import { NextResponse } from "next/server";
import { getDailyQuest } from "@/lib/server/quests";

export async function GET() {
  try {
    const quest = await getDailyQuest();
    return NextResponse.json({
      success: true,
      data: quest,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: { message: (error as Error).message || "Failed to retrieve daily quest" },
      },
      { status: 500 }
    );
  }
}
