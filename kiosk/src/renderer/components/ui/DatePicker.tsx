import { useEffect, useRef, useState } from 'react';

const VIET_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const VIET_MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmt(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function parse(str: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

interface DatePickerProps {
  value?: string;
  placeholder?: string;
  onChange: (dateStr: string) => void;
}

/**
 * Custom date picker (calendar tiếng Việt) — class `.tkbtv-datepicker`.
 * Value format: DD/MM/YYYY.
 */
export function DatePicker({ value = '', placeholder = 'ngày /tháng /năm', onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const parsed = parse(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

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

  const handlePick = (d: number) => {
    const date = new Date(viewYear, viewMonth, d);
    onChange(fmt(date));
    setOpen(false);
  };

  const nav = (dir: 'prev' | 'next' | 'prev-year' | 'next-year') => {
    if (dir === 'prev-year') setViewYear((y) => y - 1);
    else if (dir === 'next-year') setViewYear((y) => y + 1);
    else if (dir === 'prev') {
      let m = viewMonth - 1;
      let y = viewYear;
      if (m < 0) { m = 11; y--; }
      setViewMonth(m);
      setViewYear(y);
    } else {
      let m = viewMonth + 1;
      let y = viewYear;
      if (m > 11) { m = 0; y++; }
      setViewMonth(m);
      setViewYear(y);
    }
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: JSX.Element[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e-${i}`} className="tkbtv-cal-day tkbtv-cal-day--empty" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday =
      d === today.getDate() &&
      viewMonth === today.getMonth() &&
      viewYear === today.getFullYear();
    const isSelected =
      parsed !== null &&
      d === parsed.getDate() &&
      viewMonth === parsed.getMonth() &&
      viewYear === parsed.getFullYear();
    const classes = [
      'tkbtv-cal-day',
      isToday && 'tkbtv-cal-day--today',
      isSelected && 'tkbtv-cal-day--selected',
    ]
      .filter(Boolean)
      .join(' ');
    cells.push(
      <div key={d} className={classes} onClick={() => handlePick(d)}>
        {d}
      </div>,
    );
  }

  const showPlaceholder = !parsed;

  return (
    <div
      ref={wrapperRef}
      className={`tkbtv-datepicker${open ? ' tkbtv-datepicker--open' : ''}`}
    >
      <div
        className="tkbtv-input-icon"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <input
          type="text"
          className={`tkbtv-input${showPlaceholder ? ' tkbtv-input--placeholder' : ''}`}
          value={value || placeholder}
          readOnly
        />
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="3" width="14" height="13" rx="2" stroke="#6b7280" strokeWidth="1.4" />
          <path d="M2 7h14M6 1v4M12 1v4" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <div className="tkbtv-calendar" onClick={(e) => e.stopPropagation()}>
        <div className="tkbtv-cal-header">
          <button type="button" className="tkbtv-cal-nav" onClick={() => nav('prev-year')}>
            «
          </button>
          <button type="button" className="tkbtv-cal-nav" onClick={() => nav('prev')}>
            ‹
          </button>
          <span className="tkbtv-cal-title">
            {VIET_MONTHS[viewMonth]} {viewYear}
          </span>
          <button type="button" className="tkbtv-cal-nav" onClick={() => nav('next')}>
            ›
          </button>
          <button type="button" className="tkbtv-cal-nav" onClick={() => nav('next-year')}>
            »
          </button>
        </div>
        <div className="tkbtv-cal-weekdays">
          {VIET_DAYS.map((d) => (
            <div key={d} className="tkbtv-cal-weekday">
              {d}
            </div>
          ))}
        </div>
        <div className="tkbtv-cal-days">{cells}</div>
      </div>
    </div>
  );
}
