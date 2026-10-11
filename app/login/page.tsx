"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/journal");
        router.refresh();
      } else {
        setError(data.error?.message || "Failed to login");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-md mx-auto p-6 flex flex-col justify-center animate-in fade-in duration-500 min-h-[80vh]">
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md border border-[#DCE5D8] mb-4 bg-[#1E3526] flex items-center justify-center">
          <img src="/logo-icon.png" alt="EarthLens AI" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-3xl font-bold text-forest">Welcome Back</h1>
        <p className="text-sage mt-2">Log in to continue your journey</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-forest-dark">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl p-3 text-forest focus:outline-none focus:ring-2 focus:ring-earth/50 transition-shadow"
            placeholder="explorer@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-forest-dark">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl p-3 text-forest focus:outline-none focus:ring-2 focus:ring-earth/50 transition-shadow"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 mt-4 rounded-xl bg-[#294B36] hover:bg-[#1E3526] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
        >
          <span className="text-white font-bold">{isLoading ? "Logging in..." : "Log In"}</span>
        </button>
      </form>

      <p className="text-center text-sage mt-6 text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-earth hover:text-forest font-semibold transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  );
}
