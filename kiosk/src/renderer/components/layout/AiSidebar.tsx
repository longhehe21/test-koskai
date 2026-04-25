import { useEffect, useRef, useState } from 'react';
import { MuseTalkCanvas } from '@components/musetalk-canvas/MuseTalkCanvas';
import { useConversationStore, type MuseTalkStatus } from '@store/conversationStore';
import type { ConversationState } from '@store/conversationStore';
import { useAi } from '@renderer/providers/AiProvider';

const STATUS_DOT: Record<MuseTalkStatus, { bg: string; pulse: boolean }> = {
  disconnected: { bg: '#ffb648', pulse: false },
  connecting:   { bg: '#ffb648', pulse: true  },
  connected:    { bg: '#3ddc84', pulse: false },
  error:        { bg: '#ff5566', pulse: true  },
  unconfigured: { bg: '#9ca3af', pulse: false },
};

const STATUS_LABEL: Record<MuseTalkStatus, string> = {
  disconnected: 'Chưa kết nối',
  connecting:   'Đang kết nối MuseTalk…',
  connected:    'Sẵn sàng',
  error:        'Lỗi kết nối',
  unconfigured: 'MuseTalk chưa cấu hình',
};

// ── Typewriter — chỉ chạy khi active=true ────────────────────────────────────
const TYPEWRITER_MS = 18;

function TypewriterText({
  text,
  active,
  onComplete,
}: {
  text: string;
  active: boolean;
  onComplete: () => void;
}) {
  const [displayed, setDisplayed] = useState('');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) return;
    setDisplayed('');
    if (!text) { onCompleteRef.current(); return; }
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); onCompleteRef.current(); }
    }, TYPEWRITER_MS);
    return () => clearInterval(id);
  }, [active, text]);

  const done = displayed.length >= text.length;
  // Khi chưa active (chờ audio): hiện trống + cursor — không flash full text
  // Khi active: hiện dần + cursor cho đến khi xong
  return (
    <>
      {active ? displayed : ''}
      {(!active || !done) && <span className="ai-typewriter-cursor" aria-hidden="true" />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function AiSidebar() {
  const { canvasRef, begin, retryListening } = useAi();
  const museTalkStatus = useConversationStore((s) => s.museTalkStatus);
  const state          = useConversationStore((s) => s.state);
  const messages       = useConversationStore((s) => s.messages);
  const error          = useConversationStore((s) => s.error);
  const audioPlaying   = useConversationStore((s) => s.audioPlaying);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ID của AI message đang typewriter
  const [streamingId, setStreamingId]     = useState<string | null>(null);
  const [streamingActive, setStreamingActive] = useState(false);
  const prevAudioRef = useRef(false);
  const prevLenRef   = useRef(0);

  const dot = STATUS_DOT[museTalkStatus];

  const begunRef = useRef(false);
  useEffect(() => {
    if (museTalkStatus === 'connected' && !begunRef.current) {
      begunRef.current = true;
      begin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [museTalkStatus]);

  // Khi có AI message mới → chuẩn bị streaming (chưa active)
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      const last = messages[messages.length - 1];
      if (last.role === 'ai') {
        setStreamingId(last.id);
        setStreamingActive(false);
      }
      prevLenRef.current = messages.length;
    }
  }, [messages]);

  // Khi audio bắt đầu phát → kích hoạt typewriter
  useEffect(() => {
    if (audioPlaying && !prevAudioRef.current) {
      setStreamingActive(true);
    }
    prevAudioRef.current = audioPlaying;
  }, [audioPlaying]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingId]);

  return (
    <aside className="kiosk-ai-panel">
      <div className="ai-panel-inner">
        <div className="ai-panel-status">
          <span
            className={`ai-panel-status-dot ${dot.pulse ? 'animate-pulse' : ''}`}
            style={{ background: dot.bg }}
          />
          <span>{STATUS_LABEL[museTalkStatus]}</span>
        </div>

        <div className="ai-panel-canvas-wrapper" data-ai-state={state}>
          <MuseTalkCanvas
            ref={canvasRef}
            idleVideoUrl="/avatar-idle.mp4"
            className="h-full w-full"
          />
          {(state === 'LISTENING' || state === 'SPEAKING') && (
            <div className="ai-panel-sparkles" aria-hidden="true">
              <span className="ai-sparkle ai-sparkle--1" />
              <span className="ai-sparkle ai-sparkle--2" />
              <span className="ai-sparkle ai-sparkle--3" />
              <span className="ai-sparkle ai-sparkle--4" />
              <span className="ai-sparkle ai-sparkle--5" />
              <span className="ai-sparkle ai-sparkle--6" />
            </div>
          )}
        </div>

        {error && (
          <div className="ai-panel-error">
            <span className="ai-panel-error-text">⚠ {error}</span>
            <button className="ai-panel-error-retry" onClick={retryListening}>
              Thử lại
            </button>
          </div>
        )}

        <div className="ai-panel-chat-history">
          {messages.length === 0 ? (
            <p className="ai-chat-empty-hint">Hãy nói gì đó…</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`ai-chat-msg ai-chat-msg--${msg.role}`}>
                <div className={`ai-chat-bubble ai-chat-bubble--${msg.role}`}>
                  {msg.role === 'ai' && msg.id === streamingId ? (
                    <TypewriterText
                      text={msg.text}
                      active={streamingActive}
                      onComplete={() => { setStreamingId(null); setStreamingActive(false); }}
                    />
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <StateBadge state={state} />
      </div>
    </aside>
  );
}

const STATE_CONFIG: Record<ConversationState, { label: string; color: string; pulse: boolean }> = {
  IDLE:       { label: 'Đang chờ…',    color: 'rgba(255,255,255,0.35)', pulse: false },
  LISTENING:  { label: 'Đang nghe…',   color: '#38bdf8',                pulse: true  },
  PROCESSING: { label: 'Đang xử lý…', color: '#fbbf24',                pulse: true  },
  SPEAKING:   { label: 'Đang trả lời…',color: '#a78bfa',                pulse: false },
};

function StateBadge({ state }: { state: ConversationState }) {
  const { label, color, pulse } = STATE_CONFIG[state];
  return (
    <div className="ai-state-badge">
      <span
        className={`ai-state-dot${pulse ? ' ai-state-dot--pulse' : ''}`}
        style={{ background: color }}
      />
      <span className="ai-state-label">{label}</span>
    </div>
  );
}
