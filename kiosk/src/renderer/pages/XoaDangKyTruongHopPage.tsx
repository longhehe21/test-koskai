import '@styles/pages/tam-tru-truong-hop.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { TamTruHoSoDinhKemModal, type TamTruHoSoDinhKemSubmit } from '@components/ui';
import { useTamTruFlowStore, type XoaDangKyCaseId } from '@store/tamTruFlowStore';

type CaseId = Exclude<XoaDangKyCaseId, null>;

interface TruongHopCase {
  id: CaseId;
  title: string;
  description: string;
  iconPath: JSX.Element;
}

const GROUP_ICON = (
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);

const GROUP_X_ICON = (
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="17" y1="5" x2="23" y2="11" />
    <line x1="23" y1="5" x2="17" y2="11" />
  </>
);

const CALENDAR_X_ICON = (
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="9" y1="14" x2="15" y2="20" />
    <line x1="15" y1="14" x2="9" y2="20" />
  </>
);

const CASES: TruongHopCase[] = [
  {
    id: 'ho-vang-mat-6thang',
    title: 'Hộ vắng mặt trên 6 tháng',
    description: 'Toàn bộ hộ gia đình không có mặt tại nơi thường trú hiện tại.',
    iconPath: GROUP_ICON,
  },
  {
    id: 'nhan-khau-khong-con-cho-o',
    title: 'Nhân khẩu hộ do không còn chỗ ở hợp pháp',
    description:
      'Dành cho cá nhân trong hộ gia đình đã thay đổi hoặc mất quyền sở hữu nhà ở.',
    iconPath: GROUP_X_ICON,
  },
  {
    id: 'nhan-khau-da-dk-thuong-tru',
    title: 'Nhân khẩu do đã đăng ký thường trú tại nơi tạm trú',
    description: 'Cá nhân tạm vắng không khai báo trong thời gian dài.',
    iconPath: CALENDAR_X_ICON,
  },
  {
    id: 'ca-ho-khong-con-cho-o',
    title: 'Cả hộ do không còn chỗ ở hợp pháp',
    description:
      'Dành cho toàn bộ thành viên hộ gia đình không còn nơi cư trú pháp lý.',
    iconPath: GROUP_X_ICON,
  },
  {
    id: 'nhan-khau-vang-mat-6thang',
    title: 'Nhân khẩu vắng mặt trên 6 tháng',
    description: 'Cá nhân tạm vắng không khai báo trong thời gian dài.',
    iconPath: CALENDAR_X_ICON,
  },
  {
    id: 'ho-da-dk-thuong-tru',
    title: 'Hộ do đã đăng ký thường trú tại nơi tạm trú',
    description: 'Toàn bộ hộ gia đình không có mặt tại nơi thường trú hiện tại.',
    iconPath: GROUP_ICON,
  },
];

interface HsdkConfig {
  /** Q2 label; null = case chỉ cần 1 giấy tờ (CT01). */
  q2Label: string | null;
}

// Q1 CT01 cho toàn bộ cases. Chỉ 2 case có Q2.
const HSDK_CONFIGS: Record<CaseId, HsdkConfig> = {
  'ho-vang-mat-6thang': { q2Label: null },
  'nhan-khau-khong-con-cho-o': {
    q2Label: 'GIẤY TỜ, TÀI LIỆU CHỨNG MINH CHỖ Ở HỢP PHÁP',
  },
  'nhan-khau-da-dk-thuong-tru': { q2Label: null },
  'ca-ho-khong-con-cho-o': {
    q2Label: 'GIẤY TỜ CHỨNG MINH VỀ VIỆC KHÔNG CÒN CHỖ Ở HỢP PHÁP',
  },
  'nhan-khau-vang-mat-6thang': { q2Label: null },
  'ho-da-dk-thuong-tru': { q2Label: null },
};

const ADVANCE_DELAY_MS = 300;
const Q1_LABEL = 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (Mẫu CT01)';

export default function XoaDangKyTruongHopPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<CaseId | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<CaseId | null>(null);

  usePageHeader({ title: 'Xóa đăng ký tạm trú' });

  const handleCardClick = (id: CaseId) => {
    if (advancing) return;
    setSelectedId(id);
    useTamTruFlowStore.getState().setXoaDangKyCase(id);
    setAdvancing(true);
    window.setTimeout(() => {
      setActiveCaseId(id);
      setAdvancing(false);
    }, ADVANCE_DELAY_MS);
  };

  const handleHsdkSubmit = (result: TamTruHoSoDinhKemSubmit) => {
    useTamTruFlowStore.getState().setAnswers({
      variant: null,
      hasQ1: result.q1 === 'yes',
      hasQ2: result.q2 === 'yes',
    });
    setActiveCaseId(null);
    setSelectedId(null);
    navigate(result.target);
  };

  const handleHsdkDismiss = () => {
    setActiveCaseId(null);
    setSelectedId(null);
  };

  const activeConfig = activeCaseId ? HSDK_CONFIGS[activeCaseId] : null;

  return (
    <>
      <div className="tttrh-area">
        <h1 className="tttrh-title">
          Bạn thuộc <span className="tttrh-title-accent">TRƯỜNG HỢP</span> nào?
        </h1>
        <p className="tttrh-subtitle">
          Vui lòng chọn trường hợp đăng ký phù hợp để hệ thống hướng dẫn chuẩn bị hồ sơ đính kèm
        </p>

        <div className="tttrh-grid tttrh-grid--three">
          {CASES.map((c) => (
            <div
              key={c.id}
              className={`tttrh-card${selectedId === c.id ? ' tttrh-card--active' : ''}`}
              onClick={() => handleCardClick(c.id)}
            >
              <div className="tttrh-card-decor">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  {c.iconPath}
                </svg>
              </div>
              <div className="tttrh-card-icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {c.iconPath}
                </svg>
              </div>
              <h3 className="tttrh-card-title">{c.title}</h3>
              <p className="tttrh-card-desc">{c.description}</p>
            </div>
          ))}
        </div>

        <div className="tttrh-footer">
          <button
            type="button"
            className="tttrh-btn tttrh-btn--back"
            onClick={() => navigate(-1)}
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
        </div>
      </div>

      <TamTruHoSoDinhKemModal
        open={activeConfig !== null}
        onDismiss={handleHsdkDismiss}
        onSubmit={handleHsdkSubmit}
        q1Label={Q1_LABEL}
        q2Label={activeConfig?.q2Label}
        previewImage="/assets/mau-to-khai-ct01.svg"
        previewAlt="Mẫu tờ khai CT01"
        scanRoute="/scan-xoa-dang-ky"
        formRoute="/tao-ho-so-xoa-dang-ky"
      />
    </>
  );
}
