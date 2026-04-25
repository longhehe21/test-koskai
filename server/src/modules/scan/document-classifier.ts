export interface DocumentRecognitionConfig {
  mustHave: string[];
  shouldHave?: string[];
  minScore?: number;
}

export interface DocumentConfig {
  code: string;
  name: string;
  recognition: DocumentRecognitionConfig;
}

export interface ClassificationResult {
  code: string;
  name: string;
  score: number;
  matchedKeywords: string[];
}

export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyDocument(ocrText: string, documents: DocumentConfig[]): ClassificationResult | null {
  const normalized = normalizeText(ocrText);
  let best: ClassificationResult | null = null;

  for (const doc of documents) {
    const mustHave = doc.recognition.mustHave.map(normalizeText);
    const shouldHave = (doc.recognition.shouldHave ?? []).map(normalizeText);
    const threshold = doc.recognition.minScore ?? 0.5;

    const mustMatched = mustHave.filter((kw) => normalized.includes(kw));
    if (mustMatched.length !== mustHave.length) continue;

    const shouldMatched = shouldHave.filter((kw) => normalized.includes(kw));
    const totalKeywords = mustHave.length + shouldHave.length;
    const matchedCount = mustMatched.length + shouldMatched.length;
    const score = totalKeywords > 0 ? matchedCount / totalKeywords : 0;

    if (score >= threshold && (!best || score > best.score)) {
      const matchedOriginal: string[] = [];
      for (const kw of doc.recognition.mustHave) {
        if (normalized.includes(normalizeText(kw))) matchedOriginal.push(kw);
      }
      for (const kw of doc.recognition.shouldHave ?? []) {
        if (normalized.includes(normalizeText(kw))) matchedOriginal.push(kw);
      }
      best = { code: doc.code, name: doc.name, score, matchedKeywords: matchedOriginal };
    }
  }

  return best;
}
