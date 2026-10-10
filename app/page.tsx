import Link from "next/link";
import { 
  Camera, 
  Sparkles, 
  Leaf, 
  BookOpen, 
  ArrowRight, 
  Compass, 
  Sun, 
  Award, 
  CheckCircle2 
} from "lucide-react";
import { XPProgress } from "@/components/XPProgress";
import { QuestCard } from "@/components/QuestCard";
import { getAuthenticatedUserId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/mongodb";
import { calculateUserProgression } from "@/lib/server/progression";

export default async function HomePage() {
  const userId = await getAuthenticatedUserId();

  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATED EXPLORER DASHBOARD (REAL DB DATA)
  // ─────────────────────────────────────────────────────────────
  if (userId) {
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: userId });
    const discoveryCount = await db.collection("discoveries").countDocuments({ userId });
    const progression = calculateUserProgression(user?.xp, discoveryCount);
    const userName = user?.name || "Explorer";

    const recentDiscoveries = await db
      .collection("discoveries")
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();

    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-8 md:gap-10">
        <header className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4EEDF] text-[#294B36] text-xs font-semibold w-fit">
            <Sparkles className="w-3.5 h-3.5 text-[#3E6548]" />
            <span>Welcome back, {userName}</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#1E3526] tracking-tight">
            Find Nature. <span className="text-[#3E6548]">Discover Yourself.</span>
          </h1>
          <p className="text-sm md:text-base text-[#5F7363] max-w-xl">
            {discoveryCount > 0 
              ? `You have logged ${discoveryCount} field ${discoveryCount === 1 ? "discovery" : "discoveries"}. Ready for your next outdoor observation?`
              : "Step outside, observe your local biome, and log your very first nature discovery."}
          </p>
        </header>

        {/* Primary Action Button */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link 
            href="/discover"
            className="flex-1 flex items-center justify-center gap-3 bg-[#294B36] hover:bg-[#1E3526] text-white px-6 py-4 rounded-2xl font-bold text-lg shadow-sm hover:shadow transition-all"
          >
            <Camera className="w-5 h-5 text-[#D2E3CE]" />
            Start New Discovery
          </Link>
          <Link 
            href="/journal"
            className="flex items-center justify-center gap-2 bg-white hover:bg-[#F5F8F1] text-[#294B36] border border-[#DCE5D8] px-6 py-4 rounded-2xl font-bold text-base transition-all"
          >
            <BookOpen className="w-5 h-5 text-[#3E6548]" />
            View Field Journal ({discoveryCount})
          </Link>
        </div>

        {/* Activity & Quest Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white p-6 rounded-2xl border border-[#DCE5D8] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1E3526] flex items-center gap-2">
                <Award className="w-5 h-5 text-[#3E6548]" />
                Explorer Rank & XP
              </h2>
              <span className="text-xs font-semibold text-[#5F7363]">
                {progression.totalXp} Total XP
              </span>
            </div>
            <XPProgress 
              currentXP={progression.currentLevelXp} 
              level={progression.level} 
              nextLevelXP={progression.nextLevelXp} 
            />
          </section>

          <section className="bg-white p-6 rounded-2xl border border-[#DCE5D8] shadow-sm flex flex-col gap-4">
            <h2 className="text-lg font-bold text-[#1E3526] flex items-center gap-2">
              <Sun className="w-5 h-5 text-[#3E6548]" />
              Today&apos;s Nature Quest
            </h2>
            <QuestCard 
              title="Canopy Patterns" 
              description="Find and photograph the leaf structure or bark of a native tree."
              reward={50}
            />
          </section>
        </div>

        {/* Recent Field Discoveries Section */}
        {recentDiscoveries.length > 0 && (
          <section className="bg-white p-6 rounded-2xl border border-[#DCE5D8] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1E3526] flex items-center gap-2">
                <Leaf className="w-5 h-5 text-[#3E6548]" />
                Recent Discoveries
              </h2>
              <Link href="/journal" className="text-xs font-semibold text-[#294B36] hover:underline">
                View all ({discoveryCount}) &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {recentDiscoveries.map((item) => (
                <Link
                  key={item._id.toString()}
                  href={`/journal`}
                  className="p-3.5 rounded-xl bg-[#F5F8F1] border border-[#DCE5D8] hover:border-[#294B36] transition-all flex flex-col gap-1"
                >
                  <p className="font-bold text-sm text-[#1E3526] truncate">
                    {item.analysis?.candidateIdentification || "Unknown Specimen"}
                  </p>
                  <p className="text-xs text-[#5F7363] capitalize">
                    {item.observation?.category || "Observation"} • {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CLEAN, ORGANIZED, STANDARD LANDING PAGE (Non-logged in)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col items-center">
      
      {/* ── HERO SECTION ── */}
      <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 md:pt-20 md:pb-24 flex flex-col items-center text-center">
        
        {/* Hackathon Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E4EEDF] border border-[#D2E3CE] text-[#294B36] text-xs font-semibold mb-6">
          <Leaf className="w-4 h-4 text-[#3E6548]" />
          <span>Hacktoberfest 2026 • Touch Grass Challenge</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#1E3526] tracking-tight leading-[1.1] max-w-4xl">
          Step outside. Discover nature. <br className="hidden sm:block" />
          <span className="text-[#3E6548]">Reflect within.</span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-base sm:text-lg md:text-xl text-[#5F7363] max-w-2xl leading-relaxed">
          EarthLens AI helps you disconnect from screens and explore the living world. 
          Photograph plants and wildlife, discover their ecological roles with AI, and create mindful memory cards.
        </p>

        {/* Call to Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#294B36] hover:bg-[#1E3526] text-white px-8 py-3.5 rounded-full font-bold text-base shadow-sm hover:shadow transition-all"
          >
            Start Exploring Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#F5F8F1] text-[#294B36] border border-[#DCE5D8] px-7 py-3.5 rounded-full font-semibold text-base transition-all"
          >
            <Compass className="w-4 h-4 text-[#3E6548]" />
            See How It Works
          </Link>
        </div>

        {/* Feature Pill Highlights */}
        <div className="mt-12 pt-8 border-t border-[#DCE5D8] w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-[#5F7363]">
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#3E6548]" />
            <span>AI Species Vision</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#3E6548]" />
            <span>Ecological Insights</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#3E6548]" />
            <span>Mindful Quotes</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#3E6548]" />
            <span>100% Free & Open</span>
          </div>
        </div>

        {/* ── PRODUCT PREVIEW CARD (Clean Botanical Showcase) ── */}
        <div className="mt-14 w-full max-w-4xl bg-white rounded-3xl border border-[#DCE5D8] p-6 sm:p-8 shadow-sm text-left">
          <div className="flex flex-col md:flex-row items-center gap-8">
            
            {/* Visual Botanical Mockup */}
            <div className="w-full md:w-1/2 rounded-2xl bg-[#E4EEDF]/60 border border-[#DCE5D8] p-6 flex flex-col justify-between aspect-[4/3] relative overflow-hidden">
              <div className="flex items-center justify-between z-10">
                <span className="px-3 py-1 rounded-full bg-white/90 text-[#294B36] text-xs font-bold shadow-xs">
                  🌿 Specimen #042
                </span>
                <span className="text-xs font-semibold text-[#5F7363]">
                  Field Observation
                </span>
              </div>
              
              {/* Graphic Motif */}
              <div className="my-auto py-4 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#294B36] flex items-center justify-center text-white mb-3 shadow-sm">
                  <Leaf className="w-8 h-8 text-[#D2E3CE]" />
                </div>
                <h4 className="text-xl font-bold text-[#1E3526]">Silver Birch</h4>
                <p className="text-xs text-[#5F7363] italic">Betula pendula</p>
              </div>

              <div className="flex items-center justify-between text-xs text-[#294B36] font-medium z-10 pt-2 border-t border-[#DCE5D8]">
                <span>Pioneer Species</span>
                <span>Soil Revitalizer</span>
              </div>
            </div>

            {/* AI Insights & Reflection Details */}
            <div className="w-full md:w-1/2 flex flex-col gap-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3E6548] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                AI Ecological Analysis & Reflection
              </div>

              <h3 className="text-2xl font-bold text-[#1E3526]">
                Nature as your greatest teacher
              </h3>

              <div className="space-y-3 text-sm text-[#5F7363]">
                <div className="p-3.5 rounded-xl bg-[#F5F8F1] border border-[#DCE5D8]">
                  <p className="font-semibold text-[#1E3526] text-xs mb-1">Ecological Role:</p>
                  <p className="text-xs leading-relaxed">
                    Birch trees are primary colonizers. They nourish poor ground, prepare the canopy for oaks, and sustain over 300 insect species.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F5F8F1] border border-[#DCE5D8]">
                  <p className="font-semibold text-[#1E3526] text-xs mb-1">Philosophical Reflection:</p>
                  <p className="text-xs italic text-[#38483B] leading-relaxed">
                    &ldquo;Like the birch on disturbed ground, you do not need perfect conditions to begin. Your presence can heal the soil for what comes next.&rdquo;
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#D2E3CE] text-[#1E3526]">
                  +50 Explorer XP
                </span>
                <span className="text-xs text-[#5F7363]">
                  Ready to download as Memory Card
                </span>
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="w-full bg-white border-y border-[#DCE5D8] py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E4EEDF] text-[#294B36] text-xs font-bold mb-3">
            <span>Simple 3-Step Flow</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold text-[#1E3526] tracking-tight">
            How EarthLens AI Works
          </h2>
          <p className="mt-3 text-[#5F7363] max-w-xl mx-auto text-sm sm:text-base">
            No complicated gear. No sensor setups. Just your curiosity and the outdoors.
          </p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Step 1 */}
            <div className="bg-[#F5F8F1] p-8 rounded-3xl border border-[#DCE5D8] flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#294B36] text-white flex items-center justify-center font-bold text-lg mb-6 shadow-xs">
                01
              </div>
              <h3 className="text-xl font-bold text-[#1E3526] mb-2">Step Outside & Capture</h3>
              <p className="text-sm text-[#5F7363] leading-relaxed">
                Take a mindful walk. When you notice an interesting leaf, wild mushroom, pollinator, or bark texture, snap a photo.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#F5F8F1] p-8 rounded-3xl border border-[#DCE5D8] flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#3E6548] text-white flex items-center justify-center font-bold text-lg mb-6 shadow-xs">
                02
              </div>
              <h3 className="text-xl font-bold text-[#1E3526] mb-2">Discover Ecology</h3>
              <p className="text-sm text-[#5F7363] leading-relaxed">
                Our vision AI identifies candidate species and explains their purpose in the ecosystem, connecting you directly to nature.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#F5F8F1] p-8 rounded-3xl border border-[#DCE5D8] flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#5F7363] text-white flex items-center justify-center font-bold text-lg mb-6 shadow-xs">
                03
              </div>
              <h3 className="text-xl font-bold text-[#1E3526] mb-2">Reflect & Save</h3>
              <p className="text-sm text-[#5F7363] leading-relaxed">
                Receive personalized contemplative insights and download a beautifully formatted digital memory card to keep or share.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── CORE FEATURES GRID ── */}
      <section id="features" className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E4EEDF] text-[#294B36] text-xs font-bold mb-3">
            <span>Core Capabilities</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#1E3526] tracking-tight">
            Designed for curious outdoor minds
          </h2>
          <p className="mt-3 text-[#5F7363] max-w-xl mx-auto text-sm sm:text-base">
            Everything you need to turn casual strolls into mindful botanical expeditions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-white p-6 rounded-2xl border border-[#DCE5D8] shadow-xs flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E4EEDF] flex items-center justify-center text-[#294B36]">
              <Camera className="w-5 h-5 text-[#3E6548]" />
            </div>
            <h3 className="font-bold text-[#1E3526] text-base">AI Vision Identification</h3>
            <p className="text-xs text-[#5F7363] leading-relaxed">
              Upload photos directly from your phone or desktop. Receive immediate species suggestions and taxonomy.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#DCE5D8] shadow-xs flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E4EEDF] flex items-center justify-center text-[#294B36]">
              <Leaf className="w-5 h-5 text-[#3E6548]" />
            </div>
            <h3 className="font-bold text-[#1E3526] text-base">Ecological Significance</h3>
            <p className="text-xs text-[#5F7363] leading-relaxed">
              Learn how organisms interact with their surroundings — pollinators, mycorrhizal networks, and climate resilience.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#DCE5D8] shadow-xs flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E4EEDF] flex items-center justify-center text-[#294B36]">
              <Sparkles className="w-5 h-5 text-[#3E6548]" />
            </div>
            <h3 className="font-bold text-[#1E3526] text-base">Memory Card Studio</h3>
            <p className="text-xs text-[#5F7363] leading-relaxed">
              Transform every outdoor finding into an aesthetic quote card that captures both observation and philosophical thought.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#DCE5D8] shadow-xs flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E4EEDF] flex items-center justify-center text-[#294B36]">
              <Award className="w-5 h-5 text-[#3E6548]" />
            </div>
            <h3 className="font-bold text-[#1E3526] text-base">Explorer Progression</h3>
            <p className="text-xs text-[#5F7363] leading-relaxed">
              Complete daily nature quests, earn experience points (XP), and track your personal journey in the nature field journal.
            </p>
          </div>

        </div>
      </section>

      {/* ── MISSION / TOUCH GRASS SECTION ── */}
      <section id="mission" className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="w-full bg-[#1E3526] text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#294B36] text-[#D2E3CE] text-xs font-semibold mb-4">
              <Sun className="w-3.5 h-3.5" />
              <span>The Touch Grass Philosophy</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Technology that encourages you to look away from screens.
            </h2>
            <p className="mt-4 text-[#D2E3CE]/90 text-sm sm:text-base leading-relaxed">
              Most digital applications are engineered to keep you scrolling indoors. 
              EarthLens AI was built for Hacktoberfest Week 1 with the opposite intent: 
              to give you a meaningful excuse to step outside, breathe fresh air, and observe the biodiversity right around you.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 text-xs font-medium text-[#E4EEDF]">
              <span className="flex items-center gap-1.5 bg-[#294B36]/80 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#D2E3CE]" />
                Zero Endless Feeds
              </span>
              <span className="flex items-center gap-1.5 bg-[#294B36]/80 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#D2E3CE]" />
                Privacy-Preserving
              </span>
              <span className="flex items-center gap-1.5 bg-[#294B36]/80 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#D2E3CE]" />
                Open Source & Educational
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CALL TO ACTION ── */}
      <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="bg-white rounded-3xl border border-[#DCE5D8] p-8 sm:p-12 shadow-xs flex flex-col items-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E3526]">
            Ready to explore what lives outside your door?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#5F7363] max-w-lg">
            Create your explorer account in seconds. Photograph your first discovery and start your field journal.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-[#294B36] hover:bg-[#1E3526] text-white px-7 py-3 rounded-full font-bold text-sm shadow-sm transition-all"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center text-sm font-semibold text-[#294B36] hover:text-[#1E3526] px-4 py-3"
            >
              Already have an account? Log in
            </Link>
          </div>
        </div>
      </section>

      {/* ── STANDARD FOOTER ── */}
      <footer className="w-full bg-[#EAF1E5] border-t border-[#DCE5D8] mt-12 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#5F7363]">
          
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#294B36] flex items-center justify-center text-white">
              <Leaf className="w-4 h-4 text-[#D2E3CE]" />
            </div>
            <span className="font-bold text-[#1E3526] text-sm">EarthLens AI</span>
            <span className="text-[#5F7363]">| Find Nature. Discover Yourself.</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <Link href="#how-it-works" className="hover:text-[#1E3526] transition-colors">How It Works</Link>
            <Link href="#features" className="hover:text-[#1E3526] transition-colors">Features</Link>
            <Link href="#mission" className="hover:text-[#1E3526] transition-colors">Mission</Link>
            <Link href="/login" className="hover:text-[#1E3526] transition-colors">Log In</Link>
            <Link href="/signup" className="hover:text-[#1E3526] transition-colors">Sign Up</Link>
          </div>

          <div className="text-center md:text-right">
            <span>Built for Hacktoberfest 2026 • &ldquo;Touch Grass&rdquo; Challenge</span>
          </div>

        </div>
      </footer>

    </div>
  );
}
