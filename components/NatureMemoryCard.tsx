/* eslint-disable @next/next/no-img-element */
import { FormattedText } from "@/components/FormattedText";
import { Leaf } from "lucide-react";

interface NatureMemoryCardProps {
  image: string;
  title: string;
  quote?: string;
  lifeConnection?: string;
  reflection?: string; // backwards-compatible alias
  date: string;
  styleVariant: "light" | "dark" | "earthy";
  showPhoto: boolean;
}

export function NatureMemoryCard({
  image,
  title,
  quote,
  lifeConnection,
  reflection,
  date,
  styleVariant,
  showPhoto
}: NatureMemoryCardProps) {
  const styles = {
    light: "bg-[#FDFBF7] text-[#2D3A2F] border-[#E5DFD3]",
    dark: "bg-[#1E3329] text-[#FDFBF7] border-[#2C4A3B]",
    earthy: "bg-[#B58D67] text-[#FDFBF7] border-[#8B6B4D]"
  };

  const quoteText = (quote || reflection || "").replace(/\*\*/g, "").replace(/^["'“`]+|["'”`]+$/g, "").trim();
  const lifeText = (lifeConnection || "").replace(/\*\*/g, "").trim();

  return (
    <div className={`w-full max-w-sm mx-auto min-h-[540px] flex flex-col rounded-3xl overflow-hidden shadow-xl border ${styles[styleVariant]} transition-colors duration-500`}>
      {showPhoto && (
        <div className="h-48 sm:h-52 w-full relative shrink-0">
          {image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${
              styleVariant === "light" ? "bg-[#E4EEDF]" : 
              styleVariant === "dark" ? "bg-[#16271F]" : "bg-[#9A7350]"
            }`}>
              <Leaf className="w-12 h-12 opacity-30" />
            </div>
          )}
          <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t to-transparent ${
            styleVariant === "light" ? "from-[#FDFBF7]" : 
            styleVariant === "dark" ? "from-[#1E3329]" : "from-[#B58D67]"
          }`} />
        </div>
      )}
      
      <div className={`flex flex-col flex-1 p-6 ${!showPhoto ? "justify-center" : ""}`}>
        <div className="uppercase tracking-widest text-[10px] font-bold opacity-70 mb-1.5">
          EARTHLENS AI
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-serif font-bold mb-3 leading-tight">
          {title}
        </h2>
        
        <div className="w-12 h-1 bg-current opacity-25 mb-4 rounded-full" />
        
        {/* Prominent Original Quote */}
        {quoteText && (
          <blockquote className="italic font-serif text-sm sm:text-base leading-relaxed opacity-95 mb-3">
            &ldquo;<FormattedText text={quoteText} />&rdquo;
          </blockquote>
        )}

        {/* Life Connection beneath quote */}
        {lifeText && (
          <p className="text-xs sm:text-sm leading-relaxed opacity-85 mb-4 font-sans">
            <FormattedText text={lifeText} />
          </p>
        )}

        {!quoteText && !lifeText && (
          <p className="italic text-sm leading-relaxed opacity-70 flex-1">
            Your field reflection goes here...
          </p>
        )}
        
        <div className="mt-auto pt-4 flex justify-between items-center text-xs font-medium opacity-65 border-t border-current/15">
          <span>{date}</span>
          <span>EarthLens AI</span>
        </div>
      </div>
    </div>
  );
}
