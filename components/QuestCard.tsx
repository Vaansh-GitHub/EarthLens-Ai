import { MapPin, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from "lucide-react";

interface QuestCardProps {
  title: string;
  description: string;
  reward: number;
  completed?: boolean;
  score?: number;
  status?: "strong_match" | "partial_match" | "insufficient_match";
  matchedRequirements?: string[];
  missingRequirements?: string[];
  explanation?: string;
  retrySuggestion?: string | null;
}

export function QuestCard({ 
  title, 
  description, 
  reward, 
  completed = false,
  score,
  status,
  matchedRequirements = [],
  missingRequirements = [],
  explanation,
  retrySuggestion
}: QuestCardProps) {
  const isEvaluated = typeof score === "number";

  let statusBadgeColor = "bg-[#294B36]/10 text-[#294B36]";
  let statusText = "Quest of the Day";

  if (status === "strong_match" || (isEvaluated && score >= 90)) {
    statusBadgeColor = "bg-[#E4EEDF] text-[#294B36] border border-[#D2E3CE]";
    statusText = `🎯 Strong Match (${score}%)`;
  } else if (status === "partial_match" || (isEvaluated && score >= 70)) {
    statusBadgeColor = "bg-emerald-50 text-emerald-800 border border-emerald-200";
    statusText = `🌿 Partial Match (${score}%)`;
  } else if (status === "insufficient_match" || (isEvaluated && score < 70)) {
    statusBadgeColor = "bg-amber-50 text-amber-800 border border-amber-200";
    statusText = `⚠️ Insufficient Match (${score}%)`;
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl p-5 border transition-all duration-300 ${
      completed 
        ? "bg-[#F7FAF5] border-[#DCE5D8] shadow-xs" 
        : "bg-white border-[#DCE5D8] shadow-xs hover:shadow-md"
    }`}>
      {/* Background decoration */}
      <div className="absolute -right-6 -top-6 text-[#294B36]/5 opacity-40 rotate-12 pointer-events-none">
        <MapPin className="w-32 h-32" />
      </div>
      
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusBadgeColor}`}>
            <span>{statusText}</span>
          </div>
          {completed && (
            <div className="flex items-center gap-1 text-[#294B36] text-xs font-bold bg-[#E4EEDF] px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3E6548]" />
              Quest Fulfilled (+{reward} XP)
            </div>
          )}
        </div>
        
        <div>
          <h3 className="text-base md:text-lg font-bold text-[#1E3526] mb-1">
            {title}
          </h3>
          <p className="text-sm text-[#5F7363] leading-relaxed">
            {description}
          </p>
        </div>

        {explanation && (
          <p className="text-xs text-[#38483B] bg-[#F5F8F1] p-3 rounded-xl border border-[#E2EAE0] leading-relaxed">
            <strong>Evaluation:</strong> {explanation}
          </p>
        )}

        {/* Requirements Checklist */}
        {(matchedRequirements.length > 0 || missingRequirements.length > 0) && (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F7363]">
              Observable Requirements Checklist
            </span>
            <div className="flex flex-wrap gap-1.5">
              {matchedRequirements.map((req, i) => (
                <span 
                  key={`match-${i}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E4EEDF] text-[#294B36] border border-[#D2E3CE]"
                >
                  <CheckCircle2 className="w-3 h-3 text-[#3E6548]" />
                  {req}
                </span>
              ))}
              {missingRequirements.map((req, i) => (
                <span 
                  key={`miss-${i}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                >
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  {req}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Retry Suggestion for <70% match */}
        {retrySuggestion && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs mt-1">
            <RefreshCw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <strong className="font-bold text-amber-950">How to satisfy this quest:</strong>
              <span className="leading-relaxed">{retrySuggestion}</span>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-1">
          <div className="inline-flex items-center gap-1 font-bold text-xs text-[#294B36]">
            <Sparkles className="w-3.5 h-3.5 text-[#3E6548]" />
            Quest Reward: +{reward} XP
          </div>
        </div>
      </div>
    </div>
  );
}
