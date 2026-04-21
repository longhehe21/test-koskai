import '@styles/pages/scan-tai-lieu.css';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';

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
};

type TamTruScanVariant =
  | 'thuoc-so-huu'
  | 'khong-thuoc-so-huu'
  | 'quan-doi-cong-an'
  | 'phuong-tien'
  | 'thue-muon-o-nho'
  | 'gia-han-ca-nhan'
  | 'gia-han-danh-sach'
  | 'xoa-dang-ky';

/** Build cfg động cho /scan-tam-tru* dựa vào tamTruFlowStore — chỉ scan tài liệu user "Đã có". */
function buildTamTruCfg(variant: TamTruScanVariant): ScanConfig {
  const flow = useTamTruFlowStore.getState();
  const isDanhSach = variant === 'thuoc-so-huu';
  const hasQ3 = variant === 'phuong-tien' || variant === 'gia-han-danh-sach';

  const q1Doc: ScanPage = isDanhSach
    ? {
        name: 'Danh sách công dân đăng ký tạm trú',
        image: '/assets/mau-danh-sach-tam-tru.svg',
      }
    : {
        name: 'Tờ khai thay đổi thông tin cư trú (CT01)',
        image: '/assets/mau-to-khai-ct01.svg',
      };

  const q2Doc: ScanPage = (() => {
    if (variant === 'quan-doi-cong-an' || variant === 'gia-han-ca-nhan') {
      return {
        name: 'Giấy giới thiệu của Thủ trưởng đơn vị',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      };
    }
    if (variant === 'phuong-tien') {
      return {
        name: 'Văn bản xác nhận của UBND cấp xã về địa điểm đậu đỗ phương tiện',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      };
    }
    if (variant === 'thue-muon-o-nho') {
      return {
        name: 'Hợp đồng cho thuê / cho mượn / cho ở nhờ chỗ ở hợp pháp',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      };
    }
    if (variant === 'gia-han-danh-sach') {
      return {
        name: 'Văn bản đề nghị gia hạn tạm trú kèm danh sách',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      };
    }
    if (variant === 'xoa-dang-ky') {
      const xoaCase = flow.xoaDangKyCase;
      if (xoaCase === 'nhan-khau-khong-con-cho-o') {
        return {
          name: 'Giấy tờ, tài liệu chứng minh chỗ ở hợp pháp',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        };
      }
      if (xoaCase === 'ca-ho-khong-con-cho-o') {
        return {
          name: 'Giấy tờ chứng minh về việc không còn chỗ ở hợp pháp',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        };
      }
      return {
        name: 'Giấy tờ đính kèm',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      };
    }
    return {
      name: 'Giấy tờ chứng minh chỗ ở',
      image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
    };
  })();

  const q3Doc: ScanPage =
    variant === 'gia-han-danh-sach'
      ? {
          name: 'Hợp đồng cho thuê / cho mượn / cho ở nhờ chỗ ở hợp pháp',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        }
      : {
          name: 'Giấy chứng nhận đăng ký phương tiện + an toàn kỹ thuật',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        };

  // Xóa đăng ký 1-câu cases: chỉ Q1, không có Q2
  const xoaOneDocCase =
    variant === 'xoa-dang-ky' &&
    flow.xoaDangKyCase !== 'nhan-khau-khong-con-cho-o' &&
    flow.xoaDangKyCase !== 'ca-ho-khong-con-cho-o';
  const hasQ2ForVariant = !xoaOneDocCase;

  const pages: ScanPage[] = [];
  if (flow.hasQ1) pages.push(q1Doc);
  if (hasQ2ForVariant && flow.hasQ2) pages.push(q2Doc);
  if (hasQ3 && flow.hasQ3) pages.push(q3Doc);
  // Fallback: flow chưa set → scan đủ
  if (pages.length === 0) {
    pages.push(q1Doc);
    if (hasQ2ForVariant) pages.push(q2Doc);
    if (hasQ3) pages.push(q3Doc);
  }

  const nextRouteMap: Record<TamTruScanVariant, string> = {
    'thuoc-so-huu': '/xem-truoc-tam-tru',
    'khong-thuoc-so-huu': '/xem-truoc-tam-tru-ct01',
    'quan-doi-cong-an': '/xem-truoc-tam-tru-quan-doi',
    'phuong-tien': '/xem-truoc-tam-tru-phuong-tien',
    'thue-muon-o-nho': '/xem-truoc-tam-tru-thue-muon',
    'gia-han-ca-nhan': '/xem-truoc-gia-han',
    'gia-han-danh-sach': '/xem-truoc-gia-han-danh-sach',
    'xoa-dang-ky': '/xem-truoc-xoa-dang-ky',
  };

  return {
    docImage: pages[0]?.image ?? q1Doc.image ?? '',
    docLabel: isDanhSach ? 'Mẫu danh sách công dân đăng ký tạm trú' : 'Mẫu tờ khai CT01',
    pageTitle: 'Quét tài liệu – Tạm trú',
    nextRoute: nextRouteMap[variant],
    pages,
  };
}

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
    if (location.pathname === '/scan-tam-tru') return buildTamTruCfg('thuoc-so-huu');
    if (location.pathname === '/scan-tam-tru-ct01') return buildTamTruCfg('khong-thuoc-so-huu');
    if (location.pathname === '/scan-tam-tru-quan-doi') return buildTamTruCfg('quan-doi-cong-an');
    if (location.pathname === '/scan-tam-tru-phuong-tien') return buildTamTruCfg('phuong-tien');
    if (location.pathname === '/scan-tam-tru-thue-muon') return buildTamTruCfg('thue-muon-o-nho');
    if (location.pathname === '/scan-gia-han') return buildTamTruCfg('gia-han-ca-nhan');
    if (location.pathname === '/scan-gia-han-danh-sach') return buildTamTruCfg('gia-han-danh-sach');
    if (location.pathname === '/scan-xoa-dang-ky') return buildTamTruCfg('xoa-dang-ky');
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
