import { Trophy, Star } from "lucide-react";

interface XPProgressProps {
  currentXP: number;
  level: number;
  nextLevelXP: number;
}

export function XPProgress({ currentXP, level, nextLevelXP }: XPProgressProps) {
  const progress = Math.min(100, Math.max(0, (currentXP / nextLevelXP) * 100));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-border flex flex-col gap-3 transition-transform hover:-translate-y-1 hover:shadow-md duration-300">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-earth/20 p-2 rounded-full text-earth">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-forest text-sm">Naturalist Level {level}</h3>
            <p className="text-xs text-sage">{currentXP} / {nextLevelXP} XP</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Star className="w-4 h-4 text-earth fill-earth" />
        </div>
      </div>
      
      <div className="w-full bg-sage-light h-2.5 rounded-full overflow-hidden">
        <div 
          className="bg-forest h-full rounded-full transition-all duration-1000 ease-out" 
          style={{ width: `${progress}%` }} 
        />
      </div>
      <p className="text-xs text-sage text-right">{nextLevelXP - currentXP} XP to Level {level + 1}</p>
    </div>
  );
}
