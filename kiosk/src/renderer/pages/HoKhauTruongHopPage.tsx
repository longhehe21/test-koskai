import '@styles/pages/ho-khau-truong-hop.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { HoSoDinhKemModal, type HoSoDinhKemSubmit } from '@components/ui';
import { useHoKhauFlowStore, type HoKhauOrigin } from '@store/hoKhauFlowStore';

interface TruongHopCase {
  id: string;
  titleLines: string[];
  iconPath: JSX.Element;
}

const CASES: TruongHopCase[] = [
  {
    id: 'quan-doi-cong-an',
    titleLines: ['Quân đội hoặc', 'Công an'],
    iconPath: (
      <>
        <circle cx="12" cy="8" r="5" />
        <path d="M8.21 13.89 7 22l5-3 5 3-1.21-8.12" />
      </>
    ),
  },
  {
    id: 'so-huu',
    titleLines: ['Chỗ ở thuộc quyền sở', 'hữu của mình'],
    iconPath: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
  {
    id: 'khong-so-huu',
    titleLines: ['Chỗ ở không thuộc', 'quyền sở hữu của mình'],
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
    id: 'thue-muon-o-nho',
    titleLines: ['Thuê, mượn, ở nhờ'],
    iconPath: (
      <>
        <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </>
    ),
  },
  {
    id: 'ton-giao-chuc-sac',
    titleLines: ['Cơ sở tín ngưỡng/tôn giáo', '(chức sắc, người đại diện)'],
    iconPath: (
      <>
        <path d="M3 22V10l9-6 9 6v12" />
        <path d="M3 22h18" />
        <path d="M10 22v-6h4v6" />
        <path d="M7 12v2" />
        <path d="M17 12v2" />
      </>
    ),
  },
  {
    id: 'ton-giao-nuong-tua',
    titleLines: [
      'Cơ sở tín ngưỡng/tôn giáo',
      '(trẻ em, người khuyết tật,',
      'không nơi nương tựa)',
    ],
    iconPath: (
      <>
        <path d="M3 22V10l9-6 9 6v12" />
        <path d="M3 22h18" />
        <path d="M10 22v-6h4v6" />
        <path d="M7 12v2" />
        <path d="M17 12v2" />
      </>
    ),
  },
  {
    id: 'tro-giup-xa-hoi',
    titleLines: ['Cơ sở trợ giúp xã hội', 'hoặc hộ gia đình nhận chăm sóc'],
    iconPath: (
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    ),
  },
  {
    id: 'phuong-tien',
    titleLines: ['Phương tiện', '(người sinh sống/làm nghề lưu động)'],
    iconPath: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </>
    ),
  },
];

const ADVANCE_DELAY_MS = 300;

export default function HoKhauTruongHopPage() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [branchKey, setBranchKey] = useState<string>('');

  usePageHeader({ title: 'Hộ khẩu' });

  const handleCardClick = (id: string) => {
    if (advancing) return;
    setActiveId(id);
    setAdvancing(true);
    window.setTimeout(() => {
      const flow = useHoKhauFlowStore.getState();
      if (id === 'so-huu') {
        flow.setOrigin(null);
        navigate('/ho-khau-sinh-song');
      } else if (
        id === 'khong-so-huu' ||
        id === 'thue-muon-o-nho' ||
        id === 'ton-giao-chuc-sac' ||
        id === 'ton-giao-nuong-tua' ||
        id === 'tro-giup-xa-hoi' ||
        id === 'phuong-tien'
      ) {
        flow.setOrigin(id as HoKhauOrigin);
        navigate('/ho-khau-sinh-song');
      } else if (id === 'quan-doi-cong-an') {
        flow.setType('quan-doi-cong-an');
        setBranchKey('quan-doi-cong-an');
        setModalOpen(true);
      }
      setAdvancing(false);
    }, ADVANCE_DELAY_MS);
  };

  const handleModalSubmit = (result: HoSoDinhKemSubmit) => {
    setModalOpen(false);
    setActiveId(null);
    navigate(result.target);
  };

  return (
    <>
      <div className="hktrh-area">
        <h1 className="hktrh-title">
          Bạn thuộc <span className="hktrh-title-accent">TRƯỜNG HỢP</span> nào?
        </h1>
        <p className="hktrh-subtitle">
          Vui lòng chọn trường hợp đăng ký phù hợp để hệ thống hướng dẫn chuẩn bị hồ sơ đính kèm
        </p>

        <div className="hktrh-grid">
          {CASES.map((c) => (
            <div
              key={c.id}
              className={`hktrh-card${activeId === c.id ? ' hktrh-card--active' : ''}`}
              onClick={() => handleCardClick(c.id)}
            >
              <div className="hktrh-card-check">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6l2.5 2.5L9.5 3.5"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="hktrh-card-icon">
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
              <h3 className="hktrh-card-title">
                {c.titleLines.map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < c.titleLines.length - 1 && <br />}
                  </span>
                ))}
              </h3>
            </div>
          ))}
        </div>

        <div className="hktrh-footer">
          <button className="hktrh-btn hktrh-btn--back" onClick={() => navigate(-1)}>
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

      <HoSoDinhKemModal
        open={modalOpen}
        branchKey={branchKey}
        onDismiss={() => {
          setModalOpen(false);
          setActiveId(null);
        }}
        onSubmit={handleModalSubmit}
      />
    </>
  );
}
