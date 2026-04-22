/**
 * Flow config cho progress stepper trên header.
 *
 * Mỗi flow = danh sách bước user đi qua để hoàn tất 1 thủ tục.
 * Step có thể match nhiều path (vd step "Quét giấy tờ" của tạm trú có nhiều
 * variant /scan-tam-tru-ct01, /scan-tam-tru-quan-doi, ...). `jumpTo` là path
 * dùng khi user click back về step đó — lý tưởng là path generic nhất.
 *
 * Shared paths (/cu-tru, /nop-ho-so-thanh-cong) không nằm trong `matches`
 * của step cụ thể — xử lý riêng trong useFlowStepper (dùng sessionStorage
 * để nhớ flow hiện tại, vì path shared không unique).
 *
 * Step "service" = step 0, luôn là entry point "Dịch vụ" → /services.
 * Step "done" = step cuối, khi tới nop-ho-so-thanh-cong.
 */

export interface FlowStep {
  key: string;
  label: string;
  /** Path match step này — nếu 1 step có nhiều variant thì list đủ. */
  matches: string[];
  /** Path navigate khi user click jump về step. Default = matches[0]. */
  jumpTo?: string;
}

export interface FlowDef {
  id: FlowId;
  label: string;
  steps: FlowStep[];
}

export type FlowId =
  | 'thuong-tru'
  | 'tam-tru'
  | 'tam-vang'
  | 'luu-tru'
  | 'gia-han'
  | 'xoa-dang-ky';

/** Step đầu dùng chung cho mọi flow — về menu dịch vụ. */
const SERVICE_STEP: FlowStep = {
  key: 'service',
  label: 'Dịch vụ',
  matches: [],
  jumpTo: '/services',
};

/** Step cuối dùng chung — trang nộp thành công. */
const DONE_STEP: FlowStep = {
  key: 'done',
  label: 'Hoàn tất',
  matches: ['/nop-ho-so-thanh-cong'],
};

export const FLOWS: Record<FlowId, FlowDef> = {
  'thuong-tru': {
    id: 'thuong-tru',
    label: 'Đăng ký thường trú',
    steps: [
      SERVICE_STEP,
      { key: 'case', label: 'Trường hợp', matches: ['/ho-khau-truong-hop'] },
      { key: 'origin', label: 'Nguồn gốc', matches: ['/ho-khau-sinh-song'] },
      { key: 'scan', label: 'Quét giấy tờ', matches: ['/scan-ho-khau'] },
      { key: 'preview', label: 'Xem trước', matches: ['/xem-truoc-ho-khau'] },
      { key: 'form', label: 'Điền hồ sơ', matches: ['/tao-ho-so-thuong-tru'] },
      DONE_STEP,
    ],
  },
  'tam-tru': {
    id: 'tam-tru',
    label: 'Đăng ký tạm trú',
    steps: [
      SERVICE_STEP,
      { key: 'thu-tuc', label: 'Thủ tục', matches: ['/tam-tru-thu-tuc'] },
      { key: 'case', label: 'Trường hợp', matches: ['/tam-tru-truong-hop'] },
      { key: 'doi-tuong', label: 'Đối tượng', matches: ['/tam-tru-doi-tuong'] },
      {
        key: 'scan',
        label: 'Quét giấy tờ',
        matches: [
          '/scan-tam-tru',
          '/scan-tam-tru-ct01',
          '/scan-tam-tru-quan-doi',
          '/scan-tam-tru-phuong-tien',
          '/scan-tam-tru-thue-muon',
        ],
        jumpTo: '/scan-tam-tru',
      },
      {
        key: 'preview',
        label: 'Xem trước',
        matches: [
          '/xem-truoc-tam-tru',
          '/xem-truoc-tam-tru-ct01',
          '/xem-truoc-tam-tru-quan-doi',
          '/xem-truoc-tam-tru-phuong-tien',
          '/xem-truoc-tam-tru-thue-muon',
        ],
        jumpTo: '/xem-truoc-tam-tru',
      },
      {
        key: 'form',
        label: 'Điền hồ sơ',
        matches: ['/tao-ho-so-tam-tru-danh-sach', '/tao-ho-so-tam-tru-nhan-khau-ho'],
        jumpTo: '/tao-ho-so-tam-tru-danh-sach',
      },
      DONE_STEP,
    ],
  },
  'tam-vang': {
    id: 'tam-vang',
    label: 'Khai báo tạm vắng',
    steps: [
      SERVICE_STEP,
      { key: 'case', label: 'Đối tượng', matches: ['/xac-dinh-doi-tuong'] },
      { key: 'scan', label: 'Quét giấy tờ', matches: ['/scan-tam-vang'] },
      { key: 'preview', label: 'Xem trước', matches: ['/xem-truoc-tam-vang'] },
      { key: 'form', label: 'Điền hồ sơ', matches: ['/tao-khai-bao-tam-vang'] },
      DONE_STEP,
    ],
  },
  'luu-tru': {
    id: 'luu-tru',
    label: 'Thông báo lưu trú',
    steps: [
      SERVICE_STEP,
      { key: 'scan', label: 'Quét giấy tờ', matches: ['/scan-luu-tru'] },
      { key: 'preview', label: 'Xem trước', matches: ['/xem-truoc-luu-tru'] },
      { key: 'form', label: 'Điền hồ sơ', matches: ['/tao-thong-bao-luu-tru'] },
      DONE_STEP,
    ],
  },
  'gia-han': {
    id: 'gia-han',
    label: 'Gia hạn tạm trú',
    steps: [
      SERVICE_STEP,
      { key: 'case', label: 'Trường hợp', matches: ['/gia-han-truong-hop'] },
      {
        key: 'scan',
        label: 'Quét giấy tờ',
        matches: ['/scan-gia-han', '/scan-gia-han-danh-sach'],
        jumpTo: '/scan-gia-han',
      },
      {
        key: 'preview',
        label: 'Xem trước',
        matches: ['/xem-truoc-gia-han', '/xem-truoc-gia-han-danh-sach'],
        jumpTo: '/xem-truoc-gia-han',
      },
      {
        key: 'form',
        label: 'Điền hồ sơ',
        matches: ['/tao-ho-so-gia-han', '/tao-ho-so-gia-han-danh-sach'],
        jumpTo: '/tao-ho-so-gia-han',
      },
      DONE_STEP,
    ],
  },
  'xoa-dang-ky': {
    id: 'xoa-dang-ky',
    label: 'Xóa đăng ký tạm trú',
    steps: [
      SERVICE_STEP,
      { key: 'case', label: 'Trường hợp', matches: ['/xoa-dang-ky-truong-hop'] },
      { key: 'scan', label: 'Quét giấy tờ', matches: ['/scan-xoa-dang-ky'] },
      { key: 'preview', label: 'Xem trước', matches: ['/xem-truoc-xoa-dang-ky'] },
      { key: 'form', label: 'Điền hồ sơ', matches: ['/tao-ho-so-xoa-dang-ky'] },
      DONE_STEP,
    ],
  },
};

/**
 * Index ngược path → {flowId, stepIndex} để lookup O(1).
 * Nhiều flow có thể chia sẻ path (như /nop-ho-so-thanh-cong) → ta lưu
 * TẤT CẢ matches, consumer dùng sessionStorage để chọn flow đúng.
 */
export interface PathMatch {
  flowId: FlowId;
  stepIndex: number;
}

const PATH_INDEX: Map<string, PathMatch[]> = (() => {
  const map = new Map<string, PathMatch[]>();
  for (const flow of Object.values(FLOWS)) {
    flow.steps.forEach((step, stepIndex) => {
      step.matches.forEach((path) => {
        const list = map.get(path) ?? [];
        list.push({ flowId: flow.id, stepIndex });
        map.set(path, list);
      });
    });
  }
  return map;
})();

/** Tất cả match cho path (có thể rỗng nếu path không trong flow nào). */
export function findPathMatches(pathname: string): PathMatch[] {
  return PATH_INDEX.get(pathname) ?? [];
}

/** Tìm flow dựa vào path unique — nếu có nhiều match trả null. */
export function findUniqueFlow(pathname: string): PathMatch | null {
  const matches = findPathMatches(pathname);
  return matches.length === 1 ? matches[0] : null;
}
