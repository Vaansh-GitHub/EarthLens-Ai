/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { 
  Search, Filter, BookOpen, ShieldCheck, HardDrive, Download, Upload, 
  Trash2, AlertTriangle, ArrowRight, Leaf, Sparkles, RefreshCw, CheckCircle2,
  Copy
} from "lucide-react";
import { 
  getAllDiscoveries, 
  deleteDiscovery, 
  clearAllDiscoveries, 
  getStorageEstimate, 
  requestPersistentStorage, 
  checkPersistentStorage,
  exportDiscoveriesBackup, 
  importDiscoveriesBackup, 
  saveDiscovery,
  useDiscoveryObjectUrls,
  findAllDuplicateGroups,
  type LocalDiscovery, 
  type StorageEstimateInfo,
  type DuplicateGroup
} from "@/lib/client/journal-db";

const CATEGORIES = ["All", "Plant", "Animal", "Insect", "Bird", "Fungi", "Landscape", "Other"];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function JournalClient() {
  const [entries, setEntries] = useState<LocalDiscovery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Storage Stats State
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const [showStoragePanel, setShowStoragePanel] = useState(false);

  // Modals
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Duplicate search state
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[] | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);

  // Cloud migration state
  const [showLegacyMigration, setShowLegacyMigration] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Load discoveries from local IndexedDB
  const reloadEntries = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const docs = await getAllDiscoveries();
      setEntries(docs);

      // Keep cloud user discovery count synchronized with device journal
      fetch("/api/user/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoveriesCount: docs.length }),
      }).catch((e) => console.warn("Failed to sync discoveries count to cloud:", e));

      const estimate = await getStorageEstimate();
      setStorageInfo(estimate);

      const persistState = await checkPersistentStorage();
      setIsPersisted(persistState.persisted);
    } catch (err) {
      console.error("IndexedDB error:", err);
      setErrorMessage(
        (err as Error).message ||
          "Could not open device local storage. If you are in strict private browsing, local storage may be restricted."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          window.location.href = "/login";
        }
      })
      .catch(() => {});
    void reloadEntries();
  }, []);

  // Safe object URLs for all local discovery image blobs
  const objectUrls = useDiscoveryObjectUrls(entries);

  // Handle single deletion
  const handleDeleteDiscovery = async () => {
    if (!deleteTargetId) return;
    setIsProcessing(true);
    try {
      await deleteDiscovery(deleteTargetId);
      setDeleteTargetId(null);
      await reloadEntries();
      setSuccessNotice("Discovery deleted from this device.");
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to delete discovery.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle clear all
  const handleClearAll = async () => {
    setIsProcessing(true);
    try {
      await clearAllDiscoveries();
      setShowClearConfirm(false);
      await reloadEntries();
      setSuccessNotice("All local discoveries cleared from this device.");
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to clear discoveries.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Request persistent storage
  const handleRequestPersistence = async () => {
    const res = await requestPersistentStorage();
    setIsPersisted(res.persisted);
    if (res.persisted) {
      setSuccessNotice("Persistent storage granted by your browser.");
    } else {
      setSuccessNotice("Persistent storage request submitted. Your browser manages retention based on device space.");
    }
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  // Export backup
  const handleExportBackup = async () => {
    try {
      setIsProcessing(true);
      const blob = await exportDiscoveriesBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `earthlens-journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessNotice("Journal backup downloaded to your device.");
      setTimeout(() => setSuccessNotice(null), 3500);
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to export journal backup.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Import backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await importDiscoveriesBackup(file);
      await reloadEntries();
      if (res.errors.length > 0) {
        setErrorMessage(`Imported ${res.importedCount} discoveries with warnings: ${res.errors.join(", ")}`);
      } else {
        setSuccessNotice(`Successfully imported ${res.importedCount} discoveries from backup!`);
      }
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to import backup file.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Scan for duplicate photos across the database
  const handleScanDuplicates = async () => {
    setIsScanningDuplicates(true);
    setErrorMessage(null);
    try {
      const groups = await findAllDuplicateGroups();
      setDuplicateGroups(groups);
      setShowDuplicateModal(true);
      if (groups.length === 0) {
        setSuccessNotice("Scan complete: No duplicate photos found in database! All discoveries are unique.");
        setTimeout(() => setSuccessNotice(null), 4000);
      }
    } catch (err) {
      console.error("Duplicate scan error:", err);
      setErrorMessage((err as Error).message || "Failed to scan database for duplicate photos.");
    } finally {
      setIsScanningDuplicates(false);
    }
  };

  // Delete a duplicate copy from the database
  const handleDeleteDuplicateEntry = async (dupId: string) => {
    setIsProcessing(true);
    try {
      await deleteDiscovery(dupId);
      await reloadEntries();
      const updated = await findAllDuplicateGroups();
      setDuplicateGroups(updated);
      setSuccessNotice("Duplicate photo entry deleted and database space freed.");
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to delete duplicate entry.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Optional: Safe migration from legacy MongoDB cloud entries if user chooses
  const handleMigrateFromLegacyCloud = async () => {
    setIsMigrating(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/journal");
      const resJson = await res.json();
      if (!resJson.success || !Array.isArray(resJson.data) || resJson.data.length === 0) {
        setSuccessNotice("No legacy server discoveries found to migrate.");
        setShowLegacyMigration(false);
        setIsMigrating(false);
        return;
      }

      let count = 0;
      for (const item of resJson.data) {
        let imageBlob: Blob | null = null;
        if (item.observation?.photoUrl) {
          try {
            const imgRes = await fetch(item.observation.photoUrl);
            if (imgRes.ok) {
              imageBlob = await imgRes.blob();
            }
          } catch {
            // ignore photo fetch failure
          }
        }

        if (!imageBlob) {
          imageBlob = new Blob(["legacy-placeholder"], { type: "image/jpeg" });
        }

        const candidateName =
          item.analysis?.candidateCommonName ||
          item.analysis?.candidateScientificName ||
          item.analysis?.candidateIdentification ||
          "Legacy Nature Discovery";

        await saveDiscovery({
          id: item._id?.toString() || crypto.randomUUID(),
          imageBlob,
          imageMimeType: imageBlob.type || "image/jpeg",
          category: item.observation?.category || "plant",
          notes: item.observation?.description || "",
          analysis: {
            ...item.analysis,
            candidateCommonName: candidateName,
          },
          references: item.references || [],
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
        });
        count++;
      }

      await reloadEntries();
      setSuccessNotice(`Migrated ${count} legacy discoveries into your local device journal!`);
      setShowLegacyMigration(false);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err) {
      console.error("Migration error:", err);
      setErrorMessage((err as Error).message || "Could not complete legacy migration.");
    } finally {
      setIsMigrating(false);
    }
  };

  // Filter and search
  const filteredEntries = entries.filter((entry) => {
    const q = searchQuery.trim().toLowerCase();
    const title =
      entry.analysis?.candidateCommonName ||
      entry.analysis?.candidateScientificName ||
      entry.analysis?.candidateIdentification ||
      entry.memoryCard?.title ||
      "";

    const matchesSearch =
      !q ||
      title.toLowerCase().includes(q) ||
      (entry.category || "").toLowerCase().includes(q) ||
      (entry.notes || "").toLowerCase().includes(q);

    const matchesCategory =
      activeCategory === "All" ||
      (entry.category || "").toLowerCase() === activeCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 animate-in fade-in duration-500 mb-10">
      
      {/* Hidden File Input for Backup Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportBackup} 
        accept=".json,application/json" 
        className="hidden" 
      />

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#1E3526]">
            Nature Journal
          </h1>
          <p className="text-[#5F7363] text-sm md:text-base mt-1 max-w-xl">
            A chronicle of your discoveries and reflections. Watch your connection to the natural world grow over time.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowStoragePanel(!showStoragePanel)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#DCE5D8] hover:border-[#294B36] text-[#294B36] rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#3E6548]" />
            <span>Device Storage ({entries.length})</span>
          </button>

          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#294B36] hover:bg-[#1E3526] text-white rounded-full text-xs font-bold transition-all shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D2E3CE]" />
            <span>New Discovery</span>
          </Link>
        </div>
      </header>

      {/* Privacy Notice Banner */}
      <section className="p-4 rounded-2xl bg-[#F5F8F1] border border-[#DCE5D8] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#294B36] shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs md:text-sm font-semibold text-[#1E3526] leading-relaxed">
            Your Journal is stored on this device. Photos are uploaded to our AI provider only when you request analysis. Your saved discoveries are not automatically synced to our servers.
          </p>
        </div>
      </section>

      {/* Success Notification */}
      {successNotice && (
        <div className="p-3.5 rounded-2xl bg-[#E4EEDF] border border-[#294B36]/30 text-[#1E3526] text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-[#294B36]" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Device Storage Management Drawer */}
      {showStoragePanel && (
        <div className="p-5 rounded-3xl bg-white border border-[#DCE5D8] shadow-sm flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between border-b border-[#DCE5D8] pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-[#294B36]" />
              <h2 className="text-sm font-bold text-[#1E3526]">Device Storage &amp; Privacy Controls</h2>
            </div>
            <button
              onClick={() => setShowStoragePanel(false)}
              className="text-xs font-bold text-[#5F7363] hover:text-[#1E3526] cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#F5F8F1] border border-[#DCE5D8] flex flex-col gap-1">
              <span className="font-bold text-[#5F7363] uppercase tracking-wider text-[10px]">IndexedDB Records</span>
              <span className="text-base font-extrabold text-[#1E3526]">{entries.length} discoveries</span>
              <span className="text-[#5F7363]">Stored entirely in your browser (`earthlens-local`)</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F5F8F1] border border-[#DCE5D8] flex flex-col gap-1">
              <span className="font-bold text-[#5F7363] uppercase tracking-wider text-[10px]">Storage Estimate</span>
              <span className="text-base font-extrabold text-[#1E3526]">
                {storageInfo?.isSupported ? `${formatBytes(storageInfo.usageBytes)} used` : "Available"}
              </span>
              <span className="text-[#5F7363]">
                {storageInfo?.isSupported
                  ? `~${formatBytes(storageInfo.quotaBytes)} total device quota available`
                  : "Browser storage active"}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F5F8F1] border border-[#DCE5D8] flex flex-col justify-between gap-2">
              <div>
                <span className="font-bold text-[#5F7363] uppercase tracking-wider text-[10px]">Eviction Protection</span>
                <p className="text-[#1E3526] font-semibold mt-0.5">
                  {isPersisted ? "Persistent Storage Active" : "Standard Storage"}
                </p>
                <p className="text-[11px] text-[#5F7363]">
                  {isPersisted
                    ? "Your browser protects these discoveries from disk eviction."
                    : "Browsers may clear storage under extreme disk space constraints."}
                </p>
              </div>
              {!isPersisted && (
                <button
                  type="button"
                  onClick={handleRequestPersistence}
                  className="px-3 py-1.5 rounded-full bg-[#E4EEDF] hover:bg-[#D2E3CE] text-[#294B36] font-bold text-xs self-start cursor-pointer transition-all"
                >
                  Request Persistent Retention
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#DCE5D8]">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F5F8F1] hover:bg-[#E4EEDF] text-[#1E3526] border border-[#DCE5D8] rounded-full text-xs font-bold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#3E6548]" />
              <span>Export Local Backup (.json)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F5F8F1] hover:bg-[#E4EEDF] text-[#1E3526] border border-[#DCE5D8] rounded-full text-xs font-bold transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#3E6548]" />
              <span>Import Backup</span>
            </button>

            <button
              type="button"
              onClick={handleScanDuplicates}
              disabled={isProcessing || isScanningDuplicates || entries.length < 2}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#F5F8F1] text-[#294B36] border border-[#DCE5D8] rounded-full text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Scan all entered photos in the database for duplicates"
            >
              <Copy className="w-3.5 h-3.5 text-[#3E6548]" />
              <span>{isScanningDuplicates ? "Scanning..." : "Scan for Duplicate Photos"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLegacyMigration(!showLegacyMigration)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#F5F8F1] text-[#5F7363] border border-[#DCE5D8] rounded-full text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Legacy Cloud Import</span>
            </button>

            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={isProcessing || entries.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-bold transition-all ml-auto cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Clear All Local Discoveries</span>
            </button>
          </div>

          {/* Legacy Migration Panel */}
          {showLegacyMigration && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Safe Legacy Migration</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                If you have older discoveries stored in your cloud account from previous versions, you can copy them into this device&apos;s IndexedDB journal. Your original server records will remain untouched.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleMigrateFromLegacyCloud}
                  disabled={isMigrating}
                  className="px-4 py-1.5 bg-[#294B36] text-white rounded-full text-xs font-bold hover:bg-[#1E3526] cursor-pointer disabled:opacity-50"
                >
                  {isMigrating ? "Copying discoveries..." : "Import Cloud Discoveries to Device"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLegacyMigration(false)}
                  className="px-3 py-1.5 text-xs text-[#5F7363] hover:text-[#1E3526] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Single Discovery Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-border shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#1E3526]">Delete Discovery?</h3>
            <p className="text-sm text-[#5F7363] leading-relaxed">
              This discovery will be permanently removed from this device&apos;s local storage. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-full border border-[#DCE5D8] text-xs font-bold text-[#5F7363] hover:bg-[#F5F8F1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDiscovery}
                disabled={isProcessing}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-border shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg font-bold text-[#1E3526]">Clear All Local Discoveries?</h3>
            </div>
            <p className="text-sm text-[#5F7363] leading-relaxed">
              Are you sure you want to clear all {entries.length} discoveries from this device? Make sure you have exported a backup if you wish to keep them.
            </p>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-full border border-[#DCE5D8] text-xs font-bold text-[#5F7363] hover:bg-[#F5F8F1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isProcessing}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? "Clearing..." : "Yes, Clear All Discoveries"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Photos Management Modal */}
      {showDuplicateModal && duplicateGroups && duplicateGroups.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-[#DCE5D8] shadow-2xl flex flex-col gap-5 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1E3526]">Duplicate Photos in Database</h3>
                  <p className="text-xs text-[#5F7363]">
                    Found {duplicateGroups.length} duplicate photo group{duplicateGroups.length > 1 ? "s" : ""} among your entered discoveries.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="text-xs font-bold text-[#5F7363] hover:text-[#1E3526] p-2 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {duplicateGroups.map((group, gIdx) => (
                <div key={gIdx} className="p-4 rounded-2xl bg-[#F5F8F1] border border-[#DCE5D8] flex flex-col gap-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#3E6548]">
                    Duplicate Group #{gIdx + 1}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Original Entry */}
                    <div className="p-3 bg-white rounded-xl border border-[#DCE5D8] flex items-center gap-3">
                      {objectUrls[group.original.id] && (
                        <img
                          src={objectUrls[group.original.id]}
                          alt="Primary"
                          className="w-14 h-14 rounded-lg object-cover border border-[#DCE5D8] shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-[#294B36]">Primary Entry</span>
                        <div className="font-bold text-sm text-[#1E3526] truncate">
                          {group.original.analysis?.candidateCommonName || group.original.category}
                        </div>
                        <div className="text-[11px] text-[#5F7363]">
                          {new Date(group.original.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Duplicates */}
                    {group.duplicates.map((dup) => (
                      <div key={dup.id} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center gap-3">
                        {objectUrls[dup.id] && (
                          <img
                            src={objectUrls[dup.id]}
                            alt="Duplicate"
                            className="w-14 h-14 rounded-lg object-cover border border-amber-200 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-amber-800">Duplicate Copy</span>
                          <div className="font-bold text-sm text-[#1E3526] truncate">
                            {dup.analysis?.candidateCommonName || dup.category}
                          </div>
                          <div className="text-[11px] text-[#5F7363]">
                            {new Date(dup.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDuplicateEntry(dup.id)}
                          disabled={isProcessing}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete duplicate copy"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#DCE5D8]">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="px-5 py-2.5 rounded-full bg-[#294B36] text-white text-xs font-bold hover:bg-[#1E3526] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Controls: Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[#5F7363]" />
          </div>
          <input
            type="text"
            placeholder="Search local discoveries..."
            value={searchQuery}
            onChange={(e) => startTransition(() => setSearchQuery(e.target.value))}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#DCE5D8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#294B36] text-sm text-[#1E3526] placeholder-[#5F7363]/70"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
          <div className="flex items-center gap-1 text-[#5F7363] text-sm font-medium pr-2 border-r border-[#DCE5D8]">
            <Filter className="w-4 h-4" />
          </div>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat
                  ? "bg-[#294B36] text-white shadow-xs"
                  : "bg-white text-[#1E3526] border border-[#DCE5D8] hover:border-[#294B36] hover:bg-[#F5F8F1]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Discoveries Grid or Empty State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-4 border-[#DCE5D8] border-t-[#294B36] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#5F7363]">Opening your local nature journal...</p>
        </div>
      ) : filteredEntries.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredEntries.map((entry) => {
            const title =
              entry.analysis?.candidateCommonName ||
              entry.analysis?.candidateScientificName ||
              entry.analysis?.candidateIdentification ||
              entry.memoryCard?.title ||
              "Nature Specimen";

            const formattedDate = new Date(entry.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            const imageUrl = objectUrls[entry.id];

            return (
              <div
                key={entry.id}
                className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-[#DCE5D8] shadow-xs hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative"
              >
                {/* Photo Thumbnail */}
                <Link href={`/insight?id=${entry.id}`} className="block h-36 bg-[#E4EEDF] relative overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Leaf className="w-10 h-10 text-[#5F7363] opacity-40" />
                    </div>
                  )}

                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold uppercase tracking-wider text-white">
                    {entry.category || "specimen"}
                  </div>
                </Link>

                {/* Card Content */}
                <div className="p-4 flex flex-col flex-1">
                  <Link href={`/insight?id=${entry.id}`}>
                    <h3 className="font-bold text-[#1E3526] mb-1 group-hover:text-[#294B36] transition-colors truncate">
                      {title}
                    </h3>
                  </Link>

                  <p className="text-[11px] text-[#5F7363] mb-3">{formattedDate}</p>

                  {entry.notes && (
                    <p className="text-xs text-[#38483B] line-clamp-2 mb-3 italic">
                      &quot;{entry.notes}&quot;
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-2 border-t border-[#DCE5D8]/60">
                    <Link
                      href={`/insight?id=${entry.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#294B36] hover:underline"
                    >
                      View Insight <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(entry.id)}
                      className="p-1.5 text-[#5F7363] hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                      title="Delete discovery"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-white/70 rounded-3xl border border-dashed border-[#DCE5D8] mt-4 p-6">
          <div className="w-16 h-16 rounded-full bg-[#E4EEDF] flex items-center justify-center text-[#294B36]">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1E3526]">
              {searchQuery || activeCategory !== "All" ? "No matching discoveries found" : "Your Journal is Empty"}
            </h3>
            <p className="text-[#5F7363] text-sm max-w-sm mt-1">
              {searchQuery || activeCategory !== "All"
                ? "Try adjusting your filters or search terms."
                : "Your discoveries will be saved directly on this device. Start exploring nature and reveal secrets to begin."}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <Link
              href="/discover"
              className="px-6 py-2.5 bg-[#294B36] hover:bg-[#1E3526] text-white font-bold rounded-full text-sm transition-all shadow-xs"
            >
              Start Discovering
            </Link>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-white border border-[#DCE5D8] text-[#1E3526] hover:bg-[#F5F8F1] font-bold rounded-full text-sm transition-all shadow-xs cursor-pointer"
            >
              Import Backup
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
