/**
 * Parse OCR text của tờ khai CT01 (Tờ khai thay đổi thông tin cư trú).
 *
 * OCR từ Tesseract có noise (ký tự rác, dấu câu thừa, dấu tiếng Việt sai sót).
 * Mục tiêu: tolerant parsing — extract được field nào thì trả về, field nào fail thì null.
 *
 * Các trường parse:
 *  - ward, wardType: từ "Kính gửi: UBND Phường X"
 *  - hoTen: từ "1. Họ, chữ đệm và tên: X"
 *  - ngaySinh: dd/mm/yyyy
 *  - gioiTinh: Nam/Nữ
 *  - sdt: 9-11 digit phone
 *  - email
 *  - hoTenChuHo: từ "7. Họ chữ đệm...chủ hộ: X"
 *  - mqhChuHo: từ "Mối quan hệ với chủ hộ: X"
 *  - noiDungDeNghi: từ "10. Nội dung đề nghị: X"
 *
 * Không parse:
 *  - Số định danh CCCD (ô vuông, OCR đọc rác)
 */

export interface Ct01Fields {
  ward: string | null;        // "Phường Từ Liêm"
  wardType: string | null;    // "Phường" | "Xã" | "Thị trấn" | "Đặc khu"
  wardNameOnly: string | null; // "Từ Liêm" (không prefix)
  hoTen: string | null;
  ngaySinh: string | null;
  gioiTinh: 'Nam' | 'Nữ' | null;
  sdt: string | null;
  email: string | null;
  hoTenChuHo: string | null;
  mqhChuHo: string | null;
  noiDungDeNghi: string | null;
}

const EMPTY: Ct01Fields = {
  ward: null,
  wardType: null,
  wardNameOnly: null,
  hoTen: null,
  ngaySinh: null,
  gioiTinh: null,
  sdt: null,
  email: null,
  hoTenChuHo: null,
  mqhChuHo: null,
  noiDungDeNghi: null,
};

/** Capitalize: "từ liêm" → "Từ Liêm" */
function capitalizeWords(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

/** Trim + remove trailing punctuation (. , ; : dấu ngoặc). */
function cleanValue(s: string): string {
  return s.replace(/[.,;:()\s]+$/, '').replace(/^[.,;:()\s]+/, '').trim();
}

export function parseCt01Ocr(ocrText: string): Ct01Fields {
  if (!ocrText) return EMPTY;

  const out: Ct01Fields = { ...EMPTY };

  // --- Ward: "Kính gửi(1): UBND PHƯỜNG TỪ LIÊM" ---
  // Regex tolerant: space, dấu câu, số (1) index có thể có
  const wardRe = /UBND\s+(Phường|Xã|Thị\s*trấn|Đặc\s*khu)\s+([A-ZĐĂÂÊÔƠƯ][^.,\n:(]+?)(?=\s*(?:[.,\n:]|$|\(|\d))/iu;
  const wardMatch = wardRe.exec(ocrText);
  if (wardMatch) {
    const wardType = capitalizeWords(wardMatch[1].replace(/\s+/g, ' '));
    const wardName = capitalizeWords(wardMatch[2].trim());
    if (wardName.length >= 2) {
      out.wardType = wardType;
      out.wardNameOnly = wardName;
      out.ward = `${wardType} ${wardName}`;
    }
  }

  // --- Họ tên: "1. Họ, chữ đệm và tên: ĐỖ THỊ NGỌC TRÂM" ---
  // OCR thường: "Họ. chữ đệm và tên:" (có dot rác). Match qua keyword "họ" + "tên".
  // Capture dùng \p{Lu} (Unicode uppercase) bắt đủ ĐỖ Ỗ Ị Ọ Ụ Ờ... — character class
  // cũ [A-ZĐĂÂÊÔƠƯ...Ồ-ỹ] thiếu Ọ Ụ Ỳ → bị cắt tên ở giữa.
  // Không dùng /i flag: với /i flag, \p{Lu} match cả lowercase → capture dính rác.
  // H[\p{Ll}]: tolerant với Tesseract đọc "ọ" thành g/0/i ("Hg", "H0"...).
  // Anchor "\d\." (1./2./3.) + "tên" đã đủ distinct, không cần strict "Họ".
  const hoTenRe = /(?:^|\n|\d\.)\s*H[\p{Ll}][^:\n]{0,40}?t[eê]n[^:\n]*?:\s*(\p{Lu}[\p{Lu}\s-]+?)(?=\s*(?:\n|\d\.|[.,;]|$))/u;
  const hoTenMatch = hoTenRe.exec(ocrText);
  if (hoTenMatch) {
    const name = cleanValue(hoTenMatch[1]);
    if (name.length >= 2) out.hoTen = name;
  }

  // --- Ngày sinh: "04/10/1979" ---
  const ngaySinhRe = /(?:Ng[aà]y|ngày)[^:\n]*?sinh[^:\n]*?:\s*(\d{1,2}\/\d{1,2}\/\d{4})/iu;
  const ngaySinhMatch = ngaySinhRe.exec(ocrText);
  if (ngaySinhMatch) out.ngaySinh = ngaySinhMatch[1];

  // --- Giới tính: "Nam" / "Nữ" ---
  const gioiTinhRe = /Gi[ơớ]i\s*t[íi]nh[^:\n]*?:\s*(Nam|Nữ|nam|nữ)/iu;
  const gioiTinhMatch = gioiTinhRe.exec(ocrText);
  if (gioiTinhMatch) {
    const g = gioiTinhMatch[1].toLowerCase();
    out.gioiTinh = g === 'nam' ? 'Nam' : 'Nữ';
  }

  // --- SĐT: tìm chuỗi 9-11 số liền nhau gần "điện thoại" ---
  const sdtRe = /(?:[đd]i[eệê]n\s*tho[aạ]i|SĐT|sdt)[^:\n]*?:\s*(\d{9,11})/iu;
  const sdtMatch = sdtRe.exec(ocrText);
  if (sdtMatch) out.sdt = sdtMatch[1];

  // --- Email ---
  const emailRe = /Email[^:]*?:\s*([\w][\w.+-]*@[\w.-]+\.\w{2,})/i;
  const emailMatch = emailRe.exec(ocrText);
  if (emailMatch) out.email = emailMatch[1].toLowerCase();

  // --- Chủ hộ: "7. Họ, chữ đệm và tên chủ hộ: ĐỖ TIẾN TRƯỜNG" ---
  // Anchor bằng "tên" + "chủ hộ" — KHÔNG chỉ "chủ hộ" vì field #8 cũng có
  // "Mối quan hệ với chủ hộ X" → regex cũ bị fall-through bắt nhầm X.
  // h[oộịò]: Tesseract tiếng Việt hay đọc sai "ộ" thành "i" ("hội") hoặc "ò".
  // Lookahead \d[.,]: OCR đọc "8." thành "8," — cho phép cả hai.
  // Character class \p{Lu} + Unicode flag bắt được toàn bộ VN hoa có dấu
  // (Ờ, Ố, Ệ... không nằm trong [A-ZĐĂÂÊÔƠƯ]).
  // [^\p{Lu}\n]{0,5}: nuốt "i" lạc ("hội"), space, dấu rác giữa "hộ" và tên.
  // KHÔNG dùng /i flag — \p{Lu} dưới /i sẽ match cả lowercase, capture dính rác.
  const chuHoRe = /[Tt][êeéèẻẽẹ]n\s*[Cc]h[uủ]\s*[Hh][oộịò][^\p{Lu}\n]{0,5}(\p{Lu}[\p{Lu}\s-]+?)(?=\s*(?:\d[.,]|M[oố]i\s*quan|[.,;]|$|\n))/u;
  const chuHoMatch = chuHoRe.exec(ocrText);
  if (chuHoMatch) {
    const name = cleanValue(chuHoMatch[1]);
    if (name.length >= 2 && name.length <= 50) out.hoTenChuHo = name;
  }

  // --- Mối quan hệ với chủ hộ ---
  // Anchor đi qua "chủ hộ" trước khi capture → bỏ qua "với" ở giữa.
  // [:.]? optional: OCR đôi lúc mất dấu ":" sau "chủ hộ".
  // M[oốỗ]i: "Mối" (đúng) | "Mỗi" (OCR đọc ố → ỗ).
  const mqhRe = /M[oốỗ]i\s*quan\s*h[eệ][^:\n]*?ch[uủ]\s*h[oộịò]\s*[:.]?\s*([^\n\d.]+?)(?=\s*(?:\d\.|\.|$|\n))/iu;
  const mqhMatch = mqhRe.exec(ocrText);
  if (mqhMatch) {
    const mqh = cleanValue(mqhMatch[1]);
    if (mqh.length >= 2 && mqh.length <= 30) out.mqhChuHo = capitalizeWords(mqh);
  }

  // --- Nội dung đề nghị: "Đăng ký thường trú" ---
  const ndRe = /N[oộ]i\s*dung\s*[dđ][eề]\s*ngh[iị][^:\n]*?:\s*([^\n.]+?)(?=\s*(?:\d\.|\.|$|\n))/iu;
  const ndMatch = ndRe.exec(ocrText);
  if (ndMatch) {
    const nd = cleanValue(ndMatch[1]);
    if (nd.length >= 3 && nd.length <= 100) out.noiDungDeNghi = nd;
  }

  return out;
}

/**
 * So 2 tên có match không (bỏ dấu, uppercase, ignore whitespace).
 * Dùng để compare OCR.hoTen với sessionUser.hoTen xác định Khai hộ.
 */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const normalize = (s: string) =>
    s.normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  return normalize(a) === normalize(b);
}
