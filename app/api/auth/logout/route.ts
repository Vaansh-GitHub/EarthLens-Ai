import { NextResponse } from "next/server";
import { removeAuthCookie, verifyCsrfOrigin } from "@/lib/server/auth";

export async function POST(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Invalid Origin or Referer" } },
      { status: 403 }
    );
  }

  await removeAuthCookie();
  return NextResponse.json({ success: true });
}
