import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import { 
  validateImageSignature, 
  uploadImageBuffer, 
  cleanupLocalFile, 
  deleteLocalImageIfNotReferenced,
  getPresignedImageUrl 
} from "@/lib/server/storage";

describe("Local Storage Engine Tests", () => {
  const createdTestFiles: string[] = [];

  // Valid signatures
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const validWebp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  const validGif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00]);
  const invalidFile = Buffer.from("this is a plain text file pretending to be an image");

  afterEach(async () => {
    // Clean up any test files created on disk
    for (const fileUrl of createdTestFiles) {
      await cleanupLocalFile(fileUrl);
    }
    createdTestFiles.length = 0;
  });

  describe("validateImageSignature", () => {
    it("detects valid JPEG files", () => {
      const res = validateImageSignature(validJpeg);
      expect(res.isValid).toBe(true);
      expect(res.extension).toBe("jpg");
      expect(res.mimeType).toBe("image/jpeg");
    });

    it("detects valid PNG files", () => {
      const res = validateImageSignature(validPng);
      expect(res.isValid).toBe(true);
      expect(res.extension).toBe("png");
      expect(res.mimeType).toBe("image/png");
    });

    it("detects valid WebP files", () => {
      const res = validateImageSignature(validWebp);
      expect(res.isValid).toBe(true);
      expect(res.extension).toBe("webp");
      expect(res.mimeType).toBe("image/webp");
    });

    it("detects valid GIF files", () => {
      const res = validateImageSignature(validGif);
      expect(res.isValid).toBe(true);
      expect(res.extension).toBe("gif");
      expect(res.mimeType).toBe("image/gif");
    });

    it("rejects invalid text files", () => {
      const res = validateImageSignature(invalidFile);
      expect(res.isValid).toBe(false);
    });

    it("rejects empty buffers", () => {
      const res = validateImageSignature(Buffer.alloc(0));
      expect(res.isValid).toBe(false);
    });
  });

  describe("uploadImageBuffer (local mode)", () => {
    it("uploads and saves a valid image locally with unique UUID", async () => {
      const result = await uploadImageBuffer(validJpeg, "image/jpeg", "discoveries");
      expect(result.url).toMatch(/^\/uploads\/discoveries\/[a-f0-9-]+\.jpg$/);
      expect(result.key).toMatch(/^uploads\/discoveries\/[a-f0-9-]+\.jpg$/);
      createdTestFiles.push(result.url);

      // Verify the file was written to disk in public/uploads/discoveries/
      const diskPath = path.join(process.cwd(), "public", result.url);
      const exists = await fs.stat(diskPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it("rejects empty buffers with error", async () => {
      await expect(uploadImageBuffer(Buffer.alloc(0), "image/jpeg")).rejects.toThrow("Cannot upload empty file");
    });

    it("rejects oversized buffers", async () => {
      const largeBuffer = Buffer.alloc(9 * 1024 * 1024); // 9MB
      await expect(uploadImageBuffer(largeBuffer, "image/jpeg")).rejects.toThrow("File size exceeds maximum limit");
    });

    it("rejects files with invalid signatures even if MIME type is set", async () => {
      await expect(uploadImageBuffer(invalidFile, "image/jpeg")).rejects.toThrow("Invalid or unsupported image format");
    });
  });

  describe("getPresignedImageUrl", () => {
    it("returns direct relative URL in local mode without contacting cloud storage", async () => {
      const localUrl = await getPresignedImageUrl("/uploads/discoveries/test-123.jpg");
      expect(localUrl).toBe("/uploads/discoveries/test-123.jpg");
    });
  });

  describe("deleteLocalImageIfNotReferenced", () => {
    it("deletes local image when no other discoveries reference it", async () => {
      const uploaded = await uploadImageBuffer(validPng, "image/png", "discoveries");
      const diskPath = path.join(process.cwd(), "public", uploaded.url);

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          countDocuments: vi.fn().mockResolvedValue(0), // No other documents reference this
        }),
      } as unknown as Parameters<typeof deleteLocalImageIfNotReferenced>[1];

      const deleted = await deleteLocalImageIfNotReferenced(uploaded.url, mockDb);
      expect(deleted).toBe(true);

      const exists = await fs.stat(diskPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it("preserves local image when another discovery still references it", async () => {
      const uploaded = await uploadImageBuffer(validPng, "image/png", "discoveries");
      createdTestFiles.push(uploaded.url);
      const diskPath = path.join(process.cwd(), "public", uploaded.url);

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          countDocuments: vi.fn().mockResolvedValue(1), // Another document references it!
        }),
      } as unknown as Parameters<typeof deleteLocalImageIfNotReferenced>[1];

      const deleted = await deleteLocalImageIfNotReferenced(uploaded.url, mockDb);
      expect(deleted).toBe(false);

      const exists = await fs.stat(diskPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it("prevents path traversal attempts during deletion", async () => {
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          countDocuments: vi.fn().mockResolvedValue(0),
        }),
      } as unknown as Parameters<typeof deleteLocalImageIfNotReferenced>[1];

      const deleted = await deleteLocalImageIfNotReferenced("/uploads/discoveries/../../secret.txt", mockDb);
      expect(deleted).toBe(false);
    });
  });
});
