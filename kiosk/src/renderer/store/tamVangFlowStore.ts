/**
 * Flow tạm vắng — persist HSDK answers (CT03 + văn bản đồng ý).
 * CT03 (mẫu đơn) miễn check; vanBan là giấy tờ phụ cần validate khi nộp.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type YesNo = '1' | '0';

interface TamVangFlowState {
  /** Có phiếu khai báo tạm vắng (Mẫu CT03) chưa? */
  hsdkCt03: YesNo | null;
  /** Có văn bản đồng ý của cơ quan thẩm quyền giám sát/quản lý/giáo dục chưa? */
  hsdkVanBan: YesNo | null;

  setAnswers: (input: { ct03?: YesNo; vanBan?: YesNo }) => void;
  clear: () => void;
}

export const useTamVangFlowStore = create<TamVangFlowState>()(
  persist(
    (set) => ({
      hsdkCt03: null,
      hsdkVanBan: null,
      setAnswers: ({ ct03, vanBan }) =>
        set((s) => ({
          hsdkCt03: ct03 ?? s.hsdkCt03,
          hsdkVanBan: vanBan ?? s.hsdkVanBan,
        })),
      clear: () => set({ hsdkCt03: null, hsdkVanBan: null }),
    }),
    {
      name: 'tam-vang-flow',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
