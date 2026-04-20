import { create } from 'zustand';

export interface PageHeaderConfig {
  title: string;
  showBack: boolean;
  showUserBadge: boolean;
  showDocs: boolean;
  userName?: string;
  onBack?: () => void;
}

interface LayoutState {
  header: PageHeaderConfig;
  setHeader: (patch: Partial<PageHeaderConfig>) => void;
  resetHeader: () => void;
}

const DEFAULT_HEADER: PageHeaderConfig = {
  title: 'Trang đăng nhập',
  showBack: false,
  showUserBadge: false,
  showDocs: false,
  userName: 'Nguyễn Văn A',
};

export const useLayoutStore = create<LayoutState>((set) => ({
  header: DEFAULT_HEADER,
  setHeader: (patch) =>
    set((state) => ({
      header: { ...state.header, ...patch },
    })),
  resetHeader: () => set({ header: DEFAULT_HEADER }),
}));
