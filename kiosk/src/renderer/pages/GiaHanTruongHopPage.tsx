import '@styles/pages/tam-tru-truong-hop.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { TamTruHoSoDinhKemModal, type TamTruHoSoDinhKemSubmit } from '@components/ui';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';

type CaseId = 'gia-han-ca-nhan' | 'gia-han-danh-sach';

interface TruongHopCase {
  id: CaseId;
  title: string;
  description: string;
  iconPath: JSX.Element;
}

const CASES: TruongHopCase[] = [
  {
    id: 'gia-han-ca-nhan',
    title: 'Gia hạn tạm trú',
    description:
      'Dành cho cá nhân hoặc các thành viên trong hộ gia đình gia hạn tạm trú tại nhà riêng hoặc căn hộ thuê.',
    iconPath: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="16" y2="14" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </>
    ),
  },
  {
    id: 'gia-han-danh-sach',
    title: 'Gia hạn tạm trú theo danh sách',
    description:
      'Dành cho các cơ sở lưu trú, ký túc xá hoặc gia hạn cho một nhóm người cùng lưu trú tại một địa điểm cụ thể.',
    iconPath: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
];

interface HsdkConfig {
  q1Label: string;
  q2Label: string;
  q3Label?: string;
  previewImage: string;
  previewAlt: string;
  scanRoute: string;
  formRoute: string;
}

const HSDK_CONFIGS: Record<CaseId, HsdkConfig> = {
  'gia-han-ca-nhan': {
    q1Label: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (Mẫu CT01)',
    q2Label:
      'GIẤY GIỚI THIỆU của Thủ trưởng đơn vị quản lý trực tiếp (đối với công an nhân dân) hoặc giấy giới thiệu đăng ký thường trú của đơn vị cấp trung đoàn và tương đương trở lên (đối với quân đội nhân dân)',
    previewImage: '/assets/mau-to-khai-ct01.svg',
    previewAlt: 'Mẫu tờ khai CT01',
    scanRoute: '/scan-gia-han',
    formRoute: '/tao-ho-so-gia-han',
  },
  'gia-han-danh-sach': {
    q1Label: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (Mẫu CT01)',
    q2Label:
      'VĂN BẢN ĐỀ NGHỊ gia hạn tạm trú trong đó ghi rõ thông tin về chỗ ở hợp pháp kèm danh sách người gia hạn tạm trú',
    q3Label:
      'HỢP ĐỒNG cho thuê, cho mượn, cho ở nhờ hoặc văn bản về việc cho mượn, cho ở nhờ chỗ ở hợp pháp',
    previewImage: '/assets/mau-to-khai-ct01.svg',
    previewAlt: 'Mẫu tờ khai CT01',
    scanRoute: '/scan-gia-han-danh-sach',
    formRoute: '/tao-ho-so-gia-han-danh-sach',
  },
};

const ADVANCE_DELAY_MS = 300;

export default function GiaHanTruongHopPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<CaseId | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<CaseId | null>(null);

  usePageHeader({ title: 'Gia hạn tạm trú' });

  const handleCardClick = (id: CaseId) => {
    if (advancing) return;
    setSelectedId(id);
    setAdvancing(true);
    window.setTimeout(() => {
      setActiveCaseId(id);
      setAdvancing(false);
    }, ADVANCE_DELAY_MS);
  };

  const handleHsdkSubmit = (result: TamTruHoSoDinhKemSubmit) => {
    if (activeCaseId) {
      useTamTruFlowStore.getState().setAnswers({
        variant: activeCaseId,
        hasQ1: result.q1 === 'yes',
        hasQ2: result.q2 === 'yes',
        hasQ3: result.q3 === 'yes',
      });
    }
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

        <div className="tttrh-grid">
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
        q1Label={activeConfig?.q1Label ?? ''}
        q2Label={activeConfig?.q2Label}
        q3Label={activeConfig?.q3Label}
        previewImage={activeConfig?.previewImage}
        previewAlt={activeConfig?.previewAlt}
        scanRoute={activeConfig?.scanRoute ?? '/scan-gia-han'}
        formRoute={activeConfig?.formRoute ?? '/tao-ho-so-gia-han'}
      />
    </>
  );
}
