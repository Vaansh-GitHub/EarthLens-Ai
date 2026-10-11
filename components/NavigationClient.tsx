"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, Leaf, Camera, BookOpen, Image as ImageIcon, 
  UserCircle, Menu, X, ChevronRight, Sparkles 
} from "lucide-react";
import { useState, useEffect } from "react";

export function NavigationClient({ userId }: { userId: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const navLinks = userId
    ? [
        { href: "/", icon: <Compass className="w-4 h-4" />, label: "Home" },
        { href: "/discover", icon: <Camera className="w-4 h-4" />, label: "Discover" },
        { href: "/journal", icon: <BookOpen className="w-4 h-4" />, label: "Journal" },
        { href: "/studio", icon: <ImageIcon className="w-4 h-4" />, label: "Studio" },
      ]
    : [
        { href: "#how-it-works", icon: <Compass className="w-4 h-4" />, label: "How It Works" },
        { href: "#features", icon: <Leaf className="w-4 h-4" />, label: "Features" },
        { href: "#mission", icon: <BookOpen className="w-4 h-4" />, label: "Our Mission" },
      ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F8F1]/90 backdrop-blur-md border-b border-[#DCE5D8] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 md:h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-[#1E3526] hover:opacity-90 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#1E3526] flex items-center justify-center border border-[#DCE5D8] shadow-xs shrink-0">
              <img src="/logo-icon.png" alt="EarthLens AI" className="w-full h-full object-cover" />
            </div>
            <span>
              EarthLens <span className="text-[#3E6548] font-semibold text-sm tracking-normal">AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-1 bg-white/80 p-1.5 rounded-full border border-[#DCE5D8] shadow-2xs">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#294B36] text-white shadow-xs"
                        : "text-[#38483B] hover:text-[#1E3526] hover:bg-[#E4EEDF]/60"
                    }`}
                  >
                    <span className={isActive ? "text-[#D2E3CE]" : "text-[#5F7363]"}>
                      {link.icon}
                    </span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="h-5 w-[1px] bg-[#DCE5D8]" />

            {userId ? (
              <Link
                href="/profile"
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  pathname === "/profile"
                    ? "bg-[#294B36] text-white border-[#294B36] shadow-xs"
                    : "bg-white text-[#1E3526] border-[#DCE5D8] hover:bg-[#F5F8F1] hover:border-[#CBD8C6] shadow-2xs"
                }`}
              >
                <UserCircle className={`w-4 h-4 ${pathname === "/profile" ? "text-[#D2E3CE]" : "text-[#3E6548]"}`} />
                <span>Profile</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/login"
                  className="text-xs font-bold text-[#1E3526] hover:text-[#294B36] px-3 py-1.5 rounded-lg transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center px-4 py-2 rounded-full bg-[#294B36] hover:bg-[#1E3526] text-white text-xs font-bold shadow-xs transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            className="md:hidden w-10 h-10 rounded-xl bg-white border border-[#DCE5D8] flex items-center justify-center text-[#1E3526] hover:bg-[#E4EEDF] transition-colors shadow-2xs cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-[#F5F8F1] overflow-y-auto flex flex-col p-5 md:hidden border-t border-[#DCE5D8] animate-in fade-in slide-in-from-top-2 duration-200">
          
          <div className="flex flex-col gap-5 flex-1 max-w-md mx-auto w-full">
            
            {/* Unified Grouped Navigation Links */}
            <div className="bg-white rounded-2xl border border-[#DCE5D8] p-1.5 shadow-xs divide-y divide-[#F0F4ED]">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-[#E4EEDF] text-[#1E3526] font-bold"
                        : "text-[#294B36] hover:bg-[#F5F8F1] font-semibold"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                        isActive ? "bg-[#294B36] text-white" : "bg-[#E4EEDF] text-[#294B36]"
                      }`}>
                        {link.icon}
                      </div>
                      <span className="text-sm">{link.label}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isActive ? "text-[#294B36]" : "text-[#8BA090]"}`} />
                  </Link>
                );
              })}
            </div>

            {/* User Account / Actions Section */}
            {userId ? (
              <div className="bg-white rounded-2xl border border-[#DCE5D8] p-1.5 shadow-xs">
                <Link
                  href="/profile"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                    pathname === "/profile"
                      ? "bg-[#E4EEDF] text-[#1E3526] font-bold"
                      : "text-[#294B36] hover:bg-[#F5F8F1] font-semibold"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      pathname === "/profile" ? "bg-[#294B36] text-white" : "bg-[#E4EEDF] text-[#294B36]"
                    }`}>
                      <UserCircle className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm">Your Profile</div>
                      <div className="text-[11px] text-[#5F7363] font-normal">Rank, stats & settings</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8BA090]" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center py-3 px-4 rounded-xl bg-white border border-[#DCE5D8] text-[#1E3526] text-sm font-bold hover:bg-[#F5F8F1] transition-colors shadow-2xs"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center py-3 px-4 rounded-xl bg-[#294B36] text-white text-sm font-bold hover:bg-[#1E3526] transition-all shadow-xs"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Bottom brand tagline */}
            <div className="mt-auto py-6 text-center text-xs text-[#5F7363] flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#3E6548]" />
              <span>An AI to link you to nature</span>
            </div>

          </div>

        </div>
      )}
    </>
  );
}
