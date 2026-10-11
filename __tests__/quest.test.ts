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
});
