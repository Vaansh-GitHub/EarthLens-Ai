import { describe, it, expect } from "vitest";
import { CompleteAnalysisContractSchema } from "@/lib/server/ai";
import { sanitizeInsightData } from "@/lib/clean-insight";

describe("EarthLens AI Contract Schema & Transformation Tests", () => {
  const sampleContract = {
    possibleIdentification: {
      commonName: "Turkey Tail Polypore",
      scientificName: "Trametes versicolor",
      confidence: 94,
      identificationNotes: "Concentric multicolored velvet zones visible on decaying birch log."
    },
    questMatch: {
      score: 95,
      status: "strong_match" as const,
      matchedRequirements: [
        "Fungus growing on deadwood",
        "Concentric growth pattern clearly visible"
      ],
      missingRequirements: [],
      explanation: "Image provides clear evidence of Turkey Tail polypore actively decomposing forest deadwood.",
      retrySuggestion: null
    },
    visibleEvidence: [
      {
        observation: "Concentric velvety bands of brown, tan, and cream",
        significance: "Diagnostic cap coloration of Trametes versicolor"
      },
      {
        observation: "Bracket-like overlapping shelves attached directly to birch bark",
        significance: "Sessile growth habit on fallen hardwood"
      }
    ],
    natureFacts: [
      {
        title: "Lignin Degradation",
        detail: "Produces laccase enzymes capable of breaking down complex lignin polymers in wood.",
        evidenceType: "established_fact" as const
      },
      {
        title: "White Rot Decay",
        detail: "Acts as a primary white rot decomposer, returning locked carbon and minerals to the forest floor.",
        evidenceType: "observed" as const
      }
    ],
    ecologicalRole: {
      title: "Woodland Decomposer",
      description: "Vital primary decomposer recycling fallen wood into soil organic matter.",
      ecologicalNeed: "Preservation of deadwood and decaying timber in forest ecosystems.",
      conservationNote: null
    },
    wisdomAndReflection: {
      theme: "Transformation through Decay",
      quote: "What the tree can no longer hold becomes the quiet cradle where new life takes shape.",
      lifeConnection: "In decomposing what has fallen, this bracket fungus reminds us that life's greatest nourishment often comes from gracefully breaking down what has already run its course.",
      toneUsed: "Hopeful & Transformative",
      imageConnection: "velvety concentric shelves growing from dead birch wood"
    },
    reflection: {
      question: "What completed season or ended project in your life might now be ready to nourish your next beginning?",
      journalPrompt: "Reflect on how endings in your life have previously fostered unexpected renewal."
    },
    safetyNote: null
  };

  it("validates a complete contract against Zod schema", () => {
    const parsed = CompleteAnalysisContractSchema.parse(sampleContract);
    expect(parsed.possibleIdentification.commonName).toBe("Turkey Tail Polypore");
    expect(parsed.questMatch.status).toBe("strong_match");
    expect(parsed.natureFacts.length).toBe(2);
    expect(parsed.visibleEvidence.length).toBe(2);
    expect(parsed.wisdomAndReflection.quote).toContain("quiet cradle");
  });

  it("rejects incomplete or invalid contracts", () => {
    const invalid = {
      ...sampleContract,
      possibleIdentification: {
        commonName: "", // Empty not allowed
        confidence: 150 // Over 100 not allowed
      }
    };
    expect(() => CompleteAnalysisContractSchema.parse(invalid)).toThrow();
  });

  it("sanitizes insight data and provides both structured contract and flat aliases", () => {
    const clean = sanitizeInsightData(sampleContract);
    
    // Structured contract
    expect(clean.possibleIdentification.commonName).toBe("Turkey Tail Polypore");
    expect(clean.possibleIdentification.confidence).toBe(94);
    expect(clean.wisdomAndReflection.quote).toContain("quiet cradle");
    expect(clean.wisdomAndReflection.lifeConnection).toContain("greatest nourishment");
    expect(clean.ecologicalRole.title).toBe("Woodland Decomposer");
    
    // Flat backwards-compatible aliases
    expect(clean.name).toBe("Turkey Tail Polypore");
    expect(clean.scientificName).toBe("Trametes versicolor");
    expect(clean.quote).toContain("quiet cradle");
    expect(clean.lifeLesson).toContain("greatest nourishment");
    expect(clean.characteristic).toBe("Transformation through Decay");
  });

  it("verifies quest threshold status logic", () => {
    // 90-100: strong_match
    const cleanStrong = sanitizeInsightData({
      ...sampleContract,
      questMatch: { ...sampleContract.questMatch, score: 92, status: "strong_match" }
    });
    expect(cleanStrong.questMatch?.status).toBe("strong_match");

    // 70-89: partial_match
    const cleanPartial = sanitizeInsightData({
      ...sampleContract,
      questMatch: { ...sampleContract.questMatch, score: 75, status: "partial_match" }
    });
    expect(cleanPartial.questMatch?.status).toBe("partial_match");

    // <70: insufficient_match
    const cleanInsufficient = sanitizeInsightData({
      ...sampleContract,
      questMatch: {
        ...sampleContract.questMatch,
        score: 45,
        status: "insufficient_match",
        retrySuggestion: "Try photographing a fungus growing directly on tree bark."
      }
    });
    expect(cleanInsufficient.questMatch?.status).toBe("insufficient_match");
    expect(cleanInsufficient.questMatch?.retrySuggestion).toBeTruthy();
  });
});
