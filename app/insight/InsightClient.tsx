/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, CheckCircle2, Leaf, Globe, Sparkles, BookOpen, Share2, 
  BookmarkPlus, Trash2, Edit3, X, Save, Code, Copy, Check, AlertTriangle 
} from "lucide-react";
import { InsightSection } from "@/components/InsightSection";
import { QuestCard } from "@/components/QuestCard";
import { PartyPopper } from "@/components/PartyPopper";
import { FormattedText } from "@/components/FormattedText";
import { sanitizeInsightData } from "@/lib/clean-insight";
import { Suspense, useEffect, useState, useRef } from "react";
import { 
  getDraftDiscovery, 
  saveDiscovery, 
  getDiscoveryById, 
  updateDiscovery, 
  deleteDiscovery,
  clearDraftDiscovery,
  getAllDiscoveries,
  type LocalDiscovery,
  type IdentificationContract,
  type QuestMatchContract,
  type VisibleEvidenceContractItem,
  type NatureFactContractItem,
  type EcologicalRoleContract,
  type WisdomAndReflectionContract,
  type ReflectionContract
} from "@/lib/client/journal-db";

export interface InsightData {
  possibleIdentification: IdentificationContract;
  questMatch?: QuestMatchContract | null;
  visibleEvidence: VisibleEvidenceContractItem[];
  natureFacts: NatureFactContractItem[];
  ecologicalRole: EcologicalRoleContract;
  wisdomAndReflection: WisdomAndReflectionContract;
  reflection: ReflectionContract;
  safetyNote: string | null;

  name: string;
  scientificName: string;
  confidence: string;
  image: string;
  facts: string[];
  ecologicalImportance: string;
  ecologicalNeed: string | null;
  characteristic: string;
  lifeLesson: string;
  quote: string | null;
  reflectionQuestion: string;
  detectedMood: string | null;
}

export function InsightClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  
  const [data, setData] = useState<InsightData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const savedSuccessRef = useRef(false);

  const [localDiscovery, setLocalDiscovery] = useState<LocalDiscovery | null>(null);
  const [rawContractJson, setRawContractJson] = useState<Record<string, unknown> | null>(null);
  const [dailyQuest, setDailyQuest] = useState<{ title: string; description: string; reward: number; date: string } | null>(null);
  const [questMatchInfo, setQuestMatchInfo] = useState<{ 
    matched: boolean; 
    score: number; 
    bonusXp: number; 
    reason?: string;
    questMatchScore?: number;
    questMatchStatus?: "strong_match" | "partial_match" | "insufficient_match";
    matchedRequirements?: string[];
    missingRequirements?: string[];
    matchExplanation?: string;
    retrySuggestion?: string | null;
  } | null>(null);

  const [showPartyPopper, setShowPartyPopper] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Developer JSON Inspector
  const [showDevJson, setShowDevJson] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState("plant");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track created object URL for memory cleanup
  const objectUrlRef = useRef<string | null>(null);

  // Automatically delete unsaved draft from DB if user navigates away without saving
  useEffect(() => {
    return () => {
      if (id === "new" && !savedSuccessRef.current) {
        clearDraftDiscovery().catch(() => {});
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("earthlens_current_discovery");
        }
      }
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const setObjectUrl = (url: string) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = url;
    setData((prev) => (prev ? { ...prev, image: url } : null));
  };

  const handleCopyJson = () => {
    if (!rawContractJson) return;
    navigator.clipboard.writeText(JSON.stringify(rawContractJson, null, 2)).then(() => {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    });
  };

  useEffect(() => {
    // Verify authentication
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          window.location.href = "/login";
        }
      })
      .catch(() => {});

    async function loadInsightData() {
      // 1. Fetch today's active quest
      try {
        const qRes = await fetch("/api/quest/daily");
        const qJson = await qRes.json();
        if (qJson.success && qJson.data) {
          setDailyQuest(qJson.data);
        }
      } catch (e) {
        console.warn("Failed to load daily quest", e);
      }

      // 2. Load discovery details
      if (id === "new" || !id) {
        try {
          const draft = await getDraftDiscovery();
          if (draft && draft.analysis) {
            setLocalDiscovery(draft);
            setEditNotes(draft.notes || "");
            setEditCategory(draft.category || "plant");

            let photoUrl = "";
            if (draft.imageBlob) {
              photoUrl = URL.createObjectURL(draft.imageBlob);
              setObjectUrl(photoUrl);
            }

            const clean = sanitizeInsightData(draft.analysis);
            setRawContractJson(draft.analysis as Record<string, unknown>);

            const qm = draft.questMatch || clean.questMatch;
            if (qm) {
              const scoreNum = qm.questMatchScore ?? qm.score ?? 0;
              setQuestMatchInfo({
                matched: scoreNum >= 70,
                score: scoreNum,
                bonusXp: scoreNum >= 70 ? (draft.questMatch?.bonusXp || 50) : 0,
                reason: qm.matchExplanation || qm.explanation || qm.reason,
                questMatchScore: scoreNum,
                questMatchStatus: qm.questMatchStatus || qm.status || (scoreNum >= 90 ? "strong_match" : scoreNum >= 70 ? "partial_match" : "insufficient_match"),
                matchedRequirements: qm.matchedRequirements || [],
                missingRequirements: qm.missingRequirements || [],
                matchExplanation: qm.matchExplanation || qm.explanation || qm.reason,
                retrySuggestion: qm.retrySuggestion,
              });
              if (scoreNum >= 70) {
                setShowPartyPopper(true);
              }
            }

            setData({
              ...clean,
              image: photoUrl,
            });
            setIsLoading(false);
            return;
          }
        } catch (dbErr) {
          console.warn("Could not load draft from IndexedDB, trying sessionStorage fallback:", dbErr);
        }

        // Fallback to sessionStorage
        try {
          const stored = typeof window !== "undefined" ? sessionStorage.getItem("earthlens_current_discovery") : null;
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.analysis) {
              const clean = sanitizeInsightData(parsed.analysis);
              setRawContractJson(parsed.analysis as Record<string, unknown>);

              const qm = parsed.questMatch || clean.questMatch;
              if (qm) {
                const scoreNum = qm.questMatchScore ?? qm.score ?? 0;
                setQuestMatchInfo({
                  matched: scoreNum >= 70,
                  score: scoreNum,
                  bonusXp: scoreNum >= 70 ? (parsed.questMatch?.bonusXp || 50) : 0,
                  reason: qm.matchExplanation || qm.explanation || qm.reason,
                  questMatchScore: scoreNum,
                  questMatchStatus: qm.questMatchStatus || qm.status || (scoreNum >= 90 ? "strong_match" : scoreNum >= 70 ? "partial_match" : "insufficient_match"),
                  matchedRequirements: qm.matchedRequirements || [],
                  missingRequirements: qm.missingRequirements || [],
                  matchExplanation: qm.matchExplanation || qm.explanation || qm.reason,
                  retrySuggestion: qm.retrySuggestion,
                });
                if (scoreNum >= 70) setShowPartyPopper(true);
              }

              setData({
                ...clean,
                image: parsed.imageUrl || "",
              });
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error("Failed to load discovery from storage:", err);
        }

        setIsLoading(false);
        setFetchError("Data fetching went wrong. Please try again after some time.");
        return;
      } else {
        // Saved discovery: Check IndexedDB first
        try {
          const savedDoc = await getDiscoveryById(id);
          if (savedDoc && savedDoc.analysis) {
            setLocalDiscovery(savedDoc);
            setEditNotes(savedDoc.notes || "");
            setEditCategory(savedDoc.category || "plant");

            let photoUrl = "";
            if (savedDoc.imageBlob) {
              photoUrl = URL.createObjectURL(savedDoc.imageBlob);
              setObjectUrl(photoUrl);
            }

            const clean = sanitizeInsightData(savedDoc.analysis);
            setRawContractJson(savedDoc.analysis as Record<string, unknown>);

            const qm = savedDoc.questMatch || clean.questMatch;
            if (qm) {
              const scoreNum = qm.questMatchScore ?? qm.score ?? 0;
              setQuestMatchInfo({
                matched: scoreNum >= 70,
                score: scoreNum,
                bonusXp: scoreNum >= 70 ? (savedDoc.questMatch?.bonusXp || 50) : 0,
                reason: qm.matchExplanation || qm.explanation || qm.reason,
                questMatchScore: scoreNum,
                questMatchStatus: qm.questMatchStatus || qm.status || (scoreNum >= 90 ? "strong_match" : scoreNum >= 70 ? "partial_match" : "insufficient_match"),
                matchedRequirements: qm.matchedRequirements || [],
                missingRequirements: qm.missingRequirements || [],
                matchExplanation: qm.matchExplanation || qm.explanation || qm.reason,
                retrySuggestion: qm.retrySuggestion,
              });
            }

            setData({
              ...clean,
              image: photoUrl,
            });
            setIsLoading(false);
            return;
          }
        } catch (dbErr) {
          console.warn("IndexedDB fetch failed, trying legacy API:", dbErr);
        }

        // Legacy cloud fallback
        if (id.length === 24) {
          try {
            const res = await fetch(`/api/journal/${id}`);
            const resJson = await res.json();
            if (resJson.success && resJson.data && resJson.data.analysis) {
              const doc = resJson.data;
              const clean = sanitizeInsightData(doc.analysis);
              setRawContractJson(doc.analysis as Record<string, unknown>);

              const qm = doc.questMatch || clean.questMatch;
              if (qm) {
                const scoreNum = qm.questMatchScore ?? qm.score ?? 0;
                setQuestMatchInfo({
                  matched: scoreNum >= 70,
                  score: scoreNum,
                  bonusXp: scoreNum >= 70 ? (doc.questMatch?.bonusXp || 50) : 0,
                  reason: qm.matchExplanation || qm.explanation || qm.reason,
                  questMatchScore: scoreNum,
                  questMatchStatus: qm.questMatchStatus || qm.status || (scoreNum >= 90 ? "strong_match" : scoreNum >= 70 ? "partial_match" : "insufficient_match"),
                  matchedRequirements: qm.matchedRequirements || [],
                  missingRequirements: qm.missingRequirements || [],
                  matchExplanation: qm.matchExplanation || qm.explanation || qm.reason,
                  retrySuggestion: qm.retrySuggestion,
                });
              }

              setData({
                ...clean,
                image: doc.observation?.photoUrl || "",
              });
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.error("Failed to load discovery from legacy API:", err);
          }
        }

        setIsLoading(false);
        setFetchError("Data fetching went wrong. Please try again after some time.");
      }
    }

    void loadInsightData();
  }, [id]);

  // Discard unsaved discovery & delete from DB immediately
  const handleDiscardDiscovery = async () => {
    savedSuccessRef.current = true;
    try {
      await clearDraftDiscovery();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("earthlens_current_discovery");
      }
    } catch (e) {
      console.warn("Error discarding draft discovery:", e);
    }
    router.push("/journal");
  };

  // Save to IndexedDB
  const handleSaveToJournal = async () => {
    if (!localDiscovery) {
      try {
        const draft = await getDraftDiscovery();
        if (draft) {
          setLocalDiscovery(draft);
        } else {
          setErrorMessage("No pending draft discovery found to save.");
          return;
        }
      } catch {
        setErrorMessage("Could not access pending discovery.");
        return;
      }
    }

    const docToSave = localDiscovery;
    if (!docToSave) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await saveDiscovery(docToSave);
      savedSuccessRef.current = true;
      await clearDraftDiscovery().catch(() => {});
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("earthlens_current_discovery");
      }

      try {
        const allLocal = await getAllDiscoveries();
        await fetch("/api/user/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discoveriesCount: allLocal.length }),
        });
      } catch (syncErr) {
        console.warn("Could not sync discoveriesCount to cloud account:", syncErr);
      }

      setSavedSuccess(true);
      router.replace(`/insight?id=${docToSave.id}`);
    } catch (err) {
      console.error("Failed to save to local journal:", err);
      setErrorMessage((err as Error).message || "Failed to save to device journal.");
    } finally {
      setIsSaving(false);
    }
  };

  // Local Update Handler
  const handleSaveEdit = async () => {
    if (!id || id === "new") return;
    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const updated = await updateDiscovery(id, {
        notes: editNotes,
        category: editCategory,
      });
      setLocalDiscovery(updated);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update discovery:", err);
      setErrorMessage((err as Error).message || "Failed to update discovery.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Local Delete Handler
  const handleDelete = async () => {
    if (!id || id === "new") return;
    setIsDeleting(true);

    try {
      await deleteDiscovery(id);
      try {
        const allLocal = await getAllDiscoveries();
        await fetch("/api/user/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discoveriesCount: allLocal.length }),
        });
      } catch (syncErr) {
        console.warn("Could not sync discoveriesCount after delete:", syncErr);
      }
      router.push("/journal");
    } catch (err) {
      console.error("Failed to delete discovery:", err);
      setErrorMessage((err as Error).message || "Failed to delete discovery.");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 max-w-lg w-full mx-auto p-8 flex flex-col items-center justify-center text-center gap-4 my-auto animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-[#E4EEDF] flex items-center justify-center animate-pulse text-[#294B36]">
          <Sparkles className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-xl font-serif font-bold text-[#1E3526]">Examining Field Photograph</h2>
        <p className="text-sm text-[#5F7363]">
          Deriving taxonomic identity, observable traits, and nature reflections...
        </p>
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <div className="flex-1 max-w-md w-full mx-auto p-8 flex flex-col items-center justify-center text-center gap-4 my-auto bg-white rounded-2xl border border-[#E5EAE3] shadow-sm animate-in fade-in duration-300">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-serif font-bold text-[#1E3526]">Data Fetching Failed</h2>
        <p className="text-sm text-[#5F7363]">
          {fetchError || "Data fetching went wrong. Please try again after some time."}
        </p>
        <Link
          href="/discover"
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-[#294B36] hover:bg-[#1E3526] text-white rounded-full text-sm font-semibold transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 animate-in fade-in duration-500">
      
      <header className="flex items-center justify-between flex-wrap gap-3">
        {id === "new" && !savedSuccess ? (
          <button 
            type="button"
            onClick={handleDiscardDiscovery}
            className="inline-flex items-center gap-2 text-[#5F7363] hover:text-[#1E3526] transition-colors text-sm font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Field Journal
          </button>
        ) : (
          <Link 
            href="/journal" 
            className="inline-flex items-center gap-2 text-[#5F7363] hover:text-[#1E3526] transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Field Journal
          </Link>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {id === "new" && !savedSuccess && (
            <>
              <button
                type="button"
                onClick={handleSaveToJournal}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#294B36] hover:bg-[#1E3526] text-white rounded-full text-sm font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <BookmarkPlus className="w-4 h-4 text-[#D2E3CE]" />
                <span className="text-white font-bold">{isSaving ? "Saving..." : "Save to Journal"}</span>
              </button>

              <button
                type="button"
                onClick={handleDiscardDiscovery}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-200 hover:border-red-400 text-red-600 rounded-full text-sm font-semibold transition-all shadow-xs cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>Discard Photo</span>
              </button>
            </>
          )}

          {savedSuccess && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E4EEDF] text-[#294B36] text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved to Device!
            </span>
          )}

          {id && id !== "new" && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#DCE5D8] hover:border-[#294B36] text-[#294B36] rounded-full text-sm font-bold transition-all shadow-xs cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-[#3E6548]" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-200 hover:border-red-500 text-red-600 rounded-full text-sm font-bold transition-all shadow-xs cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>Delete</span>
              </button>
            </>
          )}

          <Link 
            href={`/studio?id=${id || "new"}`} 
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#DCE5D8] hover:border-[#294B36] text-[#294B36] rounded-full text-sm font-bold transition-all shadow-xs"
          >
            <Share2 className="w-4 h-4 text-[#3E6548]" />
            <span>Memory Card</span>
          </Link>
        </div>
      </header>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-border shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-forest">Delete Discovery?</h3>
            <p className="text-sm text-sage">
              This discovery will be permanently removed from your device&apos;s local storage. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-full border border-border text-sm font-semibold hover:bg-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal / Drawer */}
      {isEditing && (
        <div className="p-5 rounded-2xl bg-[#F5F8F1] border border-[#DCE5D8] flex flex-col gap-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#1E3526] text-base">Edit Field Notes & Category</h3>
            <button 
              onClick={() => setIsEditing(false)} 
              className="text-[#5F7363] hover:text-[#1E3526] p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-[#5F7363]">Category</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="bg-white border border-[#DCE5D8] rounded-xl px-3 py-2 text-sm text-[#1E3526] focus:outline-none focus:ring-1 focus:ring-[#294B36]"
            >
              <option value="plant">Plant</option>
              <option value="animal">Animal</option>
              <option value="insect">Insect</option>
              <option value="bird">Bird</option>
              <option value="fungi">Fungi</option>
              <option value="landscape">Landscape</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-[#5F7363]">Field Notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Record your field observations, weather conditions, or location..."
              className="w-full bg-white border border-[#DCE5D8] rounded-xl p-3 text-sm min-h-[90px] focus:outline-none focus:ring-1 focus:ring-[#294B36] resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-full border border-[#DCE5D8] text-xs font-bold text-[#5F7363] hover:bg-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#294B36] hover:bg-[#1E3526] text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isUpdating ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Image & Title (from possibleIdentification) */}
      <div className="relative h-64 md:h-80 w-full rounded-3xl overflow-hidden shadow-md bg-[#E4EEDF]">
        {data.image ? (
          <img 
            src={data.image} 
            alt={data.name} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#294B36] to-[#1E3526] flex items-center justify-center">
            <Leaf className="w-16 h-16 text-[#D2E3CE]/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex flex-col justify-end p-6">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#294B36]/80 text-[#D2E3CE] border border-[#D2E3CE]/30 text-xs font-semibold backdrop-blur-md">
              <CheckCircle2 className="w-3 h-3" />
              {data.possibleIdentification?.confidence ?? 85}% Visual Confidence
            </div>
            {(data.possibleIdentification?.category || localDiscovery?.category) && (
              <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-white/90 text-xs uppercase tracking-wider font-semibold backdrop-blur-md">
                {data.possibleIdentification?.category || localDiscovery?.category}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-1 font-serif">{data.name}</h1>
          {data.scientificName && (
            <p className="text-white/90 italic text-sm">{data.scientificName}</p>
          )}
          {data.possibleIdentification?.identificationNotes && (
            <p className="text-white/75 text-xs mt-1 max-w-xl line-clamp-2">
              {data.possibleIdentification.identificationNotes}
            </p>
          )}
        </div>
      </div>

      {data.safetyNote && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 shadow-xs">
          <span className="font-bold">⚠️ Field Safety Caution:</span>
          <span>{data.safetyNote}</span>
        </div>
      )}

      {localDiscovery?.notes && (
        <div className="p-4 rounded-2xl bg-white border border-[#DCE5D8] shadow-xs">
          <h4 className="text-xs font-bold uppercase text-[#5F7363] mb-1">Field Notes</h4>
          <p className="text-sm text-[#1E3526] leading-relaxed">{localDiscovery.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-1">
        {/* Left Column: Nature Facts & Ecological Role */}
        <div className="flex flex-col gap-6">
          <InsightSection icon={<Leaf className="w-5 h-5 text-[#3E6548]" />} title="Nature Facts">
            {/* Observable Visual Evidence */}
            {data.visibleEvidence && data.visibleEvidence.length > 0 && (
              <div className="mb-3.5 flex flex-wrap gap-1.5">
                {data.visibleEvidence.map((ev, i) => (
                  <span 
                    key={i} 
                    className="px-2.5 py-1 rounded-xl bg-[#E4EEDF] text-[#294B36] border border-[#D2E3CE] text-xs font-medium flex items-center gap-1.5"
                    title={ev.significance}
                  >
                    <span>🔍</span>
                    <span className="font-semibold">{ev.observation}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Structured Nature Facts */}
            <ul className="space-y-3 text-sm text-[#38483B]">
              {data.natureFacts && data.natureFacts.length > 0 ? (
                data.natureFacts.map((fact, i) => (
                  <li key={i} className="p-3 bg-[#F5F8F1] rounded-2xl border border-[#E2EAE0]">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-[#1E3526] text-xs sm:text-sm">{fact.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        fact.evidenceType === "observed" ? "bg-emerald-100 text-emerald-800" :
                        fact.evidenceType === "established_fact" ? "bg-[#E4EEDF] text-[#294B36]" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        {fact.evidenceType === "observed" ? "Observed" : fact.evidenceType === "established_fact" ? "Verified Fact" : "Interpretation"}
                      </span>
                    </div>
                    <p className="text-xs text-[#38483B] leading-relaxed">
                      <FormattedText text={fact.detail} />
                    </p>
                  </li>
                ))
              ) : (
                data.facts.map((fact, i) => (
                  <li key={i}>
                    <FormattedText text={fact} />
                  </li>
                ))
              )}
            </ul>
          </InsightSection>
          
          <InsightSection icon={<Globe className="w-5 h-5 text-[#3E6548]" />} title="Ecological Role">
            {data.ecologicalRole?.title && (
              <h4 className="text-sm font-bold text-[#1E3526] mb-1.5">{data.ecologicalRole.title}</h4>
            )}
            <FormattedText as="p" text={data.ecologicalRole?.description || data.ecologicalImportance} className="text-sm text-[#38483B] leading-relaxed" />
            
            {(data.ecologicalRole?.ecologicalNeed || data.ecologicalNeed) && (
              <div className="mt-3 pt-3 border-t border-[#DCE5D8]">
                <h5 className="text-xs font-bold uppercase text-[#5F7363] mb-1">Conservation & Habitat Need</h5>
                <p className="text-xs text-[#38483B] leading-relaxed">
                  {data.ecologicalRole?.ecologicalNeed || data.ecologicalNeed}
                </p>
                {data.ecologicalRole?.conservationNote && (
                  <p className="text-[11px] text-[#5F7363] italic mt-1">{data.ecologicalRole.conservationNote}</p>
                )}
              </div>
            )}
          </InsightSection>
        </div>

        {/* Right Column: Wisdom & Reflection + Personal Reflection */}
        <div className="flex flex-col gap-6">
          <InsightSection icon={<Sparkles className="w-5 h-5 text-[#3E6548]" />} title="Wisdom & Reflection" variant="highlight">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="font-bold text-[#3E6548] uppercase text-xs tracking-wider">
                Theme: {data.wisdomAndReflection?.theme || data.characteristic}
              </span>
              {(data.wisdomAndReflection?.toneUsed || data.detectedMood) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E4EEDF] text-[#294B36] border border-[#D2E3CE] text-xs font-semibold">
                  🌱 Tone: {data.wisdomAndReflection?.toneUsed || data.detectedMood}
                </span>
              )}
            </div>

            {/* Prominent Original Quote */}
            {(data.wisdomAndReflection?.quote || data.quote) && (
              <blockquote className="text-base font-serif font-semibold text-[#1E3526] italic mb-3 border-l-3 border-[#294B36] pl-3 py-1">
                &ldquo;<FormattedText text={data.wisdomAndReflection?.quote || data.quote || ""} />&rdquo;
              </blockquote>
            )}

            {/* Life Connection Paragraph beneath quote */}
            <FormattedText 
              as="p" 
              text={data.wisdomAndReflection?.lifeConnection || data.lifeLesson} 
              className="text-sm text-[#38483B] leading-relaxed" 
            />

            {data.wisdomAndReflection?.imageConnection && (
              <p className="text-xs text-[#5F7363] italic mt-2.5">
                Inspired by visible {data.wisdomAndReflection.imageConnection}
              </p>
            )}
          </InsightSection>

          <InsightSection icon={<BookOpen className="w-5 h-5 text-[#3E6548]" />} title="Reflection">
            <h4 className="text-xs font-bold uppercase text-[#5F7363] mb-1">Reflection Question</h4>
            <FormattedText as="p" text={data.reflection?.question || data.reflectionQuestion} className="mb-3 text-sm text-[#38483B] leading-relaxed font-medium" />
            
            {data.reflection?.journalPrompt && (
              <div className="mb-3 p-2.5 rounded-xl bg-[#F5F8F1] border border-[#E2EAE0]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F7363] block mb-0.5">Journal Prompt</span>
                <p className="text-xs text-[#38483B] leading-relaxed">{data.reflection.journalPrompt}</p>
              </div>
            )}

            <textarea 
              placeholder="Write your reflections here..."
              className="w-full bg-white border border-[#DCE5D8] rounded-xl p-3 text-sm min-h-[90px] focus:outline-none focus:ring-1 focus:ring-[#294B36] resize-none"
            />
          </InsightSection>
        </div>
      </div>

      {/* Today's Nature Quest Match Section */}
      <div className="mt-4 mb-2 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1E3526]">Today&apos;s Nature Quest Match</h2>
          {questMatchInfo && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              questMatchInfo.matched 
                ? "bg-[#E4EEDF] text-[#294B36] border border-[#D2E3CE]" 
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}>
              {questMatchInfo.matched 
                ? `🎯 ${questMatchInfo.score}% Match • +${questMatchInfo.bonusXp} Quest Bonus`
                : `${questMatchInfo.score}% Quest Match`}
            </span>
          )}
        </div>
        <QuestCard 
          title={dailyQuest?.title || "Nature Pattern Observation"} 
          description={dailyQuest?.description || "Step outside and document local biodiversity to fulfill today's quest."}
          reward={dailyQuest?.reward || 50}
          completed={questMatchInfo?.matched || false}
          score={questMatchInfo?.score}
          status={questMatchInfo?.questMatchStatus}
          matchedRequirements={questMatchInfo?.matchedRequirements}
          missingRequirements={questMatchInfo?.missingRequirements}
          explanation={questMatchInfo?.matchExplanation || questMatchInfo?.reason}
          retrySuggestion={questMatchInfo?.retrySuggestion}
        />
        {questMatchInfo?.matched && (
          <p className="text-xs font-semibold text-[#294B36] flex items-center gap-1.5 mt-0.5">
            <CheckCircle2 className="w-4 h-4 text-[#3E6548]" />
            Quest completed! You earned {questMatchInfo.score}% match and +{questMatchInfo.bonusXp} bonus XP.
          </p>
        )}
      </div>

      {/* Developer JSON Inspector (Requirement 8) */}
      <div className="mt-2 mb-10 p-4 rounded-2xl bg-white border border-[#DCE5D8] shadow-xs">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowDevJson(!showDevJson)}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5F7363] hover:text-[#1E3526] cursor-pointer"
          >
            <Code className="w-4 h-4 text-[#3E6548]" />
            <span>{showDevJson ? "Hide Developer JSON Contract" : "Inspect Developer JSON Contract"}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#E4EEDF] text-[#294B36] text-[10px]">Validated Schema</span>
          </button>
          {showDevJson && (
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-[#F5F8F1] hover:bg-[#E4EEDF] text-[#294B36] text-xs font-bold transition-all cursor-pointer border border-[#DCE5D8]"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          )}
        </div>
        {showDevJson && (
          <div className="mt-3">
            <p className="text-[11px] text-[#5F7363] mb-2">
              Exact frontend-ready JSON contract produced for this discovery:
            </p>
            <pre className="p-4 bg-[#1E3329] text-[#A3C2A9] rounded-2xl text-xs overflow-x-auto max-h-96 leading-relaxed font-mono border border-[#2C4A3B]">
              {JSON.stringify(rawContractJson || data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Party Popper burst on quest match */}
      {showPartyPopper && questMatchInfo?.matched && (
        <PartyPopper 
          questTitle={dailyQuest?.title || "Today's Nature Quest"}
          matchScore={questMatchInfo.score}
          bonusXp={questMatchInfo.bonusXp || 50}
          onClose={() => setShowPartyPopper(false)}
        />
      )}

    </div>
  );
}
