import { getAuthenticatedUserId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/mongodb";
import { redirect } from "next/navigation";
import { UserCircle, Settings, Award, Calendar } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { Suspense } from "react";
import { calculateUserProgression } from "@/lib/server/progression";
import { ProfileAchievementsClient } from "@/components/ProfileAchievementsClient";
import Link from "next/link";

async function ProfileContent() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: userId });

  if (!user) {
    redirect("/login");
  }

  // Fetch actual discoveries count for this user
  const mongoCount = await db.collection("discoveries").countDocuments({ userId });
  const userCount = typeof user.discoveriesCount === "number" ? user.discoveriesCount : 0;
  const inferredCount = user.xp && user.xp >= 50 ? Math.floor(user.xp / 50) : 0;
  const discoveryCount = Math.max(mongoCount, userCount, inferredCount);
  const progression = calculateUserProgression(user.xp, discoveryCount);

  const memberSince = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) 
    : "Recently";

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-8 animate-in fade-in duration-500 mb-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#1E3526]">
          Your Profile
        </h1>
        <p className="text-sm md:text-base text-[#5F7363]">
          Manage your account and view your real naturalist stats.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Account Details Card */}
        <div className="flex flex-col gap-6 bg-white p-6 md:p-8 rounded-3xl border border-[#DCE5D8] shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#E4EEDF] rounded-full flex items-center justify-center text-[#294B36] shrink-0">
              <UserCircle className="w-10 h-10" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-[#1E3526] truncate">{user.name}</h2>
              <p className="text-sm text-[#5F7363] truncate">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#5F7363] bg-[#F5F8F1] px-3.5 py-2 rounded-xl border border-[#DCE5D8]">
            <Calendar className="w-4 h-4 text-[#3E6548]" />
            <span>Member since {memberSince}</span>
          </div>

          <div className="h-px w-full bg-[#DCE5D8]" />

          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-[#1E3526] text-xs uppercase tracking-wider">Account Actions</h3>
            <LogoutButton />
          </div>
        </div>

        {/* Real Achievements & Stats */}
        <div className="flex flex-col gap-6">
          <ProfileAchievementsClient
            initialCount={discoveryCount}
            userXp={user.xp ?? 0}
            initialProgression={progression}
          />

          <div className="bg-white p-6 rounded-3xl border border-[#DCE5D8] shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[#1E3526] font-bold text-sm">
              <Settings className="w-4 h-4 text-[#3E6548]" />
              Settings & Preferences
            </div>
            <p className="text-xs text-[#5F7363] leading-relaxed">
              Account settings, notification preferences, and privacy controls will be available here soon.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 w-full mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#DCE5D8] border-t-[#294B36] rounded-full animate-spin" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
