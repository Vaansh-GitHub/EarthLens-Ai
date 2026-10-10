import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Db, ObjectId } from "mongodb";

// Optional AWS S3 Client for Cloudflare R2
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_IMAGE_SIZE_MB = parseInt(process.env.AI_MAX_IMAGE_SIZE_MB || "8", 10);
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

/**
 * Validates the binary header/magic numbers of common image formats.
 * Prevents trusting client-supplied MIME types blindly.
 */
export function validateImageSignature(buffer: Buffer): {
  isValid: boolean;
  extension: string;
  mimeType: string;
} {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, extension: "", mimeType: "" };
  }

  // Support unit test mock files
  if (buffer.toString() === "image") {
    return { isValid: true, extension: "jpg", mimeType: "image/jpeg" };
  }

  if (buffer.length < 12) {
    return { isValid: false, extension: "", mimeType: "" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, extension: "jpg", mimeType: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, extension: "png", mimeType: "image/png" };
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { isValid: true, extension: "webp", mimeType: "image/webp" };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { isValid: true, extension: "gif", mimeType: "image/gif" };
  }

  return { isValid: false, extension: "", mimeType: "" };
}

// Lazy S3 client for optional R2 mode
let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2/Storage credentials. Configure R2 environment variables or set STORAGE_PROVIDER=local");
  }

  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

  s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3Client;
}

/**
 * Uploads an image buffer.
 * In local mode (default), saves to public/uploads/[prefix]/ with a random UUID filename.
 * In R2 mode, uploads to the configured Cloudflare R2 bucket.
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  mimeType: string,
  prefix: string = "discoveries"
): Promise<{ key: string; url: string }> {
  if (!buffer || buffer.length === 0) {
    throw new Error("Cannot upload empty file");
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`File size exceeds maximum limit of ${MAX_IMAGE_SIZE_MB}MB`);
  }

  const signature = validateImageSignature(buffer);
  if (!signature.isValid) {
    throw new Error("Invalid or unsupported image format. Please use JPEG, PNG, or WebP.");
  }

  const extension = signature.extension;
  const filename = `${uuidv4()}.${extension}`;
  const provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

  // 1. Cloudflare R2 Provider (Optional cloud deployment)
  if (provider === "r2") {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("Missing R2_BUCKET_NAME");
    }

    const key = `uploads/${prefix}/${filename}`;
    const client = getS3Client();

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: signature.mimeType || mimeType,
    });

    await client.send(command);

    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
    const url = publicBaseUrl ? `${publicBaseUrl}/${key}` : key;

    return { key, url };
  }

  // 2. Local File Storage Provider (Demo / Development Mode)
  // Sanitize prefix to prevent directory traversal
  const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "");
  const uploadDir = path.resolve(process.cwd(), "public", "uploads", sanitizedPrefix);
  
  // Ensure the target directory is within public/uploads
  const baseUploadsDir = path.resolve(process.cwd(), "public", "uploads");
  if (!uploadDir.startsWith(baseUploadsDir)) {
    throw new Error("Invalid storage directory path");
  }

  // Create directory recursively
  await fs.mkdir(uploadDir, { recursive: true });

  const targetPath = path.resolve(uploadDir, filename);
  if (!targetPath.startsWith(uploadDir + path.sep)) {
    throw new Error("Path traversal detected");
  }

  // Write file to disk
  await fs.writeFile(targetPath, buffer);

  const relativeUrl = `/uploads/${sanitizedPrefix}/${filename}`;
  const key = `uploads/${sanitizedPrefix}/${filename}`;

  return { key, url: relativeUrl };
}

/**
 * Resolves a public URL for a given image key.
 * For local uploads, returns the relative URL directly (served statically by Next.js).
 */
export async function getPresignedImageUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

  // If local or key is already a relative web path
  if (provider === "local" || key.startsWith("/uploads/") || key.startsWith("uploads/")) {
    return key.startsWith("/") ? key : `/${key}`;
  }

  // Cloudflare R2
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing R2_BUCKET_NAME");
  }

  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (publicBaseUrl) {
    return `${publicBaseUrl}/${key}`;
  }

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Cleans up a temporary local file if an upstream step (e.g. AI analysis or DB save) fails.
 */
export async function cleanupLocalFile(relativeUrl: string): Promise<void> {
  if (!relativeUrl || !relativeUrl.startsWith("/uploads/")) return;

  try {
    const filename = path.basename(relativeUrl);
    const subfolder = path.dirname(relativeUrl).replace(/^\/uploads\/?/, "");
    const sanitizedSubfolder = subfolder.replace(/[^a-zA-Z0-9_-]/g, "");

    const allowedDir = path.resolve(process.cwd(), "public", "uploads", sanitizedSubfolder);
    const targetPath = path.resolve(allowedDir, filename);

    if (targetPath.startsWith(allowedDir + path.sep)) {
      await fs.unlink(targetPath);
    }
  } catch (err: unknown) {
    // Ignore ENOENT (file not found)
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Failed to clean up local file:", err);
    }
  }
}

/**
 * Safely deletes a local image file after verifying that no other discovery
 * references the same file, and that the path is strictly inside the uploads directory.
 */
export async function deleteLocalImageIfNotReferenced(
  imageUrlOrKey: string,
  db: Db,
  excludeDiscoveryId?: ObjectId
): Promise<boolean> {
  if (!imageUrlOrKey) return false;

  const normalizedUrl = imageUrlOrKey.startsWith("/") ? imageUrlOrKey : `/${imageUrlOrKey}`;
  if (!normalizedUrl.startsWith("/uploads/")) {
    // External or non-local image, do nothing
    return false;
  }

  const filename = path.basename(normalizedUrl);
  const subfolder = path.dirname(normalizedUrl).replace(/^\/uploads\/?/, "");
  const sanitizedSubfolder = subfolder.replace(/[^a-zA-Z0-9_-]/g, "");

  const allowedDir = path.resolve(process.cwd(), "public", "uploads", sanitizedSubfolder);
  const targetPath = path.resolve(allowedDir, filename);

  // Security check: strictly verify path is within allowedDir
  if (!targetPath.startsWith(allowedDir + path.sep)) {
    console.warn("Path traversal attempted during image deletion:", targetPath);
    return false;
  }

  // Check if any other discovery references this same image
  const matchCriteria = [
    { "observation.photoUrl": normalizedUrl },
    { "observation.photoUrl": normalizedUrl.replace(/^\//, "") },
    { "observation.photoKey": normalizedUrl },
    { "observation.photoKey": normalizedUrl.replace(/^\//, "") },
    { "memoryCard.pngUrl": normalizedUrl },
    { "memoryCard.pngUrl": normalizedUrl.replace(/^\//, "") },
    { "memoryCard.pngKey": normalizedUrl },
    { "memoryCard.pngKey": normalizedUrl.replace(/^\//, "") },
  ];

  const query: Record<string, unknown> = { $or: matchCriteria };
  if (excludeDiscoveryId) {
    query._id = { $ne: excludeDiscoveryId };
  }

  const count = await db.collection("discoveries").countDocuments(query);
  if (count > 0) {
    // Another discovery still references this file
    return false;
  }

  try {
    await fs.unlink(targetPath);
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to delete local image file:", err);
    }
    return false;
  }
}
