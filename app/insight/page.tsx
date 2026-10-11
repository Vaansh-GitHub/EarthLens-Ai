import { getAuthenticatedUserId } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { InsightClient } from "./InsightClient";
import { Suspense } from "react";

export const metadata = {
  title: "Nature Insight — EarthLens AI",
  description: "Detailed ecological analysis, adaptations, and metaphorical life lessons.",
};

async function ProtectedInsight() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }

  return <InsightClient />;
}

export default function InsightPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 w-full mx-auto flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-[#DCE5D8] border-t-[#294B36] rounded-full animate-spin" />
        </div>
      }
    >
      <ProtectedInsight />
    </Suspense>
  );
}
