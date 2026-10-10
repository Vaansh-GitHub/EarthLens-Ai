/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Leaf, Globe, Sparkles, BookOpen, Share2, BookmarkPlus } from "lucide-react";
import { InsightSection } from "@/components/InsightSection";
import { QuestCard } from "@/components/QuestCard";
import { Suspense, useEffect, useState } from "react";

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

interface DiscoveryPayload {
  analysis?: {
    candidateCommonName?: string;
    candidateScientificName?: string;
    confidence?: string | number;
    facts?: string[];
    ecologicalImportance?: string;
    naturalCharacteristic?: string;
    metaphoricalLesson?: string;
    quote?: string;
    reflectionQuestion?: string;
  };
  observation?: {
    category?: string;
    description?: string;
    photoUrl?: string;
    photoKey?: string;
  };
  references?: unknown[];
  imageUrl?: string;
  photoKey?: string;
  category?: string;
  notes?: string;
}

function InsightContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  
  const [data, setData] = useState(FALLBACK_INSIGHT);
  const [currentDiscovery, setCurrentDiscovery] = useState<DiscoveryPayload | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadInsightData() {
      if (id === "new") {
        try {
          const stored = typeof window !== "undefined" ? sessionStorage.getItem("earthlens_current_discovery") : null;
          if (stored) {
            const parsed: DiscoveryPayload = JSON.parse(stored);
            setCurrentDiscovery(parsed);
            const a = parsed.analysis;
            if (a) {
              setData({
                name: a.candidateCommonName || a.candidateScientificName || "Observation Specimen",
                scientificName: a.candidateScientificName || "",
                confidence: String(a.confidence || "High"),
                image: parsed.imageUrl || FALLBACK_INSIGHT.image,
                facts: a.facts && a.facts.length > 0 ? a.facts : FALLBACK_INSIGHT.facts,
                ecologicalImportance: a.ecologicalImportance || FALLBACK_INSIGHT.ecologicalImportance,
                characteristic: a.naturalCharacteristic || FALLBACK_INSIGHT.characteristic,
                lifeLesson: a.metaphoricalLesson || FALLBACK_INSIGHT.lifeLesson,
                reflectionQuestion: a.reflectionQuestion || FALLBACK_INSIGHT.reflectionQuestion,
              });
            }
          }
        } catch (err) {
          console.error("Failed to load discovery from storage:", err);
        }
      } else if (id && id.length === 24) {
        try {
          const res = await fetch(`/api/journal/${id}`);
          const resJson = await res.json();
          if (resJson.success && resJson.data) {
            const doc = resJson.data;
            const a = doc.analysis;
            setData({
              name: a?.candidateCommonName || a?.candidateIdentification || "Observation Specimen",
              scientificName: a?.candidateScientificName || "",
              confidence: String(a?.confidence || "High"),
              image: doc.observation?.photoUrl || FALLBACK_INSIGHT.image,
              facts: a?.facts && a.facts.length > 0 ? a.facts : FALLBACK_INSIGHT.facts,
              ecologicalImportance: a?.ecologicalImportance || FALLBACK_INSIGHT.ecologicalImportance,
              characteristic: a?.naturalCharacteristic || FALLBACK_INSIGHT.characteristic,
              lifeLesson: a?.metaphoricalLesson || a?.lifeLesson || FALLBACK_INSIGHT.lifeLesson,
              reflectionQuestion: a?.reflectionQuestion || FALLBACK_INSIGHT.reflectionQuestion,
            });
          }
        } catch (err) {
          console.error(err);
        }
      }
    }

    void loadInsightData();
  }, [id]);

  const handleSaveToJournal = async () => {
    if (!currentDiscovery) return;
    setIsSaving(true);

    try {
      const payload = {
        observation: {
          category: currentDiscovery.category || "plant",
          description: currentDiscovery.notes || "",
          photoUrl: currentDiscovery.imageUrl || "",
          photoKey: currentDiscovery.photoKey || "",
        },
        analysis: currentDiscovery.analysis,
        references: currentDiscovery.references || [],
        memoryCard: {
          title: data.name,
          quote: currentDiscovery.analysis?.quote || "",
          template: "classic",
          showPhoto: true,
          pngUrl: currentDiscovery.imageUrl,
        },
      };

      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save to journal");
      }

      setSavedSuccess(true);
      setTimeout(() => {
        router.push("/journal");
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 animate-in fade-in duration-500">
      
      <header className="flex items-center justify-between">
        <Link href="/journal" className="inline-flex items-center gap-2 text-[#5F7363] hover:text-[#1E3526] transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" />
          Field Journal
        </Link>
        <div className="flex items-center gap-2">
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
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
            </span>
          )}
          <Link href={`/studio?id=${id || "new"}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#DCE5D8] hover:border-[#294B36] text-[#294B36] rounded-full text-sm font-bold transition-all shadow-xs">
            <Share2 className="w-4 h-4 text-[#3E6548]" />
            <span>Create Memory Card</span>
          </Link>
        </div>
      </header>

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
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-1">{data.name}</h1>
          {data.scientificName && (
            <p className="text-white/90 italic text-sm">{data.scientificName}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
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

      <div className="mt-4 mb-10">
        <h2 className="text-lg font-bold text-[#1E3526] mb-4">Inspired Quest</h2>
        <QuestCard 
          title="The Metamorphosis Observation" 
          description="Find another insect or plant in a transitional phase of its lifecycle and document it."
          reward={100}
        />
      </div>

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
