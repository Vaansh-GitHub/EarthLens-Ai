"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Leaf, Bird, Bug, Mountain } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!image) return;
    
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        if (notes || category) {
          formData.append("description", `Category: ${category}. Notes: ${notes}`);
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
          sessionStorage.setItem("earthlens_current_discovery", JSON.stringify({
            analysis: json.data.analysis,
            references: json.data.references,
            imageUrl: json.data.image?.url || image,
            photoKey: json.data.image?.key || "",
            category,
            notes,
          }));
          router.push("/insight?id=new");
          return;
        }
      }

      // Fallback
      router.push("/insight?id=new");
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage((err as Error).message || "An error occurred during analysis");
      setIsAnalyzing(false);
    }
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
          }} />
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#5F7363]">3. Optional Field Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Where did you find this? Any interesting behaviors or environmental features?"
                className="w-full bg-white border border-[#DCE5D8] rounded-2xl p-4 min-h-[120px] text-[#1E3526] placeholder:text-[#5F7363]/60 focus:outline-none focus:ring-2 focus:ring-[#294B36]/30 focus:border-[#294B36] resize-none transition-shadow text-sm"
              />
            </section>

            {/* High-Contrast Bold Action Button */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !category}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2.5 transition-all shadow-sm mb-8 ${
                isAnalyzing || !category
                  ? "bg-[#E4EEDF] text-[#5F7363] border border-[#DCE5D8] cursor-not-allowed shadow-none"
                  : "bg-[#294B36] hover:bg-[#1E3526] active:bg-[#15261b] text-white hover:shadow-lg active:scale-[0.99] cursor-pointer"
              }`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing Nature Specimen...</span>
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
    </div>
  );
}
