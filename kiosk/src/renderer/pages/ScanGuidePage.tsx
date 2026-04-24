import '@styles/pages/scan-guide.css';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';

export default function ScanGuidePage() {
  const navigate = useNavigate();

  usePageHeader({
    title: 'Hướng dẫn quét CCCD',
    showUserBadge: false,
    showDocs: false,
  });

  return (
    <div className="scan-guide-area">
      <h1 className="scan-guide-title">Hướng dẫn sử dụng máy quét CCCD</h1>
      <p className="scan-guide-subtitle">
        Vui lòng thực hiện theo các bước dưới đây để quét thẻ căn cước công dân của bạn.
      </p>

      <div className="scan-guide-illustration">
        <img
          src="/assets/cccd-illustration.svg"
          alt="CCCD gắn chip"
          className="cccd-illust-img"
        />
      </div>

      <div className="scan-guide-steps">
        <div className="scan-step">
          <div className="scan-step-number">1</div>
          <p className="scan-step-text">Đặt thẻ CCCD vào khay máy quét.</p>
        </div>
        <div className="scan-step">
          <div className="scan-step-number">2</div>
          <p className="scan-step-text">
            Đặt bàn mặt và gắn chặt hướng theo chỉ dẫn trên máy (mặt trước hướng xuống dưới).
          </p>
        </div>
        <div className="scan-step">
          <div className="scan-step-number">3</div>
          <p className="scan-step-text">
            Bấm nút xác nhận và hệ thống sẽ nhận quét và trích xuất dữ liệu.
          </p>
        </div>
      </div>

      <div className="scan-guide-actions">
        <button className="scan-btn-back" onClick={() => navigate(-1)}>
          Quay lại
        </button>
        <button className="scan-btn-start" onClick={() => navigate('/cccd-input')}>
          Tôi đã hiểu &amp; Bắt đầu quét
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}
