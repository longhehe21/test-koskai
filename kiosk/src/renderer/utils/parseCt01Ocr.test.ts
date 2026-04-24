import { describe, it, expect } from 'vitest';
import { parseCt01Ocr } from './parseCt01Ocr';

describe('parseCt01Ocr — Tesseract CT01 OCR', () => {
  // Text OCR thật từ Tesseract (user report 2026-04-24):
  // - "chủ hộ" → "chủ hội" (ộ → i)
  // - Thiếu dấu ":" sau "tên chủ hội"
  // - "8." → "8,"
  // - Field #8 "Mối quan hệ với chủ hộ Chị gi" cũng chứa "chủ hộ" → regex
  //   cũ bị fall-through bắt nhầm thành hoTenChuHo = "Chị gi".
  const userReportOcr = `c7 V93 của Bộ trưởng Bộ Cỏngan
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM:
Độc lập - Tự do — Hạnh phúc
'ộc lập — Tự do — Hạnh phú
TỜ KHAI THAY ĐÓI THÔNG TIN CƯ TRÚ
Kinh giÝ9.UBND PHƯỜNG TỪ LIÊM.
„1. Họ, chữ đệm và tên: ĐỖ THỊ NGỌC TRÂM.
- 2/Ngày,hảng năm snh..04101929. 3.Giớitnh:N9-
iSiew«mdmm [e|s].:]e]--FT-P]
5. Số điện thoại liên hệ; 0912523077.............6, Email: ngưctram26@gmaieom
7.Họ, chữ đệm và tên chủ hội ĐÔ TIÊN TRƯỜNG 8, Mối quan hệ với chủ hộ Chị gi
acc Soeeees lgi5JBIĐIBIEJDIBIPIDIS]u]
-10. Nội dung đề nghị”: Đăng ký thường tú`;

  it('extract hoTenChuHo dù OCR đọc "hộ" thành "hội" và mất dấu ":"', () => {
    const r = parseCt01Ocr(userReportOcr);
    expect(r.hoTenChuHo).toBe('ĐÔ TIÊN TRƯỜNG');
  });

  it('KHÔNG bắt nhầm "Chị gi" (từ field #8) vào hoTenChuHo', () => {
    const r = parseCt01Ocr(userReportOcr);
    expect(r.hoTenChuHo).not.toMatch(/chị/i);
  });

  it('extract mqhChuHo khi OCR mất dấu ":" sau "chủ hộ"', () => {
    const r = parseCt01Ocr(userReportOcr);
    expect(r.mqhChuHo).toBe('Chị Gi');
  });

  it('extract ward, hoTen, noiDungDeNghi (regression — không bị fix phá)', () => {
    const r = parseCt01Ocr(userReportOcr);
    expect(r.ward).toBe('Phường Từ Liêm');
    expect(r.hoTen).toBe('ĐỖ THỊ NGỌC TRÂM');
    expect(r.noiDungDeNghi).toBe('Đăng ký thường tú');
  });

  it('form chuẩn (có dấu ":") vẫn parse được — không regress', () => {
    const clean = `7. Họ, chữ đệm và tên chủ hộ: NGUYỄN VĂN A
8. Mối quan hệ với chủ hộ: Con trai
10. Nội dung đề nghị: Đăng ký thường trú`;
    const r = parseCt01Ocr(clean);
    expect(r.hoTenChuHo).toBe('NGUYỄN VĂN A');
    expect(r.mqhChuHo).toBe('Con Trai');
  });

  // OCR lần 2 (2026-04-24) — Tesseract đọc "Họ" → "Hg", "Mối" → "Mỗi":
  //   "1.Hg,chữ đệm và tên: ĐỒ THỊ NGỌC TRÂM."
  //   "Mỗi quan hệ với chủ hộ: Cl"
  // Nếu hoTen parse thất bại → Section3VN.isKhaiHoFromOcr = false
  // → không tự tick "Khai hộ" dù tên trong giấy khác tên người đăng nhập.
  const userReportOcr2 = `Mẫu CT01 ban hành kèm theo Thông tư số 662023 TT-BC
ngày 17/11/2023 của Bộ trưởng Bộ Công an
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM.
Độc lập - Tự do - Hạnh phúc
TỜ KHAI THAY ĐÓI THÔNG TIN CƯ TRÚ
Kính gi): UBND PHƯỜNG TỪ LIÊM
1.Hg,chữ đệm và tên: ĐỒ THỊ NGỌC TRÂM.
2.Ngày tháng năm sinh...04/101979.  3.Giới tính: Nữ
14 Số định danh cá nhân: esEEFEILEEIsHhLLL
'5. Số điện thoại liên hệ: 0912523077................6. Email: ngoctram36r email com.
(7.Hg, chữ đệm và tên chủ hộ; ĐÔ TIỀN TRƯỜNG 8. Mỗi quan hệ với chủ hộ: Cl
366/hdmnneaens [(013|8|o|s|2|o|o|o|ols
10.Nội dụng đề nghị ”: Đăng ký thường trú.`;

  it('extract hoTen dù OCR đọc "Họ" thành "Hg" (tolerant \\p{Ll})', () => {
    const r = parseCt01Ocr(userReportOcr2);
    expect(r.hoTen).toBe('ĐỒ THỊ NGỌC TRÂM');
  });

  it('extract hoTenChuHo dù "Họ" → "Hg" và separator là dấu ";"', () => {
    const r = parseCt01Ocr(userReportOcr2);
    expect(r.hoTenChuHo).toBe('ĐÔ TIỀN TRƯỜNG');
  });

  // OCR lần 3 (user report) — "Họ." có dấu chấm, field #7 OCR ra "17. Hạ,".
  const userReportOcr3 = `Kinh giít).UBND PHƯỜNG TỪ LIÊM
1. Họ. chữ đệm và tên: ĐỒ THỊ NGỌC TRÂM
2.Ngày tháng nimsinh..0VA019/9, 3. Giới nh: Nữ
5. Số điện thoại liên hệ 0912523077. .Email:ngoctani6ensilsem
17. Hạ, chữ đậm và tên chủ hộ: ĐÔ TIÊN TRƯỜNG 8, Mỗi quan hệ với chủ hộ: Chị gi
10. Nội dung để nghị Đăngkýthườngt`;

  it('extract hoTen với separator "Họ." (có chấm sau Họ)', () => {
    const r = parseCt01Ocr(userReportOcr3);
    expect(r.hoTen).toBe('ĐỒ THỊ NGỌC TRÂM');
  });

  it('extract hoTenChuHo với prefix "17." (OCR đọc 7 thành 17)', () => {
    const r = parseCt01Ocr(userReportOcr3);
    expect(r.hoTenChuHo).toBe('ĐÔ TIÊN TRƯỜNG');
  });
});
