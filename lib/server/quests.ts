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
  matched: boolean; // true if score >= 70
  bonusXp: number; // quest.reward if matched, otherwise 0
  reason: string;
}

/**
 * Evaluates whether a user's discovery matches today's quest.
 * If match score is 70% - 100%, matched is true and bonusXp is awarded.
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

  const commonName = String(analysis?.candidateCommonName || "").trim();
  const visualTraits = Array.isArray(analysis?.visualCharacteristics)
    ? analysis.visualCharacteristics.map((x) => String(x)).join(", ")
    : "";
  const facts = Array.isArray(analysis?.facts)
    ? analysis.facts.map((x) => String(x)).join(", ")
    : "";
  const category = String(observation?.category || "").trim();
  const notes = String(observation?.description || "").trim();

  // 1. Try AI evaluation first for accurate semantic judging
  if (accountId && apiToken) {
    try {
      const endpointUrl = `${baseUrl}/accounts/${accountId}/ai/run/${modelId}`;
      const prompt = `Evaluate how well this nature discovery fulfills the given daily nature quest on a scale of 0 to 100.
Quest: "${quest.title}: ${quest.description}"
Discovery: Specimen "${commonName || "Unknown"}", Category: "${category}", Traits: "${visualTraits}", Facts: "${facts}", Notes: "${notes}".

Instructions:
- If the discovery fulfills what the quest asked for (e.g. organism type, leaf, bark, bloom, pollinator, moss, etc.), assign a score between 70 and 100.
- If it is moderately related, assign 40 to 69.
- If it is completely unrelated, assign 0 to 39.

Return STRICTLY a JSON object:
{
  "score": number,
  "reason": "1-sentence explanation"
}
Output only the raw JSON starting with { and ending with }.`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, max_tokens: 150 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const raw = data.result?.response ?? data.response;
        if (raw) {
          const jsonString = typeof raw === "string" ? raw.trim() : JSON.stringify(raw);
          const match = jsonString.match(/\{[\s\S]*?\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const scoreNum = Number(parsed.score);
            if (!isNaN(scoreNum)) {
              const clampedScore = Math.min(100, Math.max(0, Math.round(scoreNum)));
              const matched = clampedScore >= 70;
              return {
                score: clampedScore,
                matched,
                bonusXp: matched ? quest.reward : 0,
                reason: parsed.reason ? String(parsed.reason).trim() : (matched ? "Quest objective fulfilled!" : "Partial match to quest criteria."),
              };
            }
          }
        }
      }
    } catch {
      // Fall through to heuristic evaluation
    }
  }

  // 2. Fast heuristic evaluation fallback
  return calculateHeuristicMatch(quest, commonName, visualTraits, facts, category, notes);
}

function calculateHeuristicMatch(
  quest: DailyQuest,
  commonName: string,
  visualTraits: string,
  facts: string,
  category: string,
  notes: string
): QuestMatchResult {
  const questText = `${quest.title} ${quest.description}`.toLowerCase();
  const discoveryText = `${commonName} ${visualTraits} ${facts} ${category} ${notes}`.toLowerCase();

  const stopWords = new Set(["the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with", "find", "photograph", "look", "observe", "notice", "during", "its", "your", "how", "they", "from", "any", "this", "that"]);

  const questKeywords = questText
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (questKeywords.length === 0) {
    return { score: 50, matched: false, bonusXp: 0, reason: "Insufficient quest criteria." };
  }

  let matches = 0;
  for (const word of questKeywords) {
    const stem = word.length > 4 ? word.slice(0, -1) : word;
    if (discoveryText.includes(word) || discoveryText.includes(stem)) {
      matches++;
    }
  }

  const ratio = matches / questKeywords.length;
  let score = Math.round(ratio * 100);

  const isPlantQuest = /plant|tree|leaf|flower|bark|moss|flora|lichen|seed/i.test(questText);
  const isInsectQuest = /insect|bee|bug|butterfly|spider|pollinator/i.test(questText);
  const isAnimalQuest = /animal|bird|wildlife|fauna/i.test(questText);

  if ((isPlantQuest && category === "plant") ||
      (isInsectQuest && category === "insect") ||
      (isAnimalQuest && category === "animal")) {
    score += 25;
  }

  if (matches >= 2) {
    score = Math.max(score, 75);
  }

  const clampedScore = Math.min(100, Math.max(0, score));
  const matched = clampedScore >= 70;

  return {
    score: clampedScore,
    matched,
    bonusXp: matched ? quest.reward : 0,
    reason: matched
      ? `Objective matched (${clampedScore}% match with ${quest.title})`
      : `Relevance is ${clampedScore}% (70%+ required for quest bonus)`,
  };
}
