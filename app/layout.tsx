import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EarthLens AI - Find Nature. Discover Yourself.",
  description: "Explore nature, photograph something interesting outdoors, discover information about it using AI, and reflect on what you learned.",
  icons: {
    icon: [
      { url: "/logo-icon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/logo-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pt-16 md:pt-20 bg-background">
        <Suspense fallback={<nav className="fixed top-0 left-0 right-0 z-50 h-16 md:h-20 bg-background/80 backdrop-blur-md border-b border-sage-light" />}>
          <Navigation />
        </Suspense>
        <main className="flex-1 flex flex-col w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
