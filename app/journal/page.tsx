import { getAuthenticatedUserId } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { JournalClient } from "@/components/JournalClient";
import { Suspense } from "react";

export const metadata = {
  title: "Nature Journal — EarthLens AI",
  description: "Your personal, device-local chronicle of nature discoveries, reflections, and ecological insights.",
};

async function ProtectedJournal() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }
  return <JournalClient />;
}

export default function JournalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 w-full mx-auto flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-[#DCE5D8] border-t-[#294B36] rounded-full animate-spin" />
        </div>
      }
    >
      <ProtectedJournal />
    </Suspense>
  );
}
