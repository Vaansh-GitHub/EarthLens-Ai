"use client";

import { useEffect, useRef } from "react";

interface PartyPopperProps {
  questTitle?: string;
  matchScore?: number;
  bonusXp?: number;
  onClose?: () => void;
}

export function PartyPopper({ questTitle = "Daily Quest", matchScore = 85, bonusXp = 50, onClose }: PartyPopperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = [
      "#294B36", "#3E6548", "#1E3526", // Foliage greens
      "#F59E0B", "#FBBF24", "#D97706", // Golden hour golds
      "#10B981", "#34D399",             // Mint emeralds
      "#EF4444", "#F43F5E",             // Festive corals
    ];

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      rotSpeed: number;
      shape: "rect" | "circle";
      opacity: number;
    }

    const particles: Particle[] = [];
    const count = 120;

    // Launch particles from bottom-left and bottom-right corners toward the center
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      const startX = fromLeft ? window.innerWidth * 0.1 : window.innerWidth * 0.9;
      const startY = window.innerHeight * 0.85;

      const angle = fromLeft
        ? -Math.PI / 3 + (Math.random() - 0.5) * 0.5 // Angled up and right
        : -Math.PI * (2 / 3) + (Math.random() - 0.5) * 0.5; // Angled up and left

      const speed = 14 + Math.random() * 12;

      particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 8 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
        shape: Math.random() > 0.4 ? "rect" : "circle",
        opacity: 1,
      });
    }

    const gravity = 0.4;
    const drag = 0.985;
    let elapsed = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      elapsed++;

      let aliveCount = 0;
      for (const p of particles) {
        p.vx *= drag;
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        if (elapsed > 90) {
          p.opacity = Math.max(0, p.opacity - 0.02);
        }

        if (p.opacity > 0) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;

          if (p.shape === "rect") {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (aliveCount > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
      {/* Confetti Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Celebratory Modal Popout */}
      <div className="relative pointer-events-auto bg-white/95 backdrop-blur-md border-2 border-[#294B36] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-90 fade-in duration-500">
        <div className="w-16 h-16 rounded-full bg-[#E4EEDF] border-2 border-[#3E6548] flex items-center justify-center text-3xl mb-4 shadow-sm animate-bounce">
          🎉
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E4EEDF] text-[#294B36] text-xs font-extrabold uppercase tracking-wider mb-2">
          Quest Completed!
        </span>

        <h3 className="text-2xl font-black text-[#1E3526] mb-1">
          {questTitle}
        </h3>

        <p className="text-sm text-[#5F7363] mb-4">
          Your observation achieved a <strong className="text-[#294B36]">{matchScore}% match</strong> with today&apos;s nature challenge!
        </p>

        <div className="w-full bg-[#F5F8F1] border border-[#DCE5D8] rounded-2xl p-4 flex items-center justify-around mb-6">
          <div className="flex flex-col">
            <span className="text-xs text-[#5F7363] font-semibold">Discovery XP</span>
            <span className="text-lg font-bold text-[#1E3526]">+50 XP</span>
          </div>
          <div className="h-8 w-px bg-[#DCE5D8]" />
          <div className="flex flex-col">
            <span className="text-xs text-[#5F7363] font-semibold">Quest Bonus</span>
            <span className="text-lg font-extrabold text-[#294B36]">+{bonusXp} XP</span>
          </div>
          <div className="h-8 w-px bg-[#DCE5D8]" />
          <div className="flex flex-col">
            <span className="text-xs text-[#5F7363] font-semibold">Total Earned</span>
            <span className="text-lg font-black text-[#1E3526]">+{50 + bonusXp} XP</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 bg-[#294B36] hover:bg-[#1E3526] text-white rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
        >
          Claim Points & Continue
        </button>
      </div>
    </div>
  );
}
