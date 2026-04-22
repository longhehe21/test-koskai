import '@styles/pages/ho-so-cua-toi.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';

type Status = 'draft' | 'processing' | 'approved' | 'rejected';
type StatusFilter = Status | 'all';

const VALID_STATUS_FILTERS: readonly StatusFilter[] = ['all', 'draft', 'processing', 'approved', 'rejected'];

// Đọc ?status=<code> từ URL — dùng khi DraftSavedToast/nơi khác điều hướng kèm preset filter.
// Code không hợp lệ hoặc không có → fallback về 'all'.
function parseStatusParam(raw: string | null): StatusFilter {
  if (!raw) return 'all';
  return (VALID_STATUS_FILTERS as readonly string[]).includes(raw) ? (raw as StatusFilter) : 'all';
}

interface DocRecord {
  stt: number;
  code: string;
  name: string;
  updated: string;
  status: Status;
}

const STATUS_CONFIG: Record<Status, { label: string; cls: string }> = {
  draft: { label: 'BẢN NHÁP', cls: 'hsct-status--draft' },
  processing: { label: 'ĐANG XỬ LÝ', cls: 'hsct-status--processing' },
  approved: { label: 'ĐÃ DUYỆT', cls: 'hsct-status--approved' },
  rejected: { label: 'TỪ CHỐI', cls: 'hsct-status--rejected' },
};

const RECORDS: DocRecord[] = [
  { stt: 1, code: 'BN-2024-001', name: 'Đăng ký tạm trú', updated: '10/05/2024 14:30', status: 'draft' },
  { stt: 2, code: 'HS-2024-042', name: 'Khai báo tạm vắng', updated: '12/05/2024 14:30', status: 'processing' },
  { stt: 3, code: 'HS-2024-015', name: 'Cấp lại thẻ BHYT', updated: '08/05/2024 14:30', status: 'approved' },
  { stt: 4, code: 'HS-2024-009', name: 'Đăng ký kinh doanh', updated: '05/05/2024 14:30', status: 'rejected' },
  { stt: 5, code: 'HS-2024-010', name: 'Đăng ký kinh doanh', updated: '05/05/2024 14:30', status: 'rejected' },
  { stt: 6, code: 'HS-2024-019', name: 'Đăng ký kinh doanh', updated: '05/05/2024 14:30', status: 'rejected' },
  { stt: 7, code: 'HS-2024-022', name: 'Đăng ký kinh doanh', updated: '05/05/2024 14:30', status: 'rejected' },
  { stt: 8, code: 'HS-2024-039', name: 'Đăng ký kinh doanh', updated: '05/05/2024 14:30', status: 'rejected' },
  { stt: 9, code: 'BN-2024-004', name: 'Đăng ký tạm trú', updated: '10/05/2024 14:30', status: 'draft' },
  { stt: 10, code: 'BN-2024-007', name: 'Đăng ký tạm trú', updated: '10/05/2024 14:30', status: 'draft' },
];

const VIET_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const VIET_MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function fmt(d: Date | null): string {
  if (!d) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function sameDate(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseUpdated(str: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(str);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

interface CalendarProps {
  year: number;
  month: number;
  fromDate: Date | null;
  toDate: Date | null;
  onNav: (dir: 'prev' | 'next') => void;
  onPick: (d: Date) => void;
}

function Calendar({ year, month, fromDate, toDate, onNav, onPick }: CalendarProps) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: JSX.Element[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e-${i}`} className="hsct-cal-day hsct-cal-day--empty" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cur = new Date(year, month, d);
    const isToday = sameDate(cur, today);
    const isFrom = sameDate(cur, fromDate);
    const isTo = sameDate(cur, toDate);
    const inRange = fromDate && toDate && cur > fromDate && cur < toDate;
    const classes = [
      'hsct-cal-day',
      isToday && 'hsct-cal-day--today',
      (isFrom || isTo) && 'hsct-cal-day--selected',
      isFrom && toDate && 'hsct-cal-day--range-start',
      isTo && fromDate && 'hsct-cal-day--range-end',
      inRange && 'hsct-cal-day--in-range',
    ]
      .filter(Boolean)
      .join(' ');
    cells.push(
      <div key={d} className={classes} onClick={() => onPick(cur)}>
        {d}
      </div>,
    );
  }

  return (
    <>
      <div className="hsct-cal-header">
        <button
          className="hsct-cal-nav"
          onClick={(e) => {
            e.stopPropagation();
            onNav('prev');
          }}
        >
          ‹
        </button>
        <span className="hsct-cal-title">
          {VIET_MONTHS[month]} {year}
        </span>
        <button
          className="hsct-cal-nav"
          onClick={(e) => {
            e.stopPropagation();
            onNav('next');
          }}
        >
          ›
        </button>
      </div>
      <div className="hsct-cal-weekdays">
        {VIET_DAYS.map((d) => (
          <div key={d} className="hsct-cal-weekday">
            {d}
          </div>
        ))}
      </div>
      <div className="hsct-cal-days">{cells}</div>
    </>
  );
}

function getActionsJsx(status: Status): JSX.Element {
  const EYE = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  const EDIT = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
  const DELETE = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
  const PRINT = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
  const INFO = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );

  switch (status) {
    case 'draft':
      return (
        <>
          <button className="hsct-action-btn" title="Sửa">{EDIT}</button>
          <button className="hsct-action-btn" title="Xóa">{DELETE}</button>
        </>
      );
    case 'processing':
      return <button className="hsct-action-btn" title="Xem">{EYE}</button>;
    case 'approved':
      return (
        <>
          <button className="hsct-action-btn" title="Xem">{EYE}</button>
          <button className="hsct-action-btn" title="In">{PRINT}</button>
        </>
      );
    case 'rejected':
      return (
        <>
          <button className="hsct-action-btn" title="Xem">{EYE}</button>
          <button className="hsct-action-btn" title="Chi tiết">{INFO}</button>
        </>
      );
  }
}

const STATUS_OPTIONS: { code: Status | 'all'; label: string }[] = [
  { code: 'all', label: 'Tất cả trạng thái' },
  { code: 'draft', label: 'Bản nháp' },
  { code: 'processing', label: 'Đang xử lý' },
  { code: 'approved', label: 'Đã duyệt' },
  { code: 'rejected', label: 'Từ chối' },
];

export default function HoSoCuaToiPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Init filter từ URL param ?status=<code> (cross-file: DraftSavedToast.onList
  // truyền 'draft' để mở trang tự lọc bản nháp). User vẫn đổi được sau đó.
  const [filterStatus, setFilterStatus] = useState<StatusFilter>(() =>
    parseStatusParam(searchParams.get('status')),
  );
  const [appliedFrom, setAppliedFrom] = useState<Date | null>(null);
  const [appliedTo, setAppliedTo] = useState<Date | null>(null);

  const [statusOpen, setStatusOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const today = useMemo(() => new Date(), []);
  const [fromYear, setFromYear] = useState(today.getFullYear());
  const [fromMonth, setFromMonth] = useState(today.getMonth());
  const [toYear, setToYear] = useState(() =>
    today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear(),
  );
  const [toMonth, setToMonth] = useState(() => (today.getMonth() + 1) % 12);

  usePageHeader({ title: 'Hồ sơ của tôi' });

  useEffect(() => {
    if (!statusOpen && !dateOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [statusOpen, dateOpen]);

  const filtered = useMemo(() => {
    return RECORDS.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      const d = parseUpdated(r.updated);
      if (appliedFrom && d) {
        const start = new Date(appliedFrom.getFullYear(), appliedFrom.getMonth(), appliedFrom.getDate());
        if (d < start) return false;
      }
      if (appliedTo && d) {
        const end = new Date(appliedTo.getFullYear(), appliedTo.getMonth(), appliedTo.getDate(), 23, 59, 59);
        if (d > end) return false;
      }
      return true;
    });
  }, [filterStatus, appliedFrom, appliedTo]);

  const handleDayPick = (d: Date) => {
    if (!fromDate || (fromDate && toDate)) {
      setFromDate(d);
      setToDate(null);
      return;
    }
    if (d.getTime() < fromDate.getTime()) {
      setToDate(fromDate);
      setFromDate(d);
    } else if (d.getTime() === fromDate.getTime()) {
      setFromDate(null);
      setToDate(null);
    } else {
      setToDate(d);
    }
  };

  const handleFromNav = (dir: 'prev' | 'next') => {
    let m = fromMonth + (dir === 'prev' ? -1 : 1);
    let y = fromYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setFromMonth(m);
    setFromYear(y);
  };
  const handleToNav = (dir: 'prev' | 'next') => {
    let m = toMonth + (dir === 'prev' ? -1 : 1);
    let y = toYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setToMonth(m);
    setToYear(y);
  };

  const handleDateClear = () => {
    setFromDate(null);
    setToDate(null);
    setAppliedFrom(null);
    setAppliedTo(null);
  };

  const handleDateApply = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setDateOpen(false);
  };

  const dateRangeText =
    appliedFrom && appliedTo
      ? `${fmt(appliedFrom)} - ${fmt(appliedTo)}`
      : appliedFrom
        ? `Từ ${fmt(appliedFrom)}`
        : appliedTo
          ? `Đến ${fmt(appliedTo)}`
          : 'Chọn khoảng ngày';

  const statusLabel = STATUS_OPTIONS.find((o) => o.code === filterStatus)?.label ?? 'Tất cả trạng thái';

  return (
    <div className="hsct-area">
      <div className="hsct-content">
        <div className="hsct-header-row">
          <h1 className="hsct-title">Danh sách tất cả hồ sơ</h1>
          <button
            type="button"
            className="hsct-home-btn"
            onClick={() => navigate('/services')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-8 9 8" />
              <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
            </svg>
            Về trang chủ
          </button>
        </div>
        <p className="hsct-subtitle">
          Quản lý và theo dõi toàn bộ vòng đời của các hồ sơ ứng tuyển, từ khâu khởi tạo đến khi
          phê duyệt cuối cùng. Hệ thống hiển thị trạng thái thời gian thực của mọi quy trình thủ
          tục.
        </p>

        <div className="hsct-filters">
          <div className="hsct-filter">
            <label className="hsct-filter-label">TÌM THEO MÃ/TÊN</label>
            <div className="hsct-filter-input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="BN-2024..." />
            </div>
          </div>

          <div className="hsct-filter">
            <label className="hsct-filter-label">LOẠI THỦ TỤC</label>
            <button className="hsct-filter-select">
              <span>Tất cả thủ tục</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="hsct-filter">
            <label className="hsct-filter-label">TRẠNG THÁI</label>
            <div
              ref={statusRef}
              className={`hsct-dropdown-wrap${statusOpen ? ' hsct-dropdown-wrap--open' : ''}`}
            >
              <button
                className="hsct-filter-select"
                onClick={(e) => {
                  e.stopPropagation();
                  setStatusOpen((v) => !v);
                  setDateOpen(false);
                }}
              >
                <span>{statusLabel}</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="hsct-dropdown">
                {STATUS_OPTIONS.map((opt) => (
                  <div
                    key={opt.code}
                    className={`hsct-dropdown-item${filterStatus === opt.code ? ' hsct-dropdown-item--active' : ''}`}
                    onClick={() => {
                      setFilterStatus(opt.code);
                      setStatusOpen(false);
                    }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="hsct-filter">
            <label className="hsct-filter-label">KHOẢNG THỜI GIAN</label>
            <div
              ref={dateRef}
              className={`hsct-dropdown-wrap${dateOpen ? ' hsct-dropdown-wrap--open' : ''}`}
            >
              <button
                className="hsct-filter-select hsct-filter-select--left"
                onClick={(e) => {
                  e.stopPropagation();
                  setDateOpen((v) => !v);
                  setStatusOpen(false);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="#9ca3af" strokeWidth="1.4">
                  <rect x="2" y="3" width="14" height="13" rx="2" />
                  <path d="M2 7h14M6 1v4M12 1v4" strokeLinecap="round" />
                </svg>
                <span>{dateRangeText}</span>
                <svg
                  className="hsct-filter-chevron"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                >
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="hsct-daterange-popup" onClick={(e) => e.stopPropagation()}>
                <div className="hsct-daterange-row">
                  <div className="hsct-daterange-field">
                    <label>Từ ngày</label>
                    <input type="text" placeholder="ngày /tháng /năm" value={fmt(fromDate)} readOnly />
                  </div>
                  <div className="hsct-daterange-field">
                    <label>Đến ngày</label>
                    <input type="text" placeholder="ngày /tháng /năm" value={fmt(toDate)} readOnly />
                  </div>
                </div>
                <div className="hsct-daterange-calendars">
                  <div className="hsct-daterange-cal">
                    <Calendar
                      year={fromYear}
                      month={fromMonth}
                      fromDate={fromDate}
                      toDate={toDate}
                      onNav={handleFromNav}
                      onPick={handleDayPick}
                    />
                  </div>
                  <div className="hsct-daterange-cal">
                    <Calendar
                      year={toYear}
                      month={toMonth}
                      fromDate={fromDate}
                      toDate={toDate}
                      onNav={handleToNav}
                      onPick={handleDayPick}
                    />
                  </div>
                </div>
                <div className="hsct-daterange-actions">
                  <button
                    className="hsct-daterange-btn hsct-daterange-btn--clear"
                    onClick={handleDateClear}
                  >
                    Xóa
                  </button>
                  <button
                    className="hsct-daterange-btn hsct-daterange-btn--apply"
                    onClick={handleDateApply}
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hsct-table-wrap">
          <div className="hsct-table-scroll">
            <table className="hsct-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>MÃ HỒ SƠ</th>
                  <th>TÊN THỦ TỤC</th>
                  <th>NGÀY CẬP NHẬT</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cfg = STATUS_CONFIG[r.status];
                  return (
                    <tr key={r.stt} data-status={r.status}>
                      <td className="hsct-td-stt">{pad(r.stt)}</td>
                      <td>
                        <a
                          className="hsct-code"
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/xem-truoc-ho-so');
                          }}
                        >
                          {r.code}
                        </a>
                      </td>
                      <td>{r.name}</td>
                      <td>{r.updated}</td>
                      <td>
                        <span className={`hsct-status ${cfg.cls}`}>{cfg.label}</span>
                      </td>
                      <td>
                        <div className="hsct-actions">{getActionsJsx(r.status)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="hsct-pagination">
            <span className="hsct-pagination-info">
              Hiển thị 1-{filtered.length} trên tổng số {filtered.length} hồ sơ
            </span>
            <div className="hsct-pagination-pages">
              <button className="hsct-page-btn hsct-page-btn--nav">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button className="hsct-page-btn hsct-page-btn--active">1</button>
              <button className="hsct-page-btn">2</button>
              <button className="hsct-page-btn">3</button>
              <span className="hsct-page-dots">...</span>
              <button className="hsct-page-btn">13</button>
              <button className="hsct-page-btn hsct-page-btn--nav">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
