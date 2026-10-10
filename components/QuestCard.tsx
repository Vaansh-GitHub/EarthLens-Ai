import { MapPin, CheckCircle2 } from "lucide-react";

interface QuestCardProps {
  title: string;
  description: string;
  reward: number;
  completed?: boolean;
}

export function QuestCard({ title, description, reward, completed = false }: QuestCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
      completed 
        ? "bg-surface/50 border-border opacity-80" 
        : "bg-mint/40 border-mint/60 shadow-sm hover:-translate-y-1 hover:shadow-md"
    }`}>
      {/* Background decoration */}
      {!completed && (
        <div className="absolute -right-6 -top-6 text-mint opacity-40 rotate-12">
          <MapPin className="w-32 h-32" />
        </div>
      )}
      
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${completed ? "bg-border text-sage" : "bg-forest/10 text-forest-dark"}`}>
            <span>Quest of the Day</span>
          </div>
          {completed && (
            <div className="flex items-center gap-1 text-sage text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Completed
            </div>
          )}
        </div>
        
        <div>
          <h3 className={`text-lg font-semibold mb-1 ${completed ? "text-sage" : "text-forest-dark"}`}>
            {title}
          </h3>
          <p className={`text-sm ${completed ? "text-sage/80" : "text-forest/80"}`}>
            {description}
          </p>
        </div>
        
        <div className={`inline-flex items-center gap-1 font-semibold text-sm ${
          completed ? "text-sage" : "text-earth"
        }`}>
          +{reward} XP
        </div>
      </div>
    </div>
  );
}
