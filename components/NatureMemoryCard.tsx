/* eslint-disable @next/next/no-img-element */
interface NatureMemoryCardProps {
  image: string;
  title: string;
  reflection: string;
  date: string;
  styleVariant: "light" | "dark" | "earthy";
  showPhoto: boolean;
}

export function NatureMemoryCard({ image, title, reflection, date, styleVariant, showPhoto }: NatureMemoryCardProps) {
  
  const styles = {
    light: "bg-[#FDFBF7] text-[#2D3A2F] border-[#E5DFD3]",
    dark: "bg-[#1E3329] text-[#FDFBF7] border-[#2C4A3B]",
    earthy: "bg-[#B58D67] text-[#FDFBF7] border-[#8B6B4D]"
  };

  return (
    <div className={`w-full max-w-sm mx-auto aspect-[3/4] flex flex-col rounded-2xl overflow-hidden shadow-xl border ${styles[styleVariant]} transition-colors duration-500`}>
      {showPhoto && (
        <div className="h-1/2 w-full relative">
          <img src={image} alt={title} className="w-full h-full object-cover" />
          <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t to-transparent ${
            styleVariant === "light" ? "from-[#FDFBF7]" : 
            styleVariant === "dark" ? "from-[#1E3329]" : "from-[#B58D67]"
          }`} />
        </div>
      )}
      
      <div className={`flex flex-col flex-1 p-8 ${!showPhoto ? "justify-center" : ""}`}>
        <div className="uppercase tracking-widest text-[10px] font-bold opacity-70 mb-2">EarthLens AI</div>
        
        <h2 className="text-3xl font-serif font-bold mb-4 leading-tight">{title}</h2>
        
        <div className="w-12 h-1 bg-current opacity-20 mb-6 rounded-full" />
        
        <p className="italic text-sm leading-relaxed opacity-90 flex-1">
          &quot;{reflection || "Your reflection goes here..."}&quot;
        </p>
        
        <div className="mt-auto pt-6 flex justify-between items-center text-xs font-medium opacity-60">
          <span>{date}</span>
          <span>#TouchGrass</span>
        </div>
      </div>
    </div>
  );
}
