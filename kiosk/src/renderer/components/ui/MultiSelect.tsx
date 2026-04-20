import { useEffect, useRef, useState } from 'react';

export interface MultiSelectOption {
  code: string;
  label: string;
}

interface MultiSelectProps {
  value: string[];
  options: MultiSelectOption[];
  placeholder: string;
  onChange: (codes: string[]) => void;
}

export function MultiSelect({ value, options, placeholder, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [open]);

  const toggle = (code: string) => {
    if (value.includes(code)) onChange(value.filter((c) => c !== code));
    else onChange([...value, code]);
  };

  const removeTag = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((c) => c !== code));
  };

  const classes = `tkbtv-multi-select ttbl-multi-inline${open ? ' tkbtv-select-wrapper--open' : ''}`;

  return (
    <div ref={wrapperRef} className={classes} onClick={(e) => e.stopPropagation()}>
      <div className="tkbtv-select" onClick={() => setOpen((v) => !v)}>
        <div className="tkbtv-multi-tags">
          {value.map((code) => {
            const opt = options.find((o) => o.code === code);
            if (!opt) return null;
            return (
              <span key={code} className="tkbtv-tag" onClick={(e) => removeTag(code, e)}>
                {opt.label}
              </span>
            );
          })}
        </div>
        {value.length === 0 && <span className="ttbl-multi-placeholder">{placeholder}</span>}
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
        {options.map((opt) => {
          const active = value.includes(opt.code);
          return (
            <div
              key={opt.code}
              className={`tkbtv-dropdown-item${active ? ' tkbtv-dropdown-item--active' : ''}`}
              onClick={() => toggle(opt.code)}
            >
              {opt.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
