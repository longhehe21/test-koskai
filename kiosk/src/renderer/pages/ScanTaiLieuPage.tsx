/**
 * ScanTaiLieuPage — trang scan tài liệu thật (production).
 *
 * Thay mock camera cũ bằng <AutoScanCamera /> (camera thật, auto nhận diện).
 * Lưu ảnh vào scanStore theo {flowKey, docCode} để các page sau (xem trước, nộp hồ sơ)
 * truy cập được.
 *
 * Flow user:
 *  1. Mount: camera tự bật, polling scan
 *  2. Click item bên phải → chọn doc đang scan (expectedDocCode)
 *  3. Scan match → modal popup "Đã nhận diện"
 *  4. User bấm "Giữ ảnh" → lưu scanStore, modal đóng, thumbnail bên phải cập nhật ✓
 *  5. User chọn tiếp item khác hoặc bấm "Tiếp tục"
 *
 * Không auto advance — user chủ động chọn.
 */
import '@styles/pages/scan-tai-lieu.css';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';
import { useTamVangFlowStore } from '@store/tamVangFlowStore';
import { useScanStore } from '@store/scanStore';
import { AutoScanCamera, type MatchInfo } from '@components/ui/AutoScanCamera';
import { Modal } from '@components/ui/Modal';
import { ConfirmSubmitModal } from '@components/ui';

interface ScanPage {
  name: string;
  image?: string;
  /** Mã doc trong backend (required_docs[].code) — server trả về match.code */
  docCode: string;
}

interface ScanConfig {
  /** Backend procedureCode — để gửi lên /scan/classify */
  procedureCode: string;
  /** Key trong scanStore (thường = procedureCode, có thể thêm suffix cho variant) */
  flowKey: string;
  docImage: string;
  docLabel: string;
  pageTitle: string;
  nextRoute: string;
  pages: ScanPage[];
  /**
   * Ràng buộc mẫu tờ khai chính — thường trú VN dùng CT01, VK dùng CT02, tạm vắng dùng CT03.
   * null = không ràng buộc (tạm trú/lưu trú).
   * handleKeep validate match.code nhầm prefix sẽ reject + cảnh báo (Tier 1).
   */
  expectedFormCode?: 'ct01' | 'ct02' | 'ct03' | null;
  /**
   * User đã tick "Chưa có" ở đơn chính (Q1/CT0X) trong HSDK modal.
   * → `buildXxxCfg` không render page đơn chính → validateScan KHÔNG được bắt
   *   user "scan CT0X trước" (Tier 2) vì user đâu có đơn để scan.
   * Tier 1 (sai mẫu CT0X khác) vẫn apply để phòng user lỡ scan nhầm loại.
   */
  skipFormRequired?: boolean;
}

/**
 * Danh sách các prefix CT hợp lệ — dùng trong Tier 1 validateScan để detect
 * user scan nhầm mẫu (vd expect CT03 mà scan trúng CT01).
 */
const CT_PREFIXES = ['ct01-', 'ct02-', 'ct03-'] as const;

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
  '/scan-luu-tru': {
    procedureCode: 'luu-tru',
    flowKey: 'luu-tru',
    docImage: '/assets/mau-luu-tru.svg',
    docLabel: 'Mẫu xác nhận lưu trú',
    pageTitle: 'Quét tài liệu – Lưu trú',
    nextRoute: '/xem-truoc-luu-tru',
    pages: [
      { name: 'Xác nhận lưu trú', docCode: 'xac-nhan-luu-tru' },
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

function buildTamTruCfg(variant: TamTruScanVariant): ScanConfig {
  const flow = useTamTruFlowStore.getState();
  const isDanhSach = variant === 'thuoc-so-huu';
  const hasQ3 = variant === 'phuong-tien' || variant === 'gia-han-danh-sach';

  const q1Doc: ScanPage = isDanhSach
    ? {
        name: 'Danh sách công dân đăng ký tạm trú',
        image: '/assets/mau-danh-sach-tam-tru.svg',
        docCode: 'danh-sach-cong-dan-tam-tru',
      }
    : {
        name: 'Tờ khai thay đổi thông tin cư trú (CT01)',
        image: '/assets/mau-to-khai-ct01.svg',
        docCode: 'ct01-to-khai-thay-doi-thong-tin-cu-tru',
      };

  const q2Doc: ScanPage = (() => {
    if (variant === 'quan-doi-cong-an' || variant === 'gia-han-ca-nhan') {
      return {
        name: 'Giấy giới thiệu của Thủ trưởng đơn vị',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        docCode: 'giay-gioi-thieu-quan-doi-cong-an',
      };
    }
    if (variant === 'phuong-tien') {
      return {
        name: 'Văn bản xác nhận địa điểm đậu đỗ phương tiện',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        docCode: 'vb-xac-nhan-dia-diem-dau-do',
      };
    }
    if (variant === 'thue-muon-o-nho') {
      return {
        name: 'Hợp đồng cho thuê / cho mượn / cho ở nhờ',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        docCode: 'hop-dong-thue-muon-o-nho',
      };
    }
    if (variant === 'gia-han-danh-sach') {
      return {
        name: 'Văn bản đề nghị gia hạn tạm trú kèm danh sách',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        docCode: 'vb-de-nghi-gia-han-danh-sach',
      };
    }
    if (variant === 'xoa-dang-ky') {
      const xoaCase = flow.xoaDangKyCase;
      if (xoaCase === 'nhan-khau-khong-con-cho-o') {
        return {
          name: 'Giấy tờ chứng minh chỗ ở hợp pháp',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          docCode: 'giay-to-cho-o-hop-phap',
        };
      }
      if (xoaCase === 'ca-ho-khong-con-cho-o') {
        return {
          name: 'Giấy tờ chứng minh không còn chỗ ở hợp pháp',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          docCode: 'giay-to-khong-con-cho-o',
        };
      }
      return {
        name: 'Giấy tờ đính kèm',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        docCode: 'giay-to-dinh-kem',
      };
    }
    return {
      name: 'Giấy tờ chứng minh chỗ ở',
      image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      docCode: 'giay-to-cho-o-hop-phap',
    };
  })();

  const q3Doc: ScanPage =
    variant === 'gia-han-danh-sach'
      ? {
          name: 'Hợp đồng cho thuê / cho mượn / cho ở nhờ',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          docCode: 'hop-dong-thue-muon-o-nho',
        }
      : {
          name: 'Giấy CN đăng ký phương tiện + an toàn kỹ thuật',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          docCode: 'giay-cn-dang-ky-phuong-tien',
        };

  const xoaOneDocCase =
    variant === 'xoa-dang-ky' &&
    flow.xoaDangKyCase !== 'nhan-khau-khong-con-cho-o' &&
    flow.xoaDangKyCase !== 'ca-ho-khong-con-cho-o';
  const hasQ2ForVariant = !xoaOneDocCase;

  const pages: ScanPage[] = [];
  if (flow.hasQ1) pages.push(q1Doc);
  if (hasQ2ForVariant && flow.hasQ2) pages.push(q2Doc);
  if (hasQ3 && flow.hasQ3) pages.push(q3Doc);
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

  // procedureCode mapping: gia-han & xoa-dang-ky dùng backend riêng, còn lại là tam-tru
  const procedureCode =
    variant === 'gia-han-ca-nhan' || variant === 'gia-han-danh-sach'
      ? 'gia-han'
      : variant === 'xoa-dang-ky'
        ? 'xoa-dang-ky'
        : 'tam-tru';

  return {
    procedureCode,
    flowKey: `${procedureCode}:${variant}`,
    docImage: pages[0]?.image ?? q1Doc.image ?? '',
    docLabel: isDanhSach ? 'Mẫu danh sách công dân đăng ký tạm trú' : 'Mẫu tờ khai CT01',
    pageTitle: 'Quét tài liệu – Tạm trú',
    nextRoute: nextRouteMap[variant],
    pages,
    // Q1 "Chưa có" → skip Tier 2 của validateScan (không ép scan đơn chính
    // trước) — user chỉ scan giấy tờ kèm (Q2/Q3) rồi vào form khai trực tiếp.
    skipFormRequired: !flow.hasQ1,
  };
}

/**
 * Tạm vắng — 2 tài liệu theo HSDK modal ở XacDinhDoiTuongPage:
 *  - CT03 (Phiếu khai báo tạm vắng) — Q1
 *  - Văn bản đồng ý của cơ quan giám sát — Q2 (chỉ áp cho nhóm tư pháp)
 *
 * Pages dynamic theo `tamVangFlowStore` (hsdkCt03 / hsdkVanBan): chỉ render
 * tài liệu user đã tick "Đã có". Fallback show đủ khi store rỗng (truy cập
 * URL direct — tránh crash).
 *
 * expectedFormCode = 'ct03' → validateScan Tier 1 reject khi user lỡ scan CT01/CT02.
 * skipFormRequired khi user tick CT03 "Chưa có" → user chỉ scan văn bản, Tier 2 skip.
 */
function buildTamVangCfg(): ScanConfig {
  const flow = useTamVangFlowStore.getState();
  const hasCt03 = flow.hsdkCt03 !== '0';
  const hasVanBan = flow.hsdkVanBan !== '0';

  const ct03Page: ScanPage = {
    name: 'Phiếu khai báo tạm vắng (CT03)',
    image: '/assets/mauct03khaibaotamvang.svg',
    docCode: 'ct03-phieu-tam-vang',
  };
  const vanBanPage: ScanPage = {
    name: 'Văn bản đồng ý của cơ quan giám sát',
    image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
    docCode: 'van-ban-dong-y-giam-sat-giao-duc',
  };

  // flow rỗng (hsdkCt03/hsdkVanBan đều null) = user truy cập URL direct → render đủ
  // để không crash; bình thường XacDinhDoiTuongPage đã set store trước khi navigate.
  const storeEmpty = flow.hsdkCt03 === null && flow.hsdkVanBan === null;
  const pages: ScanPage[] = storeEmpty
    ? [ct03Page, vanBanPage]
    : [
        ...(hasCt03 ? [ct03Page] : []),
        ...(hasVanBan ? [vanBanPage] : []),
      ];

  return {
    procedureCode: 'tam-vang',
    flowKey: 'tam-vang',
    docImage: pages[0]?.image ?? ct03Page.image ?? '',
    docLabel: hasCt03 ? 'Mẫu CT03' : 'Văn bản đồng ý',
    pageTitle: 'Quét tài liệu – Tạm vắng',
    nextRoute: '/xem-truoc-tam-vang',
    pages,
    expectedFormCode: 'ct03',
    // User tick CT03 "Chưa có" → chỉ scan văn bản, không bị Tier 2 chặn.
    skipFormRequired: flow.hsdkCt03 === '0',
  };
}

function buildHoKhauCfg(): ScanConfig {
  const flow = useHoKhauFlowStore.getState();
  const userHasForm = flow.hsdkTc01 !== '0';
  const userHasQ2 = flow.hsdkSoHuu !== '0';
  const userHasQ3 = flow.hsdkQ3 !== '0';
  const branch = flow.type;
  const isNuocNgoai = CT02_BRANCHES.has(branch);
  const isQuanDoi = branch === 'quan-doi-cong-an';
  const isTonGiaoChucSac =
    branch === 'ton-giao-chuc-sac-vn' || branch === 'ton-giao-chuc-sac-vk';
  const isTonGiaoNuongTua =
    branch === 'ton-giao-nuong-tua-vn' || branch === 'ton-giao-nuong-tua-vk';
  const isTroGiupXaHoi =
    branch === 'tro-giup-xa-hoi-vn' || branch === 'tro-giup-xa-hoi-vk';
  const isPhuongTien = branch === 'phuong-tien-vn' || branch === 'phuong-tien-vk';
  const branchHasQ3 = BRANCHES_WITH_Q3.has(branch);

  const formPages: ScanPage[] = isNuocNgoai
    ? [
        {
          name: 'CT02 - Mặt trước',
          image: '/assets/mẫu cư trú ct02 mặt trước.svg',
          docCode: 'ct02-mat-truoc',
        },
        {
          name: 'CT02 - Mặt sau',
          image: '/assets/mẫu cư trú ct02 mặt sau.svg',
          docCode: 'ct02-mat-sau',
        },
        {
          name: 'CT02 - Chú thích',
          image: '/assets/mẫu cư trú ct02 chú thích.svg',
          docCode: 'ct02-chu-thich',
        },
      ]
    : [
        {
          name: 'Tờ khai CT01 - Mặt trước',
          image: '/assets/mẫu test tờ khai cư trú mặt trước.svg',
          docCode: 'ct01-to-khai-thay-doi-thong-tin-cu-tru',
        },
        {
          name: 'Tờ khai CT01 - Mặt sau',
          image: '/assets/mẫu test tờ khai cứ trú mặt sau.svg',
          docCode: 'ct01-mat-sau',
        },
      ];

  let secondDocName = 'Giấy CN quyền sử dụng đất';
  let secondDocCode = 'qsdd-giay-chung-nhan-quyen-su-dung-dat';
  let secondShort = 'Giấy CN QSDĐ';
  if (isQuanDoi) {
    secondDocName = 'Giấy giới thiệu của thủ trưởng đơn vị';
    secondDocCode = 'giay-gioi-thieu-quan-doi-cong-an';
    secondShort = 'Giấy giới thiệu';
  } else if (isTonGiaoChucSac) {
    secondDocName = 'Giấy tờ chứng minh là chức sắc / đại diện cơ sở';
    secondDocCode = 'giay-to-chuc-sac';
    secondShort = 'Giấy chức sắc';
  } else if (isTonGiaoNuongTua) {
    secondDocName = 'UBND xã xác nhận đối tượng & chỗ ở phụ trợ';
    secondDocCode = 'ubnd-xac-nhan-nuong-tua';
    secondShort = 'UBND xác nhận';
  } else if (isTroGiupXaHoi) {
    secondDocName = 'Văn bản đề nghị của người đứng đầu cơ sở';
    secondDocCode = 'vb-de-nghi-tro-giup-xa-hoi';
    secondShort = 'Văn bản đề nghị';
  } else if (isPhuongTien) {
    secondDocName = 'Giấy đăng ký + đăng kiểm phương tiện';
    secondDocCode = 'giay-dang-kiem-phuong-tien';
    secondShort = 'Giấy đăng kiểm';
  }

  let thirdDocName = 'UBND xác nhận chỗ ở phụ trợ';
  let thirdDocCode = 'ubnd-xac-nhan-cho-o-phu-tro';
  if (isTroGiupXaHoi) {
    thirdDocName = 'Giấy xác nhận chăm sóc/nuôi dưỡng';
    thirdDocCode = 'giay-cham-soc-nuoi-duong';
  } else if (isPhuongTien) {
    thirdDocName = 'UBND xác nhận địa điểm đậu đỗ';
    thirdDocCode = 'vb-xac-nhan-dia-diem-dau-do';
  }

  type WithKeep = ScanPage & { keep: boolean };
  const allPages: WithKeep[] = [
    ...formPages.map((p) => ({ ...p, keep: userHasForm })),
    {
      name: secondDocName,
      image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      docCode: secondDocCode,
      keep: userHasQ2,
    },
    ...(branchHasQ3
      ? [
          {
            name: thirdDocName,
            image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
            docCode: thirdDocCode,
            keep: userHasQ3,
          },
        ]
      : []),
  ];
  const pages = allPages
    .filter((p) => p.keep)
    .map(({ name, image, docCode }) => ({ name, image, docCode }));

  const formLabel = isNuocNgoai ? 'Mẫu CT02' : 'Mẫu TC01';
  const fallbackPages: ScanPage[] = [
    {
      name: 'Tờ khai CT01 - Mặt trước',
      image: '/assets/mẫu test tờ khai cư trú mặt trước.svg',
      docCode: 'ct01-to-khai-thay-doi-thong-tin-cu-tru',
    },
    {
      name: 'Tờ khai CT01 - Mặt sau',
      image: '/assets/mẫu test tờ khai cứ trú mặt sau.svg',
      docCode: 'ct01-mat-sau',
    },
    {
      name: 'Giấy CN quyền sử dụng đất',
      image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      docCode: 'qsdd-giay-chung-nhan-quyen-su-dung-dat',
    },
  ];

  return {
    procedureCode: 'thuong-tru',
    flowKey: 'thuong-tru',
    docImage: pages[0]?.image ?? '/assets/mẫu test tờ khai cư trú mặt trước.svg',
    docLabel: userHasForm ? formLabel : secondShort,
    pageTitle: 'Quét tài liệu – Hộ khẩu',
    nextRoute: '/xem-truoc-ho-khau',
    pages: pages.length ? pages : fallbackPages,
    // VN branches → CT01; VK branches (nuoc-ngoai + *-vk) → CT02
    expectedFormCode: isNuocNgoai ? 'ct02' : 'ct01',
    // Q1 (hsdkTc01) "Chưa có" → user không có CT01/CT02 để scan. validateScan
    // phải bỏ Tier 2 (ép scan form chính trước) để user scan được secondary
    // docs (Giấy giới thiệu / QSDĐ / Q2 / Q3) rồi vào form khai trực tiếp.
    skipFormRequired: !userHasForm,
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
    if (location.pathname === '/scan-tam-vang') return buildTamVangCfg();
    return STATIC_CONFIGS[location.pathname] ?? STATIC_CONFIGS['/scan-luu-tru'];
  }, [location.pathname]);

  usePageHeader({ title: cfg.pageTitle });

  // Key của ảnh đang review (click thumb đã scan) — null = không review
  const [reviewKey, setReviewKey] = useState<string | null>(null);

  const saveDoc = useScanStore((s) => s.saveDoc);
  const removeDoc = useScanStore((s) => s.removeDoc);
  const clearFlow = useScanStore((s) => s.clearFlow);
  const docs = useScanStore((s) => s.docs);

  // User bấm "Quay lại" → clear toàn bộ ảnh đã scan trong flow rồi navigate
  const handleBack = () => {
    clearFlow(cfg.flowKey);
    navigate(-1);
  };

  // List ảnh đã scan trong flow này — dynamic, theo thứ tự chụp
  const scannedList = useMemo(() => {
    const prefix = `${cfg.flowKey}:`;
    return Object.entries(docs)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, doc]) => ({ docCode: k.slice(prefix.length), doc }))
      .sort((a, b) => a.doc.scannedAt.localeCompare(b.doc.scannedAt));
  }, [docs, cfg.flowKey]);

  // Enable "Tiếp tục" khi có ≥ 1 ảnh (user tự quyết đã đủ hay chưa)
  const hasAnyScan = scannedList.length > 0;

  // Validate form CT01/CT02 theo branch VN/VK. cfg.expectedFormCode được set
  // bởi buildHoKhauCfg cho thường trú. Null = flow khác không ràng buộc.
  //
  // 3 tier check:
  //  1. match.code là CT sai prefix → reject (VD VK scan nhầm CT01).
  //  2. Chưa có CT form nào trong scanStore + current scan KHÔNG phải expected
  //     CT → reject (chống chụp linh tinh khi chưa scan form chính). Cho phép
  //     secondary docs chỉ sau khi đã có form đúng.
  //     → SKIP khi cfg.skipFormRequired (user đã tick "Chưa có" đơn chính ở
  //     HSDK modal) — user chỉ scan giấy tờ kèm nên không có form chính để ép.
  //  3. Null match hoặc secondary docs sau khi có form → pass.
  const validateScan = (match: MatchInfo | null): string | null => {
    const expected = cfg.expectedFormCode;
    if (!expected) return null;

    const matchCode = match?.code ?? '';
    const expectedPrefix = `${expected}-`;
    const expectedName = expected.toUpperCase();

    // Tier 1: match.code thuộc CT khác với expected → rõ ràng nhầm form.
    // Tổng quát cho CT01/CT02/CT03 thay vì hardcode cặp ct01↔ct02.
    // Giữ bất kể skipFormRequired để phòng user lỡ scan nhầm loại.
    const wrongCt = CT_PREFIXES.find((p) => p !== expectedPrefix && matchCode.startsWith(p));
    if (wrongCt) {
      const wrongName = wrongCt.slice(0, -1).toUpperCase();
      return `Ảnh đang là mẫu ${wrongName}. Thủ tục này cần mẫu ${expectedName} — vui lòng scan đúng mẫu.`;
    }

    // Tier 2: chưa có form chính → phải scan form chính trước.
    // User tick Q1 "Chưa có" → buildCfg bỏ page CT01/CT02, user chỉ scan giấy
    // tờ kèm. Không được block — bỏ qua Tier 2 hoàn toàn.
    if (cfg.skipFormRequired) return null;
    const hasForm = Object.entries(docs).some(
      ([k, d]) => k.startsWith(`${cfg.flowKey}:`) && d.matchCode.startsWith(expectedPrefix),
    );
    if (!hasForm && !matchCode.startsWith(expectedPrefix)) {
      return `Vui lòng scan mẫu ${expectedName} (tờ khai chính) trước khi thêm các giấy tờ khác.`;
    }

    return null;
  };

  const [formMismatchMsg, setFormMismatchMsg] = useState<string | null>(null);

  const handleKeep = (dataUrl: string, match: MatchInfo | null, ocrText: string) => {
    // Kiểm tra nhầm/thiếu mẫu CT01/CT02 theo branch — nếu không đạt → cảnh báo
    const mismatch = validateScan(match);
    if (mismatch) {
      setFormMismatchMsg(mismatch);
      return;
    }

    // Generate unique docCode theo match + timestamp → không conflict khi chụp nhiều trang cùng loại
    const prefix = match?.code ?? 'scan';
    const uniqueDocCode = `${prefix}-${Date.now()}`;

    saveDoc(cfg.flowKey, uniqueDocCode, {
      dataUrl,
      matchScore: match?.score ?? 0,
      matchCode: match?.code ?? '',
      matchName: match?.name ?? 'Tài liệu',
      scannedAt: new Date().toISOString(),
      ocrText: ocrText || undefined,
    });

    // Debug log trường đã scan — kiểm tra OCR + match info
    console.group(`%c[Scan] ${match?.name ?? 'Tài liệu'} — ${uniqueDocCode}`, 'color:#2563eb;font-weight:700');
    console.log('flowKey :', cfg.flowKey);
    console.log('match   :', match);
    console.log('ocrConf :', match ? `${(match.score * 100).toFixed(0)}%` : 'N/A');
    console.log('ocrText :', ocrText || '(empty)');
    console.groupEnd();
  };

  // Click thumb đã scan → mở review modal
  const handleThumbClick = (docCode: string) => {
    setReviewKey(docCode);
  };

  // Review modal — "Xoá": xoá khỏi store
  const handleRemove = () => {
    if (!reviewKey) return;
    removeDoc(cfg.flowKey, reviewKey);
    setReviewKey(null);
  };

  const handleCloseReview = () => setReviewKey(null);

  const reviewDoc = reviewKey ? docs[`${cfg.flowKey}:${reviewKey}`] : null;

  return (
    <div className="scan-tl-area">
      <div className="scan-tl-body">
        <div className="scan-tl-left">
          <div className="scan-tl-camera" style={{ background: 'transparent', padding: 0 }}>
            <AutoScanCamera
              procedureCode={cfg.procedureCode}
              onKeep={handleKeep}
            />
          </div>
        </div>

        <div className="scan-tl-right">
          <div className="scan-tl-list-header">
            <h3 className="scan-tl-list-title">Danh sách ảnh đã scan</h3>
            <span className="scan-tl-list-badge">{scannedList.length} ảnh</span>
          </div>
          <div className="scan-tl-list">
            {scannedList.length === 0 && (
              <div className="scan-tl-empty">
                <p>Chưa có ảnh nào</p>
                <span>Bấm <strong>📷 Chụp</strong> để bắt đầu quét tài liệu</span>
              </div>
            )}
            {scannedList.map(({ docCode, doc }, i) => (
              <button
                key={docCode}
                type="button"
                className="scan-tl-thumb is-scanned"
                onClick={() => handleThumbClick(docCode)}
                title="Click để xem / xoá"
              >
                <span className="scan-tl-thumb-check">✓</span>
                <div className="scan-tl-thumb-img">
                  <img src={doc.dataUrl} alt={`Trang ${i + 1}`} />
                </div>
                <div className="scan-tl-thumb-info">
                  <span className="scan-tl-thumb-page">
                    Trang {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="scan-tl-thumb-name">{doc.matchName}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="scan-tl-sidebar-footer">
            <button
              className="scan-tl-btn scan-tl-btn--next"
              onClick={() => navigate(cfg.nextRoute)}
              disabled={!hasAnyScan}
              style={!hasAnyScan ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
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
            <button className="scan-tl-btn scan-tl-btn--back" onClick={handleBack}>
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

      {/* Modal review — click thumb → xem to + chọn xoá / đóng */}
      <Modal
        open={reviewKey !== null && !!reviewDoc}
        overlayClassName="auto-scan-result-overlay"
        visibleClassName="auto-scan-result-overlay--visible"
        portalSelector=".kiosk-content-panel"
        onClose={handleCloseReview}
      >
        {reviewDoc && (
          <div
            className="auto-scan-result-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="auto-scan-result-header">
              <h2>
                <span>📄</span>
                <span>{reviewDoc.matchName}</span>
              </h2>
            </div>

            <div className="auto-scan-result-body">
              <img
                src={reviewDoc.dataUrl}
                alt={reviewDoc.matchName}
                className="auto-scan-result-img"
              />
            </div>

            <div className="auto-scan-result-footer">
              <button
                type="button"
                className="auto-scan-result-btn auto-scan-result-btn--retake"
                onClick={handleRemove}
              >
                🗑️ Xoá ảnh
              </button>
              <button
                type="button"
                className="auto-scan-result-btn auto-scan-result-btn--keep"
                onClick={handleCloseReview}
              >
                ✓ Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cảnh báo nhầm mẫu CT01/CT02 theo branch VN/VK đã chọn */}
      <ConfirmSubmitModal
        open={formMismatchMsg !== null}
        onCancel={() => setFormMismatchMsg(null)}
        onConfirm={() => setFormMismatchMsg(null)}
        title="Sai mẫu tờ khai"
        description={formMismatchMsg ?? ''}
        confirmLabel="Đã hiểu"
        cancelLabel="Đóng"
      />
    </div>
  );
}
