/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, CheckCircle2, Leaf, Globe, Sparkles, BookOpen, Share2, 
  BookmarkPlus, Trash2, Edit3, X, Save 
} from "lucide-react";
import { InsightSection } from "@/components/InsightSection";
import { QuestCard } from "@/components/QuestCard";
import { PartyPopper } from "@/components/PartyPopper";
import { Suspense, useEffect, useState, useRef } from "react";
import { 
  getDraftDiscovery, 
  clearDraftDiscovery, 
  saveDiscovery, 
  getDiscoveryById, 
  updateDiscovery, 
  deleteDiscovery,
  getAllDiscoveries,
  type LocalDiscovery 
} from "@/lib/client/journal-db";

const FALLBACK_INSIGHT = {
  name: "Monarch Butterfly",
  scientificName: "Danaus plexippus",
  confidence: "High",
  image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&q=80&w=800",
  facts: [
    "Known for their incredible multi-generational migration.",
    "Their orange color warns predators that they are poisonous.",
    "Caterpillars only eat milkweed plants."
  ],
  ecologicalImportance: "Monarchs are important pollinators. Their population health serves as a crucial indicator of ecological changes and environmental well-being.",
  characteristic: "Metamorphosis and endurance",
  lifeLesson: "Just as the Monarch must dissolve completely within its chrysalis to become a butterfly, we too must sometimes let go of our past selves to transform. Their 3,000-mile journey reminds us that incredible feats are possible through persistence.",
  reflectionQuestion: "What is a challenging journey or transformation you are currently undergoing, and how can you find the endurance to complete it?"
};

function InsightContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  
  const [data, setData] = useState(FALLBACK_INSIGHT);
  const [localDiscovery, setLocalDiscovery] = useState<LocalDiscovery | null>(null);
  const [dailyQuest, setDailyQuest] = useState<{ title: string; description: string; reward: number; date: string } | null>(null);
  const [questMatchInfo, setQuestMatchInfo] = useState<{ matched: boolean; score: number; bonusXp: number; reason?: string } | null>(null);
  const [showPartyPopper, setShowPartyPopper] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setData((prev) => ({ ...prev, image: url }));
  };

  useEffect(() => {
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
        // Load pending draft discovery from IndexedDB
        try {
          const draft = await getDraftDiscovery();
          if (draft) {
            setLocalDiscovery(draft);
            setEditNotes(draft.notes || "");
            setEditCategory(draft.category || "plant");

            if (draft.imageBlob) {
              const url = URL.createObjectURL(draft.imageBlob);
              setObjectUrl(url);
            }

            if (draft.questMatch) {
              setQuestMatchInfo({
                matched: !!draft.questMatch.matched,
                score: draft.questMatch.score ?? 0,
                bonusXp: draft.questMatch.bonusXp ?? 0,
                reason: draft.questMatch.reason,
              });
              if (draft.questMatch.matched) {
                setShowPartyPopper(true);
              }
            }

            const a = draft.analysis;
            const specimenName = a?.candidateCommonName || a?.candidateScientificName || "Observation Specimen";
            setData((prev) => ({
              ...prev,
              name: specimenName,
              scientificName: a?.candidateScientificName || "",
              confidence: String(a?.confidence || a?.confidenceLevel || "High"),
              facts: a?.facts && a.facts.length > 0 ? a.facts : [
                `${specimenName} observed in its living biome.`,
                `Possesses specialized adaptations to survive and thrive.`,
                `Forms an integral part of local biodiversity.`
              ],
              ecologicalImportance: a?.ecologicalImportance || a?.ecologicalRole || `${specimenName} occupies a specialized ecological role within its natural community.`,
              characteristic: a?.naturalCharacteristic || a?.characteristic || "Specialized Natural Adaptation",
              lifeLesson: a?.metaphoricalLesson || a?.lifeLesson || `Like the ${specimenName}, our unique traits allow us to flourish even in demanding environments.`,
              reflectionQuestion: a?.reflectionQuestion || `What lessons of patience, resilience, and purpose can you draw from observing ${specimenName}?`,
            }));
            return;
          }
        } catch (dbErr) {
          console.warn("Could not load draft from IndexedDB, trying sessionStorage fallback:", dbErr);
        }

        // Fallback to sessionStorage if IndexedDB draft was empty
        try {
          const stored = typeof window !== "undefined" ? sessionStorage.getItem("earthlens_current_discovery") : null;
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.questMatch) {
              setQuestMatchInfo(parsed.questMatch);
              if (parsed.questMatch.matched) setShowPartyPopper(true);
            }
            const a = parsed.analysis;
            if (a) {
              const specimenName = a.candidateCommonName || a.candidateScientificName || "Observation Specimen";
              setData((prev) => ({
                ...prev,
                name: specimenName,
                scientificName: a.candidateScientificName || "",
                confidence: String(a.confidence || "High"),
                image: parsed.imageUrl || FALLBACK_INSIGHT.image,
                facts: a.facts && a.facts.length > 0 ? a.facts : [
                  `${specimenName} observed in its natural habitat.`,
                  `Possesses unique traits tailored to its environment.`,
                  `Supports the intricate web of surrounding life.`
                ],
                ecologicalImportance: a.ecologicalImportance || `${specimenName} plays a role in regional biodiversity.`,
                characteristic: a.naturalCharacteristic || "Resilience & Growth",
                lifeLesson: a.metaphoricalLesson || `Every natural element flourishes in its own season.`,
                reflectionQuestion: a.reflectionQuestion || `What can we learn from the adaptability of this specimen?`
              }));
            }
          }
        } catch (err) {
          console.error("Failed to load discovery from storage:", err);
        }
      } else {
        // Existing Saved Discovery: Check IndexedDB first
        try {
          const savedDoc = await getDiscoveryById(id);
          if (savedDoc) {
            setLocalDiscovery(savedDoc);
            setEditNotes(savedDoc.notes || "");
            setEditCategory(savedDoc.category || "plant");

            if (savedDoc.imageBlob) {
              const url = URL.createObjectURL(savedDoc.imageBlob);
              setObjectUrl(url);
            }

            if (savedDoc.questMatch) {
              setQuestMatchInfo({
                matched: !!savedDoc.questMatch.matched,
                score: savedDoc.questMatch.score ?? 0,
                bonusXp: savedDoc.questMatch.bonusXp ?? 0,
                reason: savedDoc.questMatch.reason,
              });
            }

            const a = savedDoc.analysis;
            const specimenName = a?.candidateCommonName || a?.candidateScientificName || "Observation Specimen";
            setData((prev) => ({
              ...prev,
              name: specimenName,
              scientificName: a?.candidateScientificName || "",
              confidence: String(a?.confidence || a?.confidenceLevel || "High"),
              facts: a?.facts && a.facts.length > 0 ? a.facts : [
                `${specimenName} documented in your local journal.`,
                `Preserved securely on your device.`,
                `Forms an integral part of local biodiversity.`
              ],
              ecologicalImportance: a?.ecologicalImportance || a?.ecologicalRole || `${specimenName} occupies a specialized ecological role within its natural community.`,
              characteristic: a?.naturalCharacteristic || a?.characteristic || "Specialized Natural Adaptation",
              lifeLesson: a?.metaphoricalLesson || a?.lifeLesson || `Nature reminds us that adaptability fosters resilience.`,
              reflectionQuestion: a?.reflectionQuestion || `What personal reflections does this encounter inspire today?`,
            }));
            return;
          }
        } catch (dbErr) {
          console.warn("IndexedDB fetch failed, trying legacy API:", dbErr);
        }

        // Legacy cloud fallback if ID is from older MongoDB setup
        if (id.length === 24) {
          try {
            const res = await fetch(`/api/journal/${id}`);
            const resJson = await res.json();
            if (resJson.success && resJson.data) {
              const doc = resJson.data;
              if (doc.questMatch) setQuestMatchInfo(doc.questMatch);
              const a = doc.analysis;
              const specimenName = a?.candidateCommonName || a?.candidateScientificName || "Observation Specimen";
              setData((prev) => ({
                ...prev,
                name: specimenName,
                scientificName: a?.candidateScientificName || "",
                confidence: String(a?.confidence || "High"),
                image: doc.observation?.photoUrl || FALLBACK_INSIGHT.image,
                facts: a?.facts && a.facts.length > 0 ? a.facts : [`${specimenName} observed in nature.`],
                ecologicalImportance: a?.ecologicalImportance || `${specimenName} occupies a specialized niche.`,
                characteristic: a?.naturalCharacteristic || "Specialized Adaptation",
                lifeLesson: a?.metaphoricalLesson || `Nature teaches us persistence.`,
                reflectionQuestion: a?.reflectionQuestion || `How does this observation inspire you?`,
              }));
            }
          } catch (err) {
            console.error("Failed to load legacy discovery:", err);
          }
        }
      }
    }

    void loadInsightData();
  }, [id]);

  // Save to IndexedDB (100% free device-local storage)
  const handleSaveToJournal = async () => {
    if (!localDiscovery) {
      // If only sessionStorage metadata was available
      router.push("/journal");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const newId = crypto.randomUUID();
      await saveDiscovery({
        ...localDiscovery,
        id: newId,
        category: editCategory || localDiscovery.category || "plant",
        notes: editNotes || localDiscovery.notes || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Clear draft once safely committed to local discoveries
      await clearDraftDiscovery();

      // Sync discoveries count with server
      try {
        const allLocal = await getAllDiscoveries();
        await fetch("/api/user/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discoveriesCount: allLocal.length }),
        });
      } catch (syncErr) {
        console.warn("Could not sync discoveriesCount after save:", syncErr);
      }

      setSavedSuccess(true);
      setTimeout(() => {
        router.push("/journal");
      }, 1200);
    } catch (err) {
      console.error("Failed to save to local journal:", err);
      setErrorMessage((err as Error).message || "Failed to save discovery to device storage.");
      setIsSaving(false);
    }
  };

  // Local Edit Handler
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

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 animate-in fade-in duration-500">
      
      <header className="flex items-center justify-between flex-wrap gap-3">
        <Link 
          href="/journal" 
          className="inline-flex items-center gap-2 text-[#5F7363] hover:text-[#1E3526] transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Field Journal
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {id === "new" && !savedSuccess && (
            <button
              type="button"
              onClick={handleSaveToJournal}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#294B36] hover:bg-[#1E3526] text-white rounded-full text-sm font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <BookmarkPlus className="w-4 h-4 text-[#D2E3CE]" />
              <span className="text-white font-bold">{isSaving ? "Saving..." : "Save to Journal"}</span>
            </button>
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

      {/* Hero Image & Title */}
      <div className="relative h-64 md:h-80 w-full rounded-3xl overflow-hidden shadow-md bg-[#E4EEDF]">
        <img 
          src={data.image} 
          alt={data.name} 
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#294B36]/80 text-[#D2E3CE] border border-[#D2E3CE]/30 text-xs font-semibold backdrop-blur-md">
              <CheckCircle2 className="w-3 h-3" />
              {data.confidence} Confidence
            </div>
            {localDiscovery?.category && (
              <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-white/90 text-xs uppercase tracking-wider font-semibold backdrop-blur-md">
                {localDiscovery.category}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-1">{data.name}</h1>
          {data.scientificName && (
            <p className="text-white/90 italic text-sm">{data.scientificName}</p>
          )}
        </div>
      </div>

      {localDiscovery?.notes && (
        <div className="p-4 rounded-2xl bg-white border border-[#DCE5D8] shadow-xs">
          <h4 className="text-xs font-bold uppercase text-[#5F7363] mb-1">Field Notes</h4>
          <p className="text-sm text-[#1E3526] leading-relaxed">{localDiscovery.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-1">
        <div className="flex flex-col gap-6">
          <InsightSection icon={<Leaf className="w-5 h-5 text-[#3E6548]" />} title="Nature Facts">
            <ul className="list-disc pl-4 space-y-2 text-sm text-[#38483B]">
              {data.facts.map((fact, i) => (
                <li key={i}>{fact}</li>
              ))}
            </ul>
          </InsightSection>
          
          <InsightSection icon={<Globe className="w-5 h-5 text-[#3E6548]" />} title="Ecological Role">
            <p className="text-sm text-[#38483B] leading-relaxed">{data.ecologicalImportance}</p>
          </InsightSection>
        </div>

        <div className="flex flex-col gap-6">
          <InsightSection icon={<Sparkles className="w-5 h-5 text-[#3E6548]" />} title="Metaphorical Lesson" variant="highlight">
            <p className="font-bold text-[#3E6548] mb-1.5 uppercase text-xs tracking-wider">
              Theme: {data.characteristic}
            </p>
            <p className="italic text-sm text-[#38483B] leading-relaxed">&quot;{data.lifeLesson}&quot;</p>
          </InsightSection>

          <InsightSection icon={<BookOpen className="w-5 h-5 text-[#3E6548]" />} title="Reflection">
            <p className="mb-4 text-sm text-[#38483B] leading-relaxed">{data.reflectionQuestion}</p>
            <textarea 
              placeholder="Write your reflections here..."
              className="w-full bg-white border border-[#DCE5D8] rounded-xl p-3 text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-[#294B36] resize-none"
            />
          </InsightSection>
        </div>
      </div>

      <div className="mt-4 mb-10 flex flex-col gap-3">
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
        />
        {questMatchInfo?.matched && (
          <p className="text-xs font-semibold text-[#294B36] flex items-center gap-1.5 mt-0.5">
            <CheckCircle2 className="w-4 h-4 text-[#3E6548]" />
            Quest completed! You earned {questMatchInfo.score}% match and +{questMatchInfo.bonusXp} bonus XP.
          </p>
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

export default function InsightPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-[#DCE5D8] border-t-[#294B36] rounded-full animate-spin" /></div>}>
      <InsightContent />
    </Suspense>
  );
}
