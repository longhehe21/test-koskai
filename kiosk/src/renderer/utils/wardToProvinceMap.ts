/**
 * Mapping các phường/xã nổi tiếng → Tỉnh/Thành phố chứa nó.
 *
 * Khi OCR CT01 chỉ có "UBND Phường X" (không có tỉnh), ta suy ra tỉnh.
 * Key: tên phường đã normalize (bỏ dấu, lowercase, bỏ prefix).
 * Value: tên tỉnh/thành đầy đủ (dùng làm defaultProvinceName cho ProvinceWardSelect).
 *
 * Fallback: nếu không match → "Thành phố Hà Nội" (giả định demo ở HN).
 */

const WARD_TO_PROVINCE: Record<string, string> = {
  // Hà Nội — các phường/xã thuộc cấu trúc mới sau sáp nhập
  'tu liem': 'Thành phố Hà Nội',
  'ba dinh': 'Thành phố Hà Nội',
  'hoan kiem': 'Thành phố Hà Nội',
  'tay ho': 'Thành phố Hà Nội',
  'cau giay': 'Thành phố Hà Nội',
  'dong da': 'Thành phố Hà Nội',
  'hai ba trung': 'Thành phố Hà Nội',
  'hoang mai': 'Thành phố Hà Nội',
  'thanh xuan': 'Thành phố Hà Nội',
  'long bien': 'Thành phố Hà Nội',
  'ha dong': 'Thành phố Hà Nội',
  'me linh': 'Thành phố Hà Nội',
  'son tay': 'Thành phố Hà Nội',
  'thanh tri': 'Thành phố Hà Nội',
  'gia lam': 'Thành phố Hà Nội',
  'dan phuong': 'Thành phố Hà Nội',
  'dong anh': 'Thành phố Hà Nội',
  'soc son': 'Thành phố Hà Nội',

  // TP.HCM
  'ben thanh': 'Thành phố Hồ Chí Minh',
  'sai gon': 'Thành phố Hồ Chí Minh',
  'cho lon': 'Thành phố Hồ Chí Minh',
  'binh thanh': 'Thành phố Hồ Chí Minh',
  'phu nhuan': 'Thành phố Hồ Chí Minh',
  'tan binh': 'Thành phố Hồ Chí Minh',
  'go vap': 'Thành phố Hồ Chí Minh',
  'thu duc': 'Thành phố Hồ Chí Minh',

  // Đà Nẵng
  'hai chau': 'Thành phố Đà Nẵng',
  'son tra': 'Thành phố Đà Nẵng',
  'thanh khe': 'Thành phố Đà Nẵng',
  'ngu hanh son': 'Thành phố Đà Nẵng',

  // Lào Cai
  'xuan ai': 'Tỉnh Lào Cai',
  'lao cai': 'Tỉnh Lào Cai',
  'sa pa': 'Tỉnh Lào Cai',

  // Các tỉnh khác có thể thêm sau
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Suy ra tên tỉnh/thành từ tên phường/xã.
 * @param wardName — tên đầy đủ ("Phường Từ Liêm") hoặc chỉ tên ("Từ Liêm")
 * @returns tên tỉnh/thành, fallback "Thành phố Hà Nội"
 */
export function findProvinceForWard(wardName: string | null | undefined): string {
  if (!wardName) return 'Thành phố Hà Nội';

  // Strip prefix "Phường", "Xã", "Thị trấn", "Đặc khu"
  const clean = normalize(wardName).replace(
    /^(phuong|xa|thi tran|dac khu)\s+/,
    '',
  );

  return WARD_TO_PROVINCE[clean] ?? 'Thành phố Hà Nội';
}
