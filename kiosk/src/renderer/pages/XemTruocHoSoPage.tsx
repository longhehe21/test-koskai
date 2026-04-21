import '@styles/pages/xem-truoc-ho-so.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';
import {
  CT01_BACK_BODY,
  CT01_BODY,
  CT02_BACK_BODY,
  CT02_BODY,
  CT03_BODY,
  DANH_SACH_TAM_TRU_BODY,
  LUU_TRU_BODY,
  QSDD_OCR_HTML,
} from './xem-truoc-ho-so/docBodies';

interface PreviewPage {
  label: string;
  image: string;
  docBodyHTML?: string;
  ocrHTML?: string;
}

interface PreviewConfig {
  docImage: string;
  pages: PreviewPage[];
  filename: string;
  pageTitle: string;
  nextRoute: string;
  docBodyHTML: string;
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

const STATIC_CONFIGS: Record<string, PreviewConfig> = {
  '/xem-truoc-tam-vang': {
    docImage: '/assets/mauct03khaibaotamvang.svg',
    pages: [
      { label: 'Trang 1', image: '/assets/mauct03khaibaotamvang.svg' },
      { label: 'Trang 2', image: '/assets/mauct03khaibaotamvang.svg' },
      { label: 'Trang 3', image: '/assets/mauct03khaibaotamvang.svg' },
    ],
    filename: 'MauCT03.docx',
    pageTitle: 'Xem trước hồ sơ – Tạm vắng',
    nextRoute: '/tao-khai-bao-tam-vang',
    docBodyHTML: CT03_BODY,
  },
  '/xem-truoc-luu-tru': {
    docImage: '/assets/mau-luu-tru.svg',
    pages: [
      { label: 'Trang 1', image: '/assets/mau-luu-tru.svg' },
      { label: 'Trang 2', image: '/assets/mau-luu-tru.svg' },
    ],
    filename: 'MauDonXacNhanLuuTru.docx',
    pageTitle: 'Xem trước hồ sơ – Lưu trú',
    nextRoute: '/tao-thong-bao-luu-tru',
    docBodyHTML: LUU_TRU_BODY,
  },
};

type TamTruPreviewVariant =
  | 'thuoc-so-huu'
  | 'khong-thuoc-so-huu'
  | 'quan-doi-cong-an'
  | 'phuong-tien'
  | 'thue-muon-o-nho'
  | 'gia-han-ca-nhan'
  | 'gia-han-danh-sach'
  | 'xoa-dang-ky';

function buildTamTruCfg(variant: TamTruPreviewVariant): PreviewConfig {
  const flow = useTamTruFlowStore.getState();
  const isDanhSach = variant === 'thuoc-so-huu';
  const hasQ3 = variant === 'phuong-tien' || variant === 'gia-han-danh-sach';

  const q1Page: PreviewPage = isDanhSach
    ? {
        label: 'Danh sách công dân ĐKTT',
        image: '/assets/mau-danh-sach-tam-tru.svg',
        docBodyHTML: DANH_SACH_TAM_TRU_BODY,
      }
    : {
        label: 'Tờ khai CT01',
        image: '/assets/mau-to-khai-ct01.svg',
        docBodyHTML: CT01_BODY,
      };

  const q2Page: PreviewPage = (() => {
    if (variant === 'quan-doi-cong-an' || variant === 'gia-han-ca-nhan') {
      return {
        label: 'Giấy giới thiệu',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        ocrHTML: QSDD_OCR_HTML,
      };
    }
    if (variant === 'phuong-tien') {
      return {
        label: 'Xác nhận UBND xã',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        ocrHTML: QSDD_OCR_HTML,
      };
    }
    if (variant === 'thue-muon-o-nho') {
      return {
        label: 'Hợp đồng thuê / mượn / ở nhờ',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        ocrHTML: QSDD_OCR_HTML,
      };
    }
    if (variant === 'gia-han-danh-sach') {
      return {
        label: 'Văn bản đề nghị gia hạn',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        ocrHTML: QSDD_OCR_HTML,
      };
    }
    if (variant === 'xoa-dang-ky') {
      const xoaCase = flow.xoaDangKyCase;
      if (xoaCase === 'nhan-khau-khong-con-cho-o') {
        return {
          label: 'Giấy CM chỗ ở',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          ocrHTML: QSDD_OCR_HTML,
        };
      }
      if (xoaCase === 'ca-ho-khong-con-cho-o') {
        return {
          label: 'Giấy CM không còn chỗ ở',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          ocrHTML: QSDD_OCR_HTML,
        };
      }
      return {
        label: 'Giấy tờ đính kèm',
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        ocrHTML: QSDD_OCR_HTML,
      };
    }
    return {
      label: 'Giấy CN QSDD',
      image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      ocrHTML: QSDD_OCR_HTML,
    };
  })();

  const q3Page: PreviewPage =
    variant === 'gia-han-danh-sach'
      ? {
          label: 'Hợp đồng thuê / mượn / ở nhờ',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          ocrHTML: QSDD_OCR_HTML,
        }
      : {
          label: 'Giấy ĐK phương tiện',
          image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          ocrHTML: QSDD_OCR_HTML,
        };

  const xoaOneDocCase =
    variant === 'xoa-dang-ky' &&
    flow.xoaDangKyCase !== 'nhan-khau-khong-con-cho-o' &&
    flow.xoaDangKyCase !== 'ca-ho-khong-con-cho-o';
  const hasQ2ForVariant = !xoaOneDocCase;

  const pages: PreviewPage[] = [];
  if (flow.hasQ1) pages.push(q1Page);
  if (hasQ2ForVariant && flow.hasQ2) pages.push(q2Page);
  if (hasQ3 && flow.hasQ3) pages.push(q3Page);
  if (pages.length === 0) {
    pages.push(q1Page);
    if (hasQ2ForVariant) pages.push(q2Page);
    if (hasQ3) pages.push(q3Page);
  }

  const nextRoute =
    variant === 'xoa-dang-ky'
      ? '/tao-ho-so-xoa-dang-ky'
      : variant === 'gia-han-ca-nhan'
        ? '/tao-ho-so-gia-han'
        : variant === 'gia-han-danh-sach'
          ? '/tao-ho-so-gia-han-danh-sach'
          : flow.truongHop === 'nhan-khau-ho'
            ? '/tao-ho-so-tam-tru-nhan-khau-ho'
            : '/tao-ho-so-tam-tru-danh-sach';

  return {
    docImage: pages[0].image,
    docBodyHTML: isDanhSach ? DANH_SACH_TAM_TRU_BODY : CT01_BODY,
    filename: isDanhSach ? 'DanhSachCongDanDangKyTamTru.docx' : 'MauCT01_TamTru.docx',
    pageTitle: 'Xem trước hồ sơ – Tạm trú',
    nextRoute,
    pages,
  };
}

function buildHoKhauCfg(): PreviewConfig {
  const flow = useHoKhauFlowStore.getState();
  const hasForm = flow.hsdkTc01 !== '0';
  const hasSoHuu = flow.hsdkSoHuu !== '0';
  const hasQ3 = flow.hsdkQ3 !== '0';
  const branch = flow.type;
  const isNuocNgoai = CT02_BRANCHES.has(branch);
  const isQuanDoi = branch === 'quan-doi-cong-an';
  const isTonGiaoChucSac = branch === 'ton-giao-chuc-sac-vn' || branch === 'ton-giao-chuc-sac-vk';
  const isTonGiaoNuongTua = branch === 'ton-giao-nuong-tua-vn' || branch === 'ton-giao-nuong-tua-vk';
  const isTroGiupXaHoi = branch === 'tro-giup-xa-hoi-vn' || branch === 'tro-giup-xa-hoi-vk';
  const isPhuongTien = branch === 'phuong-tien-vn' || branch === 'phuong-tien-vk';
  const branchHasQ3 = BRANCHES_WITH_Q3.has(branch);

  const formLabel = isNuocNgoai ? 'CT02' : 'TC01';
  const frontImage = isNuocNgoai
    ? '/assets/mẫu cư trú ct02 mặt trước.svg'
    : '/assets/mẫu test tờ khai cư trú mặt trước.svg';
  const backImage = isNuocNgoai
    ? '/assets/mẫu cư trú ct02 mặt sau.svg'
    : '/assets/mẫu test tờ khai cứ trú mặt sau.svg';

  const formPages: PreviewPage[] = isNuocNgoai
    ? [
        { label: `${formLabel} - Mặt trước`, image: frontImage, docBodyHTML: CT02_BODY },
        { label: `${formLabel} - Mặt sau`, image: backImage, docBodyHTML: CT02_BACK_BODY },
        { label: `${formLabel} - Chú thích`, image: '/assets/mẫu cư trú ct02 chú thích.svg', docBodyHTML: CT01_BACK_BODY },
      ]
    : [
        { label: `${formLabel} - Mặt trước`, image: frontImage },
        { label: `${formLabel} - Mặt sau`, image: backImage, docBodyHTML: CT01_BACK_BODY },
      ];

  let secondLabel = 'Giấy CN QSDD';
  if (isQuanDoi) secondLabel = 'Giấy giới thiệu';
  else if (isTonGiaoChucSac) secondLabel = 'Giấy tờ chức sắc';
  else if (isTonGiaoNuongTua) secondLabel = 'UBND xác nhận';
  else if (isTroGiupXaHoi) secondLabel = 'Văn bản đề nghị';
  else if (isPhuongTien) secondLabel = 'Giấy đăng kiểm';

  let thirdLabel = 'UBND xác nhận';
  if (isTroGiupXaHoi) thirdLabel = 'Xác nhận chăm sóc';
  else if (isPhuongTien) thirdLabel = 'UBND xác nhận đậu đỗ';

  const allPages = [
    ...formPages.map((p) => ({ page: p, keep: hasForm })),
    {
      page: {
        label: secondLabel,
        image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
        ocrHTML: QSDD_OCR_HTML,
      } as PreviewPage,
      keep: hasSoHuu,
    },
    ...(branchHasQ3
      ? [
          {
            page: {
              label: thirdLabel,
              image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
              ocrHTML: QSDD_OCR_HTML,
            } as PreviewPage,
            keep: hasQ3,
          },
        ]
      : []),
  ];
  const pages = allPages.filter((p) => p.keep).map((p) => p.page);

  const fallbackPages: PreviewPage[] = [
    {
      label: 'TC01 - Mặt trước',
      image: '/assets/mẫu test tờ khai cư trú mặt trước.svg',
    },
    {
      label: 'TC01 - Mặt sau',
      image: '/assets/mẫu test tờ khai cứ trú mặt sau.svg',
      docBodyHTML: CT01_BACK_BODY,
    },
    {
      label: 'Giấy CN QSDD',
      image: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
      ocrHTML: QSDD_OCR_HTML,
    },
  ];

  return {
    docImage: pages[0]?.image ?? frontImage,
    docBodyHTML: isNuocNgoai ? CT02_BODY : CT01_BODY,
    filename: isNuocNgoai ? 'MauCT02.docx' : 'MauCT01.docx',
    pageTitle: 'Xem trước hồ sơ – Hộ khẩu',
    nextRoute: '/tao-ho-so-thuong-tru',
    pages: pages.length ? pages : fallbackPages,
  };
}

export default function XemTruocHoSoPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const cfg = useMemo<PreviewConfig>(() => {
    if (location.pathname === '/xem-truoc-ho-khau') return buildHoKhauCfg();
    if (location.pathname === '/xem-truoc-tam-tru') return buildTamTruCfg('thuoc-so-huu');
    if (location.pathname === '/xem-truoc-tam-tru-ct01') return buildTamTruCfg('khong-thuoc-so-huu');
    if (location.pathname === '/xem-truoc-tam-tru-quan-doi') return buildTamTruCfg('quan-doi-cong-an');
    if (location.pathname === '/xem-truoc-tam-tru-phuong-tien') return buildTamTruCfg('phuong-tien');
    if (location.pathname === '/xem-truoc-tam-tru-thue-muon') return buildTamTruCfg('thue-muon-o-nho');
    if (location.pathname === '/xem-truoc-gia-han') return buildTamTruCfg('gia-han-ca-nhan');
    if (location.pathname === '/xem-truoc-gia-han-danh-sach') return buildTamTruCfg('gia-han-danh-sach');
    if (location.pathname === '/xem-truoc-xoa-dang-ky') return buildTamTruCfg('xoa-dang-ky');
    return STATIC_CONFIGS[location.pathname] ?? STATIC_CONFIGS['/xem-truoc-tam-vang'];
  }, [location.pathname]);

  usePageHeader({ title: cfg.pageTitle });

  const [activeIdx, setActiveIdx] = useState(0);
  const scanFrameRef = useRef<HTMLDivElement>(null);
  const ocrScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIdx(0);
  }, [cfg]);

  const activePage = cfg.pages[activeIdx] ?? cfg.pages[0];
  const mode = activePage.ocrHTML ? 'ocr' : 'docx';
  const docBodyHTML = activePage.docBodyHTML ?? cfg.docBodyHTML;

  // Scan beam + OCR sequential reveal animation khi page ở OCR mode.
  // Reset state mỗi lần đổi page/mode để animation chạy lại.
  useEffect(() => {
    if (mode !== 'ocr') return;
    const frame = scanFrameRef.current;
    const container = ocrScrollRef.current;
    if (!frame || !container) return;

    frame.classList.remove('xths-scan-frame--scanning', 'xths-scan-frame--done');
    const values = Array.from(
      container.querySelectorAll<HTMLElement>('.xths-ocr-value'),
    );
    const verify = container.querySelector<HTMLElement>('.xths-ocr-verify');
    values.forEach((el) => el.classList.remove('xths-ocr-filled', 'xths-ocr-scrambling'));
    verify?.classList.remove('xths-ocr-filled', 'xths-ocr-verify--done');

    const timeouts: number[] = [];
    timeouts.push(
      window.setTimeout(() => frame.classList.add('xths-scan-frame--scanning'), 80),
    );

    const revealStart = 500;
    const stepMs = 380;
    values.forEach((el, i) => {
      const t = revealStart + i * stepMs;
      timeouts.push(
        window.setTimeout(() => el.classList.add('xths-ocr-scrambling'), t),
      );
      timeouts.push(
        window.setTimeout(() => {
          el.classList.remove('xths-ocr-scrambling');
          el.classList.add('xths-ocr-filled');
        }, t + 320),
      );
    });

    const finishT = revealStart + values.length * stepMs + 300;
    timeouts.push(
      window.setTimeout(() => {
        frame.classList.remove('xths-scan-frame--scanning');
        frame.classList.add('xths-scan-frame--done');
        verify?.classList.add('xths-ocr-filled');
      }, finishT),
    );
    timeouts.push(
      window.setTimeout(() => verify?.classList.add('xths-ocr-verify--done'), finishT + 600),
    );

    return () => {
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, [mode, activeIdx]);

  const handleNext = () => {
    if (activeIdx < cfg.pages.length - 1) {
      setActiveIdx(activeIdx + 1);
      return;
    }
    navigate(cfg.nextRoute);
  };

  return (
    <div className="xths-area">
      <div className="xths-body">
        <div className="xths-left">
          <div className="xths-scan-preview">
            <div className="xths-scan-frame" ref={scanFrameRef}>
              <img src={activePage.image} alt={activePage.label} className="xths-scan-main" />
              <div className="xths-scan-beam" />
              <div className="xths-scan-corners">
                <span className="xths-scan-corner xths-scan-corner--tl" />
                <span className="xths-scan-corner xths-scan-corner--tr" />
                <span className="xths-scan-corner xths-scan-corner--bl" />
                <span className="xths-scan-corner xths-scan-corner--br" />
              </div>
            </div>
          </div>
          <div className="xths-thumbs">
            {cfg.pages.map((p, i) => (
              <div
                key={i}
                className={`xths-thumb${activeIdx === i ? ' xths-thumb--active' : ''}`}
                onClick={() => setActiveIdx(i)}
              >
                <img src={p.image} alt={p.label} />
                <span className="xths-thumb-label">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="xths-right" data-mode={mode}>
          <div className="xths-docx-header">
            <span className="xths-docx-filename">{cfg.filename}</span>
            <span className="xths-docx-ai-badge">
              <span className="xths-ai-dot" />
              AI ASSIST ENABLED
            </span>
          </div>
          {mode === 'docx' ? (
            <div className="xths-docx-scroll">
              <div
                className="xths-docx-paper"
                dangerouslySetInnerHTML={{ __html: docBodyHTML }}
              />
            </div>
          ) : (
            <div
              ref={ocrScrollRef}
              className="xths-ocr-scroll"
              dangerouslySetInnerHTML={{ __html: activePage.ocrHTML ?? '' }}
            />
          )}
        </div>
      </div>

      <div className="xths-footer">
        <a
          className="xths-footer-btn xths-footer-btn--back"
          onClick={() => navigate(-1)}
          href="#"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>QUAY LẠI</span>
        </a>
        <a
          className="xths-footer-btn xths-footer-btn--submit"
          onClick={(e) => {
            e.preventDefault();
            handleNext();
          }}
          href="#"
        >
          <span>TIẾP TỤC</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
