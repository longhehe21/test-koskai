import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Flow hộ khẩu — state share giữa các page trong flow đăng ký thường trú.
 *
 * Thay cho `sessionStorage` direct access ở 5 page + 1 modal.
 * Reactive: component subscribe sẽ re-render khi state thay đổi.
 * Persist: dùng sessionStorage qua middleware để state sống qua navigation nhưng reset khi đóng app.
 */

/** Card nguồn ở ho-khau-truong-hop: card 'so-huu' → null, còn lại → id card. */
export type HoKhauOrigin =
  | null
  | 'khong-so-huu'
  | 'thue-muon-o-nho'
  | 'ton-giao-chuc-sac'
  | 'ton-giao-nuong-tua'
  | 'tro-giup-xa-hoi'
  | 'phuong-tien';

/** Branch key sau khi compose origin × VN/VK, dùng tìm BranchConfig. */
export type HoKhauType = string;

/** Answer Y/N cho mỗi câu hỏi trong HoSoDinhKem modal. */
export type YesNo = '1' | '0';

interface HoKhauFlowState {
  origin: HoKhauOrigin;
  type: HoKhauType;
  hsdkTc01: YesNo | null;
  hsdkSoHuu: YesNo | null;
  hsdkQ3: YesNo | null;

  setOrigin: (origin: HoKhauOrigin) => void;
  setType: (type: HoKhauType) => void;
  setHsdkAnswers: (answers: {
    tc01: YesNo;
    soHuu?: YesNo;
    q3?: YesNo;
  }) => void;
  clear: () => void;
}

export const useHoKhauFlowStore = create<HoKhauFlowState>()(
  persist(
    (set) => ({
      origin: null,
      type: '',
      hsdkTc01: null,
      hsdkSoHuu: null,
      hsdkQ3: null,

      setOrigin: (origin) => set({ origin }),
      setType: (type) => set({ type }),
      setHsdkAnswers: ({ tc01, soHuu, q3 }) =>
        set({
          hsdkTc01: tc01,
          hsdkSoHuu: soHuu ?? '0',
          hsdkQ3: q3 ?? '0',
        }),
      clear: () =>
        set({
          origin: null,
          type: '',
          hsdkTc01: null,
          hsdkSoHuu: null,
          hsdkQ3: null,
        }),
    }),
    {
      name: 'ho-khau-flow',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export function isVietKieuBranch(type: HoKhauType): boolean {
  return type === 'nuoc-ngoai' || type.endsWith('-vk');
}
