import { getAuthenticatedUserId } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { StudioClient } from "./StudioClient";
import { Suspense } from "react";

async function ProtectedStudio() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");
  
  return <StudioClient />;
}

export default function StudioPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 w-full mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-sage border-t-forest rounded-full animate-spin" />
      </div>
    }>
      <ProtectedStudio />
    </Suspense>
  );
}
