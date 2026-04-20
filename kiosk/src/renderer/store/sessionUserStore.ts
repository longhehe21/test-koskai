import { create } from 'zustand';

export interface SessionUser {
  hoTen: string;
  ngaySinh: string;
  gioiTinh: string;
  danToc: string;
  quocTich: string;
  cccd: string;
  sdt: string;
  photoSrc: string;
  thuongTru: {
    province: string;
    ward: string;
    diaChi: string;
  };
}

interface SessionUserStore {
  user: SessionUser | null;
  setUser: (user: SessionUser) => void;
  clearUser: () => void;
}

/**
 * Thông tin user trong phiên hiện tại (từ NFC/CCCD scan).
 * Reset khi logout/timeout hoặc khi flow đăng ký hoàn tất.
 *
 * Dev/mock: populated via `MOCK_USER` ở khởi động app (xem main.tsx).
 * Prod: NFC reader đọc CCCD → IPC auth → setUser(data).
 */
export const useSessionUserStore = create<SessionUserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));

/** Mock cho giai đoạn UI-only (chưa có NFC reader). */
export const MOCK_USER: SessionUser = {
  hoTen: 'NGUYỄN VĂN A',
  ngaySinh: '01/01/2000',
  gioiTinh: 'Nam',
  danToc: 'Kinh',
  quocTich: 'Việt Nam',
  cccd: '001110011111',
  sdt: '',
  photoSrc: '/assets/user-demo.svg',
  thuongTru: {
    province: 'Thành phố Hà Nội',
    ward: 'Phường Ba Đình',
    diaChi: 'Ngọc Khánh',
  },
};
