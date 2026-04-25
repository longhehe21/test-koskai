import { describe, expect, it } from 'vitest';
import { classifyDocument, normalizeText, type DocumentConfig } from './document-classifier.js';

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
  });

  it('strip punct + lowercase + collapse space', () => {
    expect(normalizeText('VĂN BẢN ĐỒNG Ý!!!  Của  CƠ QUAN')).toBe('van ban dong y cua co quan');
  });

  it('giữ số', () => {
    expect(normalizeText('Mẫu CT03 - Số 2024')).toBe('mau ct03 so 2024');
  });
});

describe('classifyDocument', () => {
  it('match "văn bản đồng ý" với OCR text chuẩn', () => {
    const ocr = `VĂN BẢN ĐỒNG Ý\ncủa Cơ quan có thẩm quyền giám sát, quản lý, giáo dục`;
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    expect(result?.code).toBe('van-ban-dong-y-giam-sat-giao-duc');
    expect(result?.score).toBeGreaterThanOrEqual(0.5);
  });

  it('match CT03 phiếu khai báo tạm vắng', () => {
    const ocr = `PHIẾU KHAI BÁO TẠM VẮNG (Mẫu CT03)\nSố phiếu: 2024/0042\nHọ và tên: Nguyễn Văn A`;
    const result = classifyDocument(ocr, TAM_VANG_DOCS);
    expect(result?.code).toBe('ct03-phieu-tam-vang');
  });

  it('thiếu must-have → không match', () => {
    const result = classifyDocument('Giấy khai sinh Nguyễn Văn A', TAM_VANG_DOCS);
    expect(result).toBeNull();
  });

  it('text rỗng → null', () => {
    expect(classifyDocument('', TAM_VANG_DOCS)).toBeNull();
  });
});
