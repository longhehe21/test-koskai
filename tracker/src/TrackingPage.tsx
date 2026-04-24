import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTracking, ApiError, type TrackingDetail } from './api';

/** Map status code → UI class + icon mapping. */
function statusVisual(code: string): { cls: string; dot: string; label: string } {
  switch (code) {
    case 'draft':
      return { cls: 'status--draft', dot: '#94a3b8', label: 'Bản nháp' };
    case 'submitted':
      return { cls: 'status--processing', dot: '#2563eb', label: 'Đã tiếp nhận' };
    case 'sent_to_ca':
      return { cls: 'status--processing', dot: '#0ea5e9', label: 'Đã gửi BCA' };
    case 'received_by_ca':
    case 'processing':
      return { cls: 'status--processing', dot: '#f59e0b', label: 'Đang xử lý' };
    case 'approved':
      return { cls: 'status--approved', dot: '#22c55e', label: 'Đã duyệt' };
    case 'rejected':
    case 'cancelled':
      return { cls: 'status--rejected', dot: '#ef4444', label: 'Từ chối' };
    default:
      return { cls: 'status--processing', dot: '#64748b', label: code };
  }
}

/** Rút gọn statusCode về 1 trong 3 phase: received | processing | done.
 *  Progress UI luôn hiển thị 3 bước cố định, bước hiện tại highlight. */
type Phase = 'received' | 'processing' | 'done';
function phaseOf(code: string): Phase {
  if (code === 'draft') return 'received'; // không thường đến đây vì draft hidden public
  if (code === 'submitted') return 'received';
  if (code === 'sent_to_ca' || code === 'received_by_ca' || code === 'processing') return 'processing';
  return 'done'; // approved | rejected | cancelled
}

/** Log trong DB theo statusCode → phase match được không (để fill timestamp). */
function logPhase(code: string): Phase | null {
  if (code === 'submitted') return 'received';
  if (code === 'sent_to_ca' || code === 'received_by_ca' || code === 'processing') return 'processing';
  if (code === 'approved' || code === 'rejected' || code === 'cancelled') return 'done';
  return null;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Trang hiển thị chi tiết hồ sơ khi scan QR từ phiếu biên nhận.
 * Public — không yêu cầu đăng nhập. Data qua endpoint public/tracking/:code.
 */
export function TrackingPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<TrackingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTracking(code)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 404) setError('Không tìm thấy hồ sơ với mã này.');
          else if (err.status === 429) setError('Bạn tra cứu quá nhiều. Vui lòng thử lại sau 1 phút.');
          else setError(err.message);
        } else {
          setError((err as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const vis = useMemo(
    () => statusVisual(detail?.statusCode ?? ''),
    [detail?.statusCode],
  );

  // Fixed 3-step timeline — user kỳ vọng 3 bước cố định giống mock mobile:
  //  1. Đã tiếp nhận (from submittedAt hoặc log 'submitted')
  //  2. Đang xử lý (from log 'sent_to_ca' hoặc 'processing')
  //  3. Đã có kết quả (from log 'approved' | 'rejected' | 'cancelled')
  // Bước current highlight, bước pending greyed out, bước done tick xanh.
  const phases = useMemo(() => {
    if (!detail) return [];
    const currentPhase = phaseOf(detail.statusCode);
    const phaseOrder: Phase[] = ['received', 'processing', 'done'];

    // Lookup timestamp của mỗi phase từ timeline logs
    const phaseTs: Record<Phase, string | null> = {
      received: detail.submittedAt, // fallback submittedAt
      processing: null,
      done: null,
    };
    detail.timeline.forEach((e) => {
      const p = logPhase(e.statusCode);
      if (p && !phaseTs[p]) phaseTs[p] = e.changedAt;
    });

    const currentIdx = phaseOrder.indexOf(currentPhase);
    return phaseOrder.map((p, i) => {
      const state: 'done' | 'current' | 'pending' =
        i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'pending';
      const labels: Record<Phase, { title: string; doneDesc: string; currentDesc: string; pendingDesc: string }> = {
        received: {
          title: 'Đã tiếp nhận',
          doneDesc: 'Hồ sơ đã được xác nhận và chuyển đến bộ phận chuyên môn.',
          currentDesc: 'Hồ sơ đã được xác nhận và chuyển đến bộ phận chuyên môn.',
          pendingDesc: 'Hồ sơ sẽ được xác nhận sau khi nộp.',
        },
        processing: {
          title: 'Đang xử lý',
          doneDesc: 'Cán bộ đã thẩm tra hồ sơ.',
          currentDesc: 'Cán bộ đang thẩm tra các thông tin liên quan.',
          pendingDesc: 'Chờ bộ phận chuyên môn thẩm tra.',
        },
        done: {
          title: 'Đã có kết quả',
          doneDesc: detail.statusCode === 'approved'
            ? 'Hồ sơ đã được duyệt. Nhận kết quả theo hình thức đã chọn.'
            : detail.statusCode === 'rejected'
              ? 'Hồ sơ bị từ chối. Xem lý do chi tiết tại cơ quan.'
              : 'Hồ sơ đã được xử lý xong.',
          currentDesc: 'Đang chờ cập nhật kết quả.',
          pendingDesc: 'Dự kiến sau khi thẩm định hoàn tất.',
        },
      };
      const meta = labels[p];
      return {
        phase: p,
        state,
        title: meta.title,
        desc: state === 'done' ? meta.doneDesc : state === 'current' ? meta.currentDesc : meta.pendingDesc,
        timestamp: phaseTs[p],
      };
    });
  }, [detail]);

  if (loading) {
    return <div className="page center"><div className="spinner" /> Đang tải...</div>;
  }

  if (error || !detail) {
    return (
      <div className="page center">
        <div className="error-box">
          <h2>⚠️ {error ?? 'Không có dữ liệu'}</h2>
          <button className="back-btn" onClick={() => navigate('/')}>← Nhập mã khác</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn-small" onClick={() => navigate('/')} aria-label="Quay lại">←</button>
        <h1 className="page-title">KioskAI</h1>
      </header>

      <section className="card hero-card">
        <span className="label-sm">MÃ HỒ SƠ</span>
        <div className="tracking-code">{detail.trackingCode}</div>
        <span className={`status-badge ${vis.cls}`}>{vis.label.toUpperCase()}</span>
      </section>

      <section className="card info-card">
        <h2 className="section-title">Chi tiết hồ sơ</h2>
        <div className="info-row">
          <span className="info-label">Thủ tục</span>
          <span className="info-value">{detail.procedureName || '—'}</span>
        </div>
        <div className="info-grid">
          <div>
            <span className="info-label">Ngày nộp</span>
            <span className="info-value">{formatDate(detail.submittedAt)}</span>
          </div>
          <div>
            <span className="info-label">Dự kiến trả</span>
            <span className="info-value">{formatDate(detail.expectedResultDate)}</span>
          </div>
        </div>
        {detail.agencyName && (
          <div className="info-row agency-row">
            <span className="info-label">Cơ quan</span>
            <span className="info-value agency-value">
              <span className="agency-icon">🏛️</span> {detail.agencyName}
            </span>
          </div>
        )}
      </section>

      <section className="card timeline-card">
        <h2 className="section-title">Tiến trình xử lý</h2>
        <ol className="timeline">
          {phases.map((p, i) => {
            const isCurrent = p.state === 'current';
            const isDone = p.state === 'done';
            const isPending = p.state === 'pending';
            return (
              <li
                key={p.phase}
                className={`timeline-item${isCurrent ? ' timeline-item--current' : ''}${isDone ? ' timeline-item--done' : ''}${isPending ? ' timeline-item--pending' : ''}`}
              >
                <span className="timeline-dot">
                  {isDone && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div className="timeline-body">
                  <h3 className="timeline-title">{p.title}</h3>
                  {p.timestamp && (
                    <time className="timeline-time">📅 {formatDateTime(p.timestamp)}</time>
                  )}
                  <p className="timeline-note">{p.desc}</p>
                  {isCurrent && (
                    <span className="timeline-badge">⏳ BƯỚC {i + 1}/{phases.length}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <footer className="page-footer">
        KioskAI © {new Date().getFullYear()} — Dịch vụ công trực tuyến
      </footer>
    </div>
  );
}
