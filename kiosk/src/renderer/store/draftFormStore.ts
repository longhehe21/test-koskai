/**
 * Draft form store — tạm thời giữ form state khi user đang điền,
 * dùng cho "Lưu nháp" + "Tiếp tục chỉnh sửa" sau.
 *
 * Shape: map procedureCode → { form data, appId đã lưu trên server }.
 * Form data shape tự do per thủ tục — cast trong page tương ứng.
 *
 * Persist sessionStorage: dữ liệu PII lite → clear khi rời kiosk (feedback_data_security).
 * Còn server-side: đã encrypt qua identity_snapshots (production).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type DraftForm = Record<string, unknown>;

interface DraftFormState {
  /** procedureCode → form data */
  forms: Record<string, DraftForm>;
  /** procedureCode → applicationId trên server (nếu đã lưu) */
  appIds: Record<string, number>;

  setForm: (procedureCode: string, form: DraftForm) => void;
  patchForm: (procedureCode: string, patch: DraftForm) => void;
  getForm: (procedureCode: string) => DraftForm | null;

  setAppId: (procedureCode: string, appId: number) => void;
  getAppId: (procedureCode: string) => number | null;

  /** Hydrate toàn bộ state từ server khi resume draft */
  hydrate: (procedureCode: string, form: DraftForm, appId: number) => void;

  clearProcedure: (procedureCode: string) => void;
  clearAll: () => void;
}

export const useDraftFormStore = create<DraftFormState>()(
  persist(
    (set, get) => ({
      forms: {},
      appIds: {},

      setForm: (procedureCode, form) => {
        set((state) => ({
          forms: { ...state.forms, [procedureCode]: form },
        }));
      },

      patchForm: (procedureCode, patch) => {
        set((state) => ({
          forms: {
            ...state.forms,
            [procedureCode]: { ...(state.forms[procedureCode] ?? {}), ...patch },
          },
        }));
      },

      getForm: (procedureCode) => get().forms[procedureCode] ?? null,

      setAppId: (procedureCode, appId) => {
        set((state) => ({
          appIds: { ...state.appIds, [procedureCode]: appId },
        }));
      },

      getAppId: (procedureCode) => get().appIds[procedureCode] ?? null,

      hydrate: (procedureCode, form, appId) => {
        set((state) => ({
          forms: { ...state.forms, [procedureCode]: form },
          appIds: { ...state.appIds, [procedureCode]: appId },
        }));
      },

      clearProcedure: (procedureCode) => {
        set((state) => {
          const forms = { ...state.forms };
          const appIds = { ...state.appIds };
          delete forms[procedureCode];
          delete appIds[procedureCode];
          return { forms, appIds };
        });
      },

      clearAll: () => set({ forms: {}, appIds: {} }),
    }),
    {
      name: 'kioskai-draft-forms',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
