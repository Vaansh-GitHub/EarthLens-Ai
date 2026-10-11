"use client";

import { useState } from "react";
import { Search, Filter, BookOpen } from "lucide-react";
import { DiscoveryCard } from "./DiscoveryCard";

interface JournalEntry {
  id: string;
  title: string;
  category: string;
  date: string;
  imageUrl?: string;
}

interface JournalGridProps {
  entries: JournalEntry[];
}

const CATEGORIES = ["All", "Plant", "Animal", "Insect", "Bird", "Fungi", "Landscape", "Other"];

export function JournalGrid({ entries }: JournalGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredEntries = entries.filter(entry => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || 
      (entry.title && entry.title.toLowerCase().includes(q)) || 
      (entry.category && entry.category.toLowerCase().includes(q));
    const matchesCategory = 
      activeCategory === "All" || 
      (entry.category || "").toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-sage" />
          </div>
          <input
            type="text"
            placeholder="Search your journal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-earth text-sm text-forest placeholder-sage/70"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
          <div className="flex items-center gap-1 text-sage text-sm font-medium pr-2 border-r border-border">
            <Filter className="w-4 h-4" />
          </div>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat 
                  ? "bg-[#294B36] text-white shadow-xs" 
                  : "bg-white text-[#1E3526] border border-[#DCE5D8] hover:border-[#294B36] hover:bg-[#F5F8F1]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filteredEntries.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredEntries.map(entry => (
            <DiscoveryCard 
              key={entry.id}
              id={entry.id}
              title={entry.title}
              category={entry.category}
              date={entry.date}
              imageUrl={entry.imageUrl}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-surface/50 rounded-3xl border border-dashed border-border mt-4">
          <div className="w-16 h-16 rounded-full bg-sage-light/50 flex items-center justify-center text-sage">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-forest">No entries found</h3>
            <p className="text-sage text-sm max-w-sm mt-1">
              {searchQuery || activeCategory !== "All" 
                ? "Try adjusting your filters or search terms." 
                : "Your journal is empty. Start discovering the nature around you to fill these pages."}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
