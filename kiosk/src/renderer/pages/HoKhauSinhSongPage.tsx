import '@styles/pages/ho-khau-sinh-song.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { HoSoDinhKemModal, type HoSoDinhKemSubmit } from '@components/ui';
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';

interface SinhSongCase {
  id: 'trong-nuoc' | 'nuoc-ngoai';
  title: string;
  desc: string;
  iconPath: JSX.Element;
}

const CASES: SinhSongCase[] = [
  {
    id: 'trong-nuoc',
    title: 'Người Việt Nam đang sinh sống trong nước',
    desc: 'Công dân Việt Nam có hộ khẩu thường trú hoặc tạm trú tại các tỉnh thành trong lãnh thổ Việt Nam.',
    iconPath: (
      <>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    id: 'nuoc-ngoai',
    title: 'Người Việt Nam định cư ở nước ngoài (về Việt Nam sinh sống)',
    desc: 'Công dân Việt Nam định cư tại nước ngoài, nay có nhu cầu hồi hương và đăng ký cư trú tại Việt Nam.',
    iconPath: (
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    ),
  },
];

/** Resolve branch key từ origin (hkss-origin sessionStorage) × VN/VK. */
function resolveType(originId: string | null, vnvk: 'trong-nuoc' | 'nuoc-ngoai'): string {
  const vn = vnvk === 'trong-nuoc';
  switch (originId) {
    case 'khong-so-huu':
      return vn ? 'khong-so-huu-vn' : 'khong-so-huu-vk';
    case 'thue-muon-o-nho':
      return vn ? 'thue-muon-o-nho-vn' : 'thue-muon-o-nho-vk';
    case 'ton-giao-chuc-sac':
      return vn ? 'ton-giao-chuc-sac-vn' : 'ton-giao-chuc-sac-vk';
    case 'ton-giao-nuong-tua':
      return vn ? 'ton-giao-nuong-tua-vn' : 'ton-giao-nuong-tua-vk';
    case 'tro-giup-xa-hoi':
      return vn ? 'tro-giup-xa-hoi-vn' : 'tro-giup-xa-hoi-vk';
    case 'phuong-tien':
      return vn ? 'phuong-tien-vn' : 'phuong-tien-vk';
    default:
      // origin null = so-huu card: branch default 'trong-nuoc' | 'nuoc-ngoai'.
      return vnvk;
  }
}

const ADVANCE_DELAY_MS = 300;

export default function HoKhauSinhSongPage() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [branchKey, setBranchKey] = useState<string>('');
  const [advancing, setAdvancing] = useState(false);

  usePageHeader({ title: 'Hộ khẩu' });

  const handleCardClick = (id: 'trong-nuoc' | 'nuoc-ngoai') => {
    if (advancing) return;
    setActiveId(id);
    setAdvancing(true);
    window.setTimeout(() => {
      const flow = useHoKhauFlowStore.getState();
      const key = resolveType(flow.origin, id);
      flow.setType(key);
      setBranchKey(key);
      setModalOpen(true);
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
      <div className="hkss-area">
        <h1 className="hkss-title">
          Bạn thuộc <span className="hkss-title-accent">TRƯỜNG HỢP</span> nào?
        </h1>
        <p className="hkss-subtitle">
          Vui lòng chọn trường hợp đăng ký phù hợp để hệ thống hướng dẫn chuẩn bị hồ sơ đính kèm
        </p>

        <div className="hkss-grid">
          {CASES.map((c) => (
            <div
              key={c.id}
              className={`hkss-card${activeId === c.id ? ' hkss-card--active' : ''}`}
              onClick={() => handleCardClick(c.id)}
            >
              <div className="hkss-card-check">
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
              <div className="hkss-card-icon">
                <svg
                  width="28"
                  height="28"
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
              <h3 className="hkss-card-title">{c.title}</h3>
              <p className="hkss-card-desc">{c.desc}</p>
            </div>
          ))}
        </div>

        <div className="hkss-footer">
          <button className="hkss-btn hkss-btn--back" onClick={() => navigate(-1)}>
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
