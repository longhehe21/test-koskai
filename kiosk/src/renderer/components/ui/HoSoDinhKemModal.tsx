import '@styles/pages/ho-khau-ho-so-dinh-kem.css';
import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import { BRANCHES, type BranchConfig } from './hoSoDinhKemBranches';
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';

type Answer = 'yes' | 'no';
type QuestionKey = 'tc01' | 'so-huu' | 'q3';
type AnswersState = Partial<Record<QuestionKey, Answer>>;

export interface HoSoDinhKemSubmit {
  tc01: Answer;
  soHuu?: Answer;
  q3?: Answer;
  /** Path downstream: /scan-ho-khau hoặc /tao-ho-so-thuong-tru. */
  target: string;
}

interface HoSoDinhKemModalProps {
  open: boolean;
  /** Branch key từ BRANCHES (VD: 'quan-doi-cong-an', 'trong-nuoc'…). Nếu không có → ẩn modal. */
  branchKey: string;
  onDismiss: () => void;
  onSubmit: (result: HoSoDinhKemSubmit) => void;
  /** Set answers vào hoKhauFlowStore để downstream page đọc. Default true. */
  writeSessionStorage?: boolean;
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
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" strokeWidth="1.8" strokeLinecap="round">
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
          Bạn {withViewForm ? 'có' : 'đã có'} <strong>{label}</strong> chưa?
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

export function HoSoDinhKemModal({
  open,
  branchKey,
  onDismiss,
  onSubmit,
  writeSessionStorage = true,
}: HoSoDinhKemModalProps) {
  const cfg: BranchConfig | undefined = BRANCHES[branchKey];
  const [answers, setAnswers] = useState<AnswersState>({});
  const [showPreview, setShowPreview] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    highlight: string[];
    target: string;
  } | null>(null);

  const q1Text = useMemo(() => {
    if (!cfg) return '';
    return cfg.q1Text ?? `TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (MẪU ${cfg.mauLabel})`;
  }, [cfg]);

  if (!cfg) return null;

  const setAnswer = (key: QuestionKey, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const requiredKeys: QuestionKey[] = [
    'tc01',
    ...(cfg.singleQuestion || !cfg.q2Text ? [] : (['so-huu'] as QuestionKey[])),
    ...(cfg.q3Text && !cfg.q3Optional ? (['q3'] as QuestionKey[]) : []),
  ];

  const allAnswered = requiredKeys.every((k) => answers[k] !== undefined);

  const writeStorage = (tc01: Answer, soHuu: Answer | undefined, q3: Answer | undefined) => {
    if (!writeSessionStorage) return;
    useHoKhauFlowStore.getState().setHsdkAnswers({
      tc01: tc01 === 'yes' ? '1' : '0',
      soHuu: soHuu === 'yes' ? '1' : '0',
      q3: q3 === 'yes' ? '1' : '0',
    });
  };

  const handleNext = () => {
    const tc01 = answers.tc01;
    if (!tc01) return;

    // Single-question branch
    if (cfg.singleQuestion) {
      writeStorage(tc01, undefined, undefined);
      onSubmit({
        tc01,
        target: tc01 === 'yes' ? '/scan-ho-khau' : '/tao-ho-so-thuong-tru',
      });
      return;
    }

    const soHuu = answers['so-huu'];
    const q3 = answers.q3;

    // Q3 required (ton-giao-chuc-sac, tro-giup-xa-hoi)
    if (cfg.q3Text && !cfg.q3Optional) {
      if (!soHuu || !q3) return;
      writeStorage(tc01, soHuu, q3);
      const missing: string[] = [];
      if (soHuu === 'no' && cfg.q2ShortName) missing.push(cfg.q2ShortName);
      if (q3 === 'no' && cfg.q3ShortName) missing.push(cfg.q3ShortName);

      if (missing.length === 0) {
        onSubmit({ tc01, soHuu, q3, target: '/scan-ho-khau' });
        return;
      }
      const allMissing = tc01 === 'no' && soHuu === 'no' && q3 === 'no';
      const target = allMissing ? '/tao-ho-so-thuong-tru' : '/scan-ho-khau';
      setConfirmState({ highlight: missing, target });
      return;
    }

    // Q3 optional (phuong-tien)
    if (cfg.q3Text && cfg.q3Optional) {
      writeStorage(tc01, soHuu, q3);
    } else {
      writeStorage(tc01, soHuu, undefined);
    }

    if (!soHuu) return;

    if (soHuu === 'no') {
      const target = tc01 === 'no' ? '/tao-ho-so-thuong-tru' : '/scan-ho-khau';
      setConfirmState({ highlight: cfg.q2ShortName ? [cfg.q2ShortName] : [], target });
      return;
    }

    onSubmit({ tc01, soHuu, q3, target: '/scan-ho-khau' });
  };

  const handleConfirmContinue = () => {
    if (!confirmState) return;
    const tc01 = answers.tc01;
    if (!tc01) return;
    const soHuu = answers['so-huu'];
    const q3 = answers.q3;
    setConfirmState(null);
    onSubmit({ tc01, soHuu, q3, target: confirmState.target });
  };

  return (
    <>
      <Modal
        open={open && !showPreview && !confirmState}
        overlayClassName="hkhsdkm-overlay"
        visibleClassName="hkhsdkm-overlay--visible"
        onClose={onDismiss}
        portalSelector=".kiosk-content-panel"
      >
        <div className="hkhsdkm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="hkhsdk-area">
            <h1 className="hkhsdk-title">HỒ SƠ ĐÍNH KÈM</h1>
            <div>
              <QuestionBlock
                dataQuestion="tc01"
                label={q1Text}
                withViewForm
                value={answers.tc01}
                onChange={(v) => setAnswer('tc01', v)}
                onOpenPreview={() => setShowPreview(true)}
              />
              {!cfg.singleQuestion && cfg.q2Text && (
                <QuestionBlock
                  dataQuestion="so-huu"
                  label={cfg.q2Text}
                  withViewForm={false}
                  value={answers['so-huu']}
                  onChange={(v) => setAnswer('so-huu', v)}
                />
              )}
              {cfg.q3Text && (
                <QuestionBlock
                  dataQuestion="q3"
                  label={cfg.q3Text}
                  withViewForm={false}
                  value={answers.q3}
                  onChange={(v) => setAnswer('q3', v)}
                />
              )}
            </div>

            <div className="hkhsdk-footer">
              <button type="button" className="hkhsdk-btn hkhsdk-btn--back" onClick={onDismiss}>
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
            {cfg.mauImages.map((img) => (
              <img key={img.src} src={img.src} alt={img.alt} className="maudon-image" />
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmState !== null}
        highlightLines={confirmState?.highlight ?? []}
        onContinue={handleConfirmContinue}
        onBack={() => setConfirmState(null)}
      />
    </>
  );
}
