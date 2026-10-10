/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";

interface DiscoveryCardProps {
  id: string;
  title: string;
  category: string;
  date: string;
  imageUrl?: string;
}

export function DiscoveryCard({ id, title, category, date, imageUrl }: DiscoveryCardProps) {
  return (
    <Link 
      href={`/insight?id=${id}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
    >
      <div className="h-32 bg-sage-light relative overflow-hidden flex items-center justify-center">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
          />
        ) : (
          <Leaf className="w-10 h-10 text-sage opacity-50" />
        )}
        <div className="absolute top-2 left-2 px-2 py-1 bg-surface/80 backdrop-blur-md rounded text-[10px] font-medium uppercase tracking-wider text-forest">
          {category}
        </div>
      </div>
      
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-forest mb-1 group-hover:text-earth transition-colors">{title}</h3>
        <p className="text-xs text-sage mb-3">{date}</p>
        
        <div className="mt-auto flex items-center gap-1 text-sm font-medium text-earth group-hover:translate-x-1 transition-transform">
          View Insight <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
