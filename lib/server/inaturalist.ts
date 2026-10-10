import { z } from "zod";

const INatTaxonSchema = z.object({
  id: z.number(),
  name: z.string(),
  preferred_common_name: z.string().optional(),
  wikipedia_url: z.string().nullable().optional(),
  default_photo: z.object({
    url: z.string().optional(),
    medium_url: z.string().optional(),
  }).nullable().optional(),
});

export type INatTaxon = z.infer<typeof INatTaxonSchema>;

export async function searchINaturalist(query: string): Promise<INatTaxon[]> {
  const baseUrl = process.env.INATURALIST_BASE_URL || "https://api.inaturalist.org/v1";
  const timeoutMs = parseInt(process.env.INATURALIST_TIMEOUT_MS || "10000", 10);
  const maxResults = parseInt(process.env.INATURALIST_MAX_RESULTS || "5", 10);

  if (!query || query.trim().length === 0) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(`${baseUrl}/taxa`);
    url.searchParams.append("q", query);
    url.searchParams.append("per_page", maxResults.toString());
    url.searchParams.append("is_active", "true");

    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
      },
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("iNaturalist rate limit exceeded");
        return [];
      }
      throw new Error(`iNaturalist API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    const validResults: INatTaxon[] = [];
    for (const item of data.results) {
      const parsed = INatTaxonSchema.safeParse(item);
      if (parsed.success) {
        validResults.push(parsed.data);
      }
    }

    return validResults;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.warn(`iNaturalist search timed out for query: ${query}`);
      return [];
    }
    console.error("Failed to search iNaturalist:", error);
    return []; // Fail gracefully, don't break the main analysis
  } finally {
    clearTimeout(timeout);
  }
}
