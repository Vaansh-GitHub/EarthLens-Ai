import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory IndexedDB mock
class MockIDBRequest {
  result: unknown = null;
  error: Error | null = null;
  onsuccess: ((e: { target: MockIDBRequest }) => void) | null = null;
  onerror: ((e: { target: MockIDBRequest }) => void) | null = null;
}

class MockIDBOpenDBRequest extends MockIDBRequest {
  onupgradeneeded: ((e: { target: MockIDBOpenDBRequest }) => void) | null = null;
}

class MockIDBTransaction {
  error: Error | null = null;
  onabort: ((e: { target: MockIDBTransaction }) => void) | null = null;
  oncomplete: (() => void) | null = null;

  constructor(private db: MockIDBDatabase, public mode: string) {}

  objectStore(name: string) {
    return this.db.getStore(name, this);
  }
}

class MockIDBObjectStore {
  constructor(private records: Map<string, unknown>, private tx: MockIDBTransaction) {}

  put(value: { id: string }) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.records.set(value.id, value);
      req.result = value.id;
      req.onsuccess?.({ target: req });
    }, 0);
    return req;
  }

  get(key: string) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = this.records.get(key) || null;
      req.onsuccess?.({ target: req });
    }, 0);
    return req;
  }

  getAll() {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = Array.from(this.records.values());
      req.onsuccess?.({ target: req });
    }, 0);
    return req;
  }

  delete(key: string) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.records.delete(key);
      req.result = undefined;
      req.onsuccess?.({ target: req });
    }, 0);
    return req;
  }

  clear() {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.records.clear();
      req.result = undefined;
      req.onsuccess?.({ target: req });
    }, 0);
    return req;
  }

  createIndex() {
    // noop
  }
}

class MockIDBDatabase {
  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };
  private stores = new Map<string, Map<string, unknown>>();

  createObjectStore(name: string) {
    this.stores.set(name, new Map());
    return new MockIDBObjectStore(this.stores.get(name)!, null as unknown as MockIDBTransaction);
  }

  getStore(name: string, tx: MockIDBTransaction) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    return new MockIDBObjectStore(this.stores.get(name)!, tx);
  }

  transaction(storeNames: string | string[], mode: string) {
    return new MockIDBTransaction(this, mode);
  }

  close() {}
}

describe("IndexedDB Client Storage Utility (journal-db)", () => {
  let mockDb: MockIDBDatabase;

  beforeEach(() => {
    mockDb = new MockIDBDatabase();
    mockDb.createObjectStore("discoveries");
    mockDb.createObjectStore("drafts");

    const mockIndexedDB = {
      open: vi.fn(() => {
        const req = new MockIDBOpenDBRequest();
        setTimeout(() => {
          req.result = mockDb;
          req.onsuccess?.({ target: req });
        }, 0);
        return req;
      }),
    };

    // Setup global window environment for test
    vi.stubGlobal("window", {
      indexedDB: mockIndexedDB,
    });
    const realCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      ...realCrypto,
      randomUUID: () => "test-uuid-1234-5678",
    });
  });

  beforeEach(async () => {
    const { clearAllDiscoveries, clearDraftDiscovery } = await import("@/lib/client/journal-db");
    await clearAllDiscoveries();
    await clearDraftDiscovery();
  });

  it("saves a discovery and retrieves it by ID", async () => {
    const { saveDiscovery, getDiscoveryById } = await import("@/lib/client/journal-db");

    const blob = new Blob(["sample image content"], { type: "image/jpeg" });
    const saved = await saveDiscovery({
      imageBlob: blob,
      imageMimeType: "image/jpeg",
      category: "plant",
      notes: "Found near the ancient oak",
      analysis: {
        candidateCommonName: "English Oak",
        candidateScientificName: "Quercus robur",
        confidence: "High",
        facts: ["Can live over 1,000 years"],
      },
    });

    expect(saved.id).toBe("test-uuid-1234-5678");
    expect(saved.category).toBe("plant");
    expect(saved.notes).toBe("Found near the ancient oak");
    expect(saved.createdAt).toBeDefined();

    const retrieved = await getDiscoveryById("test-uuid-1234-5678");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.analysis.candidateCommonName).toBe("English Oak");
  });

  it("lists all discoveries and supports partial updates", async () => {
    const { saveDiscovery, getAllDiscoveries, updateDiscovery } = await import("@/lib/client/journal-db");

    const blob = new Blob(["plant"], { type: "image/jpeg" });
    await saveDiscovery({
      id: "doc-1",
      imageBlob: blob,
      imageMimeType: "image/jpeg",
      category: "plant",
      notes: "First note",
      analysis: { candidateCommonName: "Fern" },
      createdAt: "2026-10-01T10:00:00Z",
    });

    await saveDiscovery({
      id: "doc-2",
      imageBlob: blob,
      imageMimeType: "image/jpeg",
      category: "insect",
      notes: "Second note",
      analysis: { candidateCommonName: "Beetle" },
      createdAt: "2026-10-02T10:00:00Z",
    });

    const all = await getAllDiscoveries();
    expect(all.length).toBe(2);
    // Should be sorted newest first
    expect(all[0].id).toBe("doc-2");
    expect(all[1].id).toBe("doc-1");

    // Update doc-1
    const updated = await updateDiscovery("doc-1", {
      notes: "Updated field notes after second visit",
    });

    expect(updated.notes).toBe("Updated field notes after second visit");
    expect(updated.updatedAt).toBeDefined();
  });

  it("deletes a discovery and clears all discoveries", async () => {
    const { saveDiscovery, deleteDiscovery, clearAllDiscoveries, getAllDiscoveries } = await import(
      "@/lib/client/journal-db"
    );

    const blob = new Blob(["data"], { type: "image/png" });
    await saveDiscovery({
      id: "to-delete",
      imageBlob: blob,
      imageMimeType: "image/png",
      category: "animal",
      notes: "Track of a deer",
      analysis: { candidateCommonName: "White-tailed Deer" },
    });

    const deleted = await deleteDiscovery("to-delete");
    expect(deleted).toBe(true);

    let list = await getAllDiscoveries();
    expect(list.length).toBe(0);

    // Save another and clear
    await saveDiscovery({
      id: "another-one",
      imageBlob: blob,
      imageMimeType: "image/png",
      category: "bird",
      notes: "Robin singing",
      analysis: { candidateCommonName: "American Robin" },
    });

    await clearAllDiscoveries();
    list = await getAllDiscoveries();
    expect(list.length).toBe(0);
  });

  it("saves and retrieves draft discoveries across page navigations", async () => {
    const { saveDraftDiscovery, getDraftDiscovery, clearDraftDiscovery } = await import(
      "@/lib/client/journal-db"
    );

    const blob = new Blob(["draft photo"], { type: "image/jpeg" });
    await saveDraftDiscovery({
      id: "in-flight-draft",
      imageBlob: blob,
      imageMimeType: "image/jpeg",
      category: "fungi",
      notes: "Spotted after rain",
      analysis: { candidateCommonName: "Chanterelle" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const draft = await getDraftDiscovery();
    expect(draft).not.toBeNull();
    expect(draft?.analysis.candidateCommonName).toBe("Chanterelle");

    await clearDraftDiscovery();
    const afterClear = await getDraftDiscovery();
    expect(afterClear).toBeNull();
  });

  it("detects duplicate photos and supports remake discovery replacement", async () => {
    const { 
      saveDiscovery, 
      findDuplicateDiscovery, 
      findAllDuplicateGroups, 
      computeImageSha256,
      hammingDistance,
      deleteDiscovery,
      getAllDiscoveries
    } = await import("@/lib/client/journal-db");

    // 1. Hash computation tests
    const imageA = new Blob(["nature-photo-original-bytes"], { type: "image/jpeg" });
    const imageB = new Blob(["nature-photo-original-bytes"], { type: "image/jpeg" });
    const imageC = new Blob(["completely-different-nature-photo"], { type: "image/jpeg" });

    const hashA = await computeImageSha256(imageA);
    const hashB = await computeImageSha256(imageB);
    const hashC = await computeImageSha256(imageC);

    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
    expect(hammingDistance("1100", "1100")).toBe(0);
    expect(hammingDistance("1100", "1111")).toBe(2);

    // 2. Save imageA as an entry in the database
    const savedEntry = await saveDiscovery({
      id: "orig-discovery-1",
      imageBlob: imageA,
      imageMimeType: "image/jpeg",
      category: "plant",
      notes: "First sighting of Oak Tree",
      analysis: { candidateCommonName: "Northern Red Oak" },
    });
    expect(savedEntry.imageHash).toBe(hashA);

    // 3. Check duplicate discovery: unique image should return null
    const noDup = await findDuplicateDiscovery(imageC);
    expect(noDup).toBeNull();

    // 4. Check duplicate discovery: same image should detect duplicate
    const dupMatch = await findDuplicateDiscovery(imageB);
    expect(dupMatch).not.toBeNull();
    expect(dupMatch?.existingDiscovery.id).toBe("orig-discovery-1");
    expect(dupMatch?.matchType).toBe("exact");
    expect(dupMatch?.similarity).toBe(100);

    // 5. Save another copy and test findAllDuplicateGroups
    await saveDiscovery({
      id: "dup-discovery-2",
      imageBlob: imageB,
      imageMimeType: "image/jpeg",
      category: "plant",
      notes: "Second sighting",
      analysis: { candidateCommonName: "Northern Red Oak (Copy)" },
    });

    const groups = await findAllDuplicateGroups();
    expect(groups.length).toBe(1);
    const group = groups[0];
    const allIds = [group.original.id, ...group.duplicates.map((d) => d.id)];
    expect(allIds).toContain("orig-discovery-1");
    expect(allIds).toContain("dup-discovery-2");

    // 6. Simulate remake workflow: automatically delete old discovery
    await deleteDiscovery(dupMatch!.existingDiscovery.id);
    const remaining = await getAllDiscoveries();
    expect(remaining.some((d) => d.id === "orig-discovery-1")).toBe(false);
  });
});
