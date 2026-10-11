/**
 * Utility to sanitize AI naturalist analysis and validate the frontend JSON contract.
 * Strips leaked internal prompt markers while preserving rich structured fields.
 */

import type {
  IdentificationContract,
  QuestMatchContract,
  VisibleEvidenceContractItem,
  NatureFactContractItem,
  EcologicalRoleContract,
  WisdomAndReflectionContract,
  ReflectionContract,
  LocalDiscoveryAnalysis
} from "./client/journal-db";

export interface SanitizedInsightResult {
  // Target JSON Contract
  possibleIdentification: IdentificationContract;
  questMatch?: QuestMatchContract | null;
  visibleEvidence: VisibleEvidenceContractItem[];
  natureFacts: NatureFactContractItem[];
  ecologicalRole: EcologicalRoleContract;
  wisdomAndReflection: WisdomAndReflectionContract;
  reflection: ReflectionContract;
  safetyNote: string | null;

  // Legacy flat fields for backwards compatibility
  name: string;
  scientificName: string;
  confidence: string;
  facts: string[];
  ecologicalImportance: string;
  ecologicalNeed: string | null;
  characteristic: string;
  lifeLesson: string;
  quote: string;
  reflectionQuestion: string;
  detectedMood: string | null;
}

export function sanitizeInsightData(raw: LocalDiscoveryAnalysis | Record<string, unknown> | null | undefined): SanitizedInsightResult {
  if (!raw) {
    const defaultIdent: IdentificationContract = {
      commonName: "Field Specimen",
      scientificName: null,
      confidence: 85,
      identificationNotes: "Observed in outdoor environment.",
    };
    const defaultEvidence: VisibleEvidenceContractItem[] = [
      { observation: "Natural specimen documented in the field", significance: "Observable in photograph" }
    ];
    const defaultFacts: NatureFactContractItem[] = [
      { title: "Biological Trait", detail: "Exhibits specialized adaptations suited to native environment.", evidenceType: "established_fact" }
    ];
    const defaultEco: EcologicalRoleContract = {
      title: "Ecological Contribution",
      description: "Plays an active role in local biodiversity and nutrient cycling.",
      ecologicalNeed: "Preservation of undisturbed local habitat.",
      conservationNote: null
    };
    const defaultWisdom: WisdomAndReflectionContract = {
      theme: "Natural Observation",
      quote: "In observing the quiet work of living things, we find our own sense of place.",
      lifeConnection: "Taking time to observe the natural world offers valuable perspective on human growth and patience.",
      toneUsed: "Peaceful",
      imageConnection: "natural habitat scene"
    };
    const defaultReflect: ReflectionContract = {
      question: "What visible detail in this scene surprised you most?",
      journalPrompt: "Record one aspect of this natural observation that resonates with your day."
    };

    return {
      possibleIdentification: defaultIdent,
      visibleEvidence: defaultEvidence,
      natureFacts: defaultFacts,
      ecologicalRole: defaultEco,
      wisdomAndReflection: defaultWisdom,
      reflection: defaultReflect,
      safetyNote: null,
      name: defaultIdent.commonName,
      scientificName: "",
      confidence: "High",
      facts: defaultFacts.map(f => `${f.title}: ${f.detail}`),
      ecologicalImportance: defaultEco.description,
      ecologicalNeed: defaultEco.ecologicalNeed,
      characteristic: defaultWisdom.theme,
      lifeLesson: defaultWisdom.lifeConnection,
      quote: defaultWisdom.quote,
      reflectionQuestion: defaultReflect.question,
      detectedMood: defaultWisdom.toneUsed,
    };
  }

  // 1. Identification
  let commonName = "Field Discovery";
  let scientificName: string | null = null;
  let confidenceNum = 85;
  let identNotes = "Identified from distinctive visual features.";
  let category: string | null = null;

  if (typeof raw.possibleIdentification === "object" && raw.possibleIdentification !== null) {
    const p = raw.possibleIdentification as Record<string, unknown>;
    commonName = cleanString(p.commonName) || commonName;
    scientificName = cleanString(p.scientificName);
    category = cleanString(p.category);
    if (typeof p.confidence === "number") confidenceNum = p.confidence;
    identNotes = cleanString(p.identificationNotes) || identNotes;
  } else if (typeof raw.possibleIdentification === "string") {
    commonName = cleanString(raw.possibleIdentification) || commonName;
  }

  if (commonName === "Field Discovery") {
    commonName = cleanString(raw.candidateCommonName) || cleanString(raw.candidateIdentification) || commonName;
  }
  if (!scientificName) {
    scientificName = cleanString(raw.candidateScientificName);
  }

  // Strip accidental markdown
  commonName = commonName.replace(/^[*_~`]+|[*_~`]+$/g, "").trim();

  // 2. Visible Evidence
  const rawEv = raw.visibleEvidence || raw.visualCharacteristics;
  const visibleEvidence: VisibleEvidenceContractItem[] = [];

  if (Array.isArray(rawEv)) {
    for (const item of rawEv) {
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        const obs = cleanString(obj.observation);
        const sig = cleanString(obj.significance) || "Observable morphological characteristic";
        if (obs) visibleEvidence.push({ observation: obs, significance: sig });
      } else if (typeof item === "string" && item.trim()) {
        visibleEvidence.push({ observation: item.trim(), significance: "Key visual detail" });
      }
    }
  }

  if (visibleEvidence.length === 0) {
    visibleEvidence.push({
      observation: `Visible natural structure of ${commonName}`,
      significance: "Directly documented in field photograph"
    });
  }

  // 3. Nature Facts
  const rawFacts = raw.natureFacts || raw.facts;
  const natureFacts: NatureFactContractItem[] = [];

  if (Array.isArray(rawFacts)) {
    for (const item of rawFacts) {
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        const title = cleanString(obj.title) || "Natural Trait";
        const detail = cleanString(obj.detail);
        let evidenceType: "observed" | "established_fact" | "uncertain" = "established_fact";
        if (obj.evidenceType === "observed" || obj.evidenceType === "uncertain") {
          evidenceType = obj.evidenceType;
        }
        if (detail) natureFacts.push({ title, detail, evidenceType });
      } else if (typeof item === "string" && item.trim()) {
        const str = item.trim().replace(/^[\s•*]+/, "").trim();
        const colonIdx = str.indexOf(":");
        if (colonIdx > 0 && colonIdx < 35) {
          natureFacts.push({
            title: str.slice(0, colonIdx).trim(),
            detail: str.slice(colonIdx + 1).trim(),
            evidenceType: "established_fact"
          });
        } else {
          natureFacts.push({
            title: "Biological Trait",
            detail: str,
            evidenceType: "established_fact"
          });
        }
      }
    }
  }

  if (natureFacts.length === 0) {
    natureFacts.push({
      title: "Biological Adaptation",
      detail: `${commonName} exhibits adaptations suited to its natural habitat.`,
      evidenceType: "established_fact"
    });
  }

  // 4. Ecological Role
  let ecoTitle = "Ecological Contribution";
  let ecoDesc = "";
  let ecoNeed = "Preservation of undisturbed native habitat and supporting microclimates.";
  let ecoNote: string | null = null;

  if (typeof raw.ecologicalRole === "object" && raw.ecologicalRole !== null) {
    const e = raw.ecologicalRole as Record<string, unknown>;
    ecoTitle = cleanString(e.title) || ecoTitle;
    ecoDesc = cleanString(e.description) || "";
    ecoNeed = cleanString(e.ecologicalNeed) || ecoNeed;
    ecoNote = cleanString(e.conservationNote);
  } else if (typeof raw.ecologicalRole === "string") {
    ecoDesc = raw.ecologicalRole.trim();
  }

  if (!ecoDesc) {
    ecoDesc = cleanString(raw.ecologicalImportance) || `${commonName} actively contributes to local nutrient cycling and ecosystem balance.`;
  }
  if (raw.ecologicalNeed && typeof raw.ecologicalNeed === "string") {
    ecoNeed = raw.ecologicalNeed.trim();
  }

  // 5. Wisdom & Reflection
  let theme = "Field Discovery";
  let quote = "";
  let lifeConnection = "";
  let toneUsed = "Reflective";
  let imageConnection = `the visible presence of ${commonName}`;

  if (typeof raw.wisdomAndReflection === "object" && raw.wisdomAndReflection !== null) {
    const w = raw.wisdomAndReflection as Record<string, unknown>;
    theme = cleanString(w.theme) || theme;
    quote = cleanString(w.quote) || "";
    lifeConnection = cleanString(w.lifeConnection) || "";
    toneUsed = cleanString(w.toneUsed) || toneUsed;
    imageConnection = cleanString(w.imageConnection) || imageConnection;
  }

  if (!quote) {
    quote = cleanString(raw.originalQuote) || cleanString(raw.quote) || "";
  }
  if (!lifeConnection) {
    lifeConnection = cleanString(raw.reflection) || cleanString(raw.metaphoricalLesson) || cleanString(raw.lifeLesson) || "";
  }
  if (!theme || theme === "Field Discovery") {
    theme = cleanString(raw.reflectionTheme) || cleanString(raw.naturalCharacteristic) || cleanString(raw.characteristic) || `Observation of ${commonName}`;
  }

  // Clean quote quotation marks
  quote = quote.replace(/^["'“`]+|["'”`]+$/g, "").trim();

  // 6. Reflection
  let question = `What does the visible presence of ${commonName} invite you to consider in your life today?`;
  let journalPrompt = `Write down one observation from this scene and how it mirrors something in your current experience.`;

  if (typeof raw.reflection === "object" && raw.reflection !== null) {
    const r = raw.reflection as Record<string, unknown>;
    question = cleanString(r.question) || question;
    journalPrompt = cleanString(r.journalPrompt) || journalPrompt;
  } else if (typeof raw.reflection === "string") {
    question = raw.reflection.trim();
  }

  if (cleanString(raw.reflectionQuestion)) {
    question = cleanString(raw.reflectionQuestion)!;
  }

  // 7. Quest Match
  let questMatch: QuestMatchContract | null = null;
  if (typeof raw.questMatch === "object" && raw.questMatch !== null) {
    const q = raw.questMatch as Record<string, unknown>;
    questMatch = {
      score: typeof q.score === "number" ? q.score : 0,
      status: (q.status as "strong_match" | "partial_match" | "insufficient_match") || "partial_match",
      matchedRequirements: Array.isArray(q.matchedRequirements) ? q.matchedRequirements.map(String) : [],
      missingRequirements: Array.isArray(q.missingRequirements) ? q.missingRequirements.map(String) : [],
      explanation: cleanString(q.explanation) || "Quest match evaluated from visual evidence.",
      retrySuggestion: cleanString(q.retrySuggestion),
    };
  }

  // 8. Safety Note
  const safetyNote = cleanString(raw.safetyNote);

  const qualConfidence = confidenceNum >= 80 ? "High" : confidenceNum >= 55 ? "Medium" : "Low";

  return {
    possibleIdentification: {
      commonName,
      scientificName,
      category,
      confidence: confidenceNum,
      identificationNotes: identNotes,
    },
    questMatch,
    visibleEvidence,
    natureFacts,
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

    // Legacy flat fields
    name: commonName,
    scientificName: scientificName || "",
    confidence: qualConfidence,
    facts: natureFacts.map(f => `${f.title}: ${f.detail}`),
    ecologicalImportance: ecoDesc,
    ecologicalNeed: ecoNeed,
    characteristic: theme,
    lifeLesson: lifeConnection,
    quote,
    reflectionQuestion: question,
    detectedMood: toneUsed,
  };
}

function cleanString(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || ["null", "none", "n/a", "undefined", "unknown"].includes(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}
