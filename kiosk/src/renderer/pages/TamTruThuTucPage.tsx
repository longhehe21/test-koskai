import '@styles/pages/tam-tru-doi-tuong.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';
import { useAiNavigator } from '@hooks/useAiNavigator';

type ThuTucId = 'dang-ky' | 'gia-han' | 'xoa-dang-ky';

interface ThuTucCase {
  id: ThuTucId;
  title: string;
  iconPath: JSX.Element;
}

const CASES: ThuTucCase[] = [
  {
    id: 'dang-ky',
    title: 'Đăng ký tạm trú',
    iconPath: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </>
    ),
  },
  {
    id: 'gia-han',
    title: 'Gia hạn tạm trú',
    iconPath: (
      <>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
        <path d="M21 3v5h-5" />
      </>
    ),
  },
  {
    id: 'xoa-dang-ky',
    title: 'Xóa đăng ký tạm trú',
    iconPath: (
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      </>
    ),
  },
];

const ADVANCE_DELAY_MS = 300;

export default function TamTruThuTucPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<ThuTucId | null>(null);
  const [advancing, setAdvancing] = useState(false);

  usePageHeader({ title: 'Tạm trú' });

  useAiNavigator({
    options: [
      { id: 'dang-ky',    label: 'Đăng ký tạm trú',     keywords: ['đăng ký', 'đăng ki', 'đăng kí', 'mới'] },
      { id: 'gia-han',    label: 'Gia hạn tạm trú',      keywords: ['gia hạn', 'gia han', 'hạn', 'gia hận'] },
      { id: 'xoa-dang-ky', label: 'Xóa đăng ký tạm trú', keywords: ['xóa', 'xoa', 'hủy', 'huy', 'xoá'] },
    ],
    greeting: 'Anh muốn thực hiện thủ tục gì ạ? Đăng ký mới, gia hạn, hay xóa đăng ký tạm trú?',
    onSelect: (id) => handleCardClick(id as ThuTucId),
  });

  const handleCardClick = (id: ThuTucId) => {
    if (advancing) return;
    setSelectedId(id);
    if (id === 'dang-ky') {
      useTamTruFlowStore.getState().setThuTuc('dang-ky');
      setAdvancing(true);
      window.setTimeout(() => {
        navigate('/tam-tru-truong-hop');
        setAdvancing(false);
      }, ADVANCE_DELAY_MS);
    } else if (id === 'gia-han') {
      useTamTruFlowStore.getState().setThuTuc('gia-han');
      setAdvancing(true);
      window.setTimeout(() => {
        navigate('/gia-han-truong-hop');
        setAdvancing(false);
      }, ADVANCE_DELAY_MS);
    } else if (id === 'xoa-dang-ky') {
      useTamTruFlowStore.getState().setThuTuc('xoa-dang-ky');
      setAdvancing(true);
      window.setTimeout(() => {
        navigate('/xoa-dang-ky-truong-hop');
        setAdvancing(false);
      }, ADVANCE_DELAY_MS);
    }
  };

  return (
    <div className="ttdt-area">
      <h1 className="ttdt-title">Thủ tục tạm trú</h1>
      <p className="ttdt-subtitle">
        Vui lòng chọn thủ tục bạn muốn thực hiện để hệ thống hướng dẫn các bước tiếp theo.
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
            <h3 className="ttdt-card-title">{c.title}</h3>
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
  );
}
