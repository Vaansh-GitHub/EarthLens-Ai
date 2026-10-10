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
Analyze the provided image carefully. Do not invent certainty, scientific facts, or names if you are unsure. If the image is unclear, state that it is inconclusive in your reasoning and use null for names. Clearly distinguish factual information from metaphorical interpretation.
Return your response STRICTLY as a JSON object matching this schema exactly (no markdown formatting, no code blocks, just raw JSON):
{
  "candidateCommonName": string | null,
  "candidateScientificName": string | null,
  "confidence": "High" | "Medium" | "Low",
  "uncertaintyReasoning": string,
  "visualCharacteristics": string[],
  "facts": string[],
  "ecologicalImportance": string | null,
  "naturalCharacteristic": string | null,
  "metaphoricalLesson": string | null,
  "quote": string | null,
  "reflectionQuestion": string | null,
  "searchTerms": string[]
}`;

  const promptContent = userNotes 
    ? `User provided field notes: "${userNotes}". Analyze the image and provide the JSON.` 
    : "Analyze the image and provide the JSON.";

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
    if (!response.ok && response.status === 403) {
      const errClone = response.clone();
      const errText = await errClone.text();
      if (errText.includes("Model Agreement") || errText.includes("5016")) {
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
      throw new Error(`AI provider error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cloudflare returns { result: { response: ... } } or { response: ... }
    const rawResponse = data.result?.response || data.response;
    if (!rawResponse) {
      throw new Error("Invalid response format from AI provider");
    }

    let parsedData: unknown;
    if (typeof rawResponse === "object" && rawResponse !== null) {
      parsedData = rawResponse;
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
      parsedData = JSON.parse(jsonString);
    } else {
      throw new Error("AI provider returned unparseable output");
    }

    const validatedData = AnalysisResultSchema.parse(parsedData);
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
