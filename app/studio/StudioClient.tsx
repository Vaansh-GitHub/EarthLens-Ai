"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Layout, Sparkles, CheckCircle2 } from "lucide-react";
import { NatureMemoryCard } from "@/components/NatureMemoryCard";

const FALLBACK_DATA = {
  image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&q=80&w=800",
  title: "Monarch Butterfly",
  quote: "Just as the Monarch must dissolve completely within its chrysalis to become a butterfly, we too must sometimes let go of our past selves to transform."
};

export function StudioClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [cardData, setCardData] = useState(FALLBACK_DATA);
  const [reflection, setReflection] = useState(FALLBACK_DATA.quote);
  const [styleVariant, setStyleVariant] = useState<"light" | "dark" | "earthy">("light");
  const [showPhoto, setShowPhoto] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Hidden canvas for rendering high-res PNG
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function loadData() {
      if (id === "new") {
        try {
          const stored = typeof window !== "undefined" ? sessionStorage.getItem("earthlens_current_discovery") : null;
          if (stored) {
            const parsed = JSON.parse(stored);
            const a = parsed.analysis;
            const quote = a?.quote || a?.metaphoricalLesson || FALLBACK_DATA.quote;
            const title = a?.candidateCommonName || a?.candidateScientificName || "Field Discovery";
            const image = parsed.imageUrl || FALLBACK_DATA.image;

            setCardData({ image, title, quote });
            setReflection(quote);
          }
        } catch (err) {
          console.error("Failed to load discovery for Studio:", err);
        }
      } else if (id && id.length === 24) {
        try {
          const res = await fetch(`/api/journal/${id}`);
          const resJson = await res.json();
          if (resJson.success && resJson.data) {
            const doc = resJson.data;
            const a = doc.analysis;
            const title = a?.candidateCommonName || a?.candidateIdentification || "Field Discovery";
            const quote = doc.memoryCard?.quote || a?.quote || a?.metaphoricalLesson || FALLBACK_DATA.quote;
            const image = doc.observation?.photoUrl || FALLBACK_DATA.image;

            setCardData({ image, title, quote });
            setReflection(quote);
            if (doc.memoryCard?.template) {
              setStyleVariant(doc.memoryCard.template as "light" | "dark" | "earthy");
            }
            if (doc.memoryCard?.showPhoto !== undefined) {
              setShowPhoto(doc.memoryCard.showPhoto);
            }
          }
        } catch (err) {
          console.error("Failed to fetch journal entry for Studio:", err);
        }
      }
    }

    void loadData();
  }, [id]);

  // Client-side HTML5 Canvas High-Res PNG Generator
  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const canvas = document.createElement("canvas");
      // 1200 x 1600 (3:4 ratio for crisp print & social sharing)
      const width = 1200;
      const height = 1600;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize 2D canvas context");

      // Color Schemes
      const themeColors = {
        light: { bg: "#FDFBF7", text: "#2D3A2F", subtext: "#5A6E5D", line: "#D2E3CE" },
        dark: { bg: "#1E3329", text: "#FDFBF7", subtext: "#A3C2A9", line: "#3E6548" },
        earthy: { bg: "#B58D67", text: "#FFFFFF", subtext: "#F0E4D7", line: "#D4B99B" },
      }[styleVariant];

      // 1. Background
      ctx.fillStyle = themeColors.bg;
      ctx.fillRect(0, 0, width, height);

      let textTop = 200;

      // 2. Draw Photo if enabled
      if (showPhoto && cardData.image) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Gracefully skip photo if blocked by CORS
            img.src = cardData.image;
          });

          if (img.width && img.height) {
            const photoHeight = height * 0.48;
            // Draw image with cover aspect ratio
            const scale = Math.max(width / img.width, photoHeight / img.height);
            const sw = width / scale;
            const sh = photoHeight / scale;
            const sx = (img.width - sw) / 2;
            const sy = (img.height - sh) / 2;

            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, photoHeight);

            // Bottom gradient fade into card background
            const grad = ctx.createLinearGradient(0, photoHeight - 200, 0, photoHeight);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(1, themeColors.bg);
            ctx.fillStyle = grad;
            ctx.fillRect(0, photoHeight - 200, width, 200);

            textTop = photoHeight + 60;
          }
        } catch (e) {
          console.warn("Could not load image onto canvas:", e);
        }
      }

      // 3. Header: EarthLens AI
      ctx.fillStyle = themeColors.subtext;
      ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.letterSpacing = "6px";
      ctx.fillText("EARTHLENS AI", 100, textTop);

      // 4. Title
      ctx.fillStyle = themeColors.text;
      ctx.font = "bold 68px Georgia, serif";
      ctx.letterSpacing = "0px";
      ctx.fillText(cardData.title, 100, textTop + 90);

      // 5. Divider Line
      ctx.fillStyle = themeColors.line;
      ctx.fillRect(100, textTop + 130, 140, 8);

      // 6. Wrapped Reflection / Quote
      ctx.fillStyle = themeColors.text;
      ctx.font = "italic 40px Georgia, serif";
      const quoteText = `"${reflection || cardData.quote}"`;

      // Word wrapping helper
      const maxTextWidth = width - 200;
      const words = quoteText.split(" ");
      let line = "";
      let y = textTop + 220;
      const lineHeight = 64;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && n > 0) {
          ctx.fillText(line, 100, y);
          line = words[n] + " ";
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 100, y);

      // 7. Footer: Date & Touch Grass Tag
      ctx.fillStyle = themeColors.subtext;
      ctx.font = "500 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      ctx.fillText(dateStr, 100, height - 90);
      ctx.fillText("#TouchGrass", width - 280, height - 90);

      // 8. Download PNG
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      const safeName = cardData.title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      a.download = `earthlens-${safeName}-card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setExportSuccess(true);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export Memory Card PNG. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const todayStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col md:flex-row gap-8 lg:gap-12 animate-in fade-in duration-500 mb-10">
      
      {/* Controls */}
      <div className="w-full md:w-1/2 lg:w-1/3 flex flex-col gap-6">
        <div>
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E4EEDF] text-[#294B36] text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#3E6548]" />
            <span>Digital Keepsake</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1E3526] mb-1">Memory Card Studio</h1>
          <p className="text-sm text-[#5F7363]">Personalize and export a keepsake of your field discovery.</p>
        </div>

        <div className="flex flex-col gap-5 p-5 bg-white rounded-2xl border border-[#DCE5D8] shadow-xs">
          
          {/* Style Variant */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#294B36]">Theme</label>
            <div className="grid grid-cols-3 gap-2">
              <button 
                type="button"
                onClick={() => setStyleVariant("light")}
                className={`p-2 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ${styleVariant === "light" ? "border-[#294B36] bg-[#F5F8F1] text-[#294B36]" : "border-[#E4EEDF] bg-white text-[#5F7363]"}`}
              >
                Light
              </button>
              <button 
                type="button"
                onClick={() => setStyleVariant("dark")}
                className={`p-2 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ${styleVariant === "dark" ? "border-[#294B36] bg-[#1E3526] text-white" : "border-[#E4EEDF] bg-white text-[#5F7363]"}`}
              >
                Dark
              </button>
              <button 
                type="button"
                onClick={() => setStyleVariant("earthy")}
                className={`p-2 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ${styleVariant === "earthy" ? "border-[#294B36] bg-[#B58D67] text-white" : "border-[#E4EEDF] bg-white text-[#5F7363]"}`}
              >
                Earthy
              </button>
            </div>
          </div>

          {/* Photo Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#294B36] flex items-center gap-2">
              <Layout className="w-4 h-4" />
              Include Photo
            </label>
            <button 
              type="button"
              onClick={() => setShowPhoto(!showPhoto)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${showPhoto ? "bg-[#294B36]" : "bg-[#DCE5D8]"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showPhoto ? "left-7" : "left-1"}`} />
            </button>
          </div>

          {/* Reflection Edit */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#294B36]">Your Reflection / Quote</label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="w-full bg-[#F5F8F1] border border-[#DCE5D8] rounded-xl p-3 text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-[#294B36] resize-none text-[#1E3526]"
            />
          </div>

        </div>

        <button 
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="w-full py-3.5 rounded-2xl bg-[#294B36] hover:bg-[#1E3526] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
        >
          {isExporting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download className="w-5 h-5 text-[#D2E3CE]" />
          )}
          <span>{isExporting ? "Rendering PNG..." : "Download PNG Card"}</span>
        </button>

        {exportSuccess && (
          <div className="flex items-center gap-2 text-xs text-[#294B36] bg-[#E4EEDF] p-3 rounded-xl justify-center font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#3E6548]" />
            <span>Card generated and downloaded to your device!</span>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="w-full md:w-1/2 lg:w-2/3 flex items-center justify-center bg-[#F5F8F1] rounded-3xl p-6 md:p-8 border border-[#E4EEDF]">
        <NatureMemoryCard 
          image={cardData.image}
          title={cardData.title}
          reflection={reflection}
          date={todayStr}
          styleVariant={styleVariant}
          showPhoto={showPhoto}
        />
      </div>

      <canvas ref={canvasRef} className="hidden" />

    </div>
  );
}
