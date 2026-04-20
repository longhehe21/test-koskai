export interface MauImage {
  src: string;
  alt: string;
}

export interface BranchConfig {
  mauLabel: string;
  mauImages: MauImage[];
  /** Plain text cho Q1. Default: "TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (MẪU {label})". */
  q1Text?: string;
  /** Chỉ render Q1 — bỏ Q2/Q3. */
  singleQuestion?: boolean;
  q2ShortName?: string;
  q2Text?: string;
  q3Text?: string;
  q3ShortName?: string;
  q3Optional?: boolean;
}

const TC01_IMAGES: MauImage[] = [
  {
    src: '/assets/mẫu đơn đăng ký thường trú thuộc trường hợp chỗ ở thuộc quyền ở hữu của mình.svg',
    alt: 'Mẫu đơn đăng ký thường trú - chỗ ở thuộc quyền sở hữu',
  },
];

const CT02_IMAGES: MauImage[] = [
  { src: '/assets/mẫu cư trú ct02 mặt trước.svg', alt: 'Mẫu CT02 - Mặt trước' },
  { src: '/assets/mẫu cư trú ct02 mặt sau.svg', alt: 'Mẫu CT02 - Mặt sau' },
  { src: '/assets/mẫu cư trú ct02 chú thích.svg', alt: 'Mẫu CT02 - Chú thích' },
];

const TO_KHAI_Y_KIEN_TEXT = 'TỜ KHAI (ghi ý kiến đồng ý của chủ hộ/chủ sở hữu)';

export const BRANCHES: Record<string, BranchConfig> = {
  'nuoc-ngoai': {
    mauLabel: 'CT02',
    mauImages: CT02_IMAGES,
    q2ShortName: 'Giấy tờ chứng minh sở hữu chỗ ở',
    q2Text: 'GIẤY TỜ CHỨNG MINH SỞ HỮU CHỖ Ở',
  },
  'quan-doi-cong-an': {
    mauLabel: 'TC01',
    mauImages: TC01_IMAGES,
    q2ShortName: 'Giấy giới thiệu của thủ trưởng đơn vị',
    q2Text: 'GIẤY GIỚI THIỆU CỦA THỦ TRƯỞNG ĐƠN VỊ (CA) HOẶC CẤP TRUNG ĐOÀN TRỞ LÊN (QĐ)',
  },
  'khong-so-huu-vn': {
    mauLabel: 'CT01',
    mauImages: TC01_IMAGES,
    q1Text: `${TO_KHAI_Y_KIEN_TEXT} (MẪU CT01)`,
    singleQuestion: true,
  },
  'khong-so-huu-vk': {
    mauLabel: 'CT02',
    mauImages: CT02_IMAGES,
    q1Text: `${TO_KHAI_Y_KIEN_TEXT} (MẪU CT02)`,
    singleQuestion: true,
  },
  'thue-muon-o-nho-vn': {
    mauLabel: 'CT01',
    mauImages: TC01_IMAGES,
    q1Text: `${TO_KHAI_Y_KIEN_TEXT} (MẪU CT01)`,
    singleQuestion: true,
  },
  'thue-muon-o-nho-vk': {
    mauLabel: 'CT02',
    mauImages: CT02_IMAGES,
    q1Text: `${TO_KHAI_Y_KIEN_TEXT} (MẪU CT02)`,
    singleQuestion: true,
  },
  'ton-giao-chuc-sac-vn': {
    mauLabel: 'CT01',
    mauImages: TC01_IMAGES,
    q1Text: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (MẪU CT01)',
    q2Text: 'GIẤY TỜ CHỨNG MINH LÀ CHỨC SẮC/NGƯỜI ĐẠI DIỆN CƠ SỞ',
    q2ShortName: 'Giấy tờ chứng minh là chức sắc/người đại diện cơ sở',
    q3Text: 'XÁC NHẬN CỦA UBND CẤP XÃ VỀ CHỖ Ở PHỤ TRỢ TẠI CƠ SỞ',
    q3ShortName: 'Xác nhận của UBND cấp xã về chỗ ở phụ trợ tại cơ sở',
  },
  'ton-giao-chuc-sac-vk': {
    mauLabel: 'CT02',
    mauImages: CT02_IMAGES,
    q1Text: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (MẪU CT02)',
    q2Text: 'GIẤY TỜ CHỨNG MINH LÀ CHỨC SẮC/NGƯỜI ĐẠI DIỆN CƠ SỞ',
    q2ShortName: 'Giấy tờ chứng minh là chức sắc/người đại diện cơ sở',
    q3Text: 'XÁC NHẬN CỦA UBND CẤP XÃ VỀ CHỖ Ở PHỤ TRỢ TẠI CƠ SỞ',
    q3ShortName: 'Xác nhận của UBND cấp xã về chỗ ở phụ trợ tại cơ sở',
  },
  'ton-giao-nuong-tua-vn': {
    mauLabel: 'CT01',
    mauImages: TC01_IMAGES,
    q1Text: 'TỜ KHAI (ghi ý kiến đồng ý của người đại diện/ban quản lý) (MẪU CT01)',
    q2Text: 'XÁC NHẬN CỦA UBND CẤP XÃ VỀ ĐỐI TƯỢNG VÀ CHỖ Ở PHỤ TRỢ',
    q2ShortName: 'Xác nhận của UBND cấp xã về đối tượng và chỗ ở phụ trợ',
  },
  'ton-giao-nuong-tua-vk': {
    mauLabel: 'CT02',
    mauImages: CT02_IMAGES,
    q1Text: 'TỜ KHAI (ghi ý kiến đồng ý của người đại diện/ban quản lý) (MẪU CT02)',
    q2Text: 'XÁC NHẬN CỦA UBND CẤP XÃ VỀ ĐỐI TƯỢNG VÀ CHỖ Ở PHỤ TRỢ',
    q2ShortName: 'Xác nhận của UBND cấp xã về đối tượng và chỗ ở phụ trợ',
  },
  'tro-giup-xa-hoi-vn': {
    mauLabel: 'CT01',
    mauImages: TC01_IMAGES,
    q1Text: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (MẪU CT01)',
    q2Text: 'VĂN BẢN ĐỀ NGHỊ CỦA NGƯỜI ĐỨNG ĐẦU CƠ SỞ TRỢ GIÚP XÃ HỘI',
    q2ShortName: 'Văn bản đề nghị của người đứng đầu cơ sở trợ giúp xã hội',
    q3Text: 'GIẤY TỜ XÁC NHẬN VIỆC CHĂM SÓC/NUÔI DƯỠNG',
    q3ShortName: 'Giấy tờ xác nhận việc chăm sóc/nuôi dưỡng',
  },
  'tro-giup-xa-hoi-vk': {
    mauLabel: 'CT02',
    mauImages: CT02_IMAGES,
    q1Text: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (MẪU CT02)',
    q2Text: 'VĂN BẢN ĐỀ NGHỊ CỦA NGƯỜI ĐỨNG ĐẦU CƠ SỞ TRỢ GIÚP XÃ HỘI',
    q2ShortName: 'Văn bản đề nghị của người đứng đầu cơ sở trợ giúp xã hội',
    q3Text: 'GIẤY TỜ XÁC NHẬN VIỆC CHĂM SÓC/NUÔI DƯỠNG',
    q3ShortName: 'Giấy tờ xác nhận việc chăm sóc/nuôi dưỡng',
  },
  'phuong-tien-vn': {
    mauLabel: 'CT01',
    mauImages: TC01_IMAGES,
    q1Text: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (MẪU CT01)',
    q2Text: 'GIẤY ĐĂNG KÝ + ĐĂNG KIỂM PHƯƠNG TIỆN (hoặc xác nhận UBND nếu không thuộc diện đăng ký)',
    q2ShortName: 'Giấy đăng ký + đăng kiểm phương tiện',
    q3Text: 'XÁC NHẬN CỦA UBND CẤP XÃ VỀ ĐỊA ĐIỂM ĐẬU ĐỖ THƯỜNG XUYÊN (nếu cần)',
    q3ShortName: 'Xác nhận của UBND cấp xã về địa điểm đậu đỗ thường xuyên',
    q3Optional: true,
  },
  'phuong-tien-vk': {
    mauLabel: 'CT02',
    mauImages: CT02_IMAGES,
    q1Text: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (MẪU CT02)',
    q2Text: 'GIẤY ĐĂNG KÝ + ĐĂNG KIỂM PHƯƠNG TIỆN (hoặc xác nhận UBND nếu không thuộc diện đăng ký)',
    q2ShortName: 'Giấy đăng ký + đăng kiểm phương tiện',
    q3Text: 'XÁC NHẬN CỦA UBND CẤP XÃ VỀ ĐỊA ĐIỂM ĐẬU ĐỖ THƯỜNG XUYÊN (nếu cần)',
    q3ShortName: 'Xác nhận của UBND cấp xã về địa điểm đậu đỗ thường xuyên',
    q3Optional: true,
  },
  'trong-nuoc': {
    mauLabel: 'TC01',
    mauImages: TC01_IMAGES,
    q2ShortName: 'Giấy tờ chứng minh sở hữu chỗ ở',
    q2Text: 'GIẤY TỜ CHỨNG MINH SỞ HỮU CHỖ Ở',
  },
};
