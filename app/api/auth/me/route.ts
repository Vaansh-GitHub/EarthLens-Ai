import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/mongodb";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in." } },
        { status: 401 }
      );
    }
    
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: userId });
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "User not found." } },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email }
    });
    
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
