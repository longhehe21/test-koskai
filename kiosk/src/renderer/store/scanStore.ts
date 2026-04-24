/**
 * Store lưu ảnh đã scan trong flow hồ sơ đính kèm.
 *
 * Mục đích: các page sau khi rời ScanTaiLieuPage (XemTruoc, XacNhan, NopHoSo)
 * vẫn dùng được ảnh đã scan để preview + upload lên server.
 *
 * Persist: sessionStorage — reset khi đóng tab/kiosk (phù hợp feedback_data_security:
 * PII phải clear khi rời kiosk).
 *
 * Key format: `${flowKey}:${docCode}` — flowKey là procedureCode (thuong-tru, tam-tru, …),
 * docCode là mã tài liệu match với backend (ct01-to-khai-…, qsdd-…, …).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UploadState = 'pending' | 'uploading' | 'synced' | 'failed';

export interface ScannedDoc {
  /** JPEG dataURL của ảnh đã enhance (CamScanner-like) */
  dataUrl: string;
  /** Score match 0..1 (từ server /scan/classify) */
  matchScore: number;
  /** Mã doc — dùng để map về config hiển thị tên tiếng Việt */
  matchCode: string;
  /** Tên hiển thị */
  matchName: string;
  /** ISO timestamp lúc scan */
  scannedAt: string;
  /** OCR text thô từ server — để auto-fill các field sau (VD parse phường từ CT01) */
  ocrText?: string;
  /** Trạng thái đồng bộ lên server */
  uploadState?: UploadState;
  /** applicationFiles.id sau khi upload xong */
  fileId?: number;
  /** Lỗi upload (để retry / debug) */
  uploadError?: string;
}

interface ScanState {
  /** Map `${flowKey}:${docCode}` → ScannedDoc. Flat để JSON persist đơn giản. */
  docs: Record<string, ScannedDoc>;

  saveDoc: (flowKey: string, docCode: string, doc: ScannedDoc) => void;
  updateDoc: (
    flowKey: string,
    docCode: string,
    patch: Partial<ScannedDoc>,
  ) => void;
  getDoc: (flowKey: string, docCode: string) => ScannedDoc | undefined;
  listDocsByFlow: (flowKey: string) => { docCode: string; doc: ScannedDoc }[];
  removeDoc: (flowKey: string, docCode: string) => void;
  clearFlow: (flowKey: string) => void;
  clearAll: () => void;
}

const makeKey = (flowKey: string, docCode: string) => `${flowKey}:${docCode}`;

export const useScanStore = create<ScanState>()(
  persist(
    (set, get) => ({
      docs: {},

      saveDoc: (flowKey, docCode, doc) => {
        set((state) => ({
          docs: { ...state.docs, [makeKey(flowKey, docCode)]: doc },
        }));
      },

      updateDoc: (flowKey, docCode, patch) => {
        const key = makeKey(flowKey, docCode);
        set((state) => {
          const existing = state.docs[key];
          if (!existing) return state;
          return { docs: { ...state.docs, [key]: { ...existing, ...patch } } };
        });
      },

      getDoc: (flowKey, docCode) => get().docs[makeKey(flowKey, docCode)],

      listDocsByFlow: (flowKey) => {
        const prefix = `${flowKey}:`;
        return Object.entries(get().docs)
          .filter(([k]) => k.startsWith(prefix))
          .map(([k, doc]) => ({ docCode: k.slice(prefix.length), doc }));
      },

      removeDoc: (flowKey, docCode) => {
        const key = makeKey(flowKey, docCode);
        set((state) => {
          if (!(key in state.docs)) return state;
          const next: Record<string, ScannedDoc> = {};
          for (const [k, v] of Object.entries(state.docs)) {
            if (k !== key) next[k] = v;
          }
          return { docs: next };
        });
      },

      clearFlow: (flowKey) => {
        const prefix = `${flowKey}:`;
        set((state) => {
          const next: Record<string, ScannedDoc> = {};
          for (const [k, v] of Object.entries(state.docs)) {
            if (!k.startsWith(prefix)) next[k] = v;
          }
          return { docs: next };
        });
      },

      clearAll: () => set({ docs: {} }),
    }),
    {
      name: 'kioskai-scan-docs',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
