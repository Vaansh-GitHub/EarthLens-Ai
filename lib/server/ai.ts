import { z } from "zod";
import type { DailyQuest } from "./quests";

// ─────────────────────────────────────────────────────────────
// Target JSON Schema Contract
// ─────────────────────────────────────────────────────────────

export const PossibleIdentificationSchema = z.object({
  commonName: z.string().min(1, "Common name is required"),
  scientificName: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  confidence: z.number().min(0).max(100),
  identificationNotes: z.string().min(1, "Identification notes are required"),
});

export function inferCategory(commonName: string, notes: string = "", userCategory?: string): string {
  const text = `${commonName} ${notes}`.toLowerCase();
  if (/fungus|fungi|mushroom|polypore|trametes|bracket|lichen|puffball|mycelium|toadstool|amanita|mold|spore/i.test(text)) {
    return "fungi";
  }
  if (/bird|sparrow|finch|eagle|hawk|owl|duck|goose|mammal|deer|fox|rabbit|squirrel|bear|wolf|frog|toad|turtle|snake|lizard|fish|crow|robin|cardinal/i.test(text)) {
    return "animal";
  }
  if (/insect|butterfly|moth|bee|wasp|ant|beetle|spider|dragonfly|damselfly|caterpillar|ladybug|grasshopper|cicada|fly/i.test(text)) {
    return "insect";
  }
  if (/flower|sunflower|rose|daisy|orchid|tulip|tree|oak|pine|maple|birch|fern|moss|grass|leaf|plant|bush|shrub|herb|succulent|cactus|flora/i.test(text)) {
    return "plant";
  }
  if (/mountain|lake|river|waterfall|ocean|beach|canyon|valley|glacier|cliff|dune|desert|sunset|sunrise|sky|cloud|landscape|water/i.test(text)) {
    return "landscape";
  }
  return userCategory && userCategory !== "plant" ? userCategory : "plant";
}

export const QuestMatchContractSchema = z.object({
  score: z.number().min(0).max(100),
  status: z.enum(["strong_match", "partial_match", "insufficient_match"]),
  matchedRequirements: z.array(z.string()),
  missingRequirements: z.array(z.string()),
  explanation: z.string().min(1, "Quest match explanation is required"),
  retrySuggestion: z.string().nullable().optional(),
});

export const VisibleEvidenceItemSchema = z.object({
  observation: z.string().min(1, "Observation detail is required"),
  significance: z.string().min(1, "Significance is required"),
});

export const NatureFactItemSchema = z.object({
  title: z.string().min(1, "Fact title is required"),
  detail: z.string().min(1, "Fact detail is required"),
  evidenceType: z.enum(["observed", "established_fact", "uncertain"]),
});

export const EcologicalRoleContractSchema = z.object({
  title: z.string().min(1, "Ecological role title is required"),
  description: z.string().min(1, "Ecological role description is required"),
  ecologicalNeed: z.string().min(1, "Ecological need is required"),
  conservationNote: z.string().nullable().optional(),
});

export const WisdomAndReflectionContractSchema = z.object({
  theme: z.string().min(1, "Reflection theme is required"),
  quote: z.string().min(1, "Original quote is required"),
  lifeConnection: z.string().min(1, "Life connection is required"),
  toneUsed: z.string().min(1, "Tone description is required"),
  imageConnection: z.string().min(1, "Image connection is required"),
});

export const ReflectionContractSchema = z.object({
  question: z.string().min(1, "Reflection question is required"),
  journalPrompt: z.string().min(1, "Journal prompt is required"),
});

export const CompleteAnalysisContractSchema = z.object({
  possibleIdentification: PossibleIdentificationSchema,
  questMatch: QuestMatchContractSchema,
  visibleEvidence: z.array(VisibleEvidenceItemSchema).min(1, "At least one visible evidence item is required"),
  natureFacts: z.array(NatureFactItemSchema).min(1).max(4),
  ecologicalRole: EcologicalRoleContractSchema,
  wisdomAndReflection: WisdomAndReflectionContractSchema,
  reflection: ReflectionContractSchema,
  safetyNote: z.string().nullable().optional(),
});

export type CompleteAnalysisContract = z.infer<typeof CompleteAnalysisContractSchema>;

// Backward-compatible compound type for analysis responses
export type AnalysisResult = CompleteAnalysisContract & {
  // Flat legacy aliases
  candidateCommonName: string;
  candidateScientificName: string | null;
  confidence: "High" | "Medium" | "Low";
  confidenceScore: number;
  uncertaintyReasoning: string;
  visualCharacteristics: string[];
  facts: string[];
  ecologicalImportance: string;
  ecologicalNeed: string | null;
  reflectionTheme: string;
  naturalCharacteristic: string;
  originalQuote: string;
  quote: string;
  metaphoricalLesson: string;
  lifeLesson: string;
  reflectionQuestion: string;
  detectedMood: string | null;
  searchTerms: string[];
};

// ─────────────────────────────────────────────────────────────
// Anti-Cliché and Quote Validation
// ─────────────────────────────────────────────────────────────

const BANNED_CLICHES = [
  "quiet persistence",
  "staying deeply rooted",
  "stay deeply rooted",
  "deeply rooted in where",
  "patient endurance through changing seasons",
  "life does not demand haste",
  "vital role within its local biome",
  "vital role in its biome",
];

function sanitizeAndValidateQuote(quote: string): string {
  if (!quote || quote.trim().length < 5) {
    throw new Error("Quote is too short or empty");
  }
  let cleanQ = quote.trim().replace(/^["'“`]+|["'”`]+$/g, "").trim();
  const lower = cleanQ.toLowerCase();
  for (const cliche of BANNED_CLICHES) {
    if (lower.includes(cliche)) {
      throw new Error(`Quote contains repetitive generic cliché: "${cliche}"`);
    }
  }
  if (!/[.!?]$/.test(cleanQ)) {
    cleanQ = `${cleanQ}.`;
  }
  return cleanQ;
}

// ─────────────────────────────────────────────────────────────
// Main AI Agent Execution
// ─────────────────────────────────────────────────────────────

export async function analyzeImageWithAI(
  imageBuffer: Buffer,
  mimeType: string,
  userNotes?: string,
  quest?: DailyQuest | null
): Promise<AnalysisResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const baseUrl = process.env.CLOUDFLARE_AI_BASE_URL || "https://api.cloudflare.com/client/v4";
  const modelId = process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct";

  if (!accountId || !apiToken || !modelId) {
    throw new Error("Missing required Cloudflare AI environment variables");
  }

  const questContext = quest
    ? `TODAY'S NATURE QUEST:
Title: "${quest.title}"
Objective: "${quest.description}"`
    : `TODAY'S NATURE QUEST:
Title: "General Field Discovery"
Objective: "Document visible wild organisms, patterns, or landscapes in the outdoor environment."`;

  const systemPrompt = `You are EarthLens AI, an expert field naturalist and philosophical guide.
Your purpose is to deeply observe the natural world through photographs, evaluate field quests against observable evidence, and connect genuine biological processes to human life.

CRITICAL INSTRUCTIONS:
1. EXAMINE THE PHOTOGRAPH FIRST:
   - Base all conclusions strictly on visible subject morphology, colors, textures, lighting, growth substrate, and habitat context.
   - Identify the genuine, primary wild organism, natural feature, geological formation, or scene visible in the photograph.
   - Give the precise common name of the specimen or feature (such as the specific flower, tree, bird, mammal, insect, mushroom, rock formation, or landscape). Never use generic placeholders like "Observation Specimen", "Field Specimen", or "Natural Feature".
   - Provide the binomial scientific name (Genus species) if identifiable, or null if it is a landscape, weather formation, or non-biological feature.
   - If identity is uncertain, state the likely family/genus and explain visual uncertainty in identificationNotes. If the image is a landscape, discuss the landscape and ecosystem rather than forcing a species name.
   - Do not claim symbiosis, mutualism, or species identities without observable evidence.

2. EVALUATE THE QUEST EVIDENCE:
   - Target match score: 0 to 100 based on observable evidence:
     * 90–100: strong_match (all essential quest requirements clearly supported by image)
     * 70–89: partial_match (most requirements supported, minor details uncertain)
     * Below 70: insufficient_match (missing key requirements or unrelated subject)
   - If score < 70, provide an encouraging retrySuggestion explaining what to photograph instead. If >= 70, retrySuggestion must be null.

3. ACCURATE NATURE FACTS:
   - Provide 2-3 distinct facts with title, detail, and evidenceType ("observed" | "established_fact" | "uncertain").
   - Avoid generic statements like "plays a vital role in its biome".

4. ORIGINAL, CLICHÉ-FREE QUOTE & LIFE CONNECTION:
   - The quote must feel like a thoughtful human reflection inspired by something genuinely observable in this photograph.
   - STRICT BAN ON CLICHÉS:
     * NEVER use "In the quiet persistence of...", "true resilience is born from staying deeply rooted", "patient endurance through changing seasons", or "life does not demand haste".
     * Derive the philosophical reflection directly from the specific natural phenomenon, adaptation, or behavior observable in THIS photograph.
   - "lifeConnection" must be a separate readable paragraph explaining the metaphor connecting the photographed natural subject to human life without merely repeating the quote.
   - If user notes are provided, let their tone subtly influence the reflection. If not, derive tone from the visual mood.`;

  let promptContent: string;
  if (userNotes && userNotes.trim()) {
    promptContent = `User's field notes: "${userNotes.trim()}".
${questContext}
Examine the image, evaluate the quest, and gently reflect the user's emotional tone in the quote.`;
  } else {
    promptContent = `No user notes provided.
${questContext}
Examine the image, evaluate the quest, and derive the emotional tone entirely from the photograph's visual ambiance.`;
  }

  const jsonFormatInstructions = `
CRITICAL OUTPUT REQUIREMENT:
Return EXACTLY ONE valid JSON object matching this schema. No Markdown fences, introductory commentary, or trailing text.
{
  "possibleIdentification": {
    "commonName": "Identified common name of the visible specimen or feature",
    "scientificName": "Binomial scientific name or null",
    "category": "plant" | "animal" | "insect" | "fungi" | "landscape" | "other",
    "confidence": 85,
    "identificationNotes": "Specific visual details supporting identification and any uncertainty"
  },
  "questMatch": {
    "score": 85,
    "status": "strong_match" | "partial_match" | "insufficient_match",
    "matchedRequirements": ["Requirement 1 supported by photo"],
    "missingRequirements": [],
    "explanation": "Why this image satisfies or misses the quest",
    "retrySuggestion": null
  },
  "visibleEvidence": [
    {
      "observation": "Specific observable feature in photo",
      "significance": "Biological or ecological significance of this feature"
    }
  ],
  "natureFacts": [
    {
      "title": "Fact headline",
      "detail": "Accurate, informative biological or ecological fact",
      "evidenceType": "observed" | "established_fact" | "uncertain"
    }
  ],
  "ecologicalRole": {
    "title": "Ecological function headline",
    "description": "Specific functional contribution to local ecosystem",
    "ecologicalNeed": "Genuine conservation concern or habitat need",
    "conservationNote": null
  },
  "wisdomAndReflection": {
    "theme": "Unique theme derived strictly from image",
    "quote": "Complete, evocative 1-2 sentence quote. Zero clichés.",
    "lifeConnection": "Thoughtful paragraph explaining the connection to human life.",
    "toneUsed": "Reflective / Peaceful / Curious / Hopeful",
    "imageConnection": "Visible visual detail that inspired this reflection"
  },
  "reflection": {
    "question": "Thoughtful question for personal contemplation",
    "journalPrompt": "Actionable journaling prompt"
  },
  "safetyNote": null
}`;

  const timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "60000", 10);
  const endpointUrl = `${baseUrl}/accounts/${accountId}/ai/run/${modelId}`;

  // Helper to call Cloudflare Workers AI model
  async function callModel(promptText: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload = {
        prompt: promptText,
        image: Array.from(imageBuffer),
        max_tokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS || "1500", 10),
      };

      let response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Handle model agreement if needed
      if (!response.ok && (response.status === 403 || response.status === 400)) {
        const errText = await response.clone().text().catch(() => "");
        if (errText.includes("Model Agreement") || errText.includes("5016") || errText.includes("agree")) {
          await fetch(endpointUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "agree" }),
          });
          response = await fetch(endpointUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        }
      }

      if (!response.ok) {
        if (response.status === 429) throw new Error("AI provider rate limit exceeded");
        const errText = await response.text().catch(() => "");
        throw new Error(`AI provider error: ${response.status} ${response.statusText} ${errText}`.trim());
      }

      const data = await response.json();
      const rawResponse = data.result?.response ??
        data.result?.choices?.[0]?.text ??
        data.response ??
        data.choices?.[0]?.text;

      if (!rawResponse) throw new Error("Invalid response format from AI provider");
      return typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Attempt 1: Standard structured run
  const initialPrompt = `${systemPrompt}\n\n${promptContent}\n\n${jsonFormatInstructions}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const promptToUse = attempt === 1
        ? initialPrompt
        : `${systemPrompt}\n\n${promptContent}\n\nPREVIOUS ATTEMPT FAILED: The output was malformed or incomplete (${lastError?.message}).
You MUST return ONLY one valid, complete JSON object conforming strictly to the requested schema. Ensure all quotes and paragraphs are complete with closing punctuation. Do not truncate.
${jsonFormatInstructions}`;

      const rawText = await callModel(promptToUse);
      const parsedData = parseOrRecoverJson(rawText);
      const normalized = normalizeAnalysisData(parsedData, quest);

      // Validate quote completeness and anti-cliché directives
      normalized.wisdomAndReflection.quote = sanitizeAndValidateQuote(normalized.wisdomAndReflection.quote);

      // Strictly validate with Zod
      const validatedContract = CompleteAnalysisContractSchema.parse({
        possibleIdentification: normalized.possibleIdentification,
        questMatch: normalized.questMatch,
        visibleEvidence: normalized.visibleEvidence,
        natureFacts: normalized.natureFacts,
        ecologicalRole: normalized.ecologicalRole,
        wisdomAndReflection: normalized.wisdomAndReflection,
        reflection: normalized.reflection,
        safetyNote: normalized.safetyNote,
      });

      // Construct complete result with backward-compatible aliases
      const finalResult: AnalysisResult = {
        ...validatedContract,
        candidateCommonName: validatedContract.possibleIdentification.commonName,
        candidateScientificName: validatedContract.possibleIdentification.scientificName || null,
        confidence: validatedContract.possibleIdentification.confidence >= 80 ? "High" : validatedContract.possibleIdentification.confidence >= 55 ? "Medium" : "Low",
        confidenceScore: validatedContract.possibleIdentification.confidence,
        uncertaintyReasoning: validatedContract.possibleIdentification.identificationNotes,
        visualCharacteristics: validatedContract.visibleEvidence.map((e) => e.observation),
        facts: validatedContract.natureFacts.map((f) => `${f.title}: ${f.detail}`),
        ecologicalImportance: validatedContract.ecologicalRole.description,
        ecologicalNeed: validatedContract.ecologicalRole.ecologicalNeed,
        reflectionTheme: validatedContract.wisdomAndReflection.theme,
        naturalCharacteristic: validatedContract.wisdomAndReflection.theme,
        originalQuote: validatedContract.wisdomAndReflection.quote,
        quote: validatedContract.wisdomAndReflection.quote,
        metaphoricalLesson: validatedContract.wisdomAndReflection.lifeConnection,
        lifeLesson: validatedContract.wisdomAndReflection.lifeConnection,
        reflectionQuestion: validatedContract.reflection.question,
        detectedMood: validatedContract.wisdomAndReflection.toneUsed,
        searchTerms: [validatedContract.possibleIdentification.commonName, validatedContract.possibleIdentification.scientificName].filter(Boolean) as string[],
      };

      return finalResult;
    } catch (err) {
      lastError = err as Error;
      if (lastError.message.includes("rate limit")) {
        throw lastError;
      }
      if (attempt === 1) {
        console.warn(`Attempt 1 output validation failed: ${lastError.message}. Retrying with strict JSON corrective prompt...`);
      }
    }
  }

  throw new Error(`AI provider returned malformed output: ${lastError?.message || "Failed schema validation"}`);
}

// ─────────────────────────────────────────────────────────────
// Normalization and Recovery
// ─────────────────────────────────────────────────────────────

function cleanString(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || ["null", "none", "n/a", "undefined", "unknown"].includes(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

function parseOrRecoverJson(rawResponse: string): Record<string, unknown> {
  let jsonString = rawResponse.trim();
  if (jsonString.startsWith("```json")) jsonString = jsonString.slice(7).trim();
  else if (jsonString.startsWith("```")) jsonString = jsonString.slice(3).trim();
  if (jsonString.endsWith("```")) jsonString = jsonString.slice(0, -3).trim();

  // 1. Direct JSON attempt
  const fullMatch = jsonString.match(/\{[\s\S]*\}/);
  if (fullMatch) {
    try {
      return JSON.parse(fullMatch[0]);
    } catch {
      // Continue to repair
    }
  }

  // 2. Repair truncated JSON
  const firstBrace = jsonString.indexOf("{");
  if (firstBrace !== -1) {
    try {
      let candidate = jsonString.slice(firstBrace);
      candidate = candidate.replace(/,\s*"[^"]*"?\s*:\s*"?$/, "").trim();
      candidate = candidate.replace(/,\s*$/, "").trim();

      const openBrackets = (candidate.match(/\[/g) || []).length;
      const closeBrackets = (candidate.match(/\]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) candidate += "]";

      const openBraces = (candidate.match(/\{/g) || []).length;
      const closeBraces = (candidate.match(/\}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) candidate += "}";

      return JSON.parse(candidate);
    } catch {
      // Fall through to regex extraction
    }
  }

  return extractFromText(rawResponse);
}

function normalizeAnalysisData(
  data: Record<string, unknown>,
  quest?: DailyQuest | null
): CompleteAnalysisContract {
  // 1. Identification
  let rawIdent = data.possibleIdentification;
  let commonName: string | null = null;
  let sciName: string | null = null;
  let confidenceNum = 85;
  let identNotes = "Identified based on distinctive observable visual characteristics.";

  if (typeof rawIdent === "object" && rawIdent !== null) {
    const identObj = rawIdent as Record<string, unknown>;
    commonName = cleanString(identObj.commonName);
    sciName = cleanString(identObj.scientificName);
    if (typeof identObj.confidence === "number") {
      confidenceNum = Math.min(100, Math.max(0, Math.round(identObj.confidence)));
    } else if (typeof identObj.confidence === "string") {
      const c = (identObj.confidence as string).toLowerCase();
      confidenceNum = c.includes("high") ? 90 : c.includes("low") ? 45 : 70;
    }
    identNotes = cleanString(identObj.identificationNotes) || identNotes;
  } else if (typeof rawIdent === "string") {
    commonName = cleanString(rawIdent);
  }

  if (!commonName) {
    commonName = cleanString(data.candidateCommonName) || cleanString(data.candidateIdentification);
  }
  if (!commonName) {
    throw new Error("Failed to determine subject identification from photograph");
  }

  if (!sciName) {
    sciName = cleanString(data.candidateScientificName);
  }

  // 2. Visible Evidence
  const rawEvidence = data.visibleEvidence || data.visualCharacteristics;
  const visibleEvidenceList: Array<{ observation: string; significance: string }> = [];

  if (Array.isArray(rawEvidence)) {
    for (const item of rawEvidence) {
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        const obs = cleanString(obj.observation);
        const sig = cleanString(obj.significance) || "Observable morphological trait";
        if (obs) visibleEvidenceList.push({ observation: obs, significance: sig });
      } else if (typeof item === "string" && item.trim()) {
        visibleEvidenceList.push({ observation: item.trim(), significance: "Key observable morphological detail" });
      }
    }
  }

  if (visibleEvidenceList.length === 0) {
    visibleEvidenceList.push({
      observation: `Visible natural structure of ${commonName}`,
      significance: "Directly documented in field photograph",
    });
  }

  // 3. Nature Facts
  const rawNatureFacts = data.natureFacts || data.facts;
  const natureFactsList: Array<{ title: string; detail: string; evidenceType: "observed" | "established_fact" | "uncertain" }> = [];

  if (Array.isArray(rawNatureFacts)) {
    for (const item of rawNatureFacts) {
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        const title = cleanString(obj.title) || "Natural History";
        const detail = cleanString(obj.detail);
        let evType: "observed" | "established_fact" | "uncertain" = "established_fact";
        if (obj.evidenceType === "observed" || obj.evidenceType === "uncertain") {
          evType = obj.evidenceType;
        }
        if (detail) natureFactsList.push({ title, detail, evidenceType: evType });
      } else if (typeof item === "string" && item.trim()) {
        const str = item.trim();
        const colonIdx = str.indexOf(":");
        if (colonIdx > 0 && colonIdx < 35) {
          natureFactsList.push({
            title: str.slice(0, colonIdx).trim(),
            detail: str.slice(colonIdx + 1).trim(),
            evidenceType: "established_fact",
          });
        } else {
          natureFactsList.push({
            title: "Biological Trait",
            detail: str,
            evidenceType: "established_fact",
          });
        }
      }
    }
  }

  if (natureFactsList.length === 0) {
    natureFactsList.push({
      title: "Biological Adaptation",
      detail: `${commonName} exhibits distinctive anatomical adaptations suited to its immediate habitat.`,
      evidenceType: "established_fact",
    });
  }

  // 4. Ecological Role
  let ecoTitle = "Ecosystem Contribution";
  let ecoDesc = "";
  let ecoNeed = "Preservation of undisturbed native habitat and supporting microclimates.";
  let ecoNote: string | null = null;

  if (typeof data.ecologicalRole === "object" && data.ecologicalRole !== null) {
    const ecoObj = data.ecologicalRole as Record<string, unknown>;
    ecoTitle = cleanString(ecoObj.title) || ecoTitle;
    ecoDesc = cleanString(ecoObj.description) || "";
    ecoNeed = cleanString(ecoObj.ecologicalNeed) || ecoNeed;
    ecoNote = cleanString(ecoObj.conservationNote);
  } else if (typeof data.ecologicalRole === "string") {
    ecoDesc = data.ecologicalRole.trim();
  }

  if (!ecoDesc) {
    ecoDesc = cleanString(data.ecologicalImportance) || `${commonName} plays an active role in local nutrient cycling and ecological balance.`;
  }

  // 5. Wisdom & Reflection
  let theme = "Field Discovery";
  let quote = "";
  let lifeConnection = "";
  let toneUsed = "Reflective";
  let imageConnection = `the visible presence of ${commonName}`;

  if (typeof data.wisdomAndReflection === "object" && data.wisdomAndReflection !== null) {
    const wObj = data.wisdomAndReflection as Record<string, unknown>;
    theme = cleanString(wObj.theme) || theme;
    quote = cleanString(wObj.quote) || "";
    lifeConnection = cleanString(wObj.lifeConnection) || "";
    toneUsed = cleanString(wObj.toneUsed) || toneUsed;
    imageConnection = cleanString(wObj.imageConnection) || imageConnection;
  }

  if (!theme) {
    theme = cleanString(data.reflectionTheme) || cleanString(data.naturalCharacteristic) || `Observation of ${commonName}`;
  }
  if (!quote) {
    quote = cleanString(data.originalQuote) || cleanString(data.quote) || "";
  }
  if (!lifeConnection) {
    lifeConnection = cleanString(data.reflection) || cleanString(data.metaphoricalLesson) || cleanString(data.lifeLesson) || "";
  }

  if (!quote) {
    throw new Error("AI provider failed to generate an image-specific quote");
  }
  if (!lifeConnection) {
    lifeConnection = `Observing the subtle mechanics of ${commonName} reminds us how living forms adapt and sustain themselves in silence.`;
  }

  // 6. Reflection
  let question = `What does the visible presence of ${commonName} invite you to consider in your life today?`;
  let journalPrompt = `Write down one observation from this scene and how it mirrors something in your current experience.`;

  if (typeof data.reflection === "object" && data.reflection !== null) {
    const rObj = data.reflection as Record<string, unknown>;
    question = cleanString(rObj.question) || question;
    journalPrompt = cleanString(rObj.journalPrompt) || journalPrompt;
  } else if (typeof data.reflection === "string") {
    question = data.reflection.trim();
  }

  if (cleanString(data.reflectionQuestion)) {
    question = cleanString(data.reflectionQuestion)!;
  }

  // 7. Quest Match Verification
  let questScore = 80;
  let questStatus: "strong_match" | "partial_match" | "insufficient_match" = "partial_match";
  let matchedReqs: string[] = [];
  let missingReqs: string[] = [];
  let questExplanation = "Visual evidence partially satisfies today's nature quest.";
  let retrySuggestion: string | null = null;

  if (typeof data.questMatch === "object" && data.questMatch !== null) {
    const qObj = data.questMatch as Record<string, unknown>;
    if (typeof qObj.score === "number") {
      questScore = Math.min(100, Math.max(0, Math.round(qObj.score)));
    }
    if (Array.isArray(qObj.matchedRequirements)) {
      matchedReqs = qObj.matchedRequirements.map((x) => String(x).trim()).filter(Boolean);
    }
    if (Array.isArray(qObj.missingRequirements)) {
      missingReqs = qObj.missingRequirements.map((x) => String(x).trim()).filter(Boolean);
    }
    questExplanation = cleanString(qObj.explanation) || questExplanation;
    retrySuggestion = cleanString(qObj.retrySuggestion);
  } else if (quest) {
    // Basic heuristic match if model omitted questMatch
    const desc = `${commonName} ${visibleEvidenceList.map((e) => e.observation).join(" ")}`.toLowerCase();
    const qWords = quest.description.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const matches = qWords.filter((w) => desc.includes(w));
    questScore = matches.length >= 2 ? 85 : matches.length === 1 ? 72 : 45;
  }

  // Enforce threshold rules strictly:
  if (questScore >= 90) {
    questStatus = "strong_match";
    retrySuggestion = null;
    if (matchedReqs.length === 0) matchedReqs = [quest?.title || "Target specimen documented"];
  } else if (questScore >= 70) {
    questStatus = "partial_match";
    retrySuggestion = null;
    if (matchedReqs.length === 0) matchedReqs = [quest?.title || "Observed nature subject"];
  } else {
    questStatus = "insufficient_match";
    if (missingReqs.length === 0) missingReqs = [quest?.description || "Specific quest specimen or setting not visible"];
    if (!retrySuggestion) {
      retrySuggestion = quest ? `Try locating and photographing: ${quest.description}` : "Upload a photo that clearly displays the requested nature subject.";
    }
  }

  // 8. Safety Note
  const safetyNote = cleanString(data.safetyNote);
  const identifiedCategory = cleanString((data.possibleIdentification as Record<string, unknown>)?.category) || inferCategory(commonName, identNotes);

  return {
    possibleIdentification: {
      commonName,
      scientificName: sciName,
      category: identifiedCategory,
      confidence: confidenceNum,
      identificationNotes: identNotes,
    },
    questMatch: {
      score: questScore,
      status: questStatus,
      matchedRequirements: matchedReqs,
      missingRequirements: missingReqs,
      explanation: questExplanation,
      retrySuggestion,
    },
    visibleEvidence: visibleEvidenceList,
    natureFacts: natureFactsList.slice(0, 3),
    ecologicalRole: {
      title: ecoTitle,
      description: ecoDesc,
      ecologicalNeed: ecoNeed,
      conservationNote: ecoNote,
    },
    wisdomAndReflection: {
      theme,
      quote,
      lifeConnection,
      toneUsed,
      imageConnection,
    },
    reflection: {
      question,
      journalPrompt,
    },
    safetyNote,
  };
}

// ─────────────────────────────────────────────────────────────
// Regex / Markdown Text Extractor Fallback
// ─────────────────────────────────────────────────────────────

function extractFromText(text: string): Record<string, unknown> {
  const getJsonField = (key: string): string | null => {
    const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, "i"));
    return match ? match[1].replace(/\\"/g, '"').trim() : null;
  };

  const getMarkdownSection = (titleRegex: RegExp): string | null => {
    const match = text.match(titleRegex);
    if (!match) return null;
    let s = match[1].trim();
    const bleedMatch = s.search(/(?:\n\s*|\s*\*+\s*)\*\*[a-zA-Z0-9_\s]+\*\*[:\s]/);
    if (bleedMatch > 0) s = s.slice(0, bleedMatch).trim();
    s = s.replace(/^[\s*•-]+/, "").trim();
    return s || null;
  };

  const name = getJsonField("commonName") ||
    getJsonField("possibleIdentification") ||
    getJsonField("candidateCommonName") ||
    getMarkdownSection(/\*\*(?:Common Name|Possible Identification)\*\*[:\s]*([\s\S]*?)(?=\n|\*|$)/i) ||
    text.match(/(?:specimen|subject|name)[:\s]*([^\n.,"]+)/i)?.[1]?.trim() ||
    "Nature Specimen";

  const quote = getJsonField("quote") ||
    getJsonField("originalQuote") ||
    getMarkdownSection(/\*\*(?:Original Quote|Quote)\*\*[:\s]*([\s\S]*?)(?=(?:\n\s*|\s*\*+\s*)\*\*[a-zA-Z]|$)/i) ||
    text.match(/quote[^:.\n]*(?:is|reflects[^:.\n]*is):\s*\n*["'“]*(?:['"]*)([^"'”\n][^"'”]*?)['"]*["'”]/i)?.[1]?.trim() ||
    "In observing the living world around us, we discover our own capacity for quiet renewal.";

  const reflection = getJsonField("lifeConnection") ||
    getJsonField("reflection") ||
    getJsonField("metaphoricalLesson") ||
    getMarkdownSection(/\*\*(?:Life Connection|Reflection|Metaphorical Lesson)\*\*[:\s]*([\s\S]*?)(?=(?:\n\s*|\s*\*+\s*)\*\*[a-zA-Z]|$)/i) ||
    `Observing ${name} reveals how organisms find balance within their natural surroundings.`;

  const theme = getJsonField("theme") ||
    getJsonField("reflectionTheme") ||
    getMarkdownSection(/\*\*(?:Theme|Reflection Theme)\*\*[:\s]*([\s\S]*?)(?=(?:\n\s*|\s*\*+\s*)\*\*[a-zA-Z]|$)/i) ||
    `Observation of ${name}`;

  const ecoDesc = getJsonField("description") ||
    getJsonField("ecologicalRole") ||
    getJsonField("ecologicalImportance") ||
    getMarkdownSection(/\*\*(?:Ecological Role|Ecological Importance)\*\*[:\s]*([\s\S]*?)(?=(?:\n\s*|\s*\*+\s*)\*\*[a-zA-Z]|$)/i) ||
    `${name} contributes to local biological diversity and ecological stability.`;

  return {
    possibleIdentification: {
      commonName: name.replace(/[*_]/g, "").trim(),
      scientificName: getJsonField("scientificName") || null,
      confidence: 85,
      identificationNotes: `Identified as ${name} based on visible photographic evidence.`,
    },
    visibleEvidence: [
      { observation: `Visible physical features of ${name}`, significance: "Diagnostic characteristic in photograph" },
    ],
    natureFacts: [
      { title: "Natural History", detail: `${name} has evolved specialized traits suited to its native environment.`, evidenceType: "established_fact" },
    ],
    ecologicalRole: {
      title: "Ecological Contribution",
      description: ecoDesc,
      ecologicalNeed: "Protection of natural surroundings from degradation.",
      conservationNote: null,
    },
    wisdomAndReflection: {
      theme: theme.replace(/[*_]/g, "").trim(),
      quote: quote.replace(/^["'“`]+|["'”`]+$/g, "").trim(),
      lifeConnection: reflection.replace(/[*_]/g, "").trim(),
      toneUsed: "Reflective",
      imageConnection: name,
    },
    reflection: {
      question: `What insight from ${name} resonates with your life today?`,
      journalPrompt: `Record what visible element of this observation stood out most to you.`,
    },
    safetyNote: getJsonField("safetyNote") || null,
  };
}
