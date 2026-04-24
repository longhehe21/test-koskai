/**
 * Document classifier — match OCR text với danh sách document config.
 *
 * Thuật toán scoring đơn giản:
 *  - must_have: TẤT CẢ phải xuất hiện trong text. Thiếu 1 → skip doc type.
 *  - should_have: càng nhiều match càng điểm cao.
 *  - score = (must.len + should.matched) / (must.len + should.len)
 *  - Chọn doc type có score cao nhất và ≥ min_score.
 *
 * Normalize text:
 *  - lowercase
 *  - loại dấu tiếng Việt (accent fold) — OCR đôi khi miss dấu, so với không dấu ổn định hơn
 *  - collapse whitespace
 *  - strip punct
 */

export interface DocumentRecognitionConfig {
  /** Các từ khoá BẮT BUỘC phải có — thiếu 1 → skip doc type này. */
  mustHave: string[];
  /** Từ khoá có thì cộng điểm, không có cũng không loại. */
  shouldHave?: string[];
  /** Threshold score tối thiểu (0..1). Default 0.5. */
  minScore?: number;
}

export interface DocumentConfig {
  /** Mã document — tham chiếu đến procedure.required_docs[].code */
  code: string;
  /** Tên hiển thị */
  name: string;
  /** Cấu hình nhận diện OCR */
  recognition: DocumentRecognitionConfig;
}

export interface ClassificationResult {
  code: string;
  name: string;
  score: number; // 0..1
  matchedKeywords: string[];
}

/**
 * Normalize Vietnamese text: strip dấu + lowercase + clean punct + collapse space.
 * OCR output thường có dấu câu, chấm nhiều → normalize giúp match ổn định.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD') // decompose accents
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/đ/gi, 'd') // đ không phải combining, xử lý riêng
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punct (giữ letters + digits)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classify OCR text chống lại danh sách document configs.
 * Trả về best match (nếu có score ≥ min_score), null nếu không match gì.
 */
export function classifyDocument(
  ocrText: string,
  documents: DocumentConfig[],
): ClassificationResult | null {
  const normalized = normalizeText(ocrText);
  let best: ClassificationResult | null = null;

  for (const doc of documents) {
    const mustHave = doc.recognition.mustHave.map(normalizeText);
    const shouldHave = (doc.recognition.shouldHave ?? []).map(normalizeText);
    const threshold = doc.recognition.minScore ?? 0.5;

    // Must-have check: tất cả phải match
    const mustMatched = mustHave.filter((kw) => normalized.includes(kw));
    if (mustMatched.length !== mustHave.length) {
      continue; // thiếu must-have → không phải doc type này
    }

    // Count should-have
    const shouldMatched = shouldHave.filter((kw) => normalized.includes(kw));

    // Score
    const totalKeywords = mustHave.length + shouldHave.length;
    const matchedCount = mustMatched.length + shouldMatched.length;
    const score = totalKeywords > 0 ? matchedCount / totalKeywords : 0;

    if (score >= threshold && (!best || score > best.score)) {
      // Reverse-map matched keywords to original (with dấu) cho UI hiển thị
      const matchedOriginal: string[] = [];
      for (const kw of doc.recognition.mustHave) {
        if (normalized.includes(normalizeText(kw))) matchedOriginal.push(kw);
      }
      for (const kw of doc.recognition.shouldHave ?? []) {
        if (normalized.includes(normalizeText(kw))) matchedOriginal.push(kw);
      }
      best = {
        code: doc.code,
        name: doc.name,
        score,
        matchedKeywords: matchedOriginal,
      };
    }
  }

  return best;
}
