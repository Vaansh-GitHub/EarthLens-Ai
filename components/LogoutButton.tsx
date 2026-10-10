"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[#B91C1C] hover:text-white bg-[#FEE2E2]/60 hover:bg-[#B91C1C] rounded-xl transition-all text-xs font-bold border border-[#FCA5A5]/50 disabled:opacity-50 cursor-pointer"
    >
      <LogOut className="w-4 h-4" />
      {isLoading ? "Signing Out..." : "Sign Out"}
    </button>
  );
}
