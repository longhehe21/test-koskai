import '@styles/pages/services.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';

interface Service {
  id: string;
  title: string;
  desc: string;
  color: string;
  stroke: string;
  iconPath: JSX.Element;
}

const SERVICES: Service[] = [
  {
    id: 'co-con-nho',
    title: 'Có con nhỏ',
    desc: 'Các thủ tục liên quan đến chăm sóc trẻ em',
    color: '#fee2e2',
    stroke: '#ef4444',
    iconPath: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </>
    ),
  },
  {
    id: 'hoc-tap',
    title: 'Học tập',
    desc: 'Dịch vụ giáo dục và đào tạo',
    color: '#dcfce7',
    stroke: '#22c55e',
    iconPath: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
  },
  {
    id: 'viec-lam',
    title: 'Việc làm',
    desc: 'Tìm kiếm và quản lý thông tin nghề nghiệp',
    color: '#fef3c7',
    stroke: '#d97706',
    iconPath: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </>
    ),
  },
  {
    id: 'hon-nhan',
    title: 'Hôn nhân & Gia đình',
    desc: 'Đăng ký kết hôn và hộ tịch',
    color: '#f3e8ff',
    stroke: '#9333ea',
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
    id: 'cu-tru',
    title: 'Cư trú & Giấy tờ',
    desc: 'Thủ tục cư trú và cấp giấy tờ cá nhân',
    color: '#dbeafe',
    stroke: '#3b82f6',
    iconPath: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
  {
    id: 'suc-khoe',
    title: 'Sức khỏe & Y tế',
    desc: 'Khám chữa bệnh và bảo hiểm',
    color: '#fee2e2',
    stroke: '#ef4444',
    iconPath: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  },
  {
    id: 'dien-nha-dat',
    title: 'Điện lực, Nhà ở & Đất đai',
    desc: 'Thủ tục sở hữu và quản lý bất động sản và điện năng',
    color: '#ffedd5',
    stroke: '#f97316',
    iconPath: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
  {
    id: 'huu-tri',
    title: 'Hưu trí',
    desc: 'Chế độ và quyền lợi người cao tuổi',
    color: '#e0e7ff',
    stroke: '#4f46e5',
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
    id: 'phuong-tien',
    title: 'Phương tiện và người lái',
    desc: 'Quản lý xe, bằng lái và người lái',
    color: '#e0e7ff',
    stroke: '#6366f1',
    iconPath: (
      <>
        <rect x="1" y="6" width="15" height="12" rx="2" />
        <path d="M16 10l4-2v8l-4-2" />
      </>
    ),
  },
  {
    id: 'khai-tu',
    title: 'Khai tử',
    desc: 'Thủ tục khi người thân qua đời',
    color: '#fce7f3',
    stroke: '#db2777',
    iconPath: (
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    ),
  },
  {
    id: 'khieu-kien',
    title: 'Khiếu kiện',
    desc: 'Giải quyết khiếu nại tố cáo',
    color: '#e0e7ff',
    stroke: '#4338ca',
    iconPath: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </>
    ),
  },
];

export default function ServicesPage() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);

  usePageHeader({ title: 'Dịch vụ công dân' });

  const handleClick = (id: string) => {
    setActiveId(id);
    if (id === 'cu-tru') {
      window.setTimeout(() => navigate('/cu-tru'), 200);
    }
  };

  return (
    <div className="services-area">
      <h1 className="services-heading">Danh sách dịch vụ Công dân</h1>
      <div className="services-grid">
        {SERVICES.map((s) => {
          const style = {
            '--icon-bg': s.color,
            '--icon-stroke': s.stroke,
          } as React.CSSProperties;
          return (
            <button
              key={s.id}
              className={`service-card${activeId === s.id ? ' service-card-active' : ''}`}
              style={style}
              onClick={() => handleClick(s.id)}
            >
              <div className="service-icon">
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
              <div className="service-info">
                <span className="service-title">{s.title}</span>
                <span className="service-desc">{s.desc}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
