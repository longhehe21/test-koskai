import { useState } from 'react';
import { MuseTalkCanvas } from '@components/musetalk-canvas/MuseTalkCanvas';
import { VoiceButton } from '@components/voice-button/VoiceButton';
import { useConversationStore, type MuseTalkStatus } from '@store/conversationStore';
import { useAi } from '@renderer/providers/AiProvider';

const STATUS_DOT: Record<MuseTalkStatus, { bg: string; pulse: boolean }> = {
  disconnected: { bg: '#ffb648', pulse: false },
  connecting: { bg: '#ffb648', pulse: true },
  connected: { bg: '#3ddc84', pulse: false },
  error: { bg: '#ff5566', pulse: true },
  unconfigured: { bg: '#9ca3af', pulse: false },
};

const STATUS_LABEL: Record<MuseTalkStatus, string> = {
  disconnected: 'Chưa kết nối',
  connecting: 'Đang kết nối MuseTalk…',
  connected: 'Sẵn sàng',
  error: 'Lỗi kết nối',
  unconfigured: 'MuseTalk chưa cấu hình',
};

export function AiSidebar() {
  const { canvasRef, begin } = useAi();
  const museTalkStatus = useConversationStore((s) => s.museTalkStatus);
  const state = useConversationStore((s) => s.state);
  const [active, setActive] = useState(false);

  const dot = STATUS_DOT[museTalkStatus];

  const handleTap = () => {
    if (museTalkStatus !== 'connected') return;
    setActive(true);
    begin();
  };

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

          {/* Sparkles — chỉ hiện khi LISTENING/SPEAKING, absolute inside wrapper */}
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

          {active && state === 'PROCESSING' && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: 'rgba(8,8,12,0.55)', backdropFilter: 'blur(4px)' }}
            >
              <div
                className="h-9 w-9 animate-spin rounded-full"
                style={{ border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#ffffff' }}
              />
              <span className="text-sm text-white/80">Đang xử lý…</span>
            </div>
          )}
        </div>

        <div className="ai-panel-voice-wrapper">
          {active ? (
            <VoiceButton />
          ) : (
            <button
              onClick={handleTap}
              disabled={museTalkStatus !== 'connected'}
              className="w-full flex flex-col items-center gap-2 py-3 rounded-[10px] transition-all"
              style={{
                background:
                  museTalkStatus === 'connected'
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(255,255,255,0.08)',
                cursor: museTalkStatus === 'connected' ? 'pointer' : 'not-allowed',
                opacity: museTalkStatus === 'connected' ? 1 : 0.6,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-7 h-7 text-white"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5"
                />
              </svg>
              <span className="text-sm font-semibold text-white">
                {museTalkStatus === 'connected'
                  ? 'Chạm để bắt đầu'
                  : museTalkStatus === 'unconfigured'
                    ? 'Chưa cấu hình MuseTalk'
                    : 'Đang kết nối…'}
              </span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
