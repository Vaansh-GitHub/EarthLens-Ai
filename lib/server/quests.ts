import { getDb } from "./mongodb";

export interface DailyQuest {
  date: string; // "YYYY-MM-DD"
  title: string;
  description: string;
  reward: number;
  category?: string;
  generatedBy?: "ai" | "fallback";
}

// In-memory variable that holds today's quest and automatically renews when the date changes
let cachedDailyQuest: DailyQuest | null = null;

// Rotating seasonal fallbacks in case AI generation is temporarily unreachable
const FALLBACK_QUESTS = [
  {
    title: "Canopy Patterns",
    description: "Find and photograph the leaf structure or bark texture of a native tree.",
    reward: 50,
  },
  {
    title: "Morning Dew Drops",
    description: "Look for microscopic water droplets clinging to leaves or spider webs in early light.",
    reward: 50,
  },
  {
    title: "Pollinator Pathway",
    description: "Observe a flowering plant and photograph any visiting bees, butterflies, or insects.",
    reward: 50,
  },
  {
    title: "Moss & Lichen Microcosm",
    description: "Discover a patch of moss or lichen growing on stone, brick, or deadwood.",
    reward: 50,
  },
  {
    title: "Seed Travelers",
    description: "Identify how seeds around you disperse — through wind, burrs, or fallen fruit.",
    reward: 50,
  },
  {
    title: "Understory Shadows",
    description: "Explore shrubs and groundcover in a shady corner and observe what lives beneath.",
    reward: 50,
  },
  {
    title: "Wildflower Resilience",
    description: "Spot a wild plant thriving through sidewalk cracks or disturbed urban soil.",
    reward: 50,
  },
];

function getTodayKey(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function getFallbackQuest(dateKey: string): DailyQuest {
  // Deterministic daily rotation based on date string
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const selected = FALLBACK_QUESTS[hash % FALLBACK_QUESTS.length];
  return {
    date: dateKey,
    title: selected.title,
    description: selected.description,
    reward: selected.reward,
    generatedBy: "fallback",
  };
}

async function generateQuestWithAI(dateKey: string): Promise<DailyQuest | null> {
  if (process.env.NODE_ENV === "test") return null;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const baseUrl = process.env.CLOUDFLARE_AI_BASE_URL || "https://api.cloudflare.com/client/v4";
  const modelId = process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct";

  if (!accountId || !apiToken) return null;

  const endpointUrl = `${baseUrl}/accounts/${accountId}/ai/run/${modelId}`;

  const prompt = `You are EarthLens AI, an expert naturalist guide.
Generate a fresh, creative, and inspiring daily nature quest for outdoor explorers for date ${dateKey}.
The quest should encourage stepping outside to photograph and reflect on nature (e.g. wild plants, bark, birds, insects, moss, weather, or natural patterns).
Return strictly a JSON object with:
{
  "title": "Short catchy title (2-4 words)",
  "description": "One actionable sentence describing what nature specimen or feature to find and photograph.",
  "reward": 50
}
CRITICAL: Output must begin with { and end with }. Do not include any extra text, conversational intro, or markdown blocks.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, max_tokens: 250 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const raw = data.result?.response ?? data.response;
    if (!raw) return null;

    const jsonString = typeof raw === "string" ? raw.trim() : JSON.stringify(raw);
    const match = jsonString.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (parsed.title && parsed.description) {
      return {
        date: dateKey,
        title: String(parsed.title).trim(),
        description: String(parsed.description).trim(),
        reward: typeof parsed.reward === "number" ? parsed.reward : 50,
        generatedBy: "ai",
      };
    }
    return null;
  } catch (err) {
    console.warn("AI quest generation skipped, using fallback:", err);
    return null;
  }
}

/**
 * Returns today's quest.
 * Kept in the in-memory variable `cachedDailyQuest` which automatically renews when the date changes.
 */
export async function getDailyQuest(): Promise<DailyQuest> {
  const today = getTodayKey();

  // 1. Check in-memory variable (fastest, zero overhead)
  if (cachedDailyQuest && cachedDailyQuest.date === today) {
    return cachedDailyQuest;
  }

  // 2. Check MongoDB collection to see if today's quest was already generated earlier
  try {
    const db = await getDb();
    const existing = await db.collection("daily_quests").findOne({ date: today });
    if (existing && existing.title && existing.description) {
      cachedDailyQuest = {
        date: existing.date,
        title: existing.title,
        description: existing.description,
        reward: existing.reward || 50,
        generatedBy: existing.generatedBy || "ai",
      };
      return cachedDailyQuest;
    }
  } catch {
    // If DB is temporarily unavailable, continue to generation
  }

  // 3. Generate new quest using AI for today
  let quest = await generateQuestWithAI(today);

  // 4. Fallback if AI generation failed
  if (!quest) {
    quest = getFallbackQuest(today);
  }

  // 5. Update in-memory variable
  cachedDailyQuest = quest;

  // 6. Persist to MongoDB asynchronously
  try {
    const db = await getDb();
    await db.collection("daily_quests").updateOne(
      { date: today },
      { $set: quest },
      { upsert: true }
    );
  } catch {
    // Non-blocking
  }

  return cachedDailyQuest;
}

export interface QuestMatchResult {
  score: number; // 0 - 100
  questMatchScore: number; // 0 - 100
  questMatchStatus: "strong_match" | "partial_match" | "insufficient_match";
  matchedRequirements: string[];
  missingRequirements: string[];
  matchExplanation: string;
  retrySuggestion: string | null;
  matched: boolean; // true if score >= 70
  bonusXp: number; // quest.reward if matched, otherwise 0
  reason: string;
}

/**
 * Evaluates whether a user's discovery matches today's quest.
 * Matches with a score >= 70% receive the quest bonus.
 * Strong match: 90-100%
 * Partial match: 70-89%
 * Insufficient match: Below 70%
 */
export async function evaluateQuestMatch(
  quest: DailyQuest,
  analysis?: Record<string, unknown>,
  observation?: Record<string, unknown>
): Promise<QuestMatchResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const baseUrl = process.env.CLOUDFLARE_AI_BASE_URL || "https://api.cloudflare.com/client/v4";
  const modelId = process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct";

  // 1. Extract commonName safely from object or string
  let commonName = "";
  if (typeof analysis?.possibleIdentification === "object" && analysis?.possibleIdentification !== null) {
    const p = analysis.possibleIdentification as Record<string, unknown>;
    commonName = String(p.commonName || "").trim();
  } else if (typeof analysis?.possibleIdentification === "string") {
    commonName = analysis.possibleIdentification.trim();
  }
  if (!commonName) {
    commonName = String(analysis?.candidateCommonName || analysis?.candidateIdentification || "").trim();
  }

  // 2. Extract visual traits
  let visualTraits = "";
  if (Array.isArray(analysis?.visibleEvidence)) {
    visualTraits = analysis.visibleEvidence
      .map((x) => (typeof x === "object" && x !== null ? `${(x as Record<string, unknown>).observation || ""} (${(x as Record<string, unknown>).significance || ""})` : String(x)))
      .filter(Boolean)
      .join("; ");
  } else if (Array.isArray(analysis?.visualCharacteristics)) {
    visualTraits = analysis.visualCharacteristics.map(String).join("; ");
  }

  // 3. Extract nature facts
  let facts = "";
  if (Array.isArray(analysis?.natureFacts)) {
    facts = analysis.natureFacts
      .map((x) => (typeof x === "object" && x !== null ? `${(x as Record<string, unknown>).title || ""}: ${(x as Record<string, unknown>).detail || ""}` : String(x)))
      .filter(Boolean)
      .join("; ");
  } else if (Array.isArray(analysis?.facts)) {
    facts = analysis.facts.map(String).join("; ");
  }

  // 4. Extract ecological role
  let ecoRole = "";
  if (typeof analysis?.ecologicalRole === "object" && analysis?.ecologicalRole !== null) {
    const e = analysis.ecologicalRole as Record<string, unknown>;
    ecoRole = `${e.title || ""}: ${e.description || ""} (${e.ecologicalNeed || ""})`.trim();
  } else if (typeof analysis?.ecologicalRole === "string") {
    ecoRole = analysis.ecologicalRole.trim();
  } else {
    ecoRole = String(analysis?.ecologicalImportance || "").trim();
  }

  const category = String(observation?.category || "").trim();
  const notes = String(observation?.description || "").trim();

  // 1. If vision model already evaluated the quest during image analysis, use its verification
  if (typeof analysis?.questMatch === "object" && analysis.questMatch !== null) {
    const qm = analysis.questMatch as Record<string, unknown>;
    const modelScore = Number(qm.score ?? qm.questMatchScore);
    if (!isNaN(modelScore) && modelScore >= 70) {
      const clampedScore = Math.min(100, Math.max(0, Math.round(modelScore)));
      const status: "strong_match" | "partial_match" | "insufficient_match" = clampedScore >= 90 ? "strong_match" : "partial_match";
      const matchedReqs = Array.isArray(qm.matchedRequirements) && qm.matchedRequirements.length > 0
        ? qm.matchedRequirements.map((r) => String(r).trim()).filter(Boolean)
        : [quest.title];
      const explanation = String(qm.explanation || qm.matchExplanation || `Visual evidence fulfills the daily quest requirements (${clampedScore}% match).`);

      return {
        score: clampedScore,
        questMatchScore: clampedScore,
        questMatchStatus: status,
        matchedRequirements: matchedReqs,
        missingRequirements: [],
        matchExplanation: explanation,
        retrySuggestion: null,
        matched: true,
        bonusXp: quest.reward || 50,
        reason: explanation,
      };
    }
  }

  // 2. Intelligent, domain-aware heuristic evaluation fallback
  return calculateHeuristicMatch(quest, commonName, visualTraits, facts, ecoRole, category, notes);
}

function calculateHeuristicMatch(
  quest: DailyQuest,
  commonName: string,
  visualTraits: string,
  facts: string,
  ecoRole: string,
  category: string,
  notes: string
): QuestMatchResult {
  const questText = `${quest.title} ${quest.description}`.toLowerCase();
  const discoveryText = `${commonName} ${visualTraits} ${facts} ${ecoRole} ${category} ${notes}`.toLowerCase();

  // Extract quest requirements
  const matchedRequirements: string[] = [];
  const missingRequirements: string[] = [];

  // Check organism / subject domains
  const wantsFungi = /fungus|fungi|mushroom|polypore|bracket|lichen|spore|mold|truffle|symbiosis/i.test(questText);
  const wantsTree = /tree|bark|canopy|wood|branch|stump|log|leaf|leaves|forest|trunk/i.test(questText);
  const wantsFlower = /flower|blossom|bloom|petal|wildflower|flora/i.test(questText);
  const wantsInsect = /insect|bee|butterfly|pollinator|spider|beetle|ant|bug|moth|dragonfly/i.test(questText);
  const wantsBird = /bird|avian|feather|wing|raptor|songbird|waterfowl|beak/i.test(questText);
  const wantsAnimal = /animal|mammal|wildlife|fauna|creature|critter|fur/i.test(questText);
  const wantsWater = /water|dew|drop|droplet|lake|stream|river|rain|pond|moisture/i.test(questText);
  const wantsMoss = /moss|lichen|rock|stone|crevice/i.test(questText);
  const wantsSeed = /seed|fruit|burr|pod|pinecone|cone|acorn/i.test(questText);
  const wantsLandscape = /landscape|mountain|ridge|valley|canyon|cliff|vista|horizon|sky|cloud|sunset/i.test(questText);

  let targetIdentified = false;

  if (wantsFungi) {
    if (/fungus|fungi|mushroom|polypore|trametes|shelf|bracket|lichen|spore|decay|sapro|mycel/i.test(discoveryText)) {
      matchedRequirements.push("Fungus or mushroom specimen observed");
      targetIdentified = true;
    } else {
      missingRequirements.push("Fungus or mushroom specimen absent in photograph");
    }
  }

  if (wantsTree) {
    if (/tree|bark|trunk|wood|log|stump|branch|forest|canopy|deciduous|conifer|oak|pine/i.test(discoveryText)) {
      matchedRequirements.push("Tree or woody substrate verified");
      targetIdentified = true;
    } else if (!wantsFungi) {
      missingRequirements.push("Tree bark or canopy structure absent");
    }
  }

  if (wantsFlower) {
    if (/flower|blossom|bloom|petal|wildflower|flora|sunflower|daisy|rose/i.test(discoveryText)) {
      matchedRequirements.push("Flowering plant or blossom observed");
      targetIdentified = true;
    } else {
      missingRequirements.push("Flowering blossom not visible");
    }
  }

  if (wantsInsect) {
    if (/insect|bee|butterfly|pollinator|spider|bug|beetle|wing|ant|moth|dragonfly/i.test(discoveryText)) {
      matchedRequirements.push("Active insect or pollinator documented");
      targetIdentified = true;
    } else {
      missingRequirements.push("Pollinator or insect absent from image");
    }
  }

  if (wantsBird) {
    if (/bird|avian|finch|sparrow|robin|eagle|hawk|owl|duck|goose|feather|wing|beak|cardinal|crow/i.test(discoveryText)) {
      matchedRequirements.push("Avian or bird specimen documented");
      targetIdentified = true;
    } else {
      missingRequirements.push("Bird or avian species absent from image");
    }
  }

  if (wantsAnimal) {
    if (/animal|mammal|deer|fox|rabbit|squirrel|bear|wolf|frog|toad|turtle|reptile|amphibian|rodent/i.test(discoveryText)) {
      matchedRequirements.push("Wild animal or mammal observed");
      targetIdentified = true;
    } else if (!wantsBird && !wantsInsect) {
      missingRequirements.push("Wild animal or mammal absent from image");
    }
  }

  if (wantsWater) {
    if (/dew|water|drop|droplet|moisture|lake|reflection|liquid|stream|river/i.test(discoveryText)) {
      matchedRequirements.push("Water droplets or aquatic feature captured");
      targetIdentified = true;
    } else {
      missingRequirements.push("Water droplets or lake feature not observed");
    }
  }

  if (wantsMoss) {
    if (/moss|lichen|spore|crevice/i.test(discoveryText)) {
      matchedRequirements.push("Moss or lichen colony documented");
      targetIdentified = true;
    } else if (!wantsFungi && !wantsTree) {
      missingRequirements.push("Moss or lichen micro-colony missing");
    }
  }

  if (wantsSeed) {
    if (/seed|fruit|cone|acorn|burr|pod|dispersal/i.test(discoveryText)) {
      matchedRequirements.push("Seed structure or dispersal mechanism identified");
      targetIdentified = true;
    } else {
      missingRequirements.push("Seed or dispersal structure missing");
    }
  }

  if (wantsLandscape) {
    if (/mountain|peak|ridge|valley|canyon|cliff|rock|stone|vista|horizon|sky|cloud|landscape|scenic|tarn|lake|geological/i.test(discoveryText)) {
      matchedRequirements.push("Geological terrain or natural landscape captured");
      targetIdentified = true;
    } else {
      missingRequirements.push("Landscape or terrain feature not visible");
    }
  }

  // Calculate score based on requirement fulfillment
  let score = 0;
  if (matchedRequirements.length > 0 && missingRequirements.length === 0) {
    score = 94;
  } else if (matchedRequirements.length > 0 && missingRequirements.length > 0) {
    score = targetIdentified ? 78 : 45;
  } else {
    // Count raw keyword overlap
    const stopWords = new Set(["the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with", "find", "photograph", "look", "observe", "its", "your", "how", "any", "unique", "growing", "between", "relationship", "specimen", "natural"]);
    const questWords = questText.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));
    let matchedWords = 0;
    for (const w of questWords) {
      if (discoveryText.includes(w)) matchedWords++;
    }
    const ratio = matchedWords / Math.max(questWords.length, 1);
    if (ratio >= 0.4) {
      score = 85;
      matchedRequirements.push(`Key quest subjects (${quest.title}) visible in image`);
    } else if (ratio >= 0.2) {
      score = 72;
      matchedRequirements.push(`Observable relation to ${quest.title}`);
    } else {
      score = Math.round(ratio * 50);
      missingRequirements.push(`Key quest subject (${quest.title}) not detected in image`);
    }
  }

  const clampedScore = Math.min(100, Math.max(0, score));
  const matched = clampedScore >= 70;

  let status: "strong_match" | "partial_match" | "insufficient_match" = "insufficient_match";
  if (clampedScore >= 90) status = "strong_match";
  else if (clampedScore >= 70) status = "partial_match";

  const explanation = matched
    ? `Image matches the daily quest requirements (${clampedScore}% match). Verified: ${matchedRequirements.join(", ")}.`
    : `Image does not meet the quest criteria (${clampedScore}% match). ${missingRequirements.join(". ")}.`;

  const retry = !matched 
    ? `Try photographing: ${quest.description}` 
    : null;

  return {
    score: clampedScore,
    questMatchScore: clampedScore,
    questMatchStatus: status,
    matchedRequirements,
    missingRequirements,
    matchExplanation: explanation,
    retrySuggestion: retry,
    matched,
    bonusXp: matched ? quest.reward : 0,
    reason: explanation,
  };
}
