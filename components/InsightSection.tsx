import { ReactNode } from "react";

interface InsightSectionProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  variant?: "default" | "highlight";
}

export function InsightSection({ icon, title, children, variant = "default" }: InsightSectionProps) {
  return (
    <div className={`p-5 rounded-2xl border ${
      variant === "highlight" 
        ? "bg-earth/10 border-earth/20" 
        : "bg-surface border-border"
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${
          variant === "highlight" ? "bg-earth/20 text-earth" : "bg-sage/20 text-forest"
        }`}>
          {icon}
        </div>
        <h3 className={`font-semibold ${
          variant === "highlight" ? "text-earth" : "text-forest"
        }`}>
          {title}
        </h3>
      </div>
      <div className="text-forest/80 leading-relaxed text-sm">
        {children}
      </div>
    </div>
  );
}
