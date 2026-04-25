import { create } from 'zustand';

export type ConversationState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';
export type MuseTalkStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'unconfigured';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: number;
}

interface ConversationStore {
  state: ConversationState;
  transcript: string;
  response: string;
  error: string | null;
  museTalkStatus: MuseTalkStatus;
  messages: ChatMessage[];
  currentRoute: string;
  /** true khi audio TTS thực sự bắt đầu phát — dùng để trigger typewriter */
  audioPlaying: boolean;

  setState: (state: ConversationState) => void;
  setTranscript: (text: string) => void;
  setResponse: (text: string) => void;
  setError: (msg: string | null) => void;
  setMuseTalkStatus: (status: MuseTalkStatus) => void;
  appendMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => void;
  clearMessages: () => void;
  setCurrentRoute: (route: string) => void;
  setAudioPlaying: (v: boolean) => void;
  reset: () => void;
}

let msgCounter = 0;
const nextMessageId = (): string => `m-${Date.now()}-${++msgCounter}`;

export const useConversationStore = create<ConversationStore>((set) => ({
  state: 'IDLE',
  transcript: '',
  response: '',
  error: null,
  museTalkStatus: 'disconnected',
  messages: [],
  currentRoute: '/',
  audioPlaying: false,

  setState: (state) => set({ state }),
  setTranscript: (transcript) => set({ transcript, error: null }),
  setResponse: (response) => set({ response }),
  setError: (error) => set({ error }),
  setMuseTalkStatus: (museTalkStatus) => set({ museTalkStatus }),
  appendMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, { id: nextMessageId(), ts: Date.now(), ...msg }],
    })),
  clearMessages: () => set({ messages: [], audioPlaying: false }),
  setCurrentRoute: (currentRoute) => set({ currentRoute }),
  setAudioPlaying: (audioPlaying) => set({ audioPlaying }),
  reset: () => set({ state: 'IDLE', transcript: '', response: '', error: null }),
}));
