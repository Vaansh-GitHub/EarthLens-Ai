"use client";

import Link from "next/link";
import { Compass, Leaf, Camera, BookOpen, Image as ImageIcon, UserCircle, Menu, X } from "lucide-react";
import { useState } from "react";

export function NavigationClient({ userId }: { userId: string | null }) {
  const [isOpen, setIsOpen] = useState(false);

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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F8F1]/95 backdrop-blur-md border-b border-[#DCE5D8] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 md:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-[#294B36] hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-[#294B36] flex items-center justify-center text-white shadow-sm">
              <Leaf className="w-5 h-5 text-[#D2E3CE]" />
            </div>
            <span>EarthLens <span className="text-[#3E6548] font-medium text-base">AI</span></span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-6">
              {navLinks.map((link) => (
                <NavLink key={link.href} href={link.href} icon={link.icon} label={link.label} />
              ))}
            </div>

            <div className="h-6 w-[1px] bg-[#DCE5D8]" />

            {userId ? (
              <NavLink href="/profile" icon={<UserCircle className="w-5 h-5" />} label="Profile" />
            ) : (
              <div className="flex items-center gap-3">
                <Link 
                  href="/login" 
                  className="text-sm font-semibold text-[#294B36] hover:text-[#1d3526] px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  Log In
                </Link>
                <Link 
                  href="/signup" 
                  className="px-5 py-2 rounded-full bg-[#294B36] text-white text-sm font-semibold hover:bg-[#1f3a2a] shadow-sm hover:shadow transition-all whitespace-nowrap"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-forest"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Overlay */}
      {isOpen && (
        <div className="fixed inset-0 top-[64px] z-40 bg-background flex flex-col p-4 md:hidden border-t border-sage-light">
          <div className="flex flex-col gap-4 flex-1 mt-4">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-sage-light text-forest font-semibold"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-3 pb-8">
            {userId ? (
              <Link 
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white border border-sage-light text-forest font-semibold"
              >
                <UserCircle className="w-5 h-5" />
                Profile
              </Link>
            ) : (
              <>
                <Link 
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center p-4 rounded-2xl bg-white border border-sage-light text-forest font-bold"
                >
                  Log In
                </Link>
                <Link 
                  href="/signup"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center p-4 rounded-2xl bg-forest text-white font-bold"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link 
      href={href} 
      className="group flex items-center gap-2 text-sm font-semibold text-foreground hover:text-forest transition-colors"
    >
      <span className="text-sage group-hover:text-earth transition-colors">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
