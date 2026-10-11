import { analyzeImageWithAI, CompleteAnalysisContractSchema } from "../lib/server/ai";

async function runTest() {
  console.log("=== Testing EarthLens AI Nature Discovery Agent with Real Image ===");
  console.log("Model:", process.env.CLOUDFLARE_AI_MODEL);

  // Mountain Lake photograph
  const testImageUrl = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800";
  console.log("Fetching test photograph:", testImageUrl);
  const imgRes = await fetch(testImageUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const testQuest = {
    date: "2026-10-11",
    title: "Alpine Reflections",
    description: "Photograph an undisturbed body of water reflecting surrounding mountain ridges or rock faces.",
    reward: 50,
  };

  console.log("Executing analyzeImageWithAI with real model...");
  const startTime = Date.now();
  const result = await analyzeImageWithAI(buffer, "image/jpeg", "Feeling a sense of quiet solitude and awe here.", testQuest);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n=== Model Response Received in ${elapsed}s ===\n`);

  // Validate with Zod
  const validated = CompleteAnalysisContractSchema.parse({
    possibleIdentification: result.possibleIdentification,
    questMatch: result.questMatch,
    visibleEvidence: result.visibleEvidence,
    natureFacts: result.natureFacts,
    ecologicalRole: result.ecologicalRole,
    wisdomAndReflection: result.wisdomAndReflection,
    reflection: result.reflection,
    safetyNote: result.safetyNote,
  });

  console.log("JSON Contract Validation: SUCCESS (All Zod constraints satisfied)");
  console.log("\n--- Full Validated JSON Contract ---");
  console.log(JSON.stringify(validated, null, 2));

  console.log("\n--- Verification Highlights ---");
  console.log("Identification:", validated.possibleIdentification.commonName);
  console.log("Confidence:", validated.possibleIdentification.confidence);
  console.log("Quest Match Score:", validated.questMatch.score);
  console.log("Quest Match Status:", validated.questMatch.status);
  console.log("Matched Requirements:", validated.questMatch.matchedRequirements);
  console.log("Missing Requirements:", validated.questMatch.missingRequirements);
  console.log("Quest Explanation:", validated.questMatch.explanation);
  console.log("Quote:", validated.wisdomAndReflection.quote);
  console.log("Life Connection:", validated.wisdomAndReflection.lifeConnection);
  console.log("Nature Facts Count:", validated.natureFacts.length);
  console.log("Visible Evidence Count:", validated.visibleEvidence.length);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
