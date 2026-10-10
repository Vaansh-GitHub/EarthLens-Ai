import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import { POST as AnalyzePOST } from "../app/api/analyze/route";
import { GET as NatureSearchGET } from "../app/api/nature/search/route";
import { POST as JournalPOST, GET as JournalGET } from "../app/api/journal/route";
import { GET as JournalIdGET, PATCH as JournalIdPATCH, DELETE as JournalIdDELETE } from "../app/api/journal/[id]/route";

// Mock auth
vi.mock("@/lib/server/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
  verifyCsrfOrigin: vi.fn().mockReturnValue(true),
}));

const { mockCollection } = vi.hoisted(() => {
  return {
    mockCollection: {
      insertOne: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      updateOne: vi.fn(),
      deleteOne: vi.fn(),
    }
  };
});

vi.mock("@/lib/server/mongodb", () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn().mockReturnValue(mockCollection),
  }),
}));

import { getAuthenticatedUserId, verifyCsrfOrigin } from "@/lib/server/auth";

const mockUserId = new ObjectId("507f1f77bcf86cd799439011");

describe("API Routes Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CLOUDFLARE_ACCOUNT_ID = "mock_account_id";
    process.env.CLOUDFLARE_API_TOKEN = "mock_token";
    process.env.CLOUDFLARE_AI_MODEL = "@cf/mock/model";
    process.env.AI_MAX_IMAGE_SIZE_MB = "8";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Analyze API (/api/analyze)", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(verifyCsrfOrigin).mockReturnValue(true);
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);

      const req = new Request("http://localhost/api/analyze", { method: "POST" });
      const res = await AnalyzePOST(req);
      
      expect(res.status).toBe(401);
    });

    it("rejects invalid MIME types", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      
      const formData = new FormData();
      formData.append("image", new File(["fake image content"], "test.txt", { type: "text/plain" }));
      
      const req = new Request("http://localhost/api/analyze", {
        method: "POST",
        body: formData,
      });

      const res = await AnalyzePOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("Unsupported image format");
    });

    it("rejects oversized images", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      
      const largeBuffer = new ArrayBuffer(9 * 1024 * 1024); // 9MB (Default limit is 8MB)
      const formData = new FormData();
      formData.append("image", new File([largeBuffer], "large.jpg", { type: "image/jpeg" }));
      
      const req = new Request("http://localhost/api/analyze", {
        method: "POST",
        body: formData,
      });

      const res = await AnalyzePOST(req);
      expect(res.status).toBe(413); // Payload too large
    });

    it("handles AI provider rate limits", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      
      const formData = new FormData();
      formData.append("image", new File(["image"], "test.jpg", { type: "image/jpeg" }));
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests"
      } as Response);

      const req = new Request("http://localhost/api/analyze", { method: "POST", body: formData });
      const res = await AnalyzePOST(req);
      
      expect(res.status).toBe(429);
    });

    it("handles AI provider malformed output", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      
      const formData = new FormData();
      formData.append("image", new File(["image"], "test.jpg", { type: "image/jpeg" }));
      
      // Return invalid JSON (missing required fields from schema)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { response: '{"candidateCommonName": "Dog"}' } })
      } as Response);

      const req = new Request("http://localhost/api/analyze", { method: "POST", body: formData });
      const res = await AnalyzePOST(req);
      
      expect(res.status).toBe(502); // Bad Gateway (malformed output)
    });

    it("returns successful analysis and references", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      
      const formData = new FormData();
      formData.append("image", new File(["image"], "test.jpg", { type: "image/jpeg" }));
      
      // Mock CF AI response
      const mockAIResponse = {
        candidateCommonName: "Monarch Butterfly",
        candidateScientificName: "Danaus plexippus",
        confidence: "High",
        uncertaintyReasoning: "Clear markings.",
        visualCharacteristics: ["Orange", "Black veins"],
        facts: ["Migrates south"],
        ecologicalImportance: "Pollinator",
        naturalCharacteristic: "Wingspan",
        metaphoricalLesson: "Transformation",
        quote: "Change is beautiful",
        reflectionQuestion: "How do you handle change?",
        searchTerms: ["Danaus"]
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { response: JSON.stringify(mockAIResponse) } })
      } as Response);

      // Mock iNaturalist response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: 1, name: "Danaus plexippus", default_photo: null }] })
      } as Response);

      const req = new Request("http://localhost/api/analyze", { method: "POST", body: formData });
      const res = await AnalyzePOST(req);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.analysis.candidateCommonName).toBe("Monarch Butterfly");
      expect(data.data.references.length).toBe(1);
    });

    it("handles missing environment variables gracefully", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      delete process.env.CLOUDFLARE_API_TOKEN; // Break it
      
      const formData = new FormData();
      formData.append("image", new File(["image"], "test.jpg", { type: "image/jpeg" }));
      
      const req = new Request("http://localhost/api/analyze", { method: "POST", body: formData });
      const res = await AnalyzePOST(req);
      
      expect(res.status).toBe(501); // Not Implemented
    });
  });

  describe("Nature Search API (/api/nature/search)", () => {
    it("handles missing query", async () => {
      const req = new Request("http://localhost/api/nature/search");
      const res = await NatureSearchGET(req);
      expect(res.status).toBe(400);
    });

    it("handles iNaturalist upstream failures", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable"
      } as Response);

      const req = new Request("http://localhost/api/nature/search?q=test");
      const res = await NatureSearchGET(req);
      // Our API handles this gracefully and returns []
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toEqual([]);
    });
  });

  describe("Journal API (/api/journal)", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
      const req = new Request("http://localhost/api/journal", { method: "GET" });
      const res = await JournalGET(req);
      expect(res.status).toBe(401);
    });

    it("allows creating a journal entry", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: "mock_id" });

      const req = new Request("http://localhost/api/journal", {
        method: "POST",
        body: JSON.stringify({ observation: { category: "plant" } })
      });
      const res = await JournalPOST(req);
      expect(res.status).toBe(201);
    });

    it("supports pagination and filters", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      
      const mockToArray = vi.fn().mockResolvedValue([]);
      const mockLimit = vi.fn().mockReturnValue({ toArray: mockToArray });
      const mockSkip = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = vi.fn().mockReturnValue({ skip: mockSkip });
      mockCollection.find.mockReturnValue({ sort: mockSort });

      const req = new Request("http://localhost/api/journal?category=plant&limit=10&skip=5", { method: "GET" });
      const res = await JournalGET(req);
      
      expect(res.status).toBe(200);
      expect(mockCollection.find).toHaveBeenCalledWith({ userId: mockUserId, "observation.category": "plant" });
      expect(mockSkip).toHaveBeenCalledWith(5);
      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  describe("Journal ID API (/api/journal/[id])", () => {
    const validMongoId = "5f9b3b9b9b9b9b9b9b9b9b9b";
    
    it("rejects invalid MongoDB IDs", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      const req = new Request(`http://localhost/api/journal/invalid-id`, { method: "GET" });
      const res = await JournalIdGET(req, { params: Promise.resolve({ id: "invalid-id" }) });
      expect(res.status).toBe(400);
    });

    it("prevents cross-user access", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      mockCollection.findOne.mockResolvedValueOnce(null); // Not found for this user

      const req = new Request(`http://localhost/api/journal/${validMongoId}`, { method: "GET" });
      const res = await JournalIdGET(req, { params: Promise.resolve({ id: validMongoId }) });
      expect(res.status).toBe(404);
    });

    it("allows PATCH updates to specific fields only", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      mockCollection.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

      const req = new Request(`http://localhost/api/journal/${validMongoId}`, {
        method: "PATCH",
        body: JSON.stringify({ memoryCard: { title: "New Title" } })
      });
      const res = await JournalIdPATCH(req, { params: Promise.resolve({ id: validMongoId }) });
      expect(res.status).toBe(200);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: expect.objectContaining({ "memoryCard.title": "New Title" }) }
      );
    });

    it("allows deleting owned entry", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(mockUserId);
      mockCollection.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      const req = new Request(`http://localhost/api/journal/${validMongoId}`, { method: "DELETE" });
      const res = await JournalIdDELETE(req, { params: Promise.resolve({ id: validMongoId }) });
      expect(res.status).toBe(200);
    });
  });
});
