import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const isDbConnected = await db.command({ ping: 1 });
    
    return NextResponse.json({
      status: "healthy",
      version: "0.1.0",
      database: isDbConnected.ok === 1 ? "connected" : "degraded"
    });
  } catch {
    return NextResponse.json({
      status: "unhealthy",
      version: "0.1.0",
      database: "disconnected"
    }, { status: 503 });
  }
}
