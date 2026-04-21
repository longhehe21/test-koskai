import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Flow tạm trú — share state giữa HSDK modal, scan, xem-truoc pages.
 * Cho biết variant (Q1 là CT01 hay Danh sách CD) + có Q1/Q2 không
 * → scan/xem-truoc build pages dynamic, chỉ show tài liệu user "Đã có".
 */

export type TamTruVariant =
  | 'thuoc-so-huu'
  | 'khong-thuoc-so-huu'
  | 'quan-doi-cong-an'
  | 'phuong-tien'
  | 'thue-muon-o-nho'
  | 'gia-han-ca-nhan'
  | 'gia-han-danh-sach'
  | null;
export type TamTruTruongHop = 'theo-danh-sach' | 'nhan-khau-ho' | null;
export type TamTruThuTuc = 'dang-ky' | 'gia-han' | 'xoa-dang-ky' | null;
export type XoaDangKyCaseId =
  | 'ho-vang-mat-6thang'
  | 'nhan-khau-khong-con-cho-o'
  | 'nhan-khau-da-dk-thuong-tru'
  | 'ca-ho-khong-con-cho-o'
  | 'nhan-khau-vang-mat-6thang'
  | 'ho-da-dk-thuong-tru'
  | null;

interface TamTruFlowState {
  /** Thủ tục chính: đăng ký / gia hạn / xóa đăng ký. Set tại TamTruThuTucPage. */
  thuTuc: TamTruThuTuc;
  /** Trường hợp user chọn ở màn "Bạn thuộc TRƯỜNG HỢP nào?" (cho đăng ký) */
  truongHop: TamTruTruongHop;
  /** Đối tượng user chọn ở màn "Xác định đối tượng tạm trú". */
  variant: TamTruVariant;
  /** Case user chọn ở màn Xóa đăng ký tạm trú (6 card). */
  xoaDangKyCase: XoaDangKyCaseId;
  /** Answers ở modal HSDK — hasQ3 chỉ dùng với variant 3 câu hỏi. */
  hasQ1: boolean;
  hasQ2: boolean;
  hasQ3: boolean;

  setThuTuc: (thuTuc: TamTruThuTuc) => void;
  setTruongHop: (truongHop: TamTruTruongHop) => void;
  setXoaDangKyCase: (xoaDangKyCase: XoaDangKyCaseId) => void;
  setAnswers: (input: {
    variant: TamTruVariant;
    hasQ1: boolean;
    hasQ2: boolean;
    hasQ3?: boolean;
  }) => void;
  clear: () => void;
}

export const useTamTruFlowStore = create<TamTruFlowState>()(
  persist(
    (set) => ({
      thuTuc: null,
      truongHop: null,
      variant: null,
      xoaDangKyCase: null,
      hasQ1: false,
      hasQ2: false,
      hasQ3: false,
      setThuTuc: (thuTuc) => set({ thuTuc }),
      setTruongHop: (truongHop) => set({ truongHop }),
      setXoaDangKyCase: (xoaDangKyCase) => set({ xoaDangKyCase }),
      setAnswers: ({ variant, hasQ1, hasQ2, hasQ3 = false }) =>
        set({ variant, hasQ1, hasQ2, hasQ3 }),
      clear: () =>
        set({
          thuTuc: null,
          truongHop: null,
          variant: null,
          xoaDangKyCase: null,
          hasQ1: false,
          hasQ2: false,
          hasQ3: false,
        }),
    }),
    {
      name: 'tam-tru-flow',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
