"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award } from "lucide-react";
import { getAllDiscoveries } from "@/lib/client/journal-db";

interface ProfileAchievementsClientProps {
  initialCount: number;
  userXp: number;
  initialProgression: {
    totalXp: number;
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
    neededXp: number;
    rankTitle: string;
  };
}

export function ProfileAchievementsClient({
  initialCount,
  userXp,
  initialProgression,
}: ProfileAchievementsClientProps) {
  const [discoveryCount, setDiscoveryCount] = useState<number>(initialCount);
  const [progression, setProgression] = useState(initialProgression);

  useEffect(() => {
    let isMounted = true;

    async function syncLocalDiscoveries() {
      try {
        const localDiscoveries = await getAllDiscoveries();
        if (!isMounted) return;

        const effectiveCount = localDiscoveries.length;
        setDiscoveryCount(effectiveCount);

        // Recalculate progression dynamically
        const totalXp = Math.max(userXp, effectiveCount * 50);
        const xpPerLevel = 100;
        const level = Math.max(1, Math.floor(totalXp / xpPerLevel) + 1);
        const currentLevelXp = totalXp % xpPerLevel;
        const nextLevelXp = xpPerLevel;
        const neededXp = nextLevelXp - currentLevelXp;

        const rankTitles = [
          "Novice Observer",
          "Curious Forager",
          "Wilderness Scout",
          "Naturalist",
          "Botanical Scholar",
          "Ecology Master",
        ];
        const rankTitle = rankTitles[Math.min(level - 1, rankTitles.length - 1)] || "Ecology Master";

        setProgression({
          totalXp,
          level,
          currentLevelXp,
          nextLevelXp,
          neededXp,
          rankTitle,
        });

        // Sync with server whenever local count differs from server's stored count (including 0 upon deletion)
        if (effectiveCount !== initialCount) {
          fetch("/api/user/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ discoveriesCount: effectiveCount }),
          }).catch((e) => console.warn("Failed to sync discoveries count to cloud:", e));
        }
      } catch (err) {
        console.warn("Could not read local discoveries in profile:", err);
      }
    }

    void syncLocalDiscoveries();

    return () => {
      isMounted = false;
    };
  }, [initialCount, userXp]);

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#DCE5D8] shadow-xs flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#1E3526] font-bold text-base">
          <Award className="w-5 h-5 text-[#3E6548]" />
          Achievements
        </div>
        <span className="text-xs font-semibold text-[#5F7363]">
          {progression.totalXp} Total XP
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link 
          href="/journal"
          className="p-4 bg-[#F5F8F1] hover:bg-[#E4EEDF]/60 transition-colors rounded-2xl border border-[#DCE5D8] text-center flex flex-col items-center justify-center group cursor-pointer"
        >
          <div className="text-3xl font-extrabold text-[#294B36]">{discoveryCount}</div>
          <div className="text-[11px] text-[#5F7363] font-semibold uppercase tracking-wider mt-1 group-hover:text-[#1E3526]">
            Discoveries
          </div>
        </Link>
        
        <div className="p-4 bg-[#F5F8F1] rounded-2xl border border-[#DCE5D8] text-center flex flex-col items-center justify-center">
          <div className="text-2xl font-extrabold text-[#294B36]">
            Level {progression.level}
          </div>
          <div className="text-[11px] text-[#5F7363] font-semibold uppercase tracking-wider mt-1">
            {progression.rankTitle}
          </div>
        </div>
      </div>

      {/* Level XP Progress Bar */}
      <div className="flex flex-col gap-1.5 pt-2">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-[#1E3526]">Progress to Level {progression.level + 1}</span>
          <span className="text-[#5F7363]">{progression.currentLevelXp} / {progression.nextLevelXp} XP</span>
        </div>
        <div className="w-full bg-[#E4EEDF] h-2 rounded-full overflow-hidden">
          <div 
            className="bg-[#294B36] h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(0, (progression.currentLevelXp / progression.nextLevelXp) * 100))}%` }} 
          />
        </div>
        <p className="text-[11px] text-[#5F7363] text-right mt-0.5">
          {progression.neededXp} XP needed for next level
        </p>
      </div>
    </div>
  );
}
