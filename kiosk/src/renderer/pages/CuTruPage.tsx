import '@styles/pages/cu-tru.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { LuuTruHoSoModal } from '@components/ui';

interface SubService {
  id: string;
  title: string;
  iconPath: JSX.Element;
}

const SUB_SERVICES: SubService[] = [
  {
    id: 'tam-vang',
    title: 'Tạm vắng',
    iconPath: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="17" y1="8" x2="23" y2="8" />
      </>
    ),
  },
  {
    id: 'tam-tru',
    title: 'Tạm trú',
    iconPath: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
  {
    id: 'luu-tru',
    title: 'Lưu trú',
    iconPath: (
      <>
        <rect x="2" y="3" width="20" height="18" rx="2" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h4" />
      </>
    ),
  },
  {
    id: 'ho-khau',
    title: 'Hộ khẩu',
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
    id: 'ho-chieu',
    title: 'Hộ chiếu',
    iconPath: (
      <>
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M16 10a4 4 0 0 1-8 0" />
        <line x1="3" y1="6" x2="21" y2="6" />
      </>
    ),
  },
  {
    id: 'cccd',
    title: 'Căn cước công dân',
    iconPath: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <circle cx="9" cy="11" r="2.5" />
        <path d="M5 18c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5" />
        <line x1="15" y1="9" x2="19" y2="9" />
        <line x1="15" y1="13" x2="19" y2="13" />
      </>
    ),
  },
];

export default function CuTruPage() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [luuTruOpen, setLuuTruOpen] = useState(false);

  usePageHeader({ title: 'Cư trú & Giấy tờ' });

  const handleCardClick = (id: string) => {
    setActiveId(id);
    if (id === 'tam-vang') {
      window.setTimeout(() => navigate('/xac-dinh-doi-tuong'), 400);
    } else if (id === 'luu-tru') {
      window.setTimeout(() => setLuuTruOpen(true), 400);
    } else if (id === 'tam-tru') {
      window.setTimeout(() => navigate('/tam-tru-thu-tuc'), 400);
    } else if (id === 'ho-khau') {
      window.setTimeout(() => navigate('/ho-khau-truong-hop'), 400);
    }
  };

  const handleLuuTruSubmit = (answer: 'yes' | 'no') => {
    setLuuTruOpen(false);
    setActiveId(null);
    navigate(answer === 'no' ? '/tao-thong-bao-luu-tru' : '/scan-luu-tru');
  };

  return (
    <>
      <div className="cutru-area">
        <h1 className="cutru-heading">Cư trú và Giấy tờ tùy thân</h1>
        <div className="cutru-grid">
          {SUB_SERVICES.map((s) => (
            <div
              key={s.id}
              className={`cutru-card${activeId === s.id ? ' cutru-card-active' : ''}`}
              onClick={() => handleCardClick(s.id)}
            >
              <div className="cutru-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {s.iconPath}
                </svg>
              </div>
              <h3 className="cutru-card-title">{s.title}</h3>
              <a href="#" className="cutru-explore-link" onClick={(e) => e.preventDefault()}>
                <span>Khám phá dịch vụ</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
          ))}
        </div>

        <div className="cutru-footer">
          <button
            className="cutru-btn cutru-btn--back"
            onClick={() => window.history.back()}
            aria-label="Quay lại"
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

      <LuuTruHoSoModal
        open={luuTruOpen}
        onDismiss={() => {
          setLuuTruOpen(false);
          setActiveId(null);
        }}
        onSubmit={handleLuuTruSubmit}
      />
    </>
  );
}
