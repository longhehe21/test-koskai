import '@styles/pages/ho-khau-ho-so-dinh-kem.css';
import '@styles/pages/xem-truoc-ho-so.css';
import { useState } from 'react';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';

type Answer = 'yes' | 'no';
type QuestionKey = 'q1' | 'q2' | 'q3';
type AnswersState = Partial<Record<QuestionKey, Answer>>;

const Q2_LABEL_DEFAULT = 'GIẤY TỜ, TÀI LIỆU CHỨNG MINH CHỖ Ở HỢP PHÁP';

export interface TamTruHoSoDinhKemSubmit {
  q1: Answer;
  q2: Answer;
  q3?: Answer;
  target: string;
}

interface TamTruHoSoDinhKemModalProps {
  open: boolean;
  onDismiss: () => void;
  onSubmit: (result: TamTruHoSoDinhKemSubmit) => void;
  /** Label câu hỏi 1 (tài liệu chính). VD: "Danh sách công dân đăng ký tạm trú",
   * "TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (Mẫu CT01)". */
  q1Label: string;
  /** Label câu hỏi 2. Truyền `null` để ẩn Q2 (modal 1-câu cho xóa đăng ký
   * cases chỉ cần CT01). Undefined → dùng default label giấy tờ chỗ ở hợp pháp. */
  q2Label?: string | null;
  /** Label câu hỏi 3 (optional — chỉ dùng cho variant phuong-tien). */
  q3Label?: string;
  /** Preview dạng HTML (dùng cho mẫu DOCX đã convert). */
  previewHTML?: string;
  /** Preview dạng ảnh (SVG/PNG). */
  previewImage?: string;
  previewAlt?: string;
  /** Route scan nếu các giấy tờ kèm "Đã có". */
  scanRoute: string;
  /** Route form tạo khi Q1 "Chưa có" (cần lập CT01). */
  formRoute: string;
}

function renderYesNoOption(active: boolean, value: Answer, onClick: () => void) {
  const activeClass = active ? ' hkhsdk-option--active' : '';
  return (
    <button
      type="button"
      className={`hkhsdk-option${activeClass}`}
      data-value={value}
      onClick={onClick}
    >
      {value === 'yes' ? (
        <span className="hkhsdk-option-icon hkhsdk-icon--check">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" className="hkhsdk-icon-fill" />
            <path
              d="M6 10l3 3 5-5"
              className="hkhsdk-icon-stroke-inv"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : (
        <span className="hkhsdk-option-icon">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="10" cy="10" r="9" className="hkhsdk-icon-stroke" strokeWidth="1.5" />
            <path d="M10 6v5M10 13v.5" className="hkhsdk-icon-stroke" />
          </svg>
        </span>
      )}
      <span className="hkhsdk-option-text">{value === 'yes' ? 'Đã có' : 'Chưa có'}</span>
    </button>
  );
}

interface QuestionBlockProps {
  dataQuestion: QuestionKey;
  label: string;
  withViewForm: boolean;
  value?: Answer;
  onChange: (value: Answer) => void;
  onOpenPreview?: () => void;
}

function QuestionBlock({
  dataQuestion,
  label,
  withViewForm,
  value,
  onChange,
  onOpenPreview,
}: QuestionBlockProps) {
  return (
    <div className="hkhsdk-question">
      <div className="hkhsdk-question-header">
        <p className="hkhsdk-question-text">
          Bạn có <strong>{label}</strong> chưa?
        </p>
        {withViewForm && onOpenPreview && (
          <a
            href="#"
            className="hkhsdk-view-form"
            onClick={(e) => {
              e.preventDefault();
              onOpenPreview();
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Xem mẫu đơn
          </a>
        )}
      </div>
      <div className="hkhsdk-options" data-question={dataQuestion}>
        {renderYesNoOption(value === 'yes', 'yes', () => onChange('yes'))}
        {renderYesNoOption(value === 'no', 'no', () => onChange('no'))}
      </div>
    </div>
  );
}

export function TamTruHoSoDinhKemModal({
  open,
  onDismiss,
  onSubmit,
  q1Label,
  q2Label,
  q3Label,
  previewHTML,
  previewImage,
  previewAlt = 'Mẫu đơn',
  scanRoute,
  formRoute,
}: TamTruHoSoDinhKemModalProps) {
  const hasQ2 = q2Label !== null;
  const resolvedQ2Label = q2Label === undefined ? Q2_LABEL_DEFAULT : q2Label ?? '';
  const [answers, setAnswers] = useState<AnswersState>({});
  const [showPreview, setShowPreview] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    highlight: string[];
    target: string;
  } | null>(null);

  const setAnswer = (key: QuestionKey, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const hasQ3Question = Boolean(q3Label);
  const allAnswered =
    answers['q1'] !== undefined &&
    (!hasQ2 || answers['q2'] !== undefined) &&
    (!hasQ3Question || answers['q3'] !== undefined);

  const handleDismiss = () => {
    setAnswers({});
    setConfirmState(null);
    setShowPreview(false);
    onDismiss();
  };

  const handleNext = () => {
    const q1 = answers['q1'];
    const q2 = hasQ2 ? answers['q2'] : undefined;
    const q3 = hasQ3Question ? answers['q3'] : undefined;
    if (!q1) return;
    if (hasQ2 && !q2) return;
    if (hasQ3Question && !q3) return;

    // Thu thập tất cả giấy tờ "Chưa có" — bao gồm cả Q1 (đơn chính) nếu thiếu.
    // User phải confirm trước khi đi tiếp, bất kể đơn chính hay giấy tờ kèm thiếu.
    const missing: string[] = [];
    if (q1 === 'no') missing.push(q1Label);
    if (hasQ2 && q2 === 'no') missing.push(resolvedQ2Label);
    if (hasQ3Question && q3 === 'no' && q3Label) missing.push(q3Label);

    // Không thiếu gì → scan ngay, không cần confirm
    if (missing.length === 0) {
      onSubmit({ q1, q2: q2 ?? 'yes', q3, target: scanRoute });
      return;
    }

    // Có thiếu → ConfirmModal cảnh báo. Target:
    //  - Q1 "Chưa có" (đơn chính thiếu): formRoute (cần fill CT01)
    //  - Q1 "Đã có" nhưng Q2/Q3 thiếu: scanRoute (scan Q1, bổ sung Q2/Q3 sau)
    const target = q1 === 'no' ? formRoute : scanRoute;
    setConfirmState({ highlight: missing, target });
  };

  const handleConfirmContinue = () => {
    if (!confirmState) return;
    const q1 = answers['q1'];
    const q2 = hasQ2 ? answers['q2'] : undefined;
    const q3 = hasQ3Question ? answers['q3'] : undefined;
    if (!q1) return;
    if (hasQ2 && !q2) return;
    if (hasQ3Question && !q3) return;
    const target = confirmState.target;
    setConfirmState(null);
    onSubmit({ q1, q2: q2 ?? 'yes', q3, target });
  };

  return (
    <>
      <Modal
        open={open && !showPreview && !confirmState}
        overlayClassName="hkhsdkm-overlay"
        visibleClassName="hkhsdkm-overlay--visible"
        onClose={handleDismiss}
        portalSelector=".kiosk-content-panel"
      >
        <div className="hkhsdkm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="hkhsdk-area">
            <h1 className="hkhsdk-title">HỒ SƠ ĐÍNH KÈM</h1>
            <div>
              <QuestionBlock
                dataQuestion="q1"
                label={q1Label}
                withViewForm={Boolean(previewHTML || previewImage)}
                value={answers['q1']}
                onChange={(v) => setAnswer('q1', v)}
                onOpenPreview={() => setShowPreview(true)}
              />
              {hasQ2 && (
                <QuestionBlock
                  dataQuestion="q2"
                  label={resolvedQ2Label}
                  withViewForm={false}
                  value={answers['q2']}
                  onChange={(v) => setAnswer('q2', v)}
                />
              )}
              {hasQ3Question && q3Label && (
                <QuestionBlock
                  dataQuestion="q3"
                  label={q3Label}
                  withViewForm={false}
                  value={answers['q3']}
                  onChange={(v) => setAnswer('q3', v)}
                />
              )}
            </div>

            <div className="hkhsdk-footer">
              <button
                type="button"
                className="hkhsdk-btn hkhsdk-btn--back"
                onClick={handleDismiss}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M11 4L6 9l5 5"
                    stroke="#374151"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Quay lại
              </button>
              <button
                type="button"
                className={`hkhsdk-btn hkhsdk-btn--next${allAnswered ? '' : ' hkhsdk-btn--disabled'}`}
                disabled={!allAnswered}
                onClick={handleNext}
              >
                Tiếp tục
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M7 4l5 5-5 5"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={open && showPreview}
        overlayClassName="hkhsdk-maudon-overlay"
        visibleClassName="hkhsdk-maudon-overlay--visible"
        onClose={() => setShowPreview(false)}
        portalSelector=".kiosk-content-panel"
      >
        <div className="hkhsdk-maudon-container" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="maudon-close"
            onClick={() => setShowPreview(false)}
            aria-label="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="#374151"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="hkhsdk-maudon-scroll">
            {previewHTML ? (
              <div
                className="xths-docx-paper"
                dangerouslySetInnerHTML={{ __html: previewHTML }}
              />
            ) : previewImage ? (
              <img src={previewImage} alt={previewAlt} className="maudon-image" />
            ) : null}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmState !== null}
        highlightLines={confirmState?.highlight ?? []}
        onContinue={handleConfirmContinue}
        onBack={() => setConfirmState(null)}
        portalSelector=".kiosk-content-panel"
      />
    </>
  );
}
