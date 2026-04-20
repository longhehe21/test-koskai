import { useEffect, useRef, useState } from 'react';

export interface DropdownItem {
  code: string;
  name: string;
}

interface DropdownProps {
  /** Wrapper id (tương thích với tkbtv-select-wrapper ID cũ — tùy chọn). */
  id?: string;
  value?: DropdownItem | null;
  placeholder: string;
  items: DropdownItem[];
  onChange: (item: DropdownItem) => void;
  /** Không mở được (disabled visual). */
  locked?: boolean;
  disabled?: boolean;
}

/**
 * Custom dropdown theo design tkbtv-select của UI repo.
 * Click outside để đóng, chọn item → onChange + tự đóng.
 */
export function Dropdown({ id, value, placeholder, items, onChange, locked, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const classes = [
    'tkbtv-select-wrapper',
    open ? 'tkbtv-select-wrapper--open' : '',
    locked ? 'tkbtv-select-wrapper--locked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={wrapperRef}
      id={id}
      className={classes}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="tkbtv-select"
        onClick={() => {
          if (locked || disabled) return;
          setOpen((v) => !v);
        }}
      >
        <span>{value?.name ?? placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 6l4 4 4-4"
            stroke="#6b7280"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="tkbtv-dropdown">
        {items.map((item) => {
          const active = value?.code === item.code;
          return (
            <div
              key={item.code}
              className={`tkbtv-dropdown-item${active ? ' tkbtv-dropdown-item--active' : ''}`}
              onClick={() => {
                onChange(item);
                setOpen(false);
              }}
            >
              {item.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
