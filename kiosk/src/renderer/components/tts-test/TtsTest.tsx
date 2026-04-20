import { useEffect, useRef, useState } from 'react';

type TtsStatus = 'idle' | 'speaking' | 'done' | 'error';

interface TtsTestProps {
  onAudioElement?: (audio: HTMLAudioElement) => void;
}

export function TtsTest({ onAudioElement }: TtsTestProps = {}) {
  const [text, setText] = useState('Xin chào, tôi là trợ lý AI của kiosk hành chính công.');
  const [status, setStatus] = useState<TtsStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    onAudioElement?.(audio);

    const onEnded = () => {
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }

      const next = queueRef.current.shift();
      if (next) {
        audio.src = next;
        audio.play().catch(handlePlayError);
      } else {
        setStatus('done');
      }
    };

    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      queueRef.current.forEach((url) => URL.revokeObjectURL(url));
      queueRef.current = [];
    };
  }, []);

  function handlePlayError(err: unknown) {
    setError(err instanceof Error ? err.message : 'Phát audio thất bại');
    setStatus('error');
  }

  async function handleSpeak() {
    const trimmed = text.trim();
    if (!trimmed || !audioRef.current) return;

    setStatus('speaking');
    setError(null);

    try {
      const raw = await window.electronAPI.invoke('tts:speak', { text: trimmed });
      const data = raw as Uint8Array;

      const blob = new Blob([data], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);

      const audio = audioRef.current;

      if (!audio.src || audio.paused) {
        audio.src = url;
        await audio.play().catch(handlePlayError);
      } else {
        queueRef.current.push(url);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'TTS thất bại');
      setStatus('error');
    }
  }

  const statusColor: Record<TtsStatus, string> = {
    idle: 'text-gray-400',
    speaking: 'text-blue-500',
    done: 'text-green-500',
    error: 'text-red-500',
  };

  const statusLabel: Record<TtsStatus, string> = {
    idle: 'chờ',
    speaking: 'đang nói...',
    done: 'xong',
    error: 'lỗi',
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto p-6">
      <h2 className="text-lg font-semibold text-white drop-shadow">Test TTS — Google Cloud vi-VN</h2>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nhập văn bản cần đọc..."
        rows={4}
        className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSpeak}
          disabled={status === 'speaking' || !text.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'speaking' ? 'Đang nói...' : 'Nói'}
        </button>

        <span className={`text-sm font-medium ${statusColor[status]}`}>
          {statusLabel[status]}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
