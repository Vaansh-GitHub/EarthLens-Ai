import { NextResponse } from "next/server";
import { getAuthenticatedUserId, verifyCsrfOrigin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { deleteLocalImageIfNotReferenced } from "@/lib/server/storage";

const PatchSchema = z.object({
  memoryCard: z.object({
    title: z.string().optional(),
    quote: z.string().optional(),
    template: z.string().optional(),
    showPhoto: z.boolean().optional(),
    pngUrl: z.string().optional(),
    pngKey: z.string().optional(),
  }).optional(),
  observation: z.object({
    description: z.string().optional(),
    photoUrl: z.string().optional(),
    photoKey: z.string().optional(),
  }).optional()
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid ID" } }, { status: 400 });
    }

    const db = await getDb();
    const discovery = await db.collection("discoveries").findOne({ _id: new ObjectId(id), userId });

    if (!discovery) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Discovery not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: discovery });
  } catch (error) {
    console.error("Journal GET ID Error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch discovery" } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Invalid Origin or Referer" } }, { status: 403 });
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid ID" } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid payload format" } }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    // Flatten updates for MongoDB dot notation to avoid overwriting entire nested objects
    if (parsed.data.memoryCard) {
      for (const [k, v] of Object.entries(parsed.data.memoryCard)) {
        if (v !== undefined) updateData[`memoryCard.${k}`] = v;
      }
    }
    if (parsed.data.observation) {
      for (const [k, v] of Object.entries(parsed.data.observation)) {
        if (v !== undefined) updateData[`observation.${k}`] = v;
      }
    }

    const db = await getDb();
    const result = await db.collection("discoveries").updateOne(
      { _id: new ObjectId(id), userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Discovery not found or unauthorized" } }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Journal PATCH Error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update discovery" } }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Invalid Origin or Referer" } }, { status: 403 });
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid ID" } }, { status: 400 });
    }

    const db = await getDb();
    
    interface DiscoveryDocument {
      _id: ObjectId;
      userId: ObjectId;
      observation?: { photoUrl?: string; photoKey?: string };
      memoryCard?: { pngUrl?: string; pngKey?: string };
    }

    // Attempt to fetch the document first to identify image paths for cleanup
    let discovery: DiscoveryDocument | null = null;
    try {
      discovery = (await db.collection("discoveries").findOne({ _id: new ObjectId(id), userId })) as DiscoveryDocument | null;
    } catch {
      // Ignore if findOne is not mocked or fails
    }

    // Delete record from database
    const result = await db.collection("discoveries").deleteOne({ _id: new ObjectId(id), userId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Discovery not found or unauthorized" } }, { status: 404 });
    }

    // Clean up local images only if no other discovery references them
    if (discovery) {
      if (discovery.observation?.photoUrl) {
        await deleteLocalImageIfNotReferenced(discovery.observation.photoUrl, db, discovery._id);
      }
      if (discovery.observation?.photoKey && discovery.observation.photoKey !== discovery.observation.photoUrl) {
        await deleteLocalImageIfNotReferenced(discovery.observation.photoKey, db, discovery._id);
      }
      if (discovery.memoryCard?.pngUrl) {
        await deleteLocalImageIfNotReferenced(discovery.memoryCard.pngUrl, db, discovery._id);
      }
      if (discovery.memoryCard?.pngKey && discovery.memoryCard.pngKey !== discovery.memoryCard.pngUrl) {
        await deleteLocalImageIfNotReferenced(discovery.memoryCard.pngKey, db, discovery._id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Journal DELETE Error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete discovery" } }, { status: 500 });
  }
}
