import { create } from 'zustand';
import type { CCCDData } from '@renderer/types/cccd';

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
  /** Dữ liệu đầy đủ 14 trường từ chip NFC (null nếu chưa đọc) */
  cccdData: CCCDData | null;
  /** Session token từ backend sau khi xác thực — bearer cho request tiếp theo */
  sessionToken: string | null;
  /** Citizen ID từ backend */
  citizenId: number | null;
  setUser: (user: SessionUser) => void;
  setCccdData: (data: CCCDData) => void;
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
  cccdData: null,
  sessionToken: null,
  citizenId: null,
  setUser: (user) => set({ user }),
  setCccdData: (data) => set({ cccdData: data }),
  setSession: (sessionToken, citizenId) => set({ sessionToken, citizenId }),
  clearUser: () => set({ user: null, cccdData: null, sessionToken: null, citizenId: null }),
}));

/** Mock CCCDData 14 trường — dev/demo (production đọc từ chip NFC). */
export const MOCK_CCCD: CCCDData = {
  soCCCD: '015203001181',
  hoTen: 'HÀ THÀNH LONG',
  ngaySinh: '20/12/2003',
  gioiTinh: 'Nam',
  quocTich: 'Việt Nam',
  danToc: 'Kinh',
  noiCap: 'Cục Cảnh sát QLHC về TTXH',
  ngayCap: '02/04/2021',
  ngayHetHan: '20/12/2033',
  tinhThuongTru: 'Tỉnh Lào Cai',
  huyenThuongTru: 'Huyện Văn Bàn',
  xaThuongTru: 'Xã Xuân Ái',
  diaChiThuongTru: 'Thôn Trung Tâm',
  anhChanDung: '',
};

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
