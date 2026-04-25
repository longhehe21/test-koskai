import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { useLocation } from 'react-router-dom';
import { ConversationController } from '@services/ConversationController';
import { useConversationStore } from '@store/conversationStore';
import { useSessionUserStore, type SessionUser } from '@store/sessionUserStore';
import { api } from '@renderer/services/api';
import type { MuseTalkCanvasHandle } from '@components/musetalk-canvas/MuseTalkCanvas';

export type TranscriptOverride = (transcript: string) => Promise<string>;

interface AiContextValue {
  canvasRef: RefObject<MuseTalkCanvasHandle>;
  begin: () => void;
  /** Override tạm thời từ page-specific hook. null → restore về default. */
  setTranscriptOverride: (fn: TranscriptOverride | null) => void;
  /** Override mặc định (global navigator) — Layout gọi khi mount. */
  setDefaultTranscriptOverride: (fn: TranscriptOverride) => void;
  interruptSpeaking: () => void;
  retryListening: () => void;
  /** Nói một đoạn text bất kỳ (greeting khi bật AI nhập liệu). */
  speakText: (text: string) => void;
}

const AiContext = createContext<AiContextValue | null>(null);

// ── Route context map — AI biết user đang ở trang nào ────────────────────────
const ROUTE_CONTEXT: Record<string, string> = {
  '/':                        'Trang chờ / màn hình khởi động',
  '/login':                   'Đăng nhập',
  '/services':                'Chọn dịch vụ hành chính',
  '/tam-tru-thu-tuc':         'Chọn thủ tục tạm trú',
  '/tam-tru-truong-hop':      'Chọn trường hợp tạm trú',
  '/tam-tru-doi-tuong':       'Chọn đối tượng tạm trú',
  '/tao-ho-so-tam-tru-nhan-khau-ho': 'Điền thông tin hồ sơ tạm trú nhân khẩu hộ',
  '/ho-so-cua-toi':           'Xem hồ sơ của tôi',
  '/nop-ho-so-thanh-cong':    'Nộp hồ sơ thành công',
};

function calcAge(ngaySinh: string): number {
  // format dd/mm/yyyy
  const parts = ngaySinh.split('/');
  if (parts.length !== 3) return 30;
  const dob = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function buildSystemPrompt(route: string, user: SessionUser | null): string {
  const base =
    'Bạn là trợ lý AI tại kiosk hành chính công, tên là "KioskAI". ' +
    'Nhiệm vụ: hướng dẫn công dân thực hiện thủ tục hành chính nhanh và chính xác. ' +
    'Quy tắc trả lời: ngắn gọn (1-2 câu), rõ ràng, lịch sự, bằng tiếng Việt. ' +
    'KHÔNG bịa đặt thông tin. Nếu không biết, hướng dẫn liên hệ cán bộ trực tiếp. ' +
    'Nhớ toàn bộ lịch sử hội thoại để trả lời nhất quán. ' +
    'Các dịch vụ hiện có: đăng ký tạm trú, gia hạn tạm trú, xóa đăng ký tạm trú.';

  const parts: string[] = [base];

  if (user) {
    const age = calcAge(user.ngaySinh);
    const persona = age < 50 ? 'anh/chị' : age < 65 ? 'chú/cô' : 'bác';
    parts.push(`Người dùng: ${user.hoTen} (${age} tuổi). Gọi họ là "${persona}".`);
  }

  const ctx = ROUTE_CONTEXT[route];
  if (ctx) parts.push(`Trang hiện tại: ${ctx}.`);

  return parts.join(' ');
}

// ── Persist tin nhắn lên backend (fire-and-forget, không block pipeline) ──────
function persistMessage(senderType: 'user' | 'ai', text: string): void {
  const token = useSessionUserStore.getState().sessionToken;
  if (!token || !text.trim()) return;
  api
    .post('/session-messages', { senderType, messageType: 'voice', messageContent: text })
    .catch(() => { /* silent — không block UI */ });
}

// ─────────────────────────────────────────────────────────────────────────────

export function AiProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const canvasRef = useRef<MuseTalkCanvasHandle>(null);
  const controllerRef = useRef<ConversationController | null>(null);
  const transcriptOverrideRef = useRef<TranscriptOverride | null>(null);
  const defaultOverrideRef = useRef<TranscriptOverride | null>(null);
  const systemPromptRef = useRef<string | null>(null);

  const setState = useConversationStore((s) => s.setState);
  const setTranscript = useConversationStore((s) => s.setTranscript);
  const setResponse = useConversationStore((s) => s.setResponse);
  const setError = useConversationStore((s) => s.setError);
  const setMuseTalkStatus = useConversationStore((s) => s.setMuseTalkStatus);
  const appendMessage = useConversationStore((s) => s.appendMessage);
  const clearMessages = useConversationStore((s) => s.clearMessages);
  const setCurrentRoute = useConversationStore((s) => s.setCurrentRoute);
  const setAudioPlaying = useConversationStore((s) => s.setAudioPlaying);

  const user = useSessionUserStore((s) => s.user);

  // Cập nhật system prompt khi route hoặc user thay đổi
  useEffect(() => {
    systemPromptRef.current = buildSystemPrompt(location.pathname, user);
    setCurrentRoute(location.pathname);
  }, [location.pathname, user, setCurrentRoute]);

  useEffect(() => {
    const controller = new ConversationController(
      {
        onStateChange: setState,
        onTranscript: (text) => {
          setTranscript(text);
          if (text.trim()) {
            appendMessage({ role: 'user', text });
            persistMessage('user', text);
          }
        },
        onResponse: (text) => {
          setResponse(text);
          if (text.trim()) {
            appendMessage({ role: 'ai', text });
            persistMessage('ai', text);
          }
        },
        onError: setError,
        onMuseTalkStatus: setMuseTalkStatus,
        onFrame: (blob, onRendered, frameIndex) => {
          canvasRef.current?.addFrame(blob, onRendered, frameIndex);
        },
        onStartSync: (getElapsedMs) => {
          canvasRef.current?.startSync(getElapsedMs);
          setAudioPlaying(true);   // audio thực sự bắt đầu → trigger typewriter
        },
        onSpeakingDone: () => {
          canvasRef.current?.clearAndShowIdle();
          setAudioPlaying(false);
        },
      },
      transcriptOverrideRef,
      systemPromptRef,
    );
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [setState, setTranscript, setResponse, setError, setMuseTalkStatus, appendMessage, setAudioPlaying]);

  // Phase 5: khi user logout → reset conversation
  useEffect(() => {
    if (!user) clearMessages();
  }, [user, clearMessages]);

  const begin = useCallback(() => {
    clearMessages(); // bắt đầu phiên mới → xoá history cũ
    controllerRef.current?.begin();
  }, [clearMessages]);

  const setDefaultTranscriptOverride = useCallback((fn: TranscriptOverride) => {
    defaultOverrideRef.current = fn;
    // Nếu hiện không có page-specific override → áp dụng global ngay
    if (!transcriptOverrideRef.current || transcriptOverrideRef.current === defaultOverrideRef.current) {
      transcriptOverrideRef.current = fn;
    }
  }, []);

  const setTranscriptOverride = useCallback((fn: TranscriptOverride | null) => {
    // null = page hook unmount → restore về global navigator
    transcriptOverrideRef.current = fn ?? defaultOverrideRef.current;
  }, []);

  const interruptSpeaking = useCallback(() => {
    controllerRef.current?.interruptSpeaking();
  }, []);

  const retryListening = useCallback(() => {
    setError(null);
    void controllerRef.current?.startListening();
  }, [setError]);

  const speakText = useCallback((text: string) => {
    controllerRef.current?.speak(text);
  }, []);

  const value = useMemo<AiContextValue>(
    () => ({ canvasRef, begin, setTranscriptOverride, setDefaultTranscriptOverride, interruptSpeaking, retryListening, speakText }),
    [begin, setTranscriptOverride, setDefaultTranscriptOverride, interruptSpeaking, retryListening, speakText],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error('useAi must be used inside AiProvider');
  return ctx;
}
