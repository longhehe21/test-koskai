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
import type { MuseTalkCanvasHandle } from '@components/musetalk-canvas/MuseTalkCanvas';

interface AiContextValue {
  canvasRef: RefObject<MuseTalkCanvasHandle>;
  begin: () => void;
}

const AiContext = createContext<AiContextValue | null>(null);

/**
 * Owns ConversationController lifecycle at app root.
 * Canvas được mount trong AiSidebar (descendant) attach vào canvasRef từ context.
 * Store subscriptions: transcript → messages (role=user), response → messages (role=ai).
 */
export function AiProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const canvasRef = useRef<MuseTalkCanvasHandle>(null);
  const controllerRef = useRef<ConversationController | null>(null);

  const setState = useConversationStore((s) => s.setState);
  const setTranscript = useConversationStore((s) => s.setTranscript);
  const setResponse = useConversationStore((s) => s.setResponse);
  const setError = useConversationStore((s) => s.setError);
  const setMuseTalkStatus = useConversationStore((s) => s.setMuseTalkStatus);
  const appendMessage = useConversationStore((s) => s.appendMessage);
  const setCurrentRoute = useConversationStore((s) => s.setCurrentRoute);

  useEffect(() => {
    const controller = new ConversationController({
      onStateChange: setState,
      onTranscript: (text) => {
        setTranscript(text);
        if (text.trim()) appendMessage({ role: 'user', text });
      },
      onResponse: (text) => {
        setResponse(text);
        if (text.trim()) appendMessage({ role: 'ai', text });
      },
      onError: setError,
      onMuseTalkStatus: setMuseTalkStatus,
      onFrame: (blob, onRendered, frameIndex) => {
        canvasRef.current?.addFrame(blob, onRendered, frameIndex);
      },
      onStartSync: (getElapsedMs) => {
        canvasRef.current?.startSync(getElapsedMs);
      },
      onSpeakingDone: () => {
        canvasRef.current?.clearAndShowIdle();
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [
    setState,
    setTranscript,
    setResponse,
    setError,
    setMuseTalkStatus,
    appendMessage,
  ]);

  useEffect(() => {
    setCurrentRoute(location.pathname);
  }, [location.pathname, setCurrentRoute]);

  const begin = useCallback(() => {
    controllerRef.current?.begin();
  }, []);

  const value = useMemo<AiContextValue>(
    () => ({ canvasRef, begin }),
    [begin],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error('useAi must be used inside AiProvider');
  return ctx;
}
