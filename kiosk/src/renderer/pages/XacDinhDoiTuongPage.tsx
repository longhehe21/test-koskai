import '@styles/pages/xac-dinh-doi-tuong.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { Modal, ConfirmModal } from '@components/ui';

type Answer = 'yes' | 'no';
type ModalKind = 'tu-phap' | 'nghia-vu' | null;

function YesNoButton({
  value,
  active,
  onClick,
}: {
  value: Answer;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`hsdk-option ${active ? 'hsdk-option--active' : 'hsdk-option--inactive'}`}
      data-value={value}
      onClick={onClick}
    >
      {value === 'yes' ? (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6 10l3 3 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="1" width="12" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="6" y="4" width="10" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M9 8h4M9 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
      {value === 'yes' ? 'Đã có' : 'Chưa có'}
    </button>
  );
}

export default function XacDinhDoiTuongPage() {
  const navigate = useNavigate();
  const [modal, setModal] = useState<ModalKind>(null);
  const [ct03, setCt03] = useState<Answer | null>(null);
  const [vanBan, setVanBan] = useState<Answer | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    highlight: string[];
    target: string;
  } | null>(null);

  usePageHeader({ title: 'Xác định đối tượng' });

  const openModal = (kind: 'tu-phap' | 'nghia-vu') => {
    setCt03(null);
    setVanBan(null);
    setModal(kind);
  };

  const closeModal = () => {
    setModal(null);
    setCt03(null);
    setVanBan(null);
  };

  const bothAnswered = modal === 'tu-phap' ? ct03 !== null && vanBan !== null : ct03 !== null;

  const handleNext = () => {
    if (modal === 'nghia-vu') {
      if (!ct03) return;
      const target = ct03 === 'no' ? '/tao-khai-bao-tam-vang' : '/scan-tam-vang';
      closeModal();
      window.setTimeout(() => navigate(target), 250);
      return;
    }

    if (!ct03 || !vanBan) return;
    if (vanBan === 'no') {
      const bothMissing = ct03 === 'no';
      const highlight = bothMissing
        ? [
            'Phiếu khai báo tạm vắng (Mẫu CT03)',
            'và văn bản đồng ý của cơ quan có thẩm quyền',
            'giám sát, quản lý, giáo dục.',
          ]
        : [
            'văn bản đồng ý của cơ quan',
            'có thẩm quyền giám sát, quản lý, giáo dục.',
          ];
      const target = bothMissing ? '/tao-khai-bao-tam-vang' : '/scan-tam-vang';
      setConfirmState({ highlight, target });
      return;
    }

    closeModal();
    window.setTimeout(() => navigate('/scan-tam-vang'), 250);
  };

  const handleConfirmContinue = () => {
    if (!confirmState) return;
    const target = confirmState.target;
    setConfirmState(null);
    closeModal();
    window.setTimeout(() => navigate(target), 250);
  };

  return (
    <>
      <div className="xddt-area">
        <h1 className="xddt-title">Xác định đối tượng cư trú</h1>
        <p className="xddt-subtitle">
          Vui lòng chọn nhóm đối tượng phù hợp với tình trạng hiện tại của bạn để tiếp tục.
        </p>

        <div className="xddt-cards">
          <div className="xddt-card" onClick={() => openModal('tu-phap')}>
            <div className="xddt-card-icon-row">
              <div className="xddt-icons-small">
                <img src="/assets/bua.svg" alt="" className="xddt-icon-sm" />
              </div>
              <img src="/assets/khien.svg" alt="" className="xddt-icon-lg xddt-icon-khien" />
            </div>
            <h3 className="xddt-card-title">
              Nhóm đối tượng đang chấp hành biện pháp tư pháp hoặc giáo dục
            </h3>
            <p className="xddt-card-desc">
              Bao gồm tù cải tạo, tù cải đang tại ngoài, người đang chấp hành án treo, hoãn thi
              hành án, hoặc đang bị áp dụng các biện pháp giáo dục, quản chế, cai nghiện bắt buộc
              tại địa phương hoặc cơ sở chuyên biệt.
            </p>
            <a
              href="#"
              className="xddt-card-link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openModal('tu-phap');
              }}
            >
              CHỌN ĐỐI TƯỢNG NÀY →
            </a>
          </div>

          <div className="xddt-card" onClick={() => openModal('nghia-vu')}>
            <div className="xddt-card-icon-row">
              <div className="xddt-icons-small">
                <img src="/assets/huychuong.svg" alt="" className="xddt-icon-sm" />
              </div>
              <img src="/assets/maybay.svg" alt="" className="xddt-icon-lg" />
            </div>
            <h3 className="xddt-card-title">
              Nhóm đối tượng thực hiện nghĩa vụ hoặc vắng mặt kéo dài
            </h3>
            <p className="xddt-card-desc">
              Bao gồm người đang thực hiện nghĩa vụ quân sự, quốc phòng hoặc người đi khỏi nơi
              thường trú từ 12 tháng liên tục trở lên tình trạng để đăng ký tạm trú hoặc tạm vắng
              tại nơi mới hoặc địa phương mới.
            </p>
            <a
              href="#"
              className="xddt-card-link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openModal('nghia-vu');
              }}
            >
              CHỌN ĐỐI TƯỢNG NÀY →
            </a>
          </div>
        </div>

        <div className="xddt-footer">
          <button type="button" className="xddt-btn-back" onClick={() => navigate(-1)}>
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
        </div>
      </div>

      <Modal
        open={modal !== null && !showPreview && !confirmState}
        overlayClassName="hsdk-overlay"
        visibleClassName="hsdk-overlay--visible"
        onClose={closeModal}
      >
        <div className="hsdk-modal" onClick={(e) => e.stopPropagation()}>
          <h1 className="hsdk-title">HỒ SƠ ĐÍNH KÈM</h1>

          <div className="hsdk-question">
            <div className="hsdk-question-header">
              <p className="hsdk-question-text">
                Bạn có <strong>PHIẾU KHAI BÁO TẠM VẮNG (Mẫu CT03)</strong> chưa?
              </p>
              <a
                href="#"
                className="hsdk-view-form"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPreview(true);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="#2563eb" strokeWidth="1.5" />
                  <path
                    d="M7 4v4M7 9.5v.5"
                    stroke="#2563eb"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Xem mẫu đơn
              </a>
            </div>
            <div className="hsdk-options" data-question="ct03">
              <YesNoButton value="yes" active={ct03 === 'yes'} onClick={() => setCt03('yes')} />
              <YesNoButton value="no" active={ct03 === 'no'} onClick={() => setCt03('no')} />
            </div>
          </div>

          {modal === 'tu-phap' && (
            <div className="hsdk-question">
              <div className="hsdk-question-header">
                <p className="hsdk-question-text">
                  Bạn có{' '}
                  <strong>
                    VĂN BẢN ĐỒNG Ý CỦA CƠ QUAN CÓ THẨM QUYỀN GIÁM SÁT, QUẢN LÝ, GIÁO DỤC
                  </strong>{' '}
                  chưa?
                </p>
              </div>
              <div className="hsdk-options" data-question="van-ban">
                <YesNoButton value="yes" active={vanBan === 'yes'} onClick={() => setVanBan('yes')} />
                <YesNoButton value="no" active={vanBan === 'no'} onClick={() => setVanBan('no')} />
              </div>
            </div>
          )}

          <div className="hsdk-footer">
            <button type="button" className="hsdk-btn hsdk-btn--back" onClick={closeModal}>
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
              className={`hsdk-btn hsdk-btn--next ${bothAnswered ? '' : 'hsdk-btn--disabled'}`}
              disabled={!bothAnswered}
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
      </Modal>

      <Modal
        open={modal !== null && showPreview}
        overlayClassName="maudon-overlay"
        visibleClassName="maudon-overlay--visible"
        onClose={() => setShowPreview(false)}
      >
        <div className="maudon-container" onClick={(e) => e.stopPropagation()}>
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
          <img
            src="/assets/mauct03khaibaotamvang.svg"
            alt="Mẫu CT03 - Khai báo tạm vắng"
            className="maudon-image"
          />
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
