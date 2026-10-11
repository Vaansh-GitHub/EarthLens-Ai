"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Layout, Sparkles, CheckCircle2 } from "lucide-react";
import { NatureMemoryCard } from "@/components/NatureMemoryCard";

import { getDraftDiscovery, getDiscoveryById } from "@/lib/client/journal-db";
import { sanitizeInsightData } from "@/lib/clean-insight";

const FALLBACK_DATA = {
  image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&q=80&w=800",
  title: "Field Discovery",
  quote: "In observing the living world around us, we discover our own capacity for quiet renewal.",
  lifeConnection: "Taking time to observe the natural world offers valuable perspective on human growth and patience."
};

export function StudioClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [cardData, setCardData] = useState(FALLBACK_DATA);
  const [quote, setQuote] = useState(FALLBACK_DATA.quote);
  const [lifeConnection, setLifeConnection] = useState(FALLBACK_DATA.lifeConnection);
  const [styleVariant, setStyleVariant] = useState<"light" | "dark" | "earthy">("light");
  const [showPhoto, setShowPhoto] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Hidden canvas for rendering high-res PNG
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const createdObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (createdObjectUrlRef.current) {
        URL.revokeObjectURL(createdObjectUrlRef.current);
        createdObjectUrlRef.current = null;
      }
    };
  }, []);

  const updateCardImageBlob = (blob: Blob) => {
    if (createdObjectUrlRef.current) {
      URL.revokeObjectURL(createdObjectUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    createdObjectUrlRef.current = url;
    return url;
  };

  useEffect(() => {
    // Ensure user is authenticated
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          window.location.href = "/login";
        }
      })
      .catch(() => {});

    async function loadData() {
      if (id === "new" || !id) {
        try {
          // Check IndexedDB draft first
          const draft = await getDraftDiscovery();
          if (draft) {
            const clean = sanitizeInsightData(draft.analysis);
            const q = clean.wisdomAndReflection?.quote || clean.quote;
            const lc = clean.wisdomAndReflection?.lifeConnection || clean.lifeLesson;
            const title = clean.name;
            let image = FALLBACK_DATA.image;
            if (draft.imageBlob) {
              image = updateCardImageBlob(draft.imageBlob);
            }
            setCardData({ image, title, quote: q, lifeConnection: lc });
            setQuote(q);
            setLifeConnection(lc);
            return;
          }

          // Fallback to sessionStorage
          const stored = typeof window !== "undefined" ? sessionStorage.getItem("earthlens_current_discovery") : null;
          if (stored) {
            const parsed = JSON.parse(stored);
            const clean = sanitizeInsightData(parsed.analysis);
            const q = clean.wisdomAndReflection?.quote || clean.quote;
            const lc = clean.wisdomAndReflection?.lifeConnection || clean.lifeLesson;
            const title = clean.name;
            const image = parsed.imageUrl || FALLBACK_DATA.image;

            setCardData({ image, title, quote: q, lifeConnection: lc });
            setQuote(q);
            setLifeConnection(lc);
          }
        } catch (err) {
          console.error("Failed to load discovery for Studio:", err);
        }
      } else {
        try {
          // Load from IndexedDB
          const localDoc = await getDiscoveryById(id);
          if (localDoc) {
            const clean = sanitizeInsightData(localDoc.analysis);
            const title = clean.name;
            const q = localDoc.memoryCard?.quote
              ? sanitizeInsightData({ quote: localDoc.memoryCard.quote }).quote
              : (clean.wisdomAndReflection?.quote || clean.quote);
            const lc = clean.wisdomAndReflection?.lifeConnection || clean.lifeLesson;
            let image = FALLBACK_DATA.image;
            if (localDoc.imageBlob) {
              image = updateCardImageBlob(localDoc.imageBlob);
            }
            setCardData({ image, title, quote: q, lifeConnection: lc });
            setQuote(q);
            setLifeConnection(lc);
            if (localDoc.memoryCard?.template) {
              const tmpl = localDoc.memoryCard.template;
              if (tmpl === "light" || tmpl === "dark" || tmpl === "earthy") {
                setStyleVariant(tmpl);
              }
            }
            if (localDoc.memoryCard?.showPhoto !== undefined) {
              setShowPhoto(localDoc.memoryCard.showPhoto);
            }
            return;
          }
        } catch (err) {
          console.warn("Failed to fetch local discovery for Studio:", err);
        }

        // Legacy cloud fallback
        if (id.length === 24) {
          try {
            const res = await fetch(`/api/journal/${id}`);
            const resJson = await res.json();
            if (resJson.success && resJson.data) {
              const doc = resJson.data;
              const a = doc.analysis;
              const clean = sanitizeInsightData(a);
              const title = clean.name;
              const q = doc.memoryCard?.quote || clean.wisdomAndReflection?.quote || clean.quote;
              const lc = clean.wisdomAndReflection?.lifeConnection || clean.lifeLesson;
              const image = doc.observation?.photoUrl || FALLBACK_DATA.image;

              setCardData({ image, title, quote: q, lifeConnection: lc });
              setQuote(q);
              setLifeConnection(lc);
              if (doc.memoryCard?.template) {
                setStyleVariant(doc.memoryCard.template as "light" | "dark" | "earthy");
              }
              if (doc.memoryCard?.showPhoto !== undefined) {
                setShowPhoto(doc.memoryCard.showPhoto);
              }
            }
          } catch (err) {
            console.error("Failed to fetch legacy journal entry for Studio:", err);
          }
        }
      }
    }

    void loadData();
  }, [id]);

  // Client-side HTML5 Canvas High-Res PNG Generator (1200 x 1600)
  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const canvas = document.createElement("canvas");
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

      let textTop = 180;

      // 2. Draw Photo if enabled
      if (showPhoto && cardData.image) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = cardData.image;
          });

          if (img.width && img.height) {
            const photoHeight = Math.round(height * 0.40); // 640px
            const scale = Math.max(width / img.width, photoHeight / img.height);
            const sw = width / scale;
            const sh = photoHeight / scale;
            const sx = (img.width - sw) / 2;
            const sy = (img.height - sh) / 2;

            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, photoHeight);

            // Bottom gradient fade into card background
            const grad = ctx.createLinearGradient(0, photoHeight - 180, 0, photoHeight);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(1, themeColors.bg);
            ctx.fillStyle = grad;
            ctx.fillRect(0, photoHeight - 180, width, 180);

            textTop = photoHeight + 50;
          }
        } catch (e) {
          console.warn("Could not load image onto canvas:", e);
        }
      }

      // 3. Header: EARTHLENS AI
      ctx.fillStyle = themeColors.subtext;
      ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.letterSpacing = "6px";
      ctx.fillText("EARTHLENS AI", 100, textTop);

      // 4. Title
      ctx.fillStyle = themeColors.text;
      ctx.font = "bold 60px Georgia, serif";
      ctx.letterSpacing = "0px";
      ctx.fillText(cardData.title, 100, textTop + 75);

      // 5. Divider Line
      ctx.fillStyle = themeColors.line;
      ctx.fillRect(100, textTop + 105, 120, 6);

      // 6. Wrapped Original Quote
      ctx.fillStyle = themeColors.text;
      const cleanQuote = (quote || cardData.quote || "").replace(/\*\*/g, "").replace(/^["'“`]+|["'”`]+$/g, "").trim();
      const quoteText = `"${cleanQuote}"`;

      const cleanLife = (lifeConnection || cardData.lifeConnection || "").replace(/\*\*/g, "").trim();

      // Dynamic font sizing based on combined length
      const combinedLength = quoteText.length + cleanLife.length;
      let quoteFontSize = 38;
      let quoteLineHeight = 56;
      let lifeFontSize = 28;
      let lifeLineHeight = 44;

      if (combinedLength > 360) {
        quoteFontSize = 32;
        quoteLineHeight = 46;
        lifeFontSize = 24;
        lifeLineHeight = 38;
      } else if (combinedLength > 240) {
        quoteFontSize = 35;
        quoteLineHeight = 52;
        lifeFontSize = 26;
        lifeLineHeight = 40;
      }

      ctx.font = `italic ${quoteFontSize}px Georgia, serif`;
      const maxTextWidth = width - 200;

      // Word wrapping helper
      const wrapText = (text: string, font: string, maxW: number): string[] => {
        ctx.font = font;
        const words = text.split(" ");
        const lines: string[] = [];
        let curLine = "";

        for (let n = 0; n < words.length; n++) {
          const testLine = curLine ? `${curLine} ${words[n]}` : words[n];
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxW && n > 0) {
            lines.push(curLine);
            curLine = words[n];
          } else {
            curLine = testLine;
          }
        }
        if (curLine) lines.push(curLine);
        return lines;
      };

      let curY = textTop + 180;

      // Draw Quote Lines
      if (cleanQuote) {
        ctx.font = `italic ${quoteFontSize}px Georgia, serif`;
        ctx.fillStyle = themeColors.text;
        const quoteLines = wrapText(quoteText, `italic ${quoteFontSize}px Georgia, serif`, maxTextWidth);
        for (const l of quoteLines) {
          ctx.fillText(l, 100, curY);
          curY += quoteLineHeight;
        }
      }

      // 7. Wrapped Life Connection Paragraph beneath quote
      if (cleanLife) {
        curY += 24; // Spacing between quote and reflection paragraph
        ctx.font = `${lifeFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.fillStyle = themeColors.subtext;
        const lifeLines = wrapText(cleanLife, `${lifeFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`, maxTextWidth);
        for (const l of lifeLines) {
          ctx.fillText(l, 100, curY);
          curY += lifeLineHeight;
        }
      }

      // 8. Footer: Date & Nature Link Tag
      ctx.fillStyle = themeColors.subtext;
      ctx.font = "500 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      ctx.fillText(dateStr, 100, height - 80);
      ctx.textAlign = "right";
      ctx.fillText("EarthLens AI • An AI to link you to nature", width - 100, height - 80);
      ctx.textAlign = "left";

      // 9. Download PNG
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

          {/* Title Edit */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#294B36]">Card Title</label>
            <input
              type="text"
              value={cardData.title}
              onChange={(e) => setCardData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Turkey Tail Fungus"
              className="w-full bg-[#F5F8F1] border border-[#DCE5D8] rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#294B36] text-[#1E3526]"
            />
          </div>

          {/* Quote Edit */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#294B36]">Original Nature Quote</label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Evocative quote connecting this natural feature to human life..."
              className="w-full bg-[#F5F8F1] border border-[#DCE5D8] rounded-xl p-3 text-sm min-h-[85px] focus:outline-none focus:ring-1 focus:ring-[#294B36] resize-none text-[#1E3526]"
            />
          </div>

          {/* Life Connection Edit */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#294B36]">Life Connection & Reflection</label>
            <textarea
              value={lifeConnection}
              onChange={(e) => setLifeConnection(e.target.value)}
              placeholder="Paragraph explaining the connection between the photographed natural subject and human experience..."
              className="w-full bg-[#F5F8F1] border border-[#DCE5D8] rounded-xl p-3 text-sm min-h-[85px] focus:outline-none focus:ring-1 focus:ring-[#294B36] resize-none text-[#1E3526]"
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
          <span>{isExporting ? "Rendering 1200x1600 PNG..." : "Download PNG Card"}</span>
        </button>

        {exportSuccess && (
          <div className="flex items-center gap-2 text-xs text-[#294B36] bg-[#E4EEDF] p-3 rounded-xl justify-center font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#3E6548]" />
            <span>High-res PNG card generated and downloaded with both quote and life connection!</span>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="w-full md:w-1/2 lg:w-2/3 flex items-center justify-center bg-[#F5F8F1] rounded-3xl p-4 sm:p-6 md:p-8 border border-[#E4EEDF] self-start md:sticky md:top-6">
        <NatureMemoryCard 
          image={cardData.image}
          title={cardData.title}
          quote={quote}
          lifeConnection={lifeConnection}
          date={todayStr}
          styleVariant={styleVariant}
          showPhoto={showPhoto}
        />
      </div>

      <canvas ref={canvasRef} className="hidden" />

    </div>
  );
}
