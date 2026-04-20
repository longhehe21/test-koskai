import type { DropdownItem } from '@components/ui';
import { useHoKhauFlowStore, isVietKieuBranch as isVkType } from '@store/hoKhauFlowStore';

export function isVietKieuBranch(): boolean {
  return isVkType(useHoKhauFlowStore.getState().type);
}

export const FOREIGN_COUNTRIES: DropdownItem[] = [
  { code: 'us', name: 'Hoa Kỳ' },
  { code: 'jp', name: 'Nhật Bản' },
  { code: 'kr', name: 'Hàn Quốc' },
  { code: 'cn', name: 'Trung Quốc' },
  { code: 'th', name: 'Thái Lan' },
  { code: 'au', name: 'Úc' },
  { code: 'ca', name: 'Canada' },
  { code: 'uk', name: 'Anh' },
  { code: 'fr', name: 'Pháp' },
  { code: 'de', name: 'Đức' },
  { code: 'khac', name: 'Khác' },
];

export const MQH_ITEMS: DropdownItem[] = [
  { code: 'cha', name: 'Cha' },
  { code: 'me', name: 'Mẹ' },
  { code: 'vo', name: 'Vợ' },
  { code: 'chong', name: 'Chồng' },
  { code: 'con', name: 'Con' },
];

export const VAI_TRO_ITEMS: DropdownItem[] = [
  { code: 'chu-ho', name: 'Chủ hộ' },
  { code: 'chu-so-huu', name: 'Chủ sở hữu chỗ ở hợp pháp' },
  { code: 'cha-me-giam-ho', name: 'Cha/Mẹ/Người giám hộ' },
];

export const GIOI_TINH_ITEMS: DropdownItem[] = [
  { code: 'nam', name: 'Nam' },
  { code: 'nu', name: 'Nữ' },
];

export const QUAN_HE_ITEMS: DropdownItem[] = [
  { code: 'chu-ho', name: 'Chủ hộ' },
  { code: 'vo', name: 'Vợ' },
  { code: 'chong', name: 'Chồng' },
  { code: 'con', name: 'Con' },
  { code: 'cha', name: 'Cha' },
  { code: 'me', name: 'Mẹ' },
  { code: 'anh', name: 'Anh' },
  { code: 'chi', name: 'Chị' },
  { code: 'em', name: 'Em' },
  { code: 'khac', name: 'Khác' },
];

export const TRUONG_HOP_ITEMS: DropdownItem[] = [
  { code: 'ca-ho', name: 'Đăng ký thường trú cả hộ' },
  { code: 'lan-dau', name: 'Đăng ký thường trú lần đầu' },
  { code: 'nhan-khau', name: 'Đăng ký thường trú nhân khẩu' },
];

export const DAN_TOC_ITEMS: DropdownItem[] = [
  { code: 'kinh', name: 'Kinh' },
  { code: 'tay', name: 'Tày' },
  { code: 'thai', name: 'Thái' },
  { code: 'muong', name: 'Mường' },
  { code: 'khmer', name: 'Khmer' },
  { code: 'hoa', name: 'Hoa' },
  { code: 'khac', name: 'Khác' },
];

export const TON_GIAO_ITEMS: DropdownItem[] = [
  { code: 'khong', name: 'Không' },
  { code: 'phat-giao', name: 'Phật giáo' },
  { code: 'cong-giao', name: 'Công giáo' },
  { code: 'tin-lanh', name: 'Tin Lành' },
  { code: 'cao-dai', name: 'Cao Đài' },
  { code: 'hoa-hao', name: 'Hòa Hảo' },
  { code: 'hoi-giao', name: 'Hồi giáo' },
];

export const LY_DO_MIEN_PHI_ITEMS: DropdownItem[] = [
  {
    code: 'tre-em-cao-tuoi-khuyet-tat',
    name: 'Trẻ em theo quy định tại Luật Trẻ em; người cao tuổi theo quy định tại Luật Người cao tuổi; người khuyết tật theo quy định tại Luật Người khuyết tật',
  },
  {
    code: 'nguoi-co-cong',
    name: 'Người có công với cách mạng và thân nhân của người có công với cách mạng theo quy định tại Pháp lệnh Ưu đãi người có công với cách mạng',
  },
  {
    code: 'dan-toc-thieu-so',
    name: 'Đồng bào dân tộc thiểu số ở các xã có điều kiện kinh tế – xã hội đặc biệt khó khăn; công dân thường trú tại các xã biên giới; công dân thường trú tại các huyện',
  },
  { code: 'mo-coi', name: 'Công dân từ đủ 16 tuổi đến dưới 18 tuổi mồ côi cả cha và mẹ' },
  { code: 'sua-thong-tin', name: 'Sửa thông tin, làm sạch dữ liệu' },
];

export const COQUAN_ITEMS: DropdownItem[] = [
  { code: 'cong-an-phuong-ba-dinh', name: 'Công an Phường Ba Đình' },
];

export function RowActions({ onAdd, onRemove }: { onAdd: () => void; onRemove?: () => void }) {
  return (
    <div className="thtt-row-actions">
      <button type="button" className="thtt-add-btn" onClick={onAdd} aria-label="Thêm">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </button>
      {onRemove && (
        <button type="button" className="thtt-del-btn" onClick={onRemove} aria-label="Xoá">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
