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
  /** Ngày cấp CCCD (dd/mm/yyyy) — mock input, production sẽ đọc từ chip */
  ngayCap?: string;
  thuongTru: {
    province: string;
    ward: string;
    diaChi: string;
  };
}

interface SessionUserStore {
  user: SessionUser | null;
  /** Session token từ backend sau khi xác thực — bearer cho request tiếp theo */
  sessionToken: string | null;
  /** Citizen ID từ backend */
  citizenId: number | null;
  setUser: (user: SessionUser) => void;
  setSession: (sessionToken: string, citizenId: number) => void;
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
  sessionToken: null,
  citizenId: null,
  setUser: (user) => set({ user }),
  setSession: (sessionToken, citizenId) => set({ sessionToken, citizenId }),
  clearUser: () => set({ user: null, sessionToken: null, citizenId: null }),
}));

/** Mock cho giai đoạn UI-only (chưa có NFC reader). */
export const MOCK_USER: SessionUser = {
  hoTen: 'HÀ THÀNH LONG',
  ngaySinh: '20/12/2003',
  gioiTinh: 'Nam',
  danToc: 'Kinh',
  quocTich: 'Việt Nam',
  cccd: '015203001181',
  sdt: '',
  photoSrc: '/assets/user-demo.svg',
  ngayCap: '02/04/2021',
  thuongTru: {
    province: 'Tỉnh Lào Cai',
    ward: 'Xã Xuân Ái',
    diaChi: 'Thôn Trung Tâm',
  },
};
