/**
 * Unit tests document classifier — không cần OCR thật, chỉ test logic match.
 */
import { describe, expect, it } from 'vitest';
import {
  classifyDocument,
  normalizeText,
  type DocumentConfig,
} from './document-classifier.js';

// Config thật của tạm vắng — 3 loại giấy tờ
const TAM_VANG_DOCS: DocumentConfig[] = [
  {
    code: 'van-ban-dong-y-giam-sat-giao-duc',
    name: 'Văn bản đồng ý của cơ quan có thẩm quyền giám sát, quản lý, giáo dục',
    recognition: {
      mustHave: ['văn bản đồng ý', 'giám sát'],
      shouldHave: ['cơ quan', 'thẩm quyền', 'quản lý', 'giáo dục'],
      minScore: 0.5,
    },
  },
  {
    code: 'ct03-phieu-tam-vang',
    name: 'Phiếu khai báo tạm vắng (Mẫu CT03)',
    recognition: {
      mustHave: ['phiếu khai báo tạm vắng'],
      shouldHave: ['ct03', 'số phiếu', 'họ và tên', 'công an'],
      minScore: 0.4,
    },
  },
  {
    code: 'giay-cham-soc-nuoi-duong',
    name: 'Giấy tờ xác nhận việc chăm sóc/nuôi dưỡng',
    recognition: {
      mustHave: ['chăm sóc'],
      shouldHave: ['nuôi dưỡng', 'xác nhận', 'ubnd'],
      minScore: 0.4,
    },
  },
];

describe('normalizeText', () => {
  it('strip dấu tiếng Việt', () => {
    expect(normalizeText('Văn Bản Đồng Ý')).toBe('van ban dong y');
    expect(normalizeText('Giám Sát')).toBe('giam sat');
    expect(normalizeText('Tạm Vắng')).toBe('tam vang');
  });

  it('strip punct + lowercase + collapse space', () => {
    expect(normalizeText('VĂN BẢN ĐỒNG Ý!!!  Của  CƠ QUAN')).toBe(
      'van ban dong y cua co quan',
    );
  });

  it('giữ số', () => {
    expect(normalizeText('Mẫu CT03 - Số 2024')).toBe('mau ct03 so 2024');
  });
});

describe('classifyDocument', () => {
  it('match "văn bản đồng ý" với OCR text chuẩn', () => {
    const ocr = `
      VĂN BẢN ĐỒNG Ý
      của Cơ quan có thẩm quyền giám sát, quản lý, giáo dục

      Ngày ... tháng ... năm 2025
      Kính gửi: ...
    `;
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('van-ban-dong-y-giam-sat-giao-duc');
    expect(result!.score).toBeGreaterThanOrEqual(0.5);
    // Match cả must + should
    expect(result!.matchedKeywords).toContain('văn bản đồng ý');
    expect(result!.matchedKeywords).toContain('giám sát');
  });

  it('match với OCR missing 1 dấu (ổn định khi OCR sót dấu)', () => {
    // OCR đọc "đồng" thành "dong" hoặc "DONG" là bình thường
    const ocr = `
      VAN BAN DONG Y
      cua co quan co tham quyen giam sat
      quan ly giao duc
    `;
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    expect(result?.code).toBe('van-ban-dong-y-giam-sat-giao-duc');
  });

  it('match CT03 phiếu khai báo tạm vắng', () => {
    const ocr = `
      PHIẾU KHAI BÁO TẠM VẮNG (Mẫu CT03)
      Số phiếu: 2024/0042
      Họ và tên: Nguyễn Văn A
      CƠ QUAN CÔNG AN...
    `;
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    expect(result?.code).toBe('ct03-phieu-tam-vang');
  });

  it('thiếu must-have → không match', () => {
    const ocr = 'Giấy khai sinh Nguyễn Văn A sinh ngày 01/01/2000';
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    expect(result).toBeNull();
  });

  it('text rỗng → null', () => {
    const result = classifyDocument('', TAM_VANG_DOCS);
    expect(result).toBeNull();
  });

  it('chỉ must-have (không should) → score = 0.33 (2/6), dưới threshold 0.5', () => {
    // Chỉ "văn bản đồng ý" + "giám sát" → 2/6 keyword = 0.33 < 0.5
    const ocr = 'Văn bản đồng ý về việc giám sát';
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    // Với config minScore 0.5 → không match
    expect(result).toBeNull();
  });

  it('chọn doc có score cao nhất khi nhiều match', () => {
    // Text có keyword của cả 2 doc → lấy cái match nhiều hơn
    const ocr = `
      VĂN BẢN ĐỒNG Ý
      của Cơ quan có thẩm quyền giám sát, quản lý, giáo dục
      xác nhận chăm sóc nuôi dưỡng
    `;
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    // "văn bản đồng ý" doc: must(2/2) + should(4/4) = 6/6 = 1.0
    // "chăm sóc" doc: must(1/1) + should(2/3) = 3/4 = 0.75
    // → chọn văn bản đồng ý
    expect(result?.code).toBe('van-ban-dong-y-giam-sat-giao-duc');
    expect(result?.score).toBe(1);
  });

  it('return matched keywords (với dấu gốc)', () => {
    const ocr = 'Văn bản đồng ý về giám sát của cơ quan';
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    if (result) {
      // Matched keywords giữ nguyên dấu gốc từ config (không phải normalized)
      expect(result.matchedKeywords).toContain('văn bản đồng ý');
      expect(result.matchedKeywords).toContain('giám sát');
      expect(result.matchedKeywords).toContain('cơ quan');
    }
  });

  it('OCR có ký tự rác giữa các từ (thường gặp với scan bẩn)', () => {
    // Dấu câu/rác GIỮA từ thì khó match (V*ĂN → "v an"). Nhưng trong thực tế
    // OCR chèn punct giữa từ (spaces, newlines) — không phá từ.
    // Giữa các từ có punct vẫn match OK:
    const ocr = `
      VĂN BẢN ĐỒNG Ý!!!
      của cơ quan, có thẩm quyền.
      Giám sát, quản lý, giáo dục.
    `;
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    expect(result?.code).toBe('van-ban-dong-y-giam-sat-giao-duc');
  });
});
