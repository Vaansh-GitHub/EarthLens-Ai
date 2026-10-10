import { JournalGrid } from "@/components/JournalGrid";
import { getAuthenticatedUserId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/mongodb";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function JournalContent() {
  const userId = await getAuthenticatedUserId();
  
  if (!userId) {
    // If not authenticated, redirect to login
    redirect("/login");
  }

  const db = await getDb();
  // Fetch discoveries for this user
  const discoveries = await db
    .collection("discoveries")
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();

  // Map to JournalGrid format
  const mappedEntries = discoveries.map((doc) => ({
    id: doc._id.toString(),
    title: doc.analysis?.candidateIdentification || "Unknown Discovery",
    category: doc.observation?.category || "other",
    date: new Date(doc.createdAt).toLocaleDateString("en-US", { 
      year: 'numeric', month: 'short', day: 'numeric' 
    }),
    imageUrl: doc.observation?.photoUrl,
  }));

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 animate-in fade-in duration-500 mb-10">
      
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-forest">
          Nature Journal
        </h1>
        <p className="text-sage max-w-xl">
          A chronicle of your discoveries and reflections. Watch your connection to the natural world grow over time.
        </p>
      </header>

      {mappedEntries.length > 0 ? (
        <JournalGrid entries={mappedEntries} />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-surface/30 rounded-2xl border border-border/50">
          <p className="text-forest mb-4">Your journal is empty.</p>
          <Link 
            href="/discover" 
            className="px-6 py-3 bg-[#294B36] hover:bg-[#1E3526] text-white font-bold rounded-full transition-all shadow-sm"
          >
            <span className="text-white font-bold">Start Discovering</span>
          </Link>
        </div>
      )}
      
    </div>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 w-full mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-sage border-t-forest rounded-full animate-spin" />
      </div>
    }>
      <JournalContent />
    </Suspense>
  );
}
