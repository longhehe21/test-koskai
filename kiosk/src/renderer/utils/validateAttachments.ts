/**
 * Validate giấy tờ đính kèm trước khi nộp hồ sơ.
 *
 * Pattern: user tick "Chưa có" ở HoSoDinhKemModal cho giấy tờ KHÔNG PHẢI mẫu
 * đơn (CT01/CT02 được miễn vì user có thể khai trực tiếp) → flow vẫn cho vào
 * trang form để điền, nhưng khi nộp sẽ chặn yêu cầu bổ sung.
 *
 * Lưu nháp KHÔNG qua validator này → user vẫn lưu được.
 */
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';
import { useTamTruFlowStore, type TamTruVariant } from '@store/tamTruFlowStore';
import { useTamVangFlowStore } from '@store/tamVangFlowStore';
import { BRANCHES } from '@components/ui/hoSoDinhKemBranches';

/**
 * Thường trú (hộ khẩu): đọc branch config + so-huu/q3 từ hoKhauFlowStore.
 * CT01/CT02 (tc01) miễn check.
 */
export function getHoKhauMissingDocs(): string[] {
  const flow = useHoKhauFlowStore.getState();
  const cfg = flow.type ? BRANCHES[flow.type] : undefined;
  if (!cfg) return [];
  const missing: string[] = [];
  if (flow.hsdkSoHuu === '0' && cfg.q2ShortName) missing.push(cfg.q2ShortName);
  if (flow.hsdkQ3 === '0' && cfg.q3ShortName) missing.push(cfg.q3ShortName);
  return missing;
}

/**
 * Tạm trú: variant → short name mapping cho Q2, Q3. CT01/CT02/Danh sách
 * (hasQ1) miễn check.
 */
const TAM_TRU_Q2_NAMES: Record<Exclude<TamTruVariant, null>, string> = {
  'thuoc-so-huu': 'Giấy tờ chứng minh quyền sở hữu',
  'khong-thuoc-so-huu': 'Giấy tờ chứng minh chỗ ở hợp pháp',
  'quan-doi-cong-an': 'Giấy tờ xác nhận cơ quan công tác',
  'phuong-tien': 'Giấy đăng ký phương tiện',
  'thue-muon-o-nho': 'Hợp đồng thuê/mượn và văn bản đồng ý',
  'gia-han-ca-nhan': 'Giấy tờ chứng minh cần gia hạn',
  'gia-han-danh-sach': 'Danh sách gia hạn',
};

const TAM_TRU_Q3_NAMES: Partial<Record<Exclude<TamTruVariant, null>, string>> = {
  'phuong-tien': 'Giấy tờ nơi neo đậu phương tiện',
};

export function getTamTruMissingDocs(): string[] {
  const flow = useTamTruFlowStore.getState();
  if (!flow.variant) return [];
  const missing: string[] = [];
  if (!flow.hasQ2) {
    const name = TAM_TRU_Q2_NAMES[flow.variant];
    if (name) missing.push(name);
  }
  const q3Name = TAM_TRU_Q3_NAMES[flow.variant];
  if (q3Name && !flow.hasQ3) {
    missing.push(q3Name);
  }
  return missing;
}

/**
 * Tạm vắng: CT03 (mẫu đơn) miễn check. Chỉ kiểm tra văn bản đồng ý của cơ
 * quan thẩm quyền — áp dụng cho trường hợp tư pháp (bị giám sát/giáo dục).
 */
export function getTamVangMissingDocs(): string[] {
  const flow = useTamVangFlowStore.getState();
  const missing: string[] = [];
  // Chỉ check khi user đã trả lời (hsdkVanBan !== null) → tránh false positive
  // cho trường hợp nghĩa vụ không có câu hỏi này.
  if (flow.hsdkVanBan === '0') {
    missing.push('Văn bản đồng ý của cơ quan có thẩm quyền giám sát, quản lý, giáo dục');
  }
  return missing;
}

// =========================================================
// Scan routes — dùng cho nút "Quay lại bổ sung" trên SubmitBlockedModal
// =========================================================

/** Thường trú: luôn /scan-ho-khau bất kể branch. */
export const HO_KHAU_SCAN_ROUTE = '/scan-ho-khau';

/** Tạm vắng: luôn /scan-tam-vang. */
export const TAM_VANG_SCAN_ROUTE = '/scan-tam-vang';

/** Tạm trú: variant → route. Null nếu chưa chọn variant. */
export function getTamTruScanRoute(): string | null {
  const flow = useTamTruFlowStore.getState();
  switch (flow.variant) {
    case 'thuoc-so-huu': return '/scan-tam-tru';
    case 'khong-thuoc-so-huu': return '/scan-tam-tru-ct01';
    case 'quan-doi-cong-an': return '/scan-tam-tru-quan-doi';
    case 'phuong-tien': return '/scan-tam-tru-phuong-tien';
    case 'thue-muon-o-nho': return '/scan-tam-tru-thue-muon';
    case 'gia-han-ca-nhan': return '/scan-gia-han';
    case 'gia-han-danh-sach': return '/scan-gia-han-danh-sach';
    default: return null;
  }
}
