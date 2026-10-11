import { describe, it, expect, vi } from "vitest";
import { getDailyQuest, evaluateQuestMatch } from "../lib/server/quests";

// Mock mongodb
vi.mock("@/lib/server/mongodb", () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
      updateOne: vi.fn().mockResolvedValue({}),
    }),
  }),
}));

describe("Daily Quest & Matching Engine", () => {
  it("provides today's quest with renewal key", async () => {
    const quest = await getDailyQuest();
    expect(quest).toBeDefined();
    expect(quest.title).toBeTruthy();
    expect(quest.description).toBeTruthy();
    expect(quest.reward).toBe(50);
    expect(quest.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("awards points when discovery has a 70%-100% match", async () => {
    const testQuest = {
      date: "2026-10-10",
      title: "Golden Hour Glow",
      description: "Find a tree with an interesting bark pattern and observe its natural texture.",
      reward: 50,
    };

    const matchingDiscovery = {
      candidateCommonName: "English Oak",
      visualCharacteristics: ["Deeply grooved bark pattern", "Thick tree trunk"],
      facts: ["Ancient oak tree in native woodland"],
    };

    const observation = {
      category: "plant",
      description: "Found an old oak tree in the forest with rough bark",
    };

    const result = await evaluateQuestMatch(testQuest, matchingDiscovery, observation);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.matched).toBe(true);
    expect(result.bonusXp).toBe(50);
  });

  it("does not award quest bonus if discovery is unrelated (< 70%)", async () => {
    const testQuest = {
      date: "2026-10-10",
      title: "Golden Hour Glow",
      description: "Find a tree with an interesting bark pattern and observe its natural texture.",
      reward: 50,
    };

    const unrelatedDiscovery = {
      candidateCommonName: "Common Pigeon",
      visualCharacteristics: ["Grey feathers", "Beak"],
      facts: ["Urban bird"],
    };

    const observation = {
      category: "animal",
      description: "Spotted sitting on electrical wire",
    };

    const result = await evaluateQuestMatch(testQuest, unrelatedDiscovery, observation);
    expect(result.score).toBeLessThan(70);
    expect(result.matched).toBe(false);
    expect(result.bonusXp).toBe(0);
  });

  it("evaluates Turkey Tail Fungus as a strong match for Fungal Fusion quest", async () => {
    const fungalFusionQuest = {
      date: "2026-10-11",
      title: "Fungal Fusion",
      description: "Find and photograph a unique fungus growing in symbiosis with a tree, highlighting the intricate relationship between the two organisms.",
      reward: 50,
    };

    const turkeyTailDiscovery = {
      possibleIdentification: {
        commonName: "Turkey Tail Fungus",
        scientificName: "Trametes versicolor",
        confidence: 85,
        identificationNotes: "Identified based on concentric multicolored bands on bracket fungus",
      },
      visibleEvidence: [
        { observation: "Bracket fungus growing on fallen oak tree bark", significance: "Wood decay organism" }
      ],
      natureFacts: [
        { title: "Decomposer", detail: "Turkey tail is a polypore bracket fungus that breaks down dead wood", evidenceType: "established_fact" }
      ],
      ecologicalRole: {
        title: "Nutrient Cycler",
        description: "Breaks down lignin and wood on dead trees to nourish forest soil",
        ecologicalNeed: "Deadwood habitat",
      }
    };

    const observation = {
      category: "fungi",
      description: "Found on a mossy fallen tree trunk in the woods",
    };

    const result = await evaluateQuestMatch(fungalFusionQuest, turkeyTailDiscovery, observation);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.matched).toBe(true);
    expect(result.questMatchStatus).toBe("strong_match");
    expect(result.bonusXp).toBe(50);
  });
});
