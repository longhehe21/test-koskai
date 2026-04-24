import '@styles/pages/ho-so-cua-toi.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import {
  deleteApplication,
  getApplication,
  listMyApplications,
  type DraftSummary,
} from '@services/applicationService';
import { ConfirmSubmitModal } from '@components/ui';

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
  /** Application ID trên server — dùng để navigate resume draft */
  appId?: number;
  /** Procedure code để xác định route navigate */
  procedureCode?: string;
}

const STATUS_CONFIG: Record<Status, { label: string; cls: string }> = {
  draft: { label: 'BẢN NHÁP', cls: 'hsct-status--draft' },
  processing: { label: 'ĐANG XỬ LÝ', cls: 'hsct-status--processing' },
  approved: { label: 'ĐÃ DUYỆT', cls: 'hsct-status--approved' },
  rejected: { label: 'TỪ CHỐI', cls: 'hsct-status--rejected' },
};

/**
 * Map procedureCode (+ optional variant) → route form tạo hồ sơ tương ứng.
 *
 * Một số procedure có nhiều variant UI (tạm trú + gia hạn đều có 2 variant:
 * nhân-khẩu-hộ và danh-sách). Form save `__variant` vào formDataJson; caller
 * đọc variant → chọn route đúng. Không có variant → dùng route default.
 *
 * Cover cả 2 flow attach:
 *   - User chọn "Đã có" → scan → form: resume thấy scans trong scanStore
 *   - User chọn "Chưa có" → form trực tiếp: resume chỉ có formData
 */
function getEditRoute(procedureCode: string, variant?: string | null): string | null {
  switch (procedureCode) {
    case 'thuong-tru': return '/tao-ho-so-thuong-tru';
    case 'tam-tru':
      return variant === 'danh-sach'
        ? '/tao-ho-so-tam-tru-danh-sach'
        : '/tao-ho-so-tam-tru-nhan-khau-ho';
    case 'tam-vang': return '/tao-khai-bao-tam-vang';
    case 'luu-tru': return '/tao-thong-bao-luu-tru';
    case 'gia-han-tam-tru':
    case 'gia-han':
      return variant === 'gia-han-danh-sach' || variant === 'danh-sach'
        ? '/tao-ho-so-gia-han-danh-sach'
        : '/tao-ho-so-gia-han';
    case 'xoa-dang-ky': return '/tao-ho-so-xoa-dang-ky';
    default: return null;
  }
}

/** Map statusCode từ backend → Status FE dùng để style cell. */
function mapStatusCode(code: string): Status {
  if (code === 'draft') return 'draft';
  if (code === 'approved') return 'approved';
  if (code === 'rejected' || code === 'cancelled') return 'rejected';
  return 'processing'; // submitted, sent_to_ca, received_by_ca, processing
}

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

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function getActionsJsx(
  record: DocRecord,
  onDeleteDraft: (record: DocRecord) => void,
): JSX.Element {
  const status = record.status;
  const EYE = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
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
        <button
          className="hsct-action-btn"
          title="Xóa"
          onClick={(e) => {
            e.stopPropagation(); // Đừng trigger row click (navigate scan page)
            onDeleteDraft(record);
          }}
        >{DELETE}</button>
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

  // Load applications từ server (cross-session per citizen)
  const [records, setRecords] = useState<DocRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list: DraftSummary[] = await listMyApplications();
        if (cancelled) return;
        const mapped: DocRecord[] = list.map((it, i) => ({
          stt: i + 1,
          code: it.trackingCode,
          name: it.procedureName,
          updated: formatDateTime(it.updatedAt),
          status: mapStatusCode(it.statusCode),
          appId: it.id,
          procedureCode: it.procedureCode,
        }));
        setRecords(mapped);
        setLoadError(null);
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!statusOpen && !dateOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [statusOpen, dateOpen]);

  // Click hàng:
  //  - Draft: fetch detail để đọc __variant trong formDataJson → getEditRoute
  //    trả route tương ứng variant. Wrapper hydrate formData + scans.
  //  - Non-draft: navigate trực tiếp sang trang nộp thành công (mã + QR).
  //
  // Async vì phải fetch detail cho draft — show spinner inline nếu chậm.
  const [navigating, setNavigating] = useState<number | null>(null);

  const handleRowClick = async (record: DocRecord) => {
    if (!record.appId) return;
    if (record.status !== 'draft') {
      navigate(`/nop-ho-so-thanh-cong?appId=${record.appId}`);
      return;
    }
    if (!record.procedureCode) return;

    setNavigating(record.appId);
    try {
      const detail = await getApplication(record.appId);
      const variant = (detail.formDataJson as { __variant?: string } | null)?.__variant ?? null;
      const route = getEditRoute(record.procedureCode, variant);
      if (route) navigate(`${route}?appId=${record.appId}`);
    } catch (err) {
      console.warn('[HoSoCuaToi] fetch variant fail:', (err as Error).message);
      // Fallback: dùng route default (không variant)
      const route = getEditRoute(record.procedureCode);
      if (route) navigate(`${route}?appId=${record.appId}`);
    } finally {
      setNavigating(null);
    }
  };

  // Xóa nháp: confirm modal → DELETE /applications/:id → bỏ khỏi list.
  // Server check soft-delete chỉ cho draft (chưa submit) + đúng owner.
  const [deleteTarget, setDeleteTarget] = useState<DocRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleRequestDelete = (record: DocRecord) => {
    setDeleteError(null);
    setDeleteTarget(record);
  };
  const handleCancelDelete = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };
  const handleConfirmDelete = async () => {
    if (!deleteTarget?.appId) return;
    setIsDeleting(true);
    try {
      await deleteApplication(deleteTarget.appId);
      setRecords((prev) => prev.filter((r) => r.appId !== deleteTarget.appId));
      setDeleteTarget(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError((err as Error).message || 'Xóa thất bại');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    return records.filter((r) => {
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
  }, [filterStatus, appliedFrom, appliedTo, records]);

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
          {filtered.length === 0 ? (
            <div className="hsct-empty">
              <svg
                width="72"
                height="72"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <circle cx="12" cy="15" r="0.6" fill="currentColor" />
                <path d="M12 11v2" />
              </svg>
              <h3 className="hsct-empty-title">
                {filterStatus === 'all'
                  ? 'Bạn chưa có hồ sơ nào'
                  : `Không có hồ sơ ở trạng thái "${statusLabel}"`}
              </h3>
              <p className="hsct-empty-desc">
                {filterStatus === 'all'
                  ? 'Các hồ sơ bạn tạo hoặc lưu nháp sẽ hiển thị tại đây.'
                  : 'Thử chọn trạng thái khác hoặc xem tất cả hồ sơ của bạn.'}
              </p>
              {filterStatus !== 'all' && (
                <button
                  type="button"
                  className="hsct-empty-btn"
                  onClick={() => setFilterStatus('all')}
                >
                  Xem tất cả hồ sơ
                </button>
              )}
            </div>
          ) : (
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
                    // Draft → cần procedureCode map route. Non-draft → luôn clickable
                    // (navigate sang nop-ho-so-thanh-cong bất kể thủ tục nào).
                    const canClick = !!r.appId && (
                      r.status !== 'draft'
                      || (!!r.procedureCode && !!getEditRoute(r.procedureCode))
                    );
                    const isNavigating = navigating === r.appId;
                    return (
                      <tr
                        key={r.stt}
                        data-status={r.status}
                        onClick={() => canClick && !isNavigating && void handleRowClick(r)}
                        style={
                          isNavigating
                            ? { cursor: 'wait', opacity: 0.6 }
                            : canClick
                              ? { cursor: 'pointer' }
                              : undefined
                        }
                      >
                        <td className="hsct-td-stt">{pad(r.stt)}</td>
                        <td>
                          <span className="hsct-code">{r.code}</span>
                        </td>
                        <td>{r.name}</td>
                        <td>{r.updated}</td>
                        <td>
                          <span className={`hsct-status ${cfg.cls}`}>{cfg.label}</span>
                        </td>
                        <td>
                          <div className="hsct-actions">{getActionsJsx(r, handleRequestDelete)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
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
          )}
        </div>
      </div>

      <ConfirmSubmitModal
        open={!!deleteTarget}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xóa hồ sơ nháp"
        description={
          deleteError
            ? `Lỗi: ${deleteError}. Vui lòng thử lại.`
            : `Hồ sơ "${deleteTarget?.name ?? ''}" (mã ${deleteTarget?.code ?? ''}) sẽ bị xóa vĩnh viễn khỏi danh sách. Thao tác này không thể khôi phục.`
        }
        confirmLabel={isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
        cancelLabel="Hủy"
      />
    </div>
  );
}
