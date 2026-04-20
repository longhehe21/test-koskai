import { useConversationStore } from '@store/conversationStore';
import type { ConversationState } from '@services/ConversationController';

const STATE_LABEL: Record<ConversationState, string> = {
  IDLE: 'Đang chờ...',
  LISTENING: 'Đang lắng nghe...',
  PROCESSING: 'Đang xử lý...',
  SPEAKING: 'Đang trả lời...',
};

/**
 * Presentation only — controller lifecycle lives in AiProvider.
 * Component hiển thị transcript/response + state icon từ store.
 */
export function VoiceButton() {
  const state = useConversationStore((s) => s.state);
  const transcript = useConversationStore((s) => s.transcript);
  const response = useConversationStore((s) => s.response);
  const error = useConversationStore((s) => s.error);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-lg mx-auto">
      <div className="w-full min-h-14 text-center px-4">
        {transcript && (
          <p className="text-sm text-[var(--text-dim)] mb-1">
            <span className="font-medium text-[var(--text)]">Bạn: </span>
            {transcript}
          </p>
        )}
        {response && (
          <p className="text-sm text-[var(--text)]">
            <span className="font-medium" style={{ color: 'var(--accent)' }}>
              AI:{' '}
            </span>
            {response}
          </p>
        )}
        {error && <p className="text-sm text-[var(--err)]">{error}</p>}
      </div>

      <div className="flex flex-col items-center gap-2">
        <StatusIcon state={state} />
        <span className="text-xs tracking-wide" style={{ color: 'var(--text-dim)' }}>
          {STATE_LABEL[state]}
        </span>
      </div>
    </div>
  );
}

function StatusIcon({ state }: { state: ConversationState }) {
  if (state === 'LISTENING') {
    return (
      <div className="relative flex items-center justify-center w-14 h-14">
        <span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping bg-red-400" />
        <span className="relative inline-flex rounded-full w-10 h-10 bg-red-500 items-center justify-center">
          <MicIcon />
        </span>
      </div>
    );
  }
  if (state === 'PROCESSING') {
    return (
      <div className="w-14 h-14 flex items-center justify-center">
        <SpinnerIcon />
      </div>
    );
  }
  if (state === 'SPEAKING') {
    return (
      <div
        className="w-14 h-14 flex items-center justify-center"
        style={{ color: 'var(--ok)' }}
      >
        <SoundIcon />
      </div>
    );
  }
  return (
    <div
      className="w-14 h-14 flex items-center justify-center"
      style={{ color: 'var(--text-dim)', opacity: 0.4 }}
    >
      <MicIcon />
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-10 h-10 animate-spin"
      style={{ color: 'var(--warn)' }}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
    </svg>
  );
}
