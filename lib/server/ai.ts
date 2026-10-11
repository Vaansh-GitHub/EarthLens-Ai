import { z } from "zod";

export const AnalysisResultSchema = z.object({
  candidateCommonName: z.string().nullable().describe("Common name if known and supported by evidence, otherwise null"),
  candidateScientificName: z.string().nullable().describe("Scientific name if known and supported by evidence, otherwise null"),
  confidence: z.enum(["High", "Medium", "Low"]).describe("Confidence level of the identification"),
  uncertaintyReasoning: z.string().describe("Explicit explanation of any uncertainty in the identification"),
  visualCharacteristics: z.array(z.string()).describe("Observable visual characteristics in the image"),
  facts: z.array(z.string()).max(3).describe("Up to 3 concise, factual nature facts about this subject"),
  ecologicalImportance: z.string().nullable().describe("The role this subject plays in its ecosystem"),
  naturalCharacteristic: z.string().nullable().describe("A factual biological or physical characteristic of the subject"),
  metaphoricalLesson: z.string().nullable().describe("A separate metaphorical life lesson inspired by this subject"),
  quote: z.string().nullable().describe("A short, original, shareable quote about the subject"),
  reflectionQuestion: z.string().nullable().describe("A thought-provoking question for the user to reflect on"),
  detectedMood: z.string().nullable().optional().describe("User's inferred mood/emotional state if text was provided, otherwise null"),
  searchTerms: z.array(z.string()).describe("Search terms (e.g. taxonomic names) for supporting references"),
  safetyNote: z.string().nullable().optional().describe("Safety warnings if potentially dangerous"),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export async function analyzeImageWithAI(imageBuffer: Buffer, mimeType: string, userNotes?: string): Promise<AnalysisResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const baseUrl = process.env.CLOUDFLARE_AI_BASE_URL || "https://api.cloudflare.com/client/v4";
  const modelId = process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct";
  
  if (!accountId || !apiToken || !modelId) {
    throw new Error("Missing required Cloudflare AI environment variables");
  }

  const systemPrompt = `You are EarthLens AI, an expert naturalist and philosophical guide.
PRIMARY DIRECTIVES:
1. STRICT VISUAL TAXONOMY: Rely strictly on what you visually see in the image pixels. User-selected categories or user field notes are subjective remarks and must NEVER override the true specimen visible in the photograph.
2. ADAPTIVE EMOTIONAL RESONANCE & MOOD-AWARE METAPHOR:
   - The "quote" and "metaphoricalLesson" MUST ALWAYS remain intimately related to and inspired by the natural organism and characteristics visible in the photograph (e.g. the quiet resilience of moss, the patience of a seed, the bold bloom of a flower, the endurance of roots).
   - TONE DETERMINATION:
     * IF USER TEXT / FIELD NOTES ARE PROVIDED:
       - Carefully analyze their words to discern the person's mood, emotional state, or sentiment (e.g. sad, weary, overwhelmed, anxious, peaceful, curious, joyful, hopeful).
       - The tone of the quote and metaphorical lesson MUST be shaped by their mood:
         • If the user is sad, discouraged, or exhausted: Comfort them, cheer them up, and motivate them through the natural organism's resilience, rebirth, and quiet endurance.
         • If the user is anxious or stressed: Ground and soothe them with nature's stillness, rootedness, and patient unhurried cycles.
         • If the user is joyful, curious, or grateful: Celebrate and amplify their wonder, energy, and connection to life.
       - Identify and output a concise mood description in "detectedMood" (e.g. "Seeking Comfort & Uplift", "Reflective & Weary", "Peaceful & Grounded", "Joyful Wonder").
     * IF NO USER TEXT IS GIVEN (or empty):
       - Generate the quote and metaphorical lesson following the standard contemplative naturalist instructions: a profound, timeless ecological life lesson and an inspiring, memorable quote tailored directly to this organism's natural qualities.
       - Set "detectedMood" to null.

Analyze the image carefully and identify the organism accurately based on visual traits.
Provide:
1. Accurate common name and scientific name.
2. Confidence ("High" or "Medium" based on visual clarity).
3. Observable visual traits.
4. Up to 3 concise, factual nature facts.
5. Ecological role and environmental niche.
6. A notable biological adaptation or characteristic.
7. A profound metaphorical life lesson (inspired by the organism, tone attuned to user mood if text is provided).
8. A memorable quote (inspired by the organism, tone attuned to user mood if text is provided).
9. A thought-provoking reflection question.
10. "detectedMood" (inferred mood string if user text provided, or null if no user text).
11. Search terms for references.

CRITICAL INSTRUCTIONS:
1. Output MUST be a strictly valid JSON object matching this schema.
2. Do NOT wrap in markdown or backticks.
3. Do NOT include unescaped quotes inside string values.
4. Output must start with { and end with }.
5. Never return generic refusal statements. Always give genuine naturalist and ecological analysis for the specimen shown.

Schema:
{
  "candidateCommonName": "Name of specimen",
  "candidateScientificName": "Scientific name or null",
  "confidence": "High" | "Medium" | "Low",
  "uncertaintyReasoning": "Explanation of visible features confirming identification",
  "visualCharacteristics": ["trait 1", "trait 2"],
  "facts": ["fact 1", "fact 2", "fact 3"],
  "ecologicalImportance": "Ecological role and niche",
  "naturalCharacteristic": "Biological feature or adaptation",
  "metaphoricalLesson": "Philosophical lesson inspired by this species",
  "quote": "Inspiring quote tailored to this species",
  "reflectionQuestion": "Thought-provoking question",
  "detectedMood": "Inferred user mood string or null",
  "searchTerms": ["term 1", "term 2"]
}`;

  let promptContent: string;
  if (userNotes && userNotes.trim()) {
    promptContent = `User's field notes and personal reflections: "${userNotes.trim()}".
Analyze the visual evidence in the image. Identify the organism from the pixels. Guess and detect the user's emotional mood from their text, and shape the quote and metaphorical lesson so they are related to this organism while matching and uplifting the user's mood (e.g. if sad, cheer them up and motivate them). Set "detectedMood" to their detected mood. Provide the JSON object now.`;
  } else {
    promptContent = `No user notes provided. Analyze the visual evidence in the image. Identify the organism from the pixels. Generate the standard contemplative naturalist quote and metaphorical lesson tailored directly to this organism's natural qualities. Set "detectedMood" to null. Provide the JSON object now.`;
  }

  // Cloudflare Workers AI Vision model payload (uses prompt + image byte array)
  const payload = {
    prompt: `${systemPrompt}\n\n${promptContent}`,
    image: Array.from(imageBuffer),
    max_tokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS || "1200", 10)
  };

  const timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "60000", 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const endpointUrl = `${baseUrl}/accounts/${accountId}/ai/run/${modelId}`;

  try {
    let response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    // Handle Cloudflare model agreement requirement if encountered
    if (!response.ok && (response.status === 403 || response.status === 400)) {
      const errClone = response.clone();
      const errText = await errClone.text();
      if (errText.includes("Model Agreement") || errText.includes("5016") || errText.includes("agree")) {
        await fetch(endpointUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ prompt: "agree" })
        });
        response = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      }
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("AI provider rate limit exceeded");
      }
      const errText = await response.text().catch(() => "");
      throw new Error(`AI provider error: ${response.status} ${response.statusText} ${errText}`.trim());
    }

    const data = await response.json();
    
    // Cloudflare returns { result: { response: ... } } or { response: ... }
    const rawResponse = data.result?.response ?? data.response;
    if (!rawResponse) {
      throw new Error("Invalid response format from AI provider");
    }

    let parsedData: Record<string, unknown> | null = null;
    
    if (typeof rawResponse === "object" && rawResponse !== null) {
      parsedData = rawResponse as Record<string, unknown>;
    } else if (typeof rawResponse === "string") {
      let jsonString = rawResponse.trim();
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString.slice(7, -3).trim();
      } else if (jsonString.startsWith("```")) {
        jsonString = jsonString.slice(3, -3).trim();
      }
      
      const match = jsonString.match(/\{[\s\S]*\}/);
      if (match) {
        jsonString = match[0];
      }

      try {
        parsedData = JSON.parse(jsonString);
      } catch {
        // Fallback: extract fields from markdown or text output
        parsedData = extractFromText(rawResponse);
      }
    }

    if (!parsedData) {
      throw new Error("AI provider returned unparseable output");
    }

    // Normalize and clean fields before schema validation
    const cleaned = normalizeAnalysisData(parsedData);
    const validatedData = AnalysisResultSchema.parse(cleaned);
    return validatedData;

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("AI Output Validation Error:", error.issues);
      throw new Error("AI provider returned malformed output");
    }
    if ((error as Error).name === "AbortError") {
      throw new Error("AI request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanString(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || ["null", "none", "n/a", "undefined", "unknown"].includes(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

function normalizeAnalysisData(data: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...data };

  if ("candidateCommonName" in data) {
    normalized.candidateCommonName = cleanString(data.candidateCommonName);
  }
  if ("candidateScientificName" in data) {
    normalized.candidateScientificName = cleanString(data.candidateScientificName);
  }
  
  if (typeof data.confidence === "string") {
    const c = data.confidence.trim().toLowerCase();
    if (c === "high") normalized.confidence = "High";
    else if (c === "low") normalized.confidence = "Low";
    else if (c === "medium") normalized.confidence = "Medium";
  }

  if (typeof data.uncertaintyReasoning === "string") {
    normalized.uncertaintyReasoning = cleanString(data.uncertaintyReasoning) ?? data.uncertaintyReasoning;
  }

  if ("visualCharacteristics" in data) {
    if (Array.isArray(data.visualCharacteristics)) {
      normalized.visualCharacteristics = data.visualCharacteristics.map((x) => String(x).trim()).filter(Boolean);
    }
  }

  if ("facts" in data) {
    if (Array.isArray(data.facts)) {
      normalized.facts = data.facts.map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
    }
  }

  if ("ecologicalImportance" in data) {
    normalized.ecologicalImportance = cleanString(data.ecologicalImportance);
  }
  if ("naturalCharacteristic" in data) {
    normalized.naturalCharacteristic = cleanString(data.naturalCharacteristic);
  }
  if ("metaphoricalLesson" in data) {
    normalized.metaphoricalLesson = cleanString(data.metaphoricalLesson);
  }
  if ("quote" in data) {
    normalized.quote = cleanString(data.quote);
  }
  if ("reflectionQuestion" in data) {
    normalized.reflectionQuestion = cleanString(data.reflectionQuestion);
  }
  if ("detectedMood" in data) {
    normalized.detectedMood = cleanString(data.detectedMood);
  }
  if ("safetyNote" in data) {
    normalized.safetyNote = cleanString(data.safetyNote);
  }
  if ("searchTerms" in data) {
    if (Array.isArray(data.searchTerms)) {
      normalized.searchTerms = data.searchTerms.map((x) => String(x).trim()).filter(Boolean);
    }
  }

  return normalized;
}

function extractFromText(text: string): Record<string, unknown> {
  const getSection = (titleRegex: RegExp): string | null => {
    const match = text.match(titleRegex);
    return match ? match[1].trim() : null;
  };

  const nameMatch = text.match(/(?:specimen|plant|animal|species|candidate):\s*([^\n.]+)/i) ||
                    text.match(/\*\*(?:Common Name|Candidate)\*\*[:\s]*([^\n]+)/i);

  const visualSection = getSection(/\*\*(?:Visual Characteristics|Visuals)\*\*[:\s]*([\s\S]*?)(?=\n\*\*|$)/i);
  const factsSection = getSection(/\*\*(?:Facts|Nature Facts)\*\*[:\s]*([\s\S]*?)(?=\n\*\*|$)/i);
  const ecoSection = getSection(/\*\*(?:Ecological Importance|Ecology)\*\*[:\s]*([\s\S]*?)(?=\n\*\*|$)/i);
  const lessonSection = getSection(/\*\*(?:Metaphorical Lesson|Lesson)\*\*[:\s]*([\s\S]*?)(?=\n\*\*|$)/i);
  const quoteSection = getSection(/\*\*(?:Quote)\*\*[:\s]*([\s\S]*?)(?=\n\*\*|$)/i);
  const questionSection = getSection(/\*\*(?:Reflection Question|Reflection)\*\*[:\s]*([\s\S]*?)(?=\n\*\*|$)/i);
  const moodSection = getSection(/\*\*(?:Mood|Detected Mood)\*\*[:\s]*([\s\S]*?)(?=\n\*\*|$)/i);

  return {
    candidateCommonName: nameMatch ? nameMatch[1].replace(/[*_]/g, "").trim() : null,
    candidateScientificName: null,
    confidence: "Medium",
    uncertaintyReasoning: "Extracted from naturalist analysis.",
    visualCharacteristics: visualSection ? visualSection.split("\n").filter((l) => l.trim()) : [],
    facts: factsSection ? factsSection.split("\n").filter((l) => l.trim()) : [],
    ecologicalImportance: ecoSection,
    naturalCharacteristic: null,
    metaphoricalLesson: lessonSection,
    quote: quoteSection,
    reflectionQuestion: questionSection,
    detectedMood: moodSection ? moodSection.replace(/[*_]/g, "").trim() : null,
    searchTerms: nameMatch ? [nameMatch[1].trim()] : ["botany", "nature"]
  };
}
