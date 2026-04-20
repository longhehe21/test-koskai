import '@styles/pages/xem-truoc-ho-so.css';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';
import {
  CT01_BACK_BODY,
  CT01_BODY,
  CT02_BACK_BODY,
  CT02_BODY,
  CT03_BODY,
  LUU_TRU_BODY,
  QSDD_OCR_HTML,
  TAM_TRU_BODY,
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
  '/xem-truoc-tam-tru': {
    docImage: '/assets/mau-tam-tru.svg',
    pages: [
      { label: 'Trang 1', image: '/assets/mau-tam-tru.svg' },
      { label: 'Trang 2', image: '/assets/mau-tam-tru.svg' },
    ],
    filename: 'MauCT01_DangKyTamTru.docx',
    pageTitle: 'Xem trước hồ sơ – Tạm trú',
    nextRoute: '/nop-ho-so-thanh-cong',
    docBodyHTML: TAM_TRU_BODY,
  },
};

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
    return STATIC_CONFIGS[location.pathname] ?? STATIC_CONFIGS['/xem-truoc-tam-vang'];
  }, [location.pathname]);

  usePageHeader({ title: cfg.pageTitle });

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setActiveIdx(0);
  }, [cfg]);

  const activePage = cfg.pages[activeIdx] ?? cfg.pages[0];
  const mode = activePage.ocrHTML ? 'ocr' : 'docx';
  const docBodyHTML = activePage.docBodyHTML ?? cfg.docBodyHTML;

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
            <div className="xths-scan-frame">
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
