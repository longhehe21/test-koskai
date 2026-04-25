import { create } from 'zustand';

export type PersonaAddress = 'anh' | 'chú' | 'bác';

export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
}

/** Một field form đã được AI extract từ lời nói. */
export interface FilledField {
  fieldKey: string;
  value: string;
  /** 0–1 — mức độ chắc chắn của extraction */
  confidence: number;
}

interface FormAiStore {
  /** Xưng hô dựa trên tuổi đọc từ CCCD */
  persona: PersonaAddress;
  /** Lịch sử hội thoại — giữ tối đa 12 lượt (6 user + 6 model) */
  history: ConversationTurn[];
  /** Map fieldKey → FilledField — tất cả các field đã fill được */
  filledFields: Record<string, FilledField>;
  /** true khi AI đang nói và bị ngắt bởi barge-in */
  wasInterrupted: boolean;

  setPersona: (persona: PersonaAddress) => void;
  addTurn: (turn: ConversationTurn) => void;
  setFilledField: (field: FilledField) => void;
  setWasInterrupted: (v: boolean) => void;
  /** Reset toàn bộ — gọi khi bắt đầu form mới */
  reset: () => void;
}

const MAX_HISTORY_TURNS = 6;

const initialState = {
  persona: 'anh' as PersonaAddress,
  history: [] as ConversationTurn[],
  filledFields: {} as Record<string, FilledField>,
  wasInterrupted: false,
};

export const useFormAiStore = create<FormAiStore>((set) => ({
  ...initialState,

  setPersona: (persona) => set({ persona }),

  addTurn: (turn) =>
    set((s) => {
      const next = [...s.history, turn];
      return { history: next.slice(-MAX_HISTORY_TURNS) };
    }),

  setFilledField: (field) =>
    set((s) => ({
      filledFields: { ...s.filledFields, [field.fieldKey]: field },
    })),

  setWasInterrupted: (wasInterrupted) => set({ wasInterrupted }),

  reset: () => set({ ...initialState }),
}));

/** Tính persona từ ngày sinh dd/mm/yyyy */
export function resolvePersona(ngaySinh: string): PersonaAddress {
  const parts = ngaySinh.split('/');
  if (parts.length < 3) return 'anh';
  const year = parseInt(parts[2], 10);
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  if (age >= 65) return 'bác';
  if (age >= 50) return 'chú';
  return 'anh';
}
