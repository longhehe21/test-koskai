import '@styles/pages/virtual-keyboard.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { processTelex } from '@renderer/utils/telex';

type InputEl = HTMLInputElement | HTMLTextAreaElement;

const ROWS_LOWER: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '@', '-'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?'],
];

const ROWS_UPPER: string[][] = [
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{', '}'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':', '"'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '/'],
];

const ALLOWED_INPUT_TYPES = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
  '',
]);

function isInputElement(el: EventTarget | null): el is InputEl {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return ALLOWED_INPUT_TYPES.has(el.type.toLowerCase());
  }
  return false;
}

/**
 * Set input.value qua native setter để React controlled input pick up change.
 * Reference: https://github.com/facebook/react/issues/11488
 */
function setNativeInputValue(input: InputEl, value: string): void {
  const proto =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findScrollParent(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return document.documentElement;
}

export function VirtualKeyboard() {
  const [activeInput, setActiveInput] = useState<InputEl | null>(null);
  const [isShift, setIsShift] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ left?: string; top?: string; bottom?: string }>({
    left: '50%',
    bottom: '60px',
  });
  const [dragging, setDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeInputRef = useRef<InputEl | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    activeInputRef.current = activeInput;
  }, [activeInput]);

  // Global focusin listener → detect active input
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!isInputElement(target)) return;
      if (target.disabled || target.readOnly) return;
      // Ignore focus moves inside keyboard itself
      if (containerRef.current?.contains(target)) return;
      setActiveInput(target);
      setIsShift(false);
    };
    document.addEventListener('focusin', onFocusIn, true);
    return () => document.removeEventListener('focusin', onFocusIn, true);
  }, []);

  // Position keyboard when active input changes
  useEffect(() => {
    if (!activeInput) {
      setVisible(false);
      return;
    }
    setPos({ left: '50%', bottom: '60px' });
    const raf = requestAnimationFrame(() => {
      setVisible(true);
      const kb = containerRef.current;
      if (!kb) return;
      const viewH = window.innerHeight;
      const targetY = viewH * 0.3;
      const rect = activeInput.getBoundingClientRect();
      const kbHeight = kb.offsetHeight;
      const gap = 12;

      const applyPosition = () => {
        const r = activeInput.getBoundingClientRect();
        const belowTop = r.bottom + gap;
        if (belowTop + kbHeight < viewH - 20) {
          setPos({ top: `${belowTop}px`, left: '50%' });
          return;
        }
        if (r.top - gap - kbHeight > 20) {
          setPos({ top: `${r.top - gap - kbHeight}px`, left: '50%' });
          return;
        }
        setPos({ left: '50%', bottom: '20px' });
      };

      if (rect.top > viewH * 0.45) {
        const scrollParent = findScrollParent(activeInput);
        const scrollDelta = rect.top - targetY;
        scrollParent.scrollBy({ top: scrollDelta, behavior: 'smooth' });
        window.setTimeout(applyPosition, 350);
      } else {
        applyPosition();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeInput]);

  const hideKeyboard = useCallback(() => {
    setActiveInput(null);
    setIsShift(false);
  }, []);

  const handleKeyPress = useCallback(
    (key: string) => {
      const input = activeInputRef.current;
      if (!input) return;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;

      let text = input.value;
      let cursorPos = start;
      if (start !== end) {
        text = text.slice(0, start) + text.slice(end);
        cursorPos = start;
      }

      const telexResult = processTelex(text, cursorPos, key);
      if (telexResult.consumed) {
        setNativeInputValue(input, telexResult.text);
        input.setSelectionRange(telexResult.cursorPos, telexResult.cursorPos);
      } else {
        const before = text.slice(0, cursorPos);
        const after = text.slice(cursorPos);
        setNativeInputValue(input, before + key + after);
        const newPos = cursorPos + key.length;
        input.setSelectionRange(newPos, newPos);
      }

      if (/^[a-zA-Z]$/.test(key)) {
        setIsShift(false);
      }
    },
    [],
  );

  const handleBackspace = useCallback(() => {
    const input = activeInputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;

    if (start !== end) {
      setNativeInputValue(input, input.value.slice(0, start) + input.value.slice(end));
      input.setSelectionRange(start, start);
    } else if (start > 0) {
      setNativeInputValue(input, input.value.slice(0, start - 1) + input.value.slice(start));
      input.setSelectionRange(start - 1, start - 1);
    }
  }, []);

  const handleEnter = useCallback(() => {
    const input = activeInputRef.current;
    if (!input) return;
    if (input instanceof HTMLTextAreaElement) {
      const start = input.selectionStart ?? input.value.length;
      setNativeInputValue(input, `${input.value.slice(0, start)}\n${input.value.slice(start)}`);
      input.setSelectionRange(start + 1, start + 1);
    } else {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    }
  }, []);

  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    const rect = containerRef.current.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !containerRef.current) return;
      e.preventDefault();
      const x = e.clientX - dragOffsetRef.current.x;
      const y = e.clientY - dragOffsetRef.current.y;
      const maxX = window.innerWidth - containerRef.current.offsetWidth;
      const maxY = window.innerHeight - containerRef.current.offsetHeight;
      setPos({
        left: `${Math.max(0, Math.min(x, maxX))}px`,
        top: `${Math.max(0, Math.min(y, maxY))}px`,
        bottom: 'auto',
      });
    },
    [dragging],
  );

  const handleDragEnd = useCallback(() => setDragging(false), []);

  if (!activeInput) return null;

  const rows = isShift ? ROWS_UPPER : ROWS_LOWER;

  const containerStyle: React.CSSProperties = {
    left: pos.left,
    top: pos.top,
    bottom: pos.bottom,
    transform: pos.top ? 'translateX(-50%)' : 'translateX(-50%) translateY(0)',
    transition: dragging ? 'none' : undefined,
  };

  return createPortal(
    <div
      className={`vk-overlay${visible ? ' vk-visible' : ''}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) hideKeyboard();
      }}
    >
      <div
        ref={containerRef}
        className={`vk-container${visible ? ' vk-visible' : ''}`}
        style={containerStyle}
        onPointerDown={(e) => e.preventDefault()}
      >
        <button
          className="vk-close-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            hideKeyboard();
          }}
          aria-label="Đóng bàn phím"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div
          className={`vk-drag-bar${dragging ? ' vk-dragging' : ''}`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="vk-drag-handle" />
          <span className="vk-drag-label">Bàn phím ảo</span>
        </div>

        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className={`vk-row${rowIdx === 0 ? ' vk-row-numbers' : ''}`}>
            {rowIdx === 3 && (
              <button
                className={`vk-key vk-key-special vk-key-shift${isShift ? ' vk-active' : ''}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsShift((v) => !v);
                }}
                aria-label="Shift"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3l9 9h-6v8H9v-8H3z" />
                </svg>
              </button>
            )}
            {row.map((keyChar) => (
              <button
                key={keyChar}
                className="vk-key"
                data-key={keyChar}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyPress(keyChar);
                }}
              >
                {keyChar}
              </button>
            ))}
            {rowIdx === 0 && (
              <button
                className="vk-key vk-key-special vk-key-backspace"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBackspace();
                }}
                aria-label="Xóa"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              </button>
            )}
          </div>
        ))}

        <div className="vk-row">
          <button
            className="vk-key"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleKeyPress(',');
            }}
          >
            ,
          </button>
          <button
            className="vk-key vk-key-space"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleKeyPress(' ');
            }}
          >
            khoảng trắng
          </button>
          <button
            className="vk-key"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleKeyPress('.');
            }}
          >
            .
          </button>
          <button
            className="vk-key vk-key-special vk-key-enter"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleEnter();
            }}
            aria-label="Enter"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 10l-5 5 5 5" />
              <path d="M20 4v7a4 4 0 0 1-4 4H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
