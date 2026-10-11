"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Sparkles, Leaf, Bird, Bug, Mountain, AlertTriangle, RefreshCw, ExternalLink 
} from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";
import { 
  saveDraftDiscovery, 
  findDuplicateDiscovery, 
  deleteDiscovery, 
  useObjectUrl, 
  type DuplicateMatch 
} from "@/lib/client/journal-db";

const CATEGORIES = [
  { id: "plant", label: "Plant", icon: Leaf },
  { id: "animal", label: "Animal", icon: Bird },
  { id: "insect", label: "Insect", icon: Bug },
  { id: "landscape", label: "Landscape", icon: Mountain },
  { id: "other", label: "Other", icon: Sparkles },
];

export function DiscoverClient() {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string | null>("plant");
  const [notes, setNotes] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Duplicate detection state
  const [detectedDuplicate, setDetectedDuplicate] = useState<DuplicateMatch | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<DuplicateMatch | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Safely generate object URL for existing duplicate thumbnail in modal
  const existingPhotoUrl = useObjectUrl(pendingDuplicate?.existingDiscovery.imageBlob);

  // Ensure user is authenticated
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          window.location.href = "/login";
        }
      })
      .catch(() => {});
  }, []);

  // Check in the background when user selects an image to provide immediate awareness
  useEffect(() => {
    let active = true;
    if (!imageFile) {
      setDetectedDuplicate(null);
      return;
    }

    findDuplicateDiscovery(imageFile)
      .then((match) => {
        if (active) setDetectedDuplicate(match);
      })
      .catch(() => {
        if (active) setDetectedDuplicate(null);
      });

    return () => {
      active = false;
    };
  }, [imageFile]);

  // Actual AI agent call execution
  const executeAnalysis = async () => {
    if (!image || !imageFile) return;

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (category) {
        formData.append("category", category);
      }
      if (notes && notes.trim()) {
        formData.append("notes", notes.trim());
        formData.append("description", notes.trim());
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Failed to analyze image");
      }

      const json = await res.json();
      if (json.data) {
        const draftId = crypto.randomUUID();
        
        // Save the raw image Blob and analysis to local IndexedDB draft
        await saveDraftDiscovery({
          id: draftId,
          imageBlob: imageFile,
          imageMimeType: imageFile.type,
          category: category || "plant",
          notes: notes || "",
          analysis: json.data.analysis,
          references: json.data.references,
          questMatch: json.data.questMatch,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Store metadata in sessionStorage for backwards compatibility
        sessionStorage.setItem("earthlens_current_discovery", JSON.stringify({
          id: draftId,
          analysis: json.data.analysis,
          references: json.data.references,
          category,
          notes,
          questMatch: json.data.questMatch,
          xpAwarded: json.data.xpAwarded,
        }));

        router.push("/insight?id=new");
        return;
      }

      // Fallback
      router.push("/insight?id=new");
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage((err as Error).message || "An error occurred during analysis");
      setIsAnalyzing(false);
    }
  };

  // Triggered when user clicks "Discover Insights"
  const handleAnalyze = async () => {
    if (!image || !imageFile) return;

    // Validate client-side image file size and type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(imageFile.type)) {
      setErrorMessage("Unsupported image format. Please use JPEG, PNG, or WebP.");
      return;
    }

    const maxSizeBytes = 8 * 1024 * 1024; // 8MB
    if (imageFile.size > maxSizeBytes) {
      setErrorMessage("Image exceeds the 8MB limit. Please choose a smaller photo.");
      return;
    }

    // Step 1: Check for duplicate image in the database BEFORE making agent call
    setIsCheckingDuplicate(true);
    setErrorMessage(null);
    let match: DuplicateMatch | null = null;
    try {
      match = await findDuplicateDiscovery(imageFile);
    } catch (checkErr) {
      console.warn("Duplicate image check encountered error:", checkErr);
    } finally {
      setIsCheckingDuplicate(false);
    }

    // If duplicate is found in database, ask user before making agent call
    if (match) {
      setPendingDuplicate(match);
      setShowDuplicateModal(true);
      return; // STOP: do NOT make agent call yet!
    }

    // If not a duplicate, proceed with AI agent call immediately
    await executeAnalysis();
  };

  // User confirmed remake: automatically delete old discovery and make the agent call
  const handleConfirmRemakeAndAnalyze = async () => {
    if (!pendingDuplicate) return;

    const oldId = pendingDuplicate.existingDiscovery.id;
    setShowDuplicateModal(false);
    setPendingDuplicate(null);
    setDetectedDuplicate(null);

    // Automatically delete old discovery from local IndexedDB and legacy server
    try {
      await deleteDiscovery(oldId);
      if (oldId.length === 24) {
        await fetch(`/api/journal/${oldId}`, { method: "DELETE" }).catch(() => {});
      }
    } catch (err) {
      console.warn("Failed to delete existing duplicate discovery:", err);
    }

    // Proceed with the AI agent call
    await executeAnalysis();
  };

  // User canceled remake: do NOT make agent call and keep existing entry intact
  const handleCancelDuplicate = () => {
    setShowDuplicateModal(false);
    setPendingDuplicate(null);
  };

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#1E3526] mb-2">New Discovery</h1>
        <p className="text-sm md:text-base text-[#5F7363]">Upload a photo to uncover its ecological secrets and wisdom.</p>
      </header>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-8">
        {/* Step 1: Photo */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#5F7363]">1. The Observation</h2>
          <ImageUploader onImageSelected={(uri, file) => {
            setImage(uri);
            setImageFile(file || null);
            setErrorMessage(null);
            setDetectedDuplicate(null);
            setPendingDuplicate(null);
          }} />

          {/* Inline notification if duplicate is detected right after selection */}
          {detectedDuplicate && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium animate-in fade-in duration-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="flex-1">
                Notice: This photo matches an existing entry in your journal (
                <strong>
                  {detectedDuplicate.existingDiscovery.analysis?.candidateCommonName ||
                    detectedDuplicate.existingDiscovery.analysis?.candidateScientificName ||
                    detectedDuplicate.existingDiscovery.category ||
                    "Observation"}
                </strong>
                ). If you discover it again, you will be prompted to remake it and delete the old entry.
              </span>
            </div>
          )}
        </section>

        {/* Step 2: Details (Only visible if image selected) */}
        {image && (
          <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#5F7363]">2. Broad Category</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? "bg-[#294B36] text-white border-[#294B36] shadow-md ring-2 ring-[#294B36]/20 font-bold" 
                          : "bg-white border-[#DCE5D8] text-[#1E3526] hover:border-[#294B36] hover:bg-[#F5F8F1] font-semibold"
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isSelected ? "text-[#D2E3CE]" : "text-[#3E6548]"}`} />
                      <span className="text-sm">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#5F7363]">3. Optional Field Notes & Reflections</h2>
                <span className="text-[11px] text-[#5F7363]/80">AI attunes quote tone to your words</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Where did you find this? How are you feeling today? (e.g. tired, peaceful, seeking motivation, excited...)"
                className="w-full bg-white border border-[#DCE5D8] rounded-2xl p-4 min-h-[120px] text-[#1E3526] placeholder:text-[#5F7363]/60 focus:outline-none focus:ring-2 focus:ring-[#294B36]/30 focus:border-[#294B36] resize-none transition-shadow text-sm"
              />
            </section>

            {/* High-Contrast Bold Action Button */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || isCheckingDuplicate || !category}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2.5 transition-all shadow-sm mb-8 ${
                isAnalyzing || isCheckingDuplicate || !category
                  ? "bg-[#E4EEDF] text-[#5F7363] border border-[#DCE5D8] cursor-not-allowed shadow-none"
                  : "bg-[#294B36] hover:bg-[#1E3526] active:bg-[#15261b] text-white hover:shadow-lg active:scale-[0.99] cursor-pointer"
              }`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing Nature Specimen...</span>
                </>
              ) : isCheckingDuplicate ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Checking Journal for Duplicates...</span>
                </>
              ) : (
                <>
                  <Sparkles className={`w-5 h-5 ${!category ? "text-[#5F7363]" : "text-[#D2E3CE]"}`} />
                  <span>Discover Insights</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Duplicate Photo Confirmation Modal */}
      {showDuplicateModal && pendingDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-[#DCE5D8] flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-[#1E3526]">Same Image Already in DB</h3>
                <p className="text-xs text-[#5F7363] mt-0.5">
                  This photo has already been documented in your database.
                </p>
              </div>
            </div>

            {/* Existing Discovery Details Card */}
            <div className="p-4 rounded-2xl bg-[#F5F8F1] border border-[#DCE5D8] flex items-center gap-4">
              {existingPhotoUrl && (
                <img
                  src={existingPhotoUrl}
                  alt="Existing discovery preview"
                  className="w-16 h-16 rounded-xl object-cover border border-[#DCE5D8] shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#3E6548]">
                  Existing Journal Entry
                </div>
                <div className="font-bold text-[#1E3526] truncate text-base">
                  {pendingDuplicate.existingDiscovery.analysis?.candidateCommonName ||
                    pendingDuplicate.existingDiscovery.analysis?.candidateScientificName ||
                    pendingDuplicate.existingDiscovery.category ||
                    "Documented Specimen"}
                </div>
                <div className="text-xs text-[#5F7363] mt-0.5">
                  Recorded on{" "}
                  {new Date(pendingDuplicate.existingDiscovery.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className="text-[11px] font-semibold text-amber-700 mt-1">
                  {pendingDuplicate.matchType === "exact" ? "100% Identical Photo" : `${pendingDuplicate.similarity}% Visual Match`}
                </div>
              </div>
            </div>

            {/* Prompt Description */}
            <div className="text-xs md:text-sm text-[#1E3526] leading-relaxed bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
              <p className="font-semibold text-amber-950 mb-1">
                Would you like to remake this discovery?
              </p>
              <p className="text-[#3E6548]">
                If you choose to remake, your <strong>old discovery will be automatically deleted</strong> before initiating the AI analysis call.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleConfirmRemakeAndAnalyze}
                disabled={isAnalyzing}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Remake Discovery (Auto-Delete Old)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelDuplicate}
                  disabled={isAnalyzing}
                  className="flex-1 py-3 px-4 rounded-2xl border border-[#DCE5D8] hover:bg-[#F5F8F1] text-[#1E3526] font-semibold text-xs md:text-sm transition-colors cursor-pointer"
                >
                  Cancel (Keep Old)
                </button>
                <Link
                  href={`/insight?id=${pendingDuplicate.existingDiscovery.id}`}
                  className="py-3 px-4 rounded-2xl border border-[#DCE5D8] hover:bg-[#F5F8F1] text-[#3E6548] font-semibold text-xs md:text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>View Entry</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
