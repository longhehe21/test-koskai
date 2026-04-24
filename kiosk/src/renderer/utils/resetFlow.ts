/**
 * resetFlow — clear state cho một flow thủ tục khi user "bắt đầu mới".
 *
 * Khi user đã lưu nháp trước đó (appId tồn tại trong draftFormStore), quay ra
 * trang chủ rồi vào lại để tạo hồ sơ MỚI (không phải resume qua "Hồ sơ của
 * tôi") thì form cần clear cache stale:
 *   - draftFormStore.forms[procedureCode] — formData JSON
 *   - draftFormStore.appIds[procedureCode] — appId draft cũ
 *   - scanStore docs với prefix `${procedureCode}:*` — ảnh scan cũ
 *   - Flow-specific store (hoKhauFlowStore, tamTruFlowStore, tamVangFlowStore)
 *
 * Chỉ clear nếu `getAppId(procedureCode)` ≠ null — tránh xóa state khi user
 * mid-flow chưa save (edge case ấn lại card trong middle of flow).
 */
import { useDraftFormStore } from '@store/draftFormStore';
import { useScanStore } from '@store/scanStore';
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';
import { useTamVangFlowStore } from '@store/tamVangFlowStore';

/**
 * Reset procedure cache + scans nếu user đã saved trước đó (signal "bắt đầu
 * mới"). Gọi tại entry point flow (VD khi click card ở /cu-tru).
 */
export function resetProcedureIfPreviouslySaved(procedureCode: string): void {
  const draftStore = useDraftFormStore.getState();
  if (!draftStore.getAppId(procedureCode)) return;

  draftStore.clearProcedure(procedureCode);
  useScanStore.getState().clearFlow(procedureCode);
}

/**
 * Reset TẤT CẢ procedure + flow store liên quan tới thủ tục cư trú. Gọi khi
 * user thật sự muốn start over (vd click 1 card ở /cu-tru).
 *
 * Không dùng cho navigation back/forward trong cùng flow.
 */
export function resetAllResidenceFlows(): void {
  const draftStore = useDraftFormStore.getState();
  const scanStore = useScanStore.getState();
  const codes = ['thuong-tru', 'tam-tru', 'tam-vang', 'luu-tru', 'gia-han-tam-tru', 'xoa-dang-ky'];
  codes.forEach((code) => {
    if (draftStore.getAppId(code)) {
      draftStore.clearProcedure(code);
      scanStore.clearFlow(code);
    }
  });
  useHoKhauFlowStore.getState().clear();
  useTamTruFlowStore.getState().clear();
  useTamVangFlowStore.getState().clear();
}
