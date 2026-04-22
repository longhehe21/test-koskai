import '@styles/pages/nop-ho-so-thanh-cong.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { submitFeedback } from '@services/feedbackService';

// Mã hồ sơ hiện hardcode — sau này lấy từ navigation state hoặc store khi
// backend trả về mã thật. Dùng chung cho copy + feedback.applicationId.
const APPLICATION_CODE = '24.03.15.000124';

// Placeholder QR rects — port nguyên từ UI repo (mô phỏng mã QR hiển thị).
const QR_RECTS: Array<[number, number, number?]> = [
  [56, 12, 8], [68, 12, 8], [56, 24, 8],
  [12, 56, 8], [24, 56, 8], [12, 68, 8],
  [56, 56, 8], [68, 56, 8], [80, 56, 8],
  [56, 68, 8], [56, 80, 8], [68, 68, 8], [80, 68, 8], [80, 80, 8],
  [92, 56, 8], [104, 56, 8], [92, 68, 8], [116, 68, 8],
  [92, 92, 8], [104, 92, 8], [116, 92, 8],
  [92, 104, 8], [116, 104, 8], [92, 116, 8], [104, 116, 8],
  [56, 92, 8], [68, 104, 8], [56, 116, 8], [68, 116, 8],
];

export default function NopHoSoThanhCongPage() {
  const navigate = useNavigate();

  // rating=0 nghĩa là chưa chọn sao nào; submit disabled đến khi >=1.
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  usePageHeader({ title: 'Xác nhận nộp hồ sơ', showBack: false });

  const handleSubmitFeedback = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    // Gọi service layer — khi backend sẵn sàng chỉ cần sửa trong feedbackService,
    // component không phải đổi gì. Lỗi để silent + retry button cho đỡ vỡ UX kiosk.
    const result = await submitFeedback({
      applicationId: APPLICATION_CODE,
      ratingScore: rating,
      comment: comment.trim() || undefined,
    });
    setSubmitting(false);
    if (result.success) setSubmitted(true);
  };

  // displayRating = hover (preview) > rating đã chọn. Trên kiosk touch thì
  // hover ít xảy ra nhưng vẫn hữu ích cho test trên máy dev.
  const displayRating = hoverRating || rating;

  return (
    <div className="nhstc-area">
      <div className="nhstc-body">
        <div className="nhstc-left">
          <div className="nhstc-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6L9 17l-5-5"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className="nhstc-title">Nộp hồ sơ thành công!</h1>
          <p className="nhstc-desc">
            Cảm ơn bạn đã thực hiện thủ tục. Hồ sơ của bạn đã được tiếp nhận và đang được xử lý bởi
            bộ phận chuyên môn.
          </p>

          <div className="nhstc-card">
            <div className="nhstc-card-row">
              <div className="nhstc-card-col">
                <span className="nhstc-card-label">MÃ HỒ SƠ</span>
                <div className="nhstc-card-value">
                  {APPLICATION_CODE}
                  <button
                    className="nhstc-copy-btn"
                    onClick={() => navigator.clipboard?.writeText(APPLICATION_CODE)}
                    aria-label="Sao chép mã hồ sơ"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="nhstc-card-divider" />
              <div className="nhstc-card-col nhstc-card-col--right">
                <span className="nhstc-card-label">THỜI GIAN TIẾP NHẬN</span>
                <span className="nhstc-card-time">15/03/2024 · 14:20</span>
              </div>
            </div>
          </div>

          <button className="nhstc-home-btn" onClick={() => navigate('/services')}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Về trang chủ
          </button>

          {/* Feedback section — cùng cột với success info, phân tách bằng divider */}
          <div className="nhstc-feedback">
            {submitted ? (
              <div className="nhstc-feedback-thanks">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" fill="#22c55e" />
                  <path
                    d="M7 12l3.5 3.5L17 9"
                    stroke="#ffffff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3 className="nhstc-feedback-thanks-title">Cảm ơn bạn đã đánh giá!</h3>
                <p className="nhstc-feedback-thanks-desc">
                  Phản hồi của bạn giúp chúng tôi cải thiện dịch vụ tốt hơn.
                </p>
              </div>
            ) : (
              <>
                <h2 className="nhstc-feedback-title">Đánh giá dịch vụ</h2>
                <p className="nhstc-feedback-desc">
                  Vui lòng chia sẻ trải nghiệm của bạn để chúng tôi cải thiện tốt hơn.
                </p>

                <div className="nhstc-stars" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = value <= displayRating;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`nhstc-star${active ? ' nhstc-star--active' : ''}`}
                        onClick={() => setRating(value)}
                        onMouseEnter={() => setHoverRating(value)}
                        aria-label={`${value} sao`}
                      >
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    );
                  })}
                </div>

                <textarea
                  className="nhstc-comment"
                  placeholder="Nhập ý kiến đóng góp của bạn..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={1}
                />

                <button
                  type="button"
                  className="nhstc-submit-btn"
                  onClick={handleSubmitFeedback}
                  disabled={rating < 1 || submitting}
                >
                  {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="nhstc-right">
          <div className="nhstc-qr-box">
            <svg className="nhstc-qr-placeholder" width="200" height="200" viewBox="0 0 140 140">
              <rect width="140" height="140" fill="#ffffff" rx="8" />
              <rect x="12" y="12" width="36" height="36" rx="4" fill="#1e293b" />
              <rect x="16" y="16" width="28" height="28" rx="2" fill="#ffffff" />
              <rect x="22" y="22" width="16" height="16" rx="1" fill="#1e293b" />
              <rect x="92" y="12" width="36" height="36" rx="4" fill="#1e293b" />
              <rect x="96" y="16" width="28" height="28" rx="2" fill="#ffffff" />
              <rect x="102" y="22" width="16" height="16" rx="1" fill="#1e293b" />
              <rect x="12" y="92" width="36" height="36" rx="4" fill="#1e293b" />
              <rect x="16" y="96" width="28" height="28" rx="2" fill="#ffffff" />
              <rect x="22" y="102" width="16" height="16" rx="1" fill="#1e293b" />
              {QR_RECTS.map(([x, y, size = 8], i) => (
                <rect key={i} x={x} y={y} width={size} height={size} rx="1" fill="#1e293b" />
              ))}
            </svg>
          </div>
          <p className="nhstc-qr-text">Quét mã QR để theo dõi trạng thái hồ sơ trên điện thoại</p>
          <p className="nhstc-qr-hint">Sử dụng Camera hoặc ứng dụng Zalo để quét nhanh mã phía trên.</p>
        </div>
      </div>
    </div>
  );
}
