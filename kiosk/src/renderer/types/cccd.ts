/** 14 trường đọc được từ chip CCCD NFC (production) hoặc mock (dev). */
export interface CCCDData {
  /** Số CCCD 12 chữ số */
  soCCCD: string;
  /** Họ và tên đầy đủ (IN HOA theo chip) */
  hoTen: string;
  /** dd/mm/yyyy */
  ngaySinh: string;
  /** 'Nam' | 'Nữ' */
  gioiTinh: string;
  /** Ví dụ: 'Việt Nam' */
  quocTich: string;
  /** Ví dụ: 'Kinh' */
  danToc: string;
  /** Tỉnh/thành phố nơi cấp */
  noiCap: string;
  /** dd/mm/yyyy */
  ngayCap: string;
  /** dd/mm/yyyy — ngày hết hạn thẻ */
  ngayHetHan: string;
  /** Tỉnh/thành phố thường trú */
  tinhThuongTru: string;
  /** Huyện/quận thường trú */
  huyenThuongTru: string;
  /** Xã/phường thường trú */
  xaThuongTru: string;
  /** Số nhà, đường — phần địa chỉ thường trú chi tiết */
  diaChiThuongTru: string;
  /** Base64 PNG — ảnh chân dung từ chip (chỉ tồn tại trong RAM) */
  anhChanDung: string;
}
