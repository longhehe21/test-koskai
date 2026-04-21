import '@styles/pages/tam-tru-doi-tuong.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { TamTruHoSoDinhKemModal, type TamTruHoSoDinhKemSubmit } from '@components/ui';
import { DANH_SACH_TAM_TRU_BODY } from './xem-truoc-ho-so/docBodies';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';

type HsdkVariant =
  | 'thuoc-so-huu'
  | 'khong-thuoc-so-huu'
  | 'quan-doi-cong-an'
  | 'phuong-tien'
  | 'thue-muon-o-nho';

interface HsdkConfig {
  q1Label: string;
  q2Label?: string;
  q3Label?: string;
  previewHTML?: string;
  previewImage?: string;
  previewAlt?: string;
  scanRoute: string;
}

// formRoute phụ thuộc flow (truongHop), scanRoute phụ thuộc variant (case).
const HSDK_CONFIGS: Record<HsdkVariant, HsdkConfig> = {
  'thuoc-so-huu': {
    q1Label: 'Danh sách công dân đăng ký tạm trú',
    previewHTML: DANH_SACH_TAM_TRU_BODY,
    scanRoute: '/scan-tam-tru',
  },
  'khong-thuoc-so-huu': {
    q1Label: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (Mẫu CT01)',
    previewImage: '/assets/mau-to-khai-ct01.svg',
    previewAlt: 'Mẫu tờ khai CT01',
    scanRoute: '/scan-tam-tru-ct01',
  },
  'quan-doi-cong-an': {
    q1Label: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (Mẫu CT01)',
    q2Label:
      'GIẤY GIỚI THIỆU của Thủ trưởng đơn vị quản lý trực tiếp ghi rõ nội dung để làm thủ tục đăng ký tạm trú và đơn vị có chỗ ở cho cán bộ chiến sĩ',
    previewImage: '/assets/mau-to-khai-ct01.svg',
    previewAlt: 'Mẫu tờ khai CT01',
    scanRoute: '/scan-tam-tru-quan-doi',
  },
  'phuong-tien': {
    q1Label: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (Mẫu CT01)',
    q2Label:
      'VĂN BẢN XÁC NHẬN của Ủy ban nhân dân cấp xã về địa điểm phương tiện đăng ký đậu, đỗ thường xuyên',
    q3Label:
      'GIẤY CHỨNG NHẬN ĐĂNG KÝ PHƯƠNG TIỆN và giấy chứng nhận an toàn kỹ thuật & bảo vệ môi trường (hoặc văn bản xác nhận của UBND cấp xã về việc sử dụng phương tiện đó vào mục đích để ở đối với phương tiện không thuộc đối tượng phải đăng ký, đăng kiểm)',
    previewImage: '/assets/mau-to-khai-ct01.svg',
    previewAlt: 'Mẫu tờ khai CT01',
    scanRoute: '/scan-tam-tru-phuong-tien',
  },
  'thue-muon-o-nho': {
    q1Label: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (Mẫu CT01)',
    q2Label:
      'HỢP ĐỒNG cho thuê, cho mượn, cho ở nhờ hoặc văn bản về việc cho mượn, cho ở nhờ chỗ ở hợp pháp',
    previewImage: '/assets/mau-to-khai-ct01.svg',
    previewAlt: 'Mẫu tờ khai CT01',
    scanRoute: '/scan-tam-tru-thue-muon',
  },
};

type DoiTuongId =
  | 'quan-doi-cong-an'
  | 'thuoc-so-huu'
  | 'khong-thuoc-so-huu'
  | 'phuong-tien'
  | 'thue-muon-o-nho';

interface DoiTuongCase {
  id: DoiTuongId;
  title: string;
  iconPath: JSX.Element;
}

const CASES: DoiTuongCase[] = [
  {
    id: 'quan-doi-cong-an',
    title: 'Quân đội hoặc\ncông an',
    iconPath: (
      <>
        <circle cx="12" cy="8" r="5" />
        <path d="M8.21 13.89 7 22l5-3 5 3-1.21-8.12" />
      </>
    ),
  },
  {
    id: 'thuoc-so-huu',
    title: 'Thuộc sở hữu\nmình',
    iconPath: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
  {
    id: 'khong-thuoc-so-huu',
    title: 'Không thuộc sở\nhữu mình',
    iconPath: (
      <>
        <rect x="4" y="2" width="16" height="20" rx="1.5" />
        <line x1="9" y1="6" x2="9" y2="6.01" />
        <line x1="15" y1="6" x2="15" y2="6.01" />
        <line x1="9" y1="10" x2="9" y2="10.01" />
        <line x1="15" y1="10" x2="15" y2="10.01" />
        <line x1="9" y1="14" x2="9" y2="14.01" />
        <line x1="15" y1="14" x2="15" y2="14.01" />
        <path d="M10 22v-4h4v4" />
      </>
    ),
  },
  {
    id: 'phuong-tien',
    title: 'Phương tiện',
    iconPath: (
      <>
        <path d="M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10" />
        <path d="M2 16h20v2a2 2 0 0 1-2 2h-1v1a1 1 0 0 1-2 0v-1H7v1a1 1 0 0 1-2 0v-1H4a2 2 0 0 1-2-2z" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <circle cx="7" cy="18" r="1" />
        <circle cx="17" cy="18" r="1" />
      </>
    ),
  },
  {
    id: 'thue-muon-o-nho',
    title: 'Thuê, mượn, ở nhờ',
    iconPath: (
      <>
        <rect x="4" y="2" width="16" height="20" rx="1.5" />
        <line x1="9" y1="6" x2="9" y2="6.01" />
        <line x1="15" y1="6" x2="15" y2="6.01" />
        <line x1="9" y1="10" x2="9" y2="10.01" />
        <line x1="15" y1="10" x2="15" y2="10.01" />
        <line x1="9" y1="14" x2="9" y2="14.01" />
        <line x1="15" y1="14" x2="15" y2="14.01" />
        <path d="M10 22v-4h4v4" />
      </>
    ),
  },
];

const ADVANCE_DELAY_MS = 300;

export default function TamTruDoiTuongPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<DoiTuongId | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [hsdkVariant, setHsdkVariant] = useState<HsdkVariant | null>(null);
  const truongHopFromFlow = useTamTruFlowStore((s) => s.truongHop);
  const formRoute =
    truongHopFromFlow === 'nhan-khau-ho'
      ? '/tao-ho-so-tam-tru-nhan-khau-ho'
      : '/tao-ho-so-tam-tru-danh-sach';

  usePageHeader({ title: 'Tạm trú' });

  const openHsdk = (variant: HsdkVariant) => {
    setAdvancing(true);
    window.setTimeout(() => {
      setHsdkVariant(variant);
      setAdvancing(false);
    }, ADVANCE_DELAY_MS);
  };

  const handleCardClick = (id: DoiTuongId) => {
    if (advancing) return;
    setSelectedId(id);
    if (id === 'thuoc-so-huu') openHsdk('thuoc-so-huu');
    else if (id === 'khong-thuoc-so-huu') openHsdk('khong-thuoc-so-huu');
    else if (id === 'quan-doi-cong-an') openHsdk('quan-doi-cong-an');
    else if (id === 'phuong-tien') openHsdk('phuong-tien');
    else if (id === 'thue-muon-o-nho') openHsdk('thue-muon-o-nho');
  };

  const handleHsdkSubmit = (result: TamTruHoSoDinhKemSubmit) => {
    if (hsdkVariant) {
      useTamTruFlowStore.getState().setAnswers({
        variant: hsdkVariant,
        hasQ1: result.q1 === 'yes',
        hasQ2: result.q2 === 'yes',
        hasQ3: result.q3 === 'yes',
      });
    }
    setHsdkVariant(null);
    setSelectedId(null);
    navigate(result.target);
  };

  const handleHsdkDismiss = () => {
    setHsdkVariant(null);
    setSelectedId(null);
  };

  const activeHsdkConfig = hsdkVariant ? HSDK_CONFIGS[hsdkVariant] : null;

  return (
    <>
      <div className="ttdt-area">
        <h1 className="ttdt-title">Xác định đối tượng tạm trú</h1>
      <p className="ttdt-subtitle">
        Vui lòng chọn trường hợp đăng ký phù hợp để hệ thống hướng dẫn chuẩn bị hồ sơ đính kèm.
      </p>

      <div className="ttdt-grid">
        {CASES.map((c) => (
          <div
            key={c.id}
            className={`ttdt-card${selectedId === c.id ? ' ttdt-card--active' : ''}`}
            onClick={() => handleCardClick(c.id)}
          >
            <div className="ttdt-card-check">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6l2.5 2.5L9.5 3.5"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="ttdt-card-icon">
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
            <h3 className="ttdt-card-title">
              {c.title.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  {i < c.title.split('\n').length - 1 && <br />}
                </span>
              ))}
            </h3>
          </div>
        ))}
      </div>

      <div className="ttdt-footer">
        <button
          type="button"
          className="ttdt-btn ttdt-btn--back"
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
        open={activeHsdkConfig !== null}
        onDismiss={handleHsdkDismiss}
        onSubmit={handleHsdkSubmit}
        q1Label={activeHsdkConfig?.q1Label ?? ''}
        q2Label={activeHsdkConfig?.q2Label}
        q3Label={activeHsdkConfig?.q3Label}
        previewHTML={activeHsdkConfig?.previewHTML}
        previewImage={activeHsdkConfig?.previewImage}
        previewAlt={activeHsdkConfig?.previewAlt}
        scanRoute={activeHsdkConfig?.scanRoute ?? '/scan-tam-tru'}
        formRoute={formRoute}
      />
    </>
  );
}
