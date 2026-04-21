import '@styles/pages/tam-tru-truong-hop.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';

type CaseId = 'theo-danh-sach' | 'nhan-khau-ho';

interface TruongHopCase {
  id: CaseId;
  title: string;
  description: string;
  iconPath: JSX.Element;
}

const CASES: TruongHopCase[] = [
  {
    id: 'theo-danh-sach',
    title: 'Đăng ký tạm trú theo danh sách',
    description:
      'Dành cho các cơ sở lưu trú, ký túc xá hoặc đăng ký cho một nhóm người cùng lưu trú tại một địa điểm cụ thể.',
    iconPath: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    id: 'nhan-khau-ho',
    title: 'Đăng ký tạm trú (Nhân khẩu hộ)',
    description:
      'Dành cho cá nhân hoặc các thành viên trong hộ gia đình đăng ký lưu trú tại nhà riêng hoặc căn hộ thuê.',
    iconPath: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
];

const ADVANCE_DELAY_MS = 300;

export default function TamTruTruongHopPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<CaseId | null>(null);
  const [advancing, setAdvancing] = useState(false);

  usePageHeader({ title: 'Tạm trú' });

  const handleCardClick = (id: CaseId) => {
    if (advancing) return;
    setSelectedId(id);
    useTamTruFlowStore.getState().setTruongHop(id);
    setAdvancing(true);
    window.setTimeout(() => {
      navigate('/tam-tru-doi-tuong');
      setAdvancing(false);
    }, ADVANCE_DELAY_MS);
  };

  return (
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
  );
}
