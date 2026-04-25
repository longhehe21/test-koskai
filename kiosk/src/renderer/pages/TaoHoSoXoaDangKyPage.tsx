import '@styles/pages/tao-ho-so-thuong-tru.css';
import '@styles/pages/tao-ho-so-tam-tru-danh-sach.css';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useCurrentUser } from '@hooks/useCurrentUser';
import { useUnsavedChangesGuard } from '@hooks/useUnsavedChangesGuard';
import { useTamTruFlowStore, type XoaDangKyCaseId } from '@store/tamTruFlowStore';
import { getTamTruMissingDocs, getTamTruScanRoute } from '@utils/validateAttachments';
import { useDraftLifecycle } from '@hooks/useDraftLifecycle';
import { DraftResumeGate } from '@components/DraftResumeGate';
import { useDraftFormStore } from '@store/draftFormStore';

const PROCEDURE_CODE = 'xoa-dang-ky';
import {
  ConfirmSubmitModal,
  SubmitBlockedModal,
  UnsavedChangesModal,
} from '@components/ui';
import {
  Dropdown,
  DatePicker,
  DraftSavedToast,
  FormFooter,
  MultiSelect,
  ProvinceWardSelect,
  type DropdownItem,
} from '@components/ui';
import {
  COQUAN_ITEMS,
  GIOI_TINH_ITEMS,
  QUAN_HE_ITEMS,
  RowActions,
} from './tao-ho-so-thuong-tru/shared';

type NguoiKhai = 'nguoi-khai' | 'khai-ho';

const THU_TUC_ITEMS: DropdownItem[] = [
  { code: 'dang-ky', name: 'Đăng ký tạm trú' },
  { code: 'gia-han', name: 'Gia hạn tạm trú' },
  { code: 'xoa-dang-ky', name: 'Xóa đăng ký tạm trú' },
];

const TRUONG_HOP_ITEMS: DropdownItem[] = [
  { code: 'ho-vang-mat-6thang', name: 'Hộ do vắng mặt từ 6 tháng trở lên' },
  { code: 'nhan-khau-khong-con-cho-o', name: 'Nhân khẩu hộ do không còn chỗ ở hợp pháp' },
  { code: 'nhan-khau-da-dk-thuong-tru', name: 'Nhân khẩu do đã đăng ký thường trú tại nơi tạm trú' },
  { code: 'ca-ho-khong-con-cho-o', name: 'Cả hộ do không còn chỗ ở hợp pháp' },
  { code: 'nhan-khau-vang-mat-6thang', name: 'Nhân khẩu do vắng mặt từ 6 tháng trở lên' },
  { code: 'ho-da-dk-thuong-tru', name: 'Hộ do đã đăng ký thường trú tại nơi tạm trú' },
];

const THONG_BAO_OPTIONS = [
  { code: 'email', label: 'Qua email' },
  { code: 'cong-tt', label: 'Qua cổng thông tin' },
];

const KET_QUA_OPTIONS: DropdownItem[] = [
  { code: 'truc-tiep', name: 'Nhận trực tiếp' },
  { code: 'email', name: 'Qua email' },
  { code: 'cong-tt', name: 'Nhận qua cổng thông tin' },
];

interface ThanhVienRow {
  id: number;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: string;
  cccd: string;
  quanHe: DropdownItem | null;
}

interface HoSoRow {
  id: number;
  tenGiayTo: string;
}

const emptyThanhVien = (id: number): ThanhVienRow => ({
  id,
  hoTen: '',
  ngaySinh: '',
  gioiTinh: '',
  cccd: '',
  quanHe: null,
});

function truongHopFromCase(xoaCase: XoaDangKyCaseId): DropdownItem {
  const match = TRUONG_HOP_ITEMS.find((t) => t.code === xoaCase);
  return match ?? TRUONG_HOP_ITEMS[0];
}

export default function TaoHoSoXoaDangKyPage() {
  return (
    <DraftResumeGate procedureCode={PROCEDURE_CODE}>
      {(loadedAppId) => <TaoHoSoXoaDangKyForm key={loadedAppId ?? 'fresh'} />}
    </DraftResumeGate>
  );
}

function TaoHoSoXoaDangKyForm() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const xoaCaseFromFlow = useTamTruFlowStore((s) => s.xoaDangKyCase);
  const defaultTruongHop = useMemo(
    () => truongHopFromCase(xoaCaseFromFlow),
    [xoaCaseFromFlow],
  );

  usePageHeader({ title: 'Hồ sơ xóa đăng ký tạm trú' });

  const cachedForm = useMemo(
    () => (useDraftFormStore.getState().forms[PROCEDURE_CODE] ?? {}) as Record<string, unknown>,
    [],
  );
  const c1 = (cachedForm.section1 ?? {}) as Record<string, unknown>;
  const c2 = (cachedForm.section2 ?? {}) as Record<string, unknown>;
  const c3 = (cachedForm.section3 ?? {}) as Record<string, unknown>;
  const c5 = (cachedForm.section5 ?? {}) as Record<string, unknown>;
  const c7 = (cachedForm.section7 ?? {}) as Record<string, unknown>;
  const c8 = (cachedForm.section8 ?? {}) as Record<string, unknown>;

  // Build danh sách HSDK dynamic theo các tài liệu user thực sự đã "Đã có".
  // Q1 no (không scan) → list rỗng, user tự thêm qua nút "+ Thêm mới hồ sơ".
  const flow = useTamTruFlowStore.getState();
  const initialHoSo = useMemo<HoSoRow[]>(() => {
    const list: HoSoRow[] = [];
    let id = 1;
    if (flow.hasQ1) {
      list.push({ id: id++, tenGiayTo: 'Tờ khai thay đổi thông tin cư trú (CT01)' });
    }
    const q2LabelByCase: Partial<Record<NonNullable<XoaDangKyCaseId>, string>> = {
      'nhan-khau-khong-con-cho-o': 'Giấy tờ, tài liệu chứng minh chỗ ở hợp pháp',
      'ca-ho-khong-con-cho-o': 'Giấy tờ chứng minh về việc không còn chỗ ở hợp pháp',
    };
    const q2Label = flow.xoaDangKyCase ? q2LabelByCase[flow.xoaDangKyCase] : undefined;
    if (q2Label && flow.hasQ2) {
      list.push({ id: id++, tenGiayTo: q2Label });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Section I
  const [s1Province, setS1Province] = useState<DropdownItem | null>(
    (c1.province as DropdownItem | null) ?? null,
  );
  const [s1Ward, setS1Ward] = useState<DropdownItem | null>(
    (c1.ward as DropdownItem | null) ?? null,
  );
  const [s1CoQuan, setS1CoQuan] = useState<DropdownItem | null>(
    (c1.coquan as DropdownItem | null) ?? COQUAN_ITEMS[0],
  );
  const [s1Sdt, setS1Sdt] = useState((c1.sdt as string) ?? '');

  // Section II — Thủ tục + Trường hợp (cả 2 locked)
  const [thuTuc, setThuTuc] = useState<DropdownItem | null>(
    (c2.thuTuc as DropdownItem | null)
      ?? THU_TUC_ITEMS.find((t) => t.code === 'xoa-dang-ky')
      ?? THU_TUC_ITEMS[2],
  );
  const [truongHop, setTruongHop] = useState<DropdownItem | null>(
    (c2.truongHop as DropdownItem | null) ?? defaultTruongHop,
  );

  // Section III — Người đề nghị xóa đăng ký tạm trú
  const [nguoiKhai, setNguoiKhai] = useState<NguoiKhai>(
    (c3.nguoiKhai as NguoiKhai) ?? 'nguoi-khai',
  );
  const [ddHoTen, setDdHoTen] = useState((c3.ddHoTen as string) ?? user.hoTen);
  const [ddNgaySinh, setDdNgaySinh] = useState((c3.ddNgaySinh as string) ?? user.ngaySinh);
  const [ddGioiTinh, setDdGioiTinh] = useState<DropdownItem | null>(
    (c3.ddGioiTinh as DropdownItem | null)
      ?? GIOI_TINH_ITEMS.find((g) => g.name === user.gioiTinh)
      ?? null,
  );
  const [ddCccd, setDdCccd] = useState((c3.ddCccd as string) ?? user.cccd);
  const [ddSdt, setDdSdt] = useState((c3.ddSdt as string) ?? user.sdt);
  const [ddEmail, setDdEmail] = useState((c3.ddEmail as string) ?? '');
  const [chuHoHoTen, setChuHoHoTen] = useState((c3.chuHoHoTen as string) ?? user.hoTen);
  const [chuHoQuanHe, setChuHoQuanHe] = useState<DropdownItem | null>(
    (c3.chuHoQuanHe as DropdownItem | null)
      ?? QUAN_HE_ITEMS.find((q) => q.code === 'chu-ho')
      ?? null,
  );
  const [chuHoCccd, setChuHoCccd] = useState((c3.chuHoCccd as string) ?? '035405033077');

  useEffect(() => {
    if (nguoiKhai === 'nguoi-khai') {
      setDdHoTen(user.hoTen);
      setDdNgaySinh(user.ngaySinh);
      setDdGioiTinh(GIOI_TINH_ITEMS.find((g) => g.name === user.gioiTinh) ?? null);
      setDdCccd(user.cccd);
      setDdSdt(user.sdt);
    } else {
      setDdHoTen('');
      setDdNgaySinh('');
      setDdGioiTinh(null);
      setDdCccd('');
      setDdSdt('');
      setDdEmail('');
    }
  }, [nguoiKhai, user]);

  // Section V — Thành viên hộ gia đình cùng thay đổi
  const defaultThanhVien: ThanhVienRow[] = [
    {
      id: 1,
      hoTen: user.hoTen,
      ngaySinh: '30/01/2004',
      gioiTinh: 'Nữ',
      cccd: '0346976829',
      quanHe: QUAN_HE_ITEMS.find((q) => q.code === 'chu-ho') ?? null,
    },
  ];
  const cachedThanhVien = (c5.thanhVien as ThanhVienRow[] | undefined);
  const [thanhVien, setThanhVien] = useState<ThanhVienRow[]>(
    cachedThanhVien && cachedThanhVien.length > 0 ? cachedThanhVien : defaultThanhVien,
  );
  const [thanhVienNext, setThanhVienNext] = useState(
    thanhVien.length > 0 ? Math.max(...thanhVien.map((r) => r.id)) + 1 : 2,
  );

  // Section VII — Hồ sơ đính kèm (danh sách dynamic theo tài liệu đã scan)
  const cachedHoSo = (c7.hoSo as HoSoRow[] | undefined);
  const [hoSo, setHoSo] = useState<HoSoRow[]>(
    cachedHoSo && cachedHoSo.length > 0 ? cachedHoSo : initialHoSo,
  );
  const [hoSoNext, setHoSoNext] = useState(
    hoSo.length > 0 ? Math.max(...hoSo.map((r) => r.id)) + 1 : initialHoSo.length + 1,
  );

  // Section VIII — Nhận kết quả
  const [s8ThongBao, setS8ThongBao] = useState<string[]>(
    (c8.thongBao as string[]) ?? [],
  );
  const [s8KetQua, setS8KetQua] = useState<DropdownItem | null>(
    (c8.ketQua as DropdownItem | null) ?? null,
  );
  const [s8Email, setS8Email] = useState((c8.email as string) ?? '');
  const showEmail = s8ThongBao.includes('email') || s8KetQua?.code === 'email';

  const [committed, setCommitted] = useState((cachedForm.committed as boolean) ?? false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [missingDocs, setMissingDocs] = useState<string[]>([]);

  const buildFormData = () => ({
    section1: { province: s1Province, ward: s1Ward, coquan: s1CoQuan, sdt: s1Sdt },
    section2: { thuTuc, truongHop },
    section3: {
      nguoiKhai, ddHoTen, ddNgaySinh, ddGioiTinh, ddCccd, ddSdt, ddEmail,
      chuHoHoTen, chuHoQuanHe, chuHoCccd,
    },
    section5: { thanhVien },
    section7: { hoSo },
    section8: { thongBao: s8ThongBao, ketQua: s8KetQua, email: s8Email },
    committed,
  });

  const {
    showDraft, setShowDraft, draftTrackingCode,
    persistDraftSilent, handleSaveDraft, handleConfirmSubmit: doConfirmSubmit,
  } = useDraftLifecycle({ procedureCode: PROCEDURE_CODE, buildFormData });

  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };
  const { guard, proceed, cancel, isPrompting } = useUnsavedChangesGuard(isDirty);

  const handleS1Ward = (item: DropdownItem) => {
    setS1Ward(item);
    setS1CoQuan({ code: `coquan-${item.code}`, name: `Công an ${item.name}` });
  };

  const addThanhVien = () => {
    setThanhVien((prev) => [...prev, emptyThanhVien(thanhVienNext)]);
    setThanhVienNext((n) => n + 1);
  };
  const updateThanhVien = (id: number, patch: Partial<ThanhVienRow>) => {
    setThanhVien((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeThanhVien = (id: number) => {
    setThanhVien((prev) => prev.filter((r) => r.id !== id));
  };

  const addHoSo = () => {
    setHoSo((prev) => [...prev, { id: hoSoNext, tenGiayTo: '' }]);
    setHoSoNext((n) => n + 1);
  };
  const removeHoSo = (id: number) => {
    setHoSo((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = () => {
    if (!committed) return;
    const missing = getTamTruMissingDocs();
    if (missing.length > 0) {
      setMissingDocs(missing);
      return;
    }
    setMissingDocs([]);
    setShowConfirmSubmit(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmSubmit(false);
    setIsDirty(false);
    await doConfirmSubmit();
  };

  return (
    <>
      <div
        className="tkbtv-area"
        onFocusCapture={markDirty}
        onChangeCapture={markDirty}
      >
        <h1 className="tkbtv-page-title">Hồ sơ xóa đăng ký tạm trú</h1>
        <p className="tkbtv-page-subtitle">
          Vui lòng điền chính xác các thông tin dưới đây để thực hiện thủ tục đăng ký tạm trú theo quy định của pháp luật
        </p>

        <div className="tkbtv-form">
          {/* I */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">I. CƠ QUAN THỰC HIỆN</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <ProvinceWardSelect
                  province={s1Province}
                  ward={s1Ward}
                  onProvinceChange={setS1Province}
                  onWardChange={handleS1Ward}
                  defaultProvinceName="Thành phố Hà Nội"
                  defaultWardName="Phường Ba Đình"
                  provinceLabel="Tỉnh/Thành phố"
                  wardLabel="Quận/Huyện/Xã"
                  provinceRequired
                  wardRequired
                />
              </div>
              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Cơ quan thực hiện <span className="tkbtv-req">*</span>
                  </label>
                  <Dropdown
                    value={s1CoQuan}
                    placeholder="Chọn cơ quan"
                    items={COQUAN_ITEMS}
                    onChange={setS1CoQuan}
                  />
                </div>
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    placeholder="Số điện thoại"
                    value={s1Sdt}
                    onChange={(e) => setS1Sdt(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* II */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">THỦ TỤC HÀNH CHÍNH YÊU CẦU</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Thủ tục <span className="tkbtv-req">*</span>
                  </label>
                  <Dropdown
                    value={thuTuc}
                    placeholder="Chọn thủ tục"
                    items={THU_TUC_ITEMS}
                    onChange={setThuTuc}
                    locked
                  />
                </div>
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Trường hợp <span className="tkbtv-req">*</span>
                  </label>
                  <Dropdown
                    value={truongHop}
                    placeholder="Chọn trường hợp"
                    items={TRUONG_HOP_ITEMS}
                    onChange={setTruongHop}
                    locked
                  />
                </div>
              </div>
            </div>
          </div>

          {/* III — Người đề nghị xóa đăng ký */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">
              THÔNG TIN NGƯỜI ĐỀ NGHỊ XÓA ĐĂNG KÝ TẠM TRÚ
            </div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <div className="tkbtv-radio-group tkbtv-radio-group--stack">
                  <label
                    className={`tkbtv-radio${nguoiKhai === 'nguoi-khai' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setNguoiKhai('nguoi-khai')}
                  >
                    <span className="tkbtv-radio-dot" />
                    Người khai thông tin là người Xóa đăng ký tạm trú
                  </label>
                  <label
                    className={`tkbtv-radio${nguoiKhai === 'khai-ho' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setNguoiKhai('khai-ho')}
                  >
                    <span className="tkbtv-radio-dot" />
                    Khai hộ (yêu cầu khai đúng các trường thông tin có trong cơ sở dữ liệu quốc gia)
                  </label>
                </div>
              </div>

              <div className="tkbtv-row tkbtv-row--three">
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Họ và tên <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={ddHoTen}
                    onChange={(e) => setDdHoTen(e.target.value)}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Ngày sinh <span className="tkbtv-req">*</span>
                  </label>
                  <DatePicker
                    value={ddNgaySinh}
                    placeholder="dd/mm/yyyy"
                    onChange={setDdNgaySinh}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">Số định danh cá nhân</label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={ddCccd}
                    onChange={(e) => setDdCccd(e.target.value)}
                  />
                </div>
              </div>

              <div className="tkbtv-row tkbtv-row--three">
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Giới tính <span className="tkbtv-req">*</span>
                  </label>
                  <Dropdown
                    value={ddGioiTinh}
                    placeholder="Chọn giới tính"
                    items={GIOI_TINH_ITEMS}
                    onChange={setDdGioiTinh}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">SDT liên hệ</label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={ddSdt}
                    onChange={(e) => setDdSdt(e.target.value)}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">Email</label>
                  <input
                    type="email"
                    className="tkbtv-input"
                    value={ddEmail}
                    onChange={(e) => setDdEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="tkbtv-row tkbtv-row--three">
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Họ tên chủ hộ tạm trú <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={chuHoHoTen}
                    onChange={(e) => setChuHoHoTen(e.target.value)}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Quan hệ với chủ hộ tạm trú <span className="tkbtv-req">*</span>
                  </label>
                  <Dropdown
                    value={chuHoQuanHe}
                    placeholder="Chọn quan hệ"
                    items={QUAN_HE_ITEMS}
                    onChange={setChuHoQuanHe}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Số ĐDCN chủ hộ tạm trú <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={chuHoCccd}
                    onChange={(e) => setChuHoCccd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* V — Thành viên hộ gia đình */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header tkbtv-section-header--with-action">
              <span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ verticalAlign: 'middle', marginRight: 6 }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                NHỮNG THÀNH VIÊN TRONG HỘ GIA ĐÌNH CÙNG THAY ĐỔI
              </span>
              <button type="button" className="tkbtv-section-action" onClick={addThanhVien}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Thêm người
              </button>
            </div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <table className="thtt-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>HỌ TÊN</th>
                      <th>NGÀY SINH</th>
                      <th>GIỚI TÍNH</th>
                      <th>SỐ DDCN</th>
                      <th>MỐI QUAN HỆ VỚI CHỦ HỘ</th>
                      <th>HÀNH ĐỘNG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thanhVien.map((r, i) => (
                      <tr key={r.id}>
                        <td className="thtt-stt">{i + 1}</td>
                        <td>
                          <input
                            type="text"
                            className="tkbtv-input tkbtv-input--xs"
                            value={r.hoTen}
                            onChange={(e) => updateThanhVien(r.id, { hoTen: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="tkbtv-input tkbtv-input--xs"
                            placeholder="dd/mm/yyyy"
                            value={r.ngaySinh}
                            onChange={(e) => updateThanhVien(r.id, { ngaySinh: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="tkbtv-input tkbtv-input--xs"
                            value={r.gioiTinh}
                            onChange={(e) => updateThanhVien(r.id, { gioiTinh: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="tkbtv-input tkbtv-input--xs"
                            value={r.cccd}
                            onChange={(e) => updateThanhVien(r.id, { cccd: e.target.value })}
                          />
                        </td>
                        <td>
                          <Dropdown
                            value={r.quanHe}
                            placeholder="Chọn"
                            items={QUAN_HE_ITEMS}
                            onChange={(v) => updateThanhVien(r.id, { quanHe: v })}
                          />
                        </td>
                        <td>
                          <RowActions onRemove={() => removeThanhVien(r.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* VII — Hồ sơ đính kèm */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header tkbtv-section-header--with-action">
              <span>VII. HỒ SƠ ĐÍNH KÈM</span>
              <button type="button" className="tkbtv-section-action" onClick={addHoSo}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Thêm mới hồ sơ
              </button>
            </div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <table className="thtt-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>TÊN GIẤY TỜ</th>
                      <th>HÌNH THỨC GIẤY TỜ</th>
                      <th>KHAI THÁC CSDL CHUYÊN NGÀNH / BIỂU MẪU ĐIỆN TỬ</th>
                      <th>ĐÍNH KÈM</th>
                      <th>SỐ LƯỢNG</th>
                      <th>GHI CHÚ</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoSo.length === 0 ? (
                      <tr>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                      </tr>
                    ) : (
                      hoSo.map((r, i) => (
                        <tr key={r.id}>
                          <td className="thtt-stt">{i + 1}</td>
                          <td>
                            <a href="#" className="thtt-link" onClick={(e) => e.preventDefault()}>
                              {r.tenGiayTo || '—'}
                            </a>
                          </td>
                          <td className="thtt-empty-cell">—</td>
                          <td className="thtt-empty-cell">—</td>
                          <td className="thtt-empty-cell">—</td>
                          <td className="thtt-empty-cell">—</td>
                          <td className="thtt-empty-cell">—</td>
                          <td>
                            <RowActions onRemove={() => removeHoSo(r.id)} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* VIII — Nhận kết quả */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">VIII THÔNG TIN NHẬN KẾT QUẢ</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Hình thức nhận thông báo <span className="tkbtv-req">*</span>
                  </label>
                  <MultiSelect
                    value={s8ThongBao}
                    options={THONG_BAO_OPTIONS}
                    placeholder="Chọn hình thức"
                    onChange={setS8ThongBao}
                  />
                  <p className="tkbtv-hint">
                    Bạn có thể chọn đồng thời nhiều phương thức để nhận cập nhật mới nhất về hồ sơ
                    của mình.
                  </p>
                </div>
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Hình thức nhận kết quả <span className="tkbtv-req">*</span>
                  </label>
                  <Dropdown
                    value={s8KetQua}
                    placeholder="Chọn hình thức"
                    items={KET_QUA_OPTIONS}
                    onChange={setS8KetQua}
                  />
                </div>
              </div>

              {showEmail && (
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Email <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="email"
                    className="tkbtv-input"
                    placeholder="example@gmail.com"
                    value={s8Email}
                    onChange={(e) => setS8Email(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="thtt-commit">
            <label className="thtt-checkbox">
              <input
                type="checkbox"
                checked={committed}
                onChange={(e) => setCommitted(e.target.checked)}
              />
              <span className="thtt-checkbox-box" />
              <span className="thtt-checkbox-text">
                Tôi xin chịu trách nhiệm trước pháp luật về lời khai trên
              </span>
            </label>
          </div>
        </div>

        <FormFooter
          onBack={() => guard(() => navigate(-1))}
          onDraft={() => void handleSaveDraft()}
          onSubmit={handleSubmit}
          submitEnabled={committed}
        />
      </div>

      <DraftSavedToast
        open={showDraft}
        onClose={() => setShowDraft(false)}
        listLabel="Xem danh sách hồ sơ"
        onList={() => navigate('/ho-so-cua-toi?status=draft')}
        trackingCode={draftTrackingCode}
      />

      <UnsavedChangesModal
        open={isPrompting}
        onClose={cancel}
        onSaveDraft={() => {
          cancel();
          void handleSaveDraft();
        }}
        onDiscard={proceed}
      />

      <ConfirmSubmitModal
        open={showConfirmSubmit}
        onCancel={() => setShowConfirmSubmit(false)}
        onConfirm={handleConfirmSubmit}
        title="Xác nhận nộp hồ sơ xóa đăng ký tạm trú"
      />

      <SubmitBlockedModal
        open={missingDocs.length > 0}
        missingDocs={missingDocs}
        onClose={() => setMissingDocs([])}
        onSaveDraft={() => {
          setMissingDocs([]);
          void handleSaveDraft();
        }}
        onGoBack={async () => {
          setMissingDocs([]);
          try { await persistDraftSilent(); } catch (err) {
            console.warn('[XoaDangKy] back-save fail:', (err as Error).message);
          }
          const route = getTamTruScanRoute();
          if (route) navigate(route);
        }}
      />
    </>
  );
}
