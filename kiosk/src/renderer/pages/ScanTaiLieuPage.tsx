import '@styles/pages/scan-tai-lieu.css';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';

interface ScanPage {
  name: string;
  image?: string;
}

interface ScanConfig {
  docImage: string;
  docLabel: string;
  pageTitle: string;
  nextRoute: string;
  pages: ScanPage[];
}

const CT02_BRANCHES = new Set([
  'nuoc-ngoai',
  'khong-so-huu-vk',
  'thue-muon-o-nho-vk',
  'ton-giao-chuc-sac-vk',
  'ton-giao-nuong-tua-vk',
  'tro-giup-xa-hoi-vk',
  'phuong-tien-vk',
]);

const BRANCHES_WITH_Q3 = new Set([
  'ton-giao-chuc-sac-vn',
  'ton-giao-chuc-sac-vk',
  'tro-giup-xa-hoi-vn',
  'tro-giup-xa-hoi-vk',
  'phuong-tien-vn',
  'phuong-tien-vk',
]);

const STATIC_CONFIGS: Record<string, ScanConfig> = {
  '/scan-tam-vang': {
    docImage: '/assets/mauct03khaibaotamvang.svg',
    docLabel: 'Mẫu CT03',
    pageTitle: 'Quét tài liệu – Tạm vắng',
    nextRoute: '/xem-truoc-tam-vang',
    pages: [
      { name: 'Tài liệu CT03' },
      { name: 'Tài liệu CT03' },
      { name: 'Văn bản đồng ý' },
    ],
  },
  '/scan-luu-tru': {
    docImage: '/assets/mau-luu-tru.svg',
    docLabel: 'Mẫu xác nhận lưu trú',
    pageTitle: 'Quét tài liệu – Lưu trú',
    nextRoute: '/xem-truoc-luu-tru',
    pages: [
      { name: 'Xác nhận lưu trú' },
      { name: 'Xác nhận lưu trú' },
    ],
  },
  '/scan-tam-tru': {
    docImage: '/assets/mau-tam-tru.svg',
    docLabel: 'Mẫu đăng ký tạm trú',
    pageTitle: 'Quét tài liệu – Tạm trú',
    nextRoute: '/xem-truoc-tam-tru',
    pages: [
      { name: 'Đăng ký tạm trú' },
      { name: 'Giấy tờ chứng minh chỗ ở' },
    ],
  },
};

/** Build cfg động cho /scan-ho-khau dựa vào hoKhauFlowStore (set bởi HoSoDinhKemModal). */
function buildHoKhauCfg(): ScanConfig {
  const flow = useHoKhauFlowStore.getState();
  const userHasForm = flow.hsdkTc01 !== '0';
  const userHasQ2 = flow.hsdkSoHuu !== '0';
  const userHasQ3 = flow.hsdkQ3 !== '0';
  const branch = flow.type;
  const isNuocNgoai = CT02_BRANCHES.has(branch);
  const isQuanDoi = branch === 'quan-doi-cong-an';
  const isTonGiaoChucSac = branch === 'ton-giao-chuc-sac-vn' || branch === 'ton-giao-chuc-sac-vk';
  const isTonGiaoNuongTua = branch === 'ton-giao-nuong-tua-vn' || branch === 'ton-giao-nuong-tua-vk';
  const isTroGiupXaHoi = branch === 'tro-giup-xa-hoi-vn' || branch === 'tro-giup-xa-hoi-vk';
  const isPhuongTien = branch === 'phuong-tien-vn' || branch === 'phuong-tien-vk';
  const branchHasQ3 = BRANCHES_WITH_Q3.has(branch);

  const formPages: ScanPage[] = isNuocNgoai
    ? [
        { name: 'Tài liệu CT02 - Mặt trước', image: '/assets/mẫu cư trú ct02 mặt trước.svg' },
        { name: 'Tài liệu CT02 - Mặt sau', image: '/assets/mẫu cư trú ct02 mặt sau.svg' },
        { name: 'Tài liệu CT02 - Chú thích', image: '/assets/mẫu cư trú ct02 chú thích.svg' },
      ]
    : [
        { name: 'Tài liệu TC01 - Mặt trước', image: '/assets/mẫu test tờ khai cư trú mặt trước.svg' },
        { name: 'Tài liệu TC01 - Mặt sau', image: '/assets/mẫu test tờ khai cứ trú mặt sau.svg' },
      ];

  let secondDocName = 'Giấy CN quyền sử dụng đất';
  let secondShort = 'Giấy CN QSDĐ';
  if (isQuanDoi) {
    secondDocName = 'Giấy giới thiệu của thủ trưởng đơn vị';
    secondShort = 'Giấy giới thiệu';
  } else if (isTonGiaoChucSac) {
    secondDocName = 'Giấy tờ chứng minh là chức sắc/người đại diện cơ sở';
    secondShort = 'Giấy tờ chức sắc';
  } else if (isTonGiaoNuongTua) {
    secondDocName = 'Xác nhận của UBND cấp xã về đối tượng và chỗ ở phụ trợ';
    secondShort = 'UBND xác nhận';
  } else if (isTroGiupXaHoi) {
    secondDocName = 'Văn bản đề nghị của người đứng đầu cơ sở trợ giúp xã hội';
    secondShort = 'Văn bản đề nghị';
  } else if (isPhuongTien) {
    secondDocName = 'Giấy đăng ký + đăng kiểm phương tiện';
    secondShort = 'Giấy đăng kiểm';
  }

  let thirdDocName = 'Xác nhận của UBND cấp xã về chỗ ở phụ trợ tại cơ sở';
  if (isTroGiupXaHoi) thirdDocName = 'Giấy tờ xác nhận việc chăm sóc/nuôi dưỡng';
  else if (isPhuongTien) thirdDocName = 'Xác nhận của UBND cấp xã về địa điểm đậu đỗ thường xuyên';

  type WithKeep = ScanPage & { keep: boolean };
  const allPages: WithKeep[] = [
    ...formPages.map((p) => ({ ...p, keep: userHasForm })),
    {
      name: secondDocName,
      image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      keep: userHasQ2,
    },
    ...(branchHasQ3
      ? [
          {
            name: thirdDocName,
            image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
            keep: userHasQ3,
          },
        ]
      : []),
  ];
  const pages = allPages.filter((p) => p.keep).map(({ name, image }) => ({ name, image }));

  const formLabel = isNuocNgoai ? 'Mẫu CT02' : 'Mẫu TC01';
  const fallbackPages: ScanPage[] = [
    { name: 'Tài liệu TC01 - Mặt trước', image: '/assets/mẫu test tờ khai cư trú mặt trước.svg' },
    { name: 'Tài liệu TC01 - Mặt sau', image: '/assets/mẫu test tờ khai cứ trú mặt sau.svg' },
    { name: 'Giấy CN quyền sử dụng đất', image: '/assets/giấy chứng nhận quyền sử dụng đất.svg' },
  ];

  return {
    docImage: pages[0]?.image ?? '/assets/mẫu test tờ khai cư trú mặt trước.svg',
    docLabel: userHasForm ? formLabel : secondShort,
    pageTitle: 'Quét tài liệu – Hộ khẩu',
    nextRoute: '/xem-truoc-ho-khau',
    pages: pages.length ? pages : fallbackPages,
  };
}

export default function ScanTaiLieuPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const cfg = useMemo<ScanConfig>(() => {
    if (location.pathname === '/scan-ho-khau') return buildHoKhauCfg();
    return STATIC_CONFIGS[location.pathname] ?? STATIC_CONFIGS['/scan-tam-vang'];
  }, [location.pathname]);

  usePageHeader({ title: cfg.pageTitle });

  return (
    <div className="scan-tl-area">
      <div className="scan-tl-body">
        <div className="scan-tl-left">
          <div className="scan-tl-camera">
            <img src={cfg.docImage} alt={cfg.docLabel} className="scan-tl-doc-img" />
            <div className="scan-tl-line" />
          </div>
        </div>

        <div className="scan-tl-right">
          <div className="scan-tl-list-header">
            <h3 className="scan-tl-list-title">Danh sách ảnh đã scan</h3>
            <span className="scan-tl-list-badge">{cfg.pages.length} trang</span>
          </div>
          <div className="scan-tl-list">
            {cfg.pages.map((p, i) => (
              <div key={i} className="scan-tl-thumb">
                <div className="scan-tl-thumb-img">
                  <img src={p.image ?? cfg.docImage} alt={`Trang ${i + 1}`} />
                </div>
                <div className="scan-tl-thumb-info">
                  <span className="scan-tl-thumb-page">
                    Trang {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="scan-tl-thumb-name">{p.name}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="scan-tl-sidebar-footer">
            <button
              className="scan-tl-btn scan-tl-btn--next"
              onClick={() => navigate(cfg.nextRoute)}
            >
              Tiếp tục
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path
                  d="M7 4l5 5-5 5"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="scan-tl-btn scan-tl-btn--back" onClick={() => navigate(-1)}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
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
      </div>
    </div>
  );
}
