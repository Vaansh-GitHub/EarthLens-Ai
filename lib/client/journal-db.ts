"use client";

import { useEffect, useState } from "react";

export interface IdentificationContract {
  commonName: string;
  scientificName?: string | null;
  category?: string | null;
  confidence: number;
  identificationNotes: string;
}

export interface QuestMatchContract {
  score: number;
  status: "strong_match" | "partial_match" | "insufficient_match";
  matchedRequirements: string[];
  missingRequirements: string[];
  explanation: string;
  retrySuggestion?: string | null;

  // Compatibility fields
  questMatchScore?: number;
  questMatchStatus?: "strong_match" | "partial_match" | "insufficient_match";
  matchExplanation?: string;
  reason?: string;
  matched?: boolean;
  bonusXp?: number;
}

export interface VisibleEvidenceContractItem {
  observation: string;
  significance: string;
}

export interface NatureFactContractItem {
  title: string;
  detail: string;
  evidenceType: "observed" | "established_fact" | "uncertain";
}

export interface EcologicalRoleContract {
  title: string;
  description: string;
  ecologicalNeed: string;
  conservationNote?: string | null;
}

export interface WisdomAndReflectionContract {
  theme: string;
  quote: string;
  lifeConnection: string;
  toneUsed: string;
  imageConnection: string;
}

export interface ReflectionContract {
  question: string;
  journalPrompt: string;
}

export interface LocalDiscoveryAnalysis {
  possibleIdentification?: IdentificationContract | string | null;
  questMatch?: QuestMatchContract | null;
  visibleEvidence?: VisibleEvidenceContractItem[] | string[];
  natureFacts?: NatureFactContractItem[] | string[];
  ecologicalRole?: EcologicalRoleContract | string | null;
  wisdomAndReflection?: WisdomAndReflectionContract | null;
  reflection?: ReflectionContract | string | null;
  safetyNote?: string | null;

  // Legacy flat fields for backwards compatibility
  candidateCommonName?: string | null;
  candidateScientificName?: string | null;
  candidateIdentification?: string | null;
  confidence?: string | number | null;
  confidenceLevel?: string | null;
  uncertaintyReasoning?: string | null;
  rationale?: string | null;
  visualCharacteristics?: string[];
  observableTraits?: string[];
  facts?: string[];
  ecologicalImportance?: string | null;
  ecologicalNeed?: string | null;
  reflectionTheme?: string | null;
  naturalCharacteristic?: string | null;
  characteristic?: string | null;
  originalQuote?: string | null;
  quote?: string | null;
  metaphoricalLesson?: string | null;
  lifeLesson?: string | null;
  reflectionQuestion?: string | null;
  detectedMood?: string | null;
  safetyNotes?: string | null;
  searchTerms?: string[];
  funFact?: string | null;
  inspirationalQuote?: string | null;
}

export interface LocalDiscovery {
  id: string; // Client-generated UUID
  imageBlob: Blob; // Original image binary data
  imageMimeType: string;
  imageHash?: string; // SHA-256 hash for exact duplicate detection
  pHash?: string; // Perceptual difference hash for visual duplicate detection
  category: string; // e.g. "plant", "animal", etc.
  notes: string;
  analysis: LocalDiscoveryAnalysis;
  rawContractJson?: Record<string, unknown>;
  references?: Array<{
    id?: number | string;
    name?: string;
    preferred_common_name?: string;
    default_photo?: { medium_url?: string } | null;
    wikipedia_url?: string | null;
  }>;
  questMatch?: (QuestMatchContract & {
    questDate?: string;
    questTitle?: string;
  }) | null;
  memoryCard?: {
    title?: string;
    quote?: string;
    template?: "light" | "dark" | "earthy" | "classic";
    showPhoto?: boolean;
  };
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface StorageEstimateInfo {
  usageBytes: number;
  quotaBytes: number;
  percentageUsed: number;
  isSupported: boolean;
}

const DB_NAME = "earthlens-local";
const DB_VERSION = 1;
const STORE_DISCOVERIES = "discoveries";
const STORE_DRAFTS = "drafts";

let dbInstance: IDBDatabase | null = null;

function isIndexedDBSupported(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

/**
 * Opens or initializes the earthlens-local IndexedDB instance.
 */
export async function openDB(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    throw new Error(
      "IndexedDB is not supported in this browser. Please use a modern browser to store local discoveries."
    );
  }

  if (dbInstance) {
    return dbInstance;
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Primary store for saved discoveries
      if (!db.objectStoreNames.contains(STORE_DISCOVERIES)) {
        const store = db.createObjectStore(STORE_DISCOVERIES, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Temporary store for in-flight / draft discovery between analysis and saving
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      const err = (event.target as IDBOpenDBRequest).error;
      reject(new Error(`Failed to open local database: ${err?.message || "Unknown error"}`));
    };
  });
}

function handleTransactionError(error: unknown): Error {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return new Error(
      "Device storage quota exceeded. Please free up space on your device or remove older discoveries in the storage manager."
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Computes the SHA-256 hex string of an image Blob for exact duplicate detection.
 */
export async function computeImageSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const subtle =
    typeof globalThis !== "undefined" && globalThis.crypto?.subtle
      ? globalThis.crypto.subtle
      : typeof window !== "undefined" && window.crypto?.subtle
      ? window.crypto.subtle
      : null;

  if (subtle) {
    const hashBuffer = await subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Deterministic fallback checksum if Web Crypto subtle is unavailable or stubbed
  const bytes = new Uint8Array(buffer);
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    h1 = Math.imul(h1 ^ byte, 2654435761);
    h2 = Math.imul(h2 ^ byte, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `chk-${bytes.length}-${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}`;
}

/**
 * Computes a 64-bit perceptual difference hash (dHash) for an image Blob.
 * Scales the image down to 9x8 grayscale and computes relative luminosity between adjacent horizontal pixels.
 * If running outside browser or canvas is unavailable, falls back to SHA-256.
 */
export async function computePerceptualHash(blob: Blob): Promise<string> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof Image === "undefined"
  ) {
    return computeImageSha256(blob);
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 9;
          canvas.height = 8;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            computeImageSha256(blob).then(resolve).catch(() => resolve(""));
            return;
          }

          ctx.drawImage(img, 0, 0, 9, 8);
          const imgData = ctx.getImageData(0, 0, 9, 8).data;

          const grays: number[] = [];
          for (let i = 0; i < imgData.length; i += 4) {
            const gray =
              0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
            grays.push(gray);
          }

          let hash = "";
          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              const left = grays[row * 9 + col];
              const right = grays[row * 9 + col + 1];
              hash += left > right ? "1" : "0";
            }
          }
          resolve(hash);
        } catch {
          computeImageSha256(blob).then(resolve).catch(() => resolve(""));
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        computeImageSha256(blob).then(resolve).catch(() => resolve(""));
      };
      img.src = url;
    } catch {
      computeImageSha256(blob).then(resolve).catch(() => resolve(""));
    }
  });
}

/**
 * Calculates the Hamming distance between two binary or hex strings.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Math.max(hash1.length, hash2.length);
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

export interface DuplicateMatch {
  existingDiscovery: LocalDiscovery;
  matchType: "exact" | "visual";
  similarity: number; // 0 to 100 percentage
}

/**
 * Scans existing discoveries in local database to find if candidateBlob is already present.
 */
export async function findDuplicateDiscovery(
  candidateBlob: Blob
): Promise<DuplicateMatch | null> {
  if (!candidateBlob) return null;
  const discoveries = await getAllDiscoveries();
  if (discoveries.length === 0) return null;

  const [candidateSha, candidatePhash] = await Promise.all([
    computeImageSha256(candidateBlob).catch(() => ""),
    computePerceptualHash(candidateBlob).catch(() => ""),
  ]);

  for (const disc of discoveries) {
    if (!disc.imageBlob) continue;

    // 1. Exact byte SHA-256 match
    let discSha = disc.imageHash;
    if (!discSha) {
      discSha = await computeImageSha256(disc.imageBlob).catch(() => "");
    }
    if (candidateSha && discSha && candidateSha === discSha) {
      return {
        existingDiscovery: disc,
        matchType: "exact",
        similarity: 100,
      };
    }

    // 2. Perceptual visual hash match
    let discPhash = disc.pHash;
    if (!discPhash) {
      discPhash = await computePerceptualHash(disc.imageBlob).catch(() => "");
    }
    if (candidatePhash && discPhash && candidatePhash.length === discPhash.length) {
      const dist = hammingDistance(candidatePhash, discPhash);
      // For 64-bit dHash, distance <= 3 represents > 95% visual identity
      const threshold = candidatePhash.length === 64 ? 3 : 0;
      if (dist <= threshold) {
        const similarity = Math.max(
          0,
          Math.round(((candidatePhash.length - dist) / candidatePhash.length) * 100)
        );
        return {
          existingDiscovery: disc,
          matchType: "visual",
          similarity,
        };
      }
    }
  }

  return null;
}

export interface DuplicateGroup {
  original: LocalDiscovery;
  duplicates: LocalDiscovery[];
}

/**
 * Scans the database and groups all duplicate photos found among entered images.
 */
export async function findAllDuplicateGroups(): Promise<DuplicateGroup[]> {
  const discoveries = await getAllDiscoveries();
  if (discoveries.length < 2) return [];

  const items = await Promise.all(
    discoveries.map(async (disc) => {
      const sha =
        disc.imageHash ||
        (disc.imageBlob ? await computeImageSha256(disc.imageBlob).catch(() => "") : "");
      const phash =
        disc.pHash ||
        (disc.imageBlob ? await computePerceptualHash(disc.imageBlob).catch(() => "") : "");
      return { disc, sha, phash };
    })
  );

  const groups: DuplicateGroup[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    if (visited.has(current.disc.id)) continue;

    const duplicates: LocalDiscovery[] = [];
    for (let j = i + 1; j < items.length; j++) {
      const other = items[j];
      if (visited.has(other.disc.id)) continue;

      let isMatch = false;
      if (current.sha && other.sha && current.sha === other.sha) {
        isMatch = true;
      } else if (
        current.phash &&
        other.phash &&
        current.phash.length === other.phash.length
      ) {
        const dist = hammingDistance(current.phash, other.phash);
        const threshold = current.phash.length === 64 ? 3 : 0;
        if (dist <= threshold) {
          isMatch = true;
        }
      }

      if (isMatch) {
        duplicates.push(other.disc);
        visited.add(other.disc.id);
      }
    }

    if (duplicates.length > 0) {
      visited.add(current.disc.id);
      groups.push({
        original: current.disc,
        duplicates,
      });
    }
  }

  return groups;
}

/**
 * Saves a new discovery into IndexedDB.
 */
export async function saveDiscovery(
  entry: Omit<LocalDiscovery, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }
): Promise<LocalDiscovery> {
  const db = await openDB();
  const id = entry.id || crypto.randomUUID();
  const now = new Date().toISOString();

  let imageHash = entry.imageHash;
  let pHash = entry.pHash;
  if (!imageHash && entry.imageBlob) {
    imageHash = await computeImageSha256(entry.imageBlob).catch(() => undefined);
  }
  if (!pHash && entry.imageBlob) {
    pHash = await computePerceptualHash(entry.imageBlob).catch(() => undefined);
  }

  const record: LocalDiscovery = {
    ...entry,
    imageHash,
    pHash,
    id,
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || now,
  };

  return new Promise<LocalDiscovery>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DISCOVERIES, "readwrite");
      const store = tx.objectStore(STORE_DISCOVERIES);
      const req = store.put(record);

      req.onsuccess = () => resolve(record);
      req.onerror = (e) => reject(handleTransactionError((e.target as IDBRequest).error));
      tx.onabort = (e) => reject(handleTransactionError((e.target as IDBTransaction).error));
    } catch (err) {
      reject(handleTransactionError(err));
    }
  });
}

/**
 * Retrieves all discoveries ordered from newest to oldest.
 */
export async function getAllDiscoveries(): Promise<LocalDiscovery[]> {
  const db = await openDB();

  return new Promise<LocalDiscovery[]>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DISCOVERIES, "readonly");
      const store = tx.objectStore(STORE_DISCOVERIES);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result || []) as LocalDiscovery[];
        // Sort descending by createdAt
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(results);
      };
      req.onerror = (e) => reject(handleTransactionError((e.target as IDBRequest).error));
    } catch (err) {
      reject(handleTransactionError(err));
    }
  });
}

/**
 * Retrieves a single discovery by its ID.
 */
export async function getDiscoveryById(id: string): Promise<LocalDiscovery | null> {
  if (!id) return null;
  const db = await openDB();

  return new Promise<LocalDiscovery | null>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DISCOVERIES, "readonly");
      const store = tx.objectStore(STORE_DISCOVERIES);
      const req = store.get(id);

      req.onsuccess = () => {
        resolve((req.result as LocalDiscovery) || null);
      };
      req.onerror = (e) => reject(handleTransactionError((e.target as IDBRequest).error));
    } catch (err) {
      reject(handleTransactionError(err));
    }
  });
}

/**
 * Updates an existing discovery with partial modifications.
 */
export async function updateDiscovery(
  id: string,
  updates: Partial<Omit<LocalDiscovery, "id" | "createdAt">>
): Promise<LocalDiscovery> {
  const existing = await getDiscoveryById(id);
  if (!existing) {
    throw new Error(`Discovery with ID "${id}" was not found.`);
  }

  const updatedRecord: LocalDiscovery = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  const db = await openDB();
  return new Promise<LocalDiscovery>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DISCOVERIES, "readwrite");
      const store = tx.objectStore(STORE_DISCOVERIES);
      const req = store.put(updatedRecord);

      req.onsuccess = () => resolve(updatedRecord);
      req.onerror = (e) => reject(handleTransactionError((e.target as IDBRequest).error));
      tx.onabort = (e) => reject(handleTransactionError((e.target as IDBTransaction).error));
    } catch (err) {
      reject(handleTransactionError(err));
    }
  });
}

/**
 * Deletes a single discovery by ID.
 */
export async function deleteDiscovery(id: string): Promise<boolean> {
  const db = await openDB();

  return new Promise<boolean>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DISCOVERIES, "readwrite");
      const store = tx.objectStore(STORE_DISCOVERIES);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(handleTransactionError((e.target as IDBRequest).error));
    } catch (err) {
      reject(handleTransactionError(err));
    }
  });
}

/**
 * Clears all discoveries from local IndexedDB storage.
 */
export async function clearAllDiscoveries(): Promise<void> {
  const db = await openDB();

  return new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DISCOVERIES, "readwrite");
      const store = tx.objectStore(STORE_DISCOVERIES);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(handleTransactionError((e.target as IDBRequest).error));
    } catch (err) {
      reject(handleTransactionError(err));
    }
  });
}

/**
 * Saves a pending / draft discovery in the drafts store so that a page refresh
 * on /insight?id=new preserves the raw image Blob in local memory.
 */
export async function saveDraftDiscovery(draft: LocalDiscovery): Promise<void> {
  const db = await openDB();

  return new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DRAFTS, "readwrite");
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.put({ ...draft, id: "active_draft" });

      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(handleTransactionError((e.target as IDBRequest).error));
    } catch (err) {
      reject(handleTransactionError(err));
    }
  });
}

/**
 * Retrieves the current pending draft discovery.
 */
export async function getDraftDiscovery(): Promise<LocalDiscovery | null> {
  const db = await openDB();

  return new Promise<LocalDiscovery | null>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DRAFTS, "readonly");
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.get("active_draft");

      req.onsuccess = () => resolve((req.result as LocalDiscovery) || null);
      req.onerror = (e) => reject(handleTransactionError((e.target as IDBRequest).error));
    } catch (err) {
      reject(handleTransactionError(err));
    }
  });
}

/**
 * Clears the active draft discovery once saved or discarded.
 */
export async function clearDraftDiscovery(): Promise<void> {
  const db = await openDB();

  return new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DRAFTS, "readwrite");
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.delete("active_draft");

      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(handleTransactionError((e.target as IDBRequest).error));
    } catch (err) {
      reject(handleTransactionError(err));
    }
  });
}

/**
 * Estimates storage usage and quota using navigator.storage.estimate().
 */
export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 1;
      const percentageUsed = Math.min(100, Math.round((usage / quota) * 100));

      return {
        usageBytes: usage,
        quotaBytes: quota,
        percentageUsed,
        isSupported: true,
      };
    } catch (e) {
      console.warn("Storage estimate failed:", e);
    }
  }

  return {
    usageBytes: 0,
    quotaBytes: 0,
    percentageUsed: 0,
    isSupported: false,
  };
}

/**
 * Requests persistent storage from the browser to prevent eviction under disk pressure.
 */
export async function requestPersistentStorage(): Promise<{ persisted: boolean; isSupported: boolean }> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    try {
      const persisted = await navigator.storage.persist();
      return { persisted, isSupported: true };
    } catch (e) {
      console.warn("Persistent storage request failed:", e);
    }
  }
  return { persisted: false, isSupported: false };
}

/**
 * Checks if storage is already persisted.
 */
export async function checkPersistentStorage(): Promise<{ persisted: boolean; isSupported: boolean }> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persisted) {
    try {
      const persisted = await navigator.storage.persisted();
      return { persisted, isSupported: true };
    } catch (e) {
      console.warn("Check persistent storage failed:", e);
    }
  }
  return { persisted: false, isSupported: false };
}

// ─────────────────────────────────────────────────────────────
// EXPORT / IMPORT BACKUP HELPERS
// ─────────────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export interface BackupPayload {
  format: "earthlens-local-backup";
  version: number;
  exportedAt: string;
  discoveries: Array<
    Omit<LocalDiscovery, "imageBlob"> & {
      imageDataUrl: string;
    }
  >;
}

/**
 * Exports all local discoveries and original image blobs into a downloadable JSON backup Blob.
 */
export async function exportDiscoveriesBackup(): Promise<Blob> {
  const discoveries = await getAllDiscoveries();

  const serializedDiscoveries = await Promise.all(
    discoveries.map(async (item) => {
      const imageDataUrl = await blobToDataUrl(item.imageBlob);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { imageBlob, ...rest } = item;
      return {
        ...rest,
        imageDataUrl,
      };
    })
  );

  const payload: BackupPayload = {
    format: "earthlens-local-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    discoveries: serializedDiscoveries,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  return new Blob([jsonString], { type: "application/json" });
}

/**
 * Imports discoveries from an EarthLens backup file into local IndexedDB.
 */
export async function importDiscoveriesBackup(
  file: File | Blob
): Promise<{ importedCount: number; errors: string[] }> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid backup file: Could not parse JSON.");
  }

  const payload = parsed as BackupPayload;
  if (!payload || payload.format !== "earthlens-local-backup" || !Array.isArray(payload.discoveries)) {
    throw new Error("Unrecognized backup format. Please select a valid EarthLens backup JSON file.");
  }

  let importedCount = 0;
  const errors: string[] = [];

  for (const item of payload.discoveries) {
    try {
      if (!item.imageDataUrl) {
        errors.push(`Discovery ${item.id || "unnamed"} missing image data.`);
        continue;
      }
      const blob = dataUrlToBlob(item.imageDataUrl);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { imageDataUrl, ...rest } = item;
      await saveDiscovery({
        ...rest,
        imageBlob: blob,
        imageMimeType: item.imageMimeType || blob.type || "image/jpeg",
      });
      importedCount++;
    } catch (itemErr) {
      errors.push(`Failed to import discovery ${item.id}: ${(itemErr as Error).message}`);
    }
  }

  return { importedCount, errors };
}

// ─────────────────────────────────────────────────────────────
// REACT HOOKS FOR MEMORY-SAFE OBJECT URLS
// ─────────────────────────────────────────────────────────────

/**
 * Safely creates and revokes an object URL for a single Blob.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
}

/**
 * Safely creates and revokes object URLs for a list of LocalDiscovery items.
 */
export function useDiscoveryObjectUrls(discoveries: LocalDiscovery[]): Record<string, string> {
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls: Record<string, string> = {};

    for (const d of discoveries) {
      if (d.imageBlob) {
        try {
          urls[d.id] = URL.createObjectURL(d.imageBlob);
        } catch (e) {
          console.warn("Failed to create object URL for discovery", d.id, e);
        }
      }
    }

    setUrlMap(urls);

    return () => {
      // Revoke all created URLs when dependencies change or component unmounts
      Object.values(urls).forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
    };
  }, [discoveries]);

  return urlMap;
}
