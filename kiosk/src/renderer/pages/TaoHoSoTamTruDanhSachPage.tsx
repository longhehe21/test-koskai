import '@styles/pages/tao-ho-so-thuong-tru.css';
import '@styles/pages/tao-ho-so-tam-tru-danh-sach.css';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useCurrentUser } from '@hooks/useCurrentUser';
import { useUnsavedChangesGuard } from '@hooks/useUnsavedChangesGuard';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';
import { getTamTruMissingDocs, getTamTruScanRoute } from '@utils/validateAttachments';
import { useDraftLifecycle } from '@hooks/useDraftLifecycle';
import { DraftResumeGate } from '@components/DraftResumeGate';
import { useDraftFormStore } from '@store/draftFormStore';

const PROCEDURE_CODE = 'tam-tru';
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
  LY_DO_MIEN_PHI_ITEMS,
  GIOI_TINH_ITEMS,
  RowActions,
} from './tao-ho-so-thuong-tru/shared';

type NguoiKeKhai = 'chu-ho' | 'chu-so-huu' | 'giam-ho';
type LePhi = 'co-phi' | 'mien-phi' | 'khong-phai-nop';

const LOAI_THU_TUC_ITEMS: DropdownItem[] = [
  { code: 'dang-ky', name: 'Đăng ký tạm trú' },
  { code: 'gia-han', name: 'Gia hạn tạm trú' },
  { code: 'xoa-dang-ky', name: 'Xóa đăng ký tạm trú' },
];

const TRUONG_HOP_ITEMS: DropdownItem[] = [
  { code: 'theo-danh-sach', name: 'Đăng ký tạm trú theo danh sách' },
  { code: 'nhan-khau-ho', name: 'Đăng ký tạm trú (Nhân khẩu hộ)' },
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

interface CongDanRow {
  id: number;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: string;
  cccd: string;
  thoiHan: string;
}

interface XinYKienRow {
  id: number;
  hoTen: string;
  cccd: string;
  ngaySinh: string;
  vaiTro: DropdownItem | null;
}

interface HoSoRow {
  id: number;
  tenGiayTo: string;
  hinhThuc: string;
  soLuong: string;
  ghiChu: string;
}

const emptyCongDan = (id: number): CongDanRow => ({
  id,
  hoTen: '',
  ngaySinh: '',
  gioiTinh: '',
  cccd: '',
  thoiHan: '',
});

const emptyXinYKien = (id: number): XinYKienRow => ({
  id,
  hoTen: '',
  cccd: '',
  ngaySinh: '',
  vaiTro: null,
});

const emptyHoSo = (id: number): HoSoRow => ({
  id,
  tenGiayTo: '',
  hinhThuc: '',
  soLuong: '',
  ghiChu: '',
});

export default function TaoHoSoTamTruDanhSachPage() {
  return (
    <DraftResumeGate procedureCode={PROCEDURE_CODE}>
      {(loadedAppId) => <TaoHoSoTamTruDanhSachForm key={loadedAppId ?? 'fresh'} />}
    </DraftResumeGate>
  );
}

function TaoHoSoTamTruDanhSachForm() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const truongHopFromFlow = useTamTruFlowStore((s) => s.truongHop);
  const defaultTruongHop = useMemo(
    () =>
      TRUONG_HOP_ITEMS.find((t) => t.code === truongHopFromFlow) ?? TRUONG_HOP_ITEMS[0],
    [truongHopFromFlow],
  );

  usePageHeader({ title: 'Hồ sơ đăng ký tạm trú' });

  const cachedForm = useMemo(
    () => (useDraftFormStore.getState().forms[PROCEDURE_CODE] ?? {}) as Record<string, unknown>,
    [],
  );
  const c1 = (cachedForm.section1 ?? {}) as Record<string, unknown>;
  const c2 = (cachedForm.section2 ?? {}) as Record<string, unknown>;
  const c3 = (cachedForm.section3 ?? {}) as Record<string, unknown>;
  const c4 = (cachedForm.section4 ?? {}) as Record<string, unknown>;
  const c5 = (cachedForm.section5 ?? {}) as Record<string, unknown>;
  const c6 = (cachedForm.section6 ?? {}) as Record<string, unknown>;
  const c7 = (cachedForm.section7 ?? {}) as Record<string, unknown>;
  const c8 = (cachedForm.section8 ?? {}) as Record<string, unknown>;

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

  // Section II
  const [loaiThuTuc, setLoaiThuTuc] = useState<DropdownItem | null>(
    (c2.loaiThuTuc as DropdownItem | null) ?? LOAI_THU_TUC_ITEMS[0],
  );
  const [truongHop, setTruongHop] = useState<DropdownItem | null>(
    (c2.truongHop as DropdownItem | null) ?? defaultTruongHop,
  );

  // Section III — Thông tin đề nghị
  const [s3Province, setS3Province] = useState<DropdownItem | null>(
    (c3.province as DropdownItem | null) ?? null,
  );
  const [s3Ward, setS3Ward] = useState<DropdownItem | null>(
    (c3.ward as DropdownItem | null) ?? null,
  );
  const [s3DiaChi, setS3DiaChi] = useState((c3.diaChi as string) ?? 'Số 120 Trần Cung');
  const [laNguoiKhaiBao, setLaNguoiKhaiBao] = useState((c3.laNguoiKhaiBao as boolean) ?? true);
  const [daiDienHoTen, setDaiDienHoTen] = useState((c3.daiDienHoTen as string) ?? user.hoTen);
  const [daiDienNgaySinh, setDaiDienNgaySinh] = useState((c3.daiDienNgaySinh as string) ?? user.ngaySinh);
  const [daiDienCccd, setDaiDienCccd] = useState((c3.daiDienCccd as string) ?? user.cccd);
  const [daiDienGioiTinh, setDaiDienGioiTinh] = useState<DropdownItem | null>(
    (c3.daiDienGioiTinh as DropdownItem | null)
      ?? GIOI_TINH_ITEMS.find((g) => g.name === user.gioiTinh) ?? null,
  );
  const [daiDienSdt, setDaiDienSdt] = useState((c3.daiDienSdt as string) ?? user.sdt);
  const [daiDienEmail, setDaiDienEmail] = useState((c3.daiDienEmail as string) ?? '');
  const defaultNoiThuongTru = `${user.thuongTru.diaChi}, ${user.thuongTru.ward}, ${user.thuongTru.province}`;
  const [noiThuongTru, setNoiThuongTru] = useState(
    (c3.noiThuongTru as string) ?? defaultNoiThuongTru,
  );
  const [noiOHienTai, setNoiOHienTai] = useState((c3.noiOHienTai as string) ?? defaultNoiThuongTru);
  const [noiDungDeNghi, setNoiDungDeNghi] = useState(
    (c3.noiDungDeNghi as string) ?? 'Đăng ký tạm trú - Gia hạn tạm trú theo danh sách',
  );
  const [yKienDaiDien, setYKienDaiDien] = useState((c3.yKienDaiDien as string) ?? '');
  const [thoiHanTamTru, setThoiHanTamTru] = useState((c3.thoiHanTamTru as string) ?? '');

  // Section IV — Danh sách công dân đăng ký tạm trú
  const defaultCongDan: CongDanRow[] = [
    { id: 1, hoTen: user.hoTen, ngaySinh: user.ngaySinh, gioiTinh: user.gioiTinh, cccd: user.cccd, thoiHan: '' },
  ];
  const cachedCongDan = c4.congDan as CongDanRow[] | undefined;
  const [congDan, setCongDan] = useState<CongDanRow[]>(
    cachedCongDan && cachedCongDan.length > 0 ? cachedCongDan : defaultCongDan,
  );
  const [congDanNext, setCongDanNext] = useState(
    congDan.length > 0 ? Math.max(...congDan.map((r) => r.id)) + 1 : 2,
  );

  // Section V — Thông tin xác nhận tờ khai
  const [nguoiKeKhai, setNguoiKeKhai] = useState<NguoiKeKhai[]>(
    (c5.nguoiKeKhai as NguoiKeKhai[]) ?? [],
  );
  const cachedXinYKien = (c5.xinYKien as XinYKienRow[] | undefined) ?? [];
  const [xinYKien, setXinYKien] = useState<XinYKienRow[]>(cachedXinYKien);
  const [xinYKienNext, setXinYKienNext] = useState(
    cachedXinYKien.length > 0 ? Math.max(...cachedXinYKien.map((r) => r.id)) + 1 : 1,
  );

  // Section VI — Hồ sơ đính kèm
  const defaultHoSo: HoSoRow[] = [
    { id: 1, tenGiayTo: 'Giấy tờ chứng minh quyền sở hữu đất', hinhThuc: '', soLuong: '', ghiChu: '' },
  ];
  const cachedHoSo = c6.hoSo as HoSoRow[] | undefined;
  const [hoSo, setHoSo] = useState<HoSoRow[]>(
    cachedHoSo && cachedHoSo.length > 0 ? cachedHoSo : defaultHoSo,
  );
  const [hoSoNext, setHoSoNext] = useState(
    hoSo.length > 0 ? Math.max(...hoSo.map((r) => r.id)) + 1 : 2,
  );

  // Section VII — Thông tin nhận thông báo
  const [s7ThongBao, setS7ThongBao] = useState<string[]>((c7.thongBao as string[]) ?? []);
  const [s7KetQua, setS7KetQua] = useState<DropdownItem | null>(
    (c7.ketQua as DropdownItem | null) ?? null,
  );
  const [s7Email, setS7Email] = useState((c7.email as string) ?? '');
  const showEmail = s7ThongBao.includes('email') || s7KetQua?.code === 'email';

  // Section VIII — Thông tin lệ phí
  const [lePhi, setLePhi] = useState<LePhi>((c8.lePhi as LePhi) ?? 'co-phi');
  const [lyDoMienPhi, setLyDoMienPhi] = useState<DropdownItem | null>(
    (c8.lyDoMienPhi as DropdownItem | null) ?? null,
  );

  // Commit + draft
  const [committed, setCommitted] = useState((cachedForm.committed as boolean) ?? false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [missingDocs, setMissingDocs] = useState<string[]>([]);

  const buildFormData = () => ({
    section1: { province: s1Province, ward: s1Ward, coquan: s1CoQuan, sdt: s1Sdt },
    section2: { loaiThuTuc, truongHop },
    section3: {
      province: s3Province, ward: s3Ward, diaChi: s3DiaChi,
      laNguoiKhaiBao, daiDienHoTen, daiDienNgaySinh, daiDienCccd,
      daiDienGioiTinh, daiDienSdt, daiDienEmail,
      noiThuongTru, noiOHienTai, noiDungDeNghi, yKienDaiDien, thoiHanTamTru,
    },
    section4: { congDan },
    section5: { nguoiKeKhai, xinYKien },
    section6: { hoSo },
    section7: { thongBao: s7ThongBao, ketQua: s7KetQua, email: s7Email },
    section8: { lePhi, lyDoMienPhi },
    committed,
    __variant: 'danh-sach',
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

  // Handlers — Section I
  const handleS1Ward = (item: DropdownItem) => {
    setS1Ward(item);
    setS1CoQuan({ code: `coquan-${item.code}`, name: `Công an ${item.name}` });
  };

  // Handlers — Section IV
  const addCongDan = () => {
    setCongDan((prev) => [...prev, emptyCongDan(congDanNext)]);
    setCongDanNext((n) => n + 1);
  };
  const updateCongDan = (id: number, patch: Partial<CongDanRow>) => {
    setCongDan((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeCongDan = (id: number) => {
    setCongDan((prev) => prev.filter((r) => r.id !== id));
  };

  // Handlers — Section V
  const toggleNguoiKeKhai = (v: NguoiKeKhai) => {
    setNguoiKeKhai((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };
  const addXinYKien = () => {
    setXinYKien((prev) => [...prev, emptyXinYKien(xinYKienNext)]);
    setXinYKienNext((n) => n + 1);
  };
  const updateXinYKien = (id: number, patch: Partial<XinYKienRow>) => {
    setXinYKien((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeXinYKien = (id: number) => {
    setXinYKien((prev) => prev.filter((r) => r.id !== id));
  };

  // Handlers — Section VI
  const addHoSo = () => {
    setHoSo((prev) => [...prev, emptyHoSo(hoSoNext)]);
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
        <h1 className="tkbtv-page-title">HỒ SƠ ĐĂNG KÝ TẠM TRÚ</h1>
        <p className="tkbtv-page-subtitle">
          Ghi chú: Các thông tin có dấu (*) là thông tin bắt buộc phải nhập
        </p>

        <div className="tkbtv-form">
          {/* I */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">I. THỦ TỤC HÀNH CHÍNH YÊU CẦU</div>
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
                  wardLabel="Xã/Phường/Đặc khu"
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
            <div className="tkbtv-section-header">II. THỦ TỤC HÀNH CHÍNH YÊU CẦU</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Loại thủ tục <span className="tkbtv-req">*</span>
                  </label>
                  <Dropdown
                    value={loaiThuTuc}
                    placeholder="Chọn loại thủ tục"
                    items={LOAI_THU_TUC_ITEMS}
                    onChange={setLoaiThuTuc}
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

          {/* III */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">III. THÔNG TIN ĐỀ NGHỊ ĐĂNG KÝ TẠM TRÚ</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <ProvinceWardSelect
                  province={s3Province}
                  ward={s3Ward}
                  onProvinceChange={setS3Province}
                  onWardChange={setS3Ward}
                  defaultProvinceName={user.thuongTru.province}
                  defaultWardName={user.thuongTru.ward}
                  provinceLabel="Tỉnh/Thành Phố"
                  wardLabel="Xã/Phường/Đặc khu"
                  wardRequired
                />
              </div>
              <div className="tkbtv-field">
                <label className="tkbtv-label">Địa chỉ</label>
                <input
                  type="text"
                  className="tkbtv-input"
                  placeholder="Số nhà, đường phố"
                  value={s3DiaChi}
                  onChange={(e) => setS3DiaChi(e.target.value)}
                />
              </div>

              <h3 className="thtt-subheading">Thông tin người đại diện theo pháp luật</h3>
              <div className="tkbtv-field">
                <label className="thtt-checkbox thtt-checkbox--inline">
                  <input
                    type="checkbox"
                    checked={laNguoiKhaiBao}
                    onChange={(e) => setLaNguoiKhaiBao(e.target.checked)}
                  />
                  <span className="thtt-checkbox-box" />
                  <span className="thtt-checkbox-text">Là người khai báo</span>
                </label>
              </div>

              <div className="tkbtv-row tkbtv-row--three">
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Họ và tên <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={daiDienHoTen}
                    onChange={(e) => setDaiDienHoTen(e.target.value)}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Ngày sinh <span className="tkbtv-req">*</span>
                  </label>
                  <DatePicker
                    value={daiDienNgaySinh}
                    placeholder="dd/mm/yyyy"
                    onChange={setDaiDienNgaySinh}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">Số định danh cá nhân</label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={daiDienCccd}
                    onChange={(e) => setDaiDienCccd(e.target.value)}
                  />
                </div>
              </div>

              <div className="tkbtv-row tkbtv-row--three">
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Giới tính <span className="tkbtv-req">*</span>
                  </label>
                  <Dropdown
                    value={daiDienGioiTinh}
                    placeholder="Chọn giới tính"
                    items={GIOI_TINH_ITEMS}
                    onChange={setDaiDienGioiTinh}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">SDT liên hệ</label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={daiDienSdt}
                    onChange={(e) => setDaiDienSdt(e.target.value)}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">Email</label>
                  <input
                    type="email"
                    className="tkbtv-input"
                    value={daiDienEmail}
                    onChange={(e) => setDaiDienEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="tkbtv-field">
                <label className="tkbtv-label">Nơi thường trú</label>
                <input
                  type="text"
                  className="tkbtv-input"
                  value={noiThuongTru}
                  onChange={(e) => setNoiThuongTru(e.target.value)}
                />
              </div>
              <div className="tkbtv-field">
                <label className="tkbtv-label">Nơi ở hiện tại</label>
                <input
                  type="text"
                  className="tkbtv-input"
                  value={noiOHienTai}
                  onChange={(e) => setNoiOHienTai(e.target.value)}
                />
              </div>
              <div className="tkbtv-field">
                <label className="tkbtv-label">Nội dung đề nghị</label>
                <textarea
                  className="tkbtv-textarea"
                  value={noiDungDeNghi}
                  onChange={(e) => setNoiDungDeNghi(e.target.value)}
                />
              </div>
              <div className="tkbtv-field">
                <label className="tkbtv-label">Ý kiến của người đại diện</label>
                <textarea
                  className="tkbtv-textarea"
                  value={yKienDaiDien}
                  onChange={(e) => setYKienDaiDien(e.target.value)}
                />
              </div>
              <div className="tkbtv-field tkbtv-field--half">
                <label className="tkbtv-label">Thời hạn tạm trú đến ngày</label>
                <DatePicker
                  value={thoiHanTamTru}
                  placeholder="dd/mm/yyyy"
                  onChange={setThoiHanTamTru}
                />
              </div>
            </div>
          </div>

          {/* IV — Danh sách công dân đăng ký tạm trú */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ verticalAlign: 'middle', marginRight: 6 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              DANH SÁCH CÔNG DÂN ĐĂNG KÝ TẠM TRÚ
            </div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-upload-row">
                <a
                  className="tkbtv-upload-btn"
                  href="/assets/danh-sach-cong-dan-dang-ky-tam-tru.docx"
                  download="danh-sach-cong-dan-dang-ky-tam-tru.docx"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Tải file mẫu
                </a>
                <button type="button" className="tkbtv-upload-btn tkbtv-upload-btn--primary" onClick={addCongDan}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  Thêm mới người lưu trú
                </button>
              </div>

              <table className="thtt-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>HỌ TÊN</th>
                    <th>NGÀY SINH</th>
                    <th>GIỚI TÍNH</th>
                    <th>SỐ DDCN</th>
                    <th>THỜI HẠN</th>
                    <th>HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody>
                  {congDan.map((r, i) => (
                    <tr key={r.id}>
                      <td className="thtt-stt">{i + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="tkbtv-input tkbtv-input--xs"
                          value={r.hoTen}
                          onChange={(e) => updateCongDan(r.id, { hoTen: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tkbtv-input tkbtv-input--xs"
                          placeholder="dd/mm/yyyy"
                          value={r.ngaySinh}
                          onChange={(e) => updateCongDan(r.id, { ngaySinh: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tkbtv-input tkbtv-input--xs"
                          value={r.gioiTinh}
                          onChange={(e) => updateCongDan(r.id, { gioiTinh: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tkbtv-input tkbtv-input--xs"
                          value={r.cccd}
                          onChange={(e) => updateCongDan(r.id, { cccd: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tkbtv-input tkbtv-input--xs"
                          placeholder="dd/mm/yyyy"
                          value={r.thoiHan}
                          onChange={(e) => updateCongDan(r.id, { thoiHan: e.target.value })}
                        />
                      </td>
                      <td>
                        <RowActions
                          onAdd={addCongDan}
                          onRemove={congDan.length > 1 ? () => removeCongDan(r.id) : undefined}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* V — Xác nhận tờ khai */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">
              V. THÔNG TIN XÁC NHẬN TỜ KHAI THÔNG TIN CƯ TRÚ BẢN ĐIỆN TỬ
            </div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field tkbtv-field--half">
                <label className="tkbtv-label">Trạng thái xác nhận</label>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--locked"
                  value="Chưa gửi"
                  readOnly
                />
              </div>

              <div className="tkbtv-field">
                <label className="tkbtv-label">Người kê khai là:</label>
                <div className="thtt-checkbox-group">
                  {(
                    [
                      ['chu-ho', 'Chủ hộ'],
                      ['chu-so-huu', 'Chủ sở hữu chỗ ở hợp pháp'],
                      ['giam-ho', 'Cha / mẹ / người giám hộ'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="thtt-checkbox thtt-checkbox--inline">
                      <input
                        type="checkbox"
                        checked={nguoiKeKhai.includes(key)}
                        onChange={() => toggleNguoiKeKhai(key)}
                      />
                      <span className="thtt-checkbox-box" />
                      <span className="thtt-checkbox-text">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="tkbtv-field">
                <div className="thtt-table-header-row">
                  <label className="tkbtv-label">Danh sách người cần xin ý kiến</label>
                  <button type="button" className="thtt-add-link" onClick={addXinYKien}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Thêm mới người xin ý kiến
                  </button>
                </div>
                <table className="thtt-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>HỌ VÀ TÊN</th>
                      <th>SỐ DDCN</th>
                      <th>NGÀY SINH</th>
                      <th>VAI TRÒ</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {xinYKien.length === 0 ? (
                      <tr>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                      </tr>
                    ) : (
                      xinYKien.map((r, i) => (
                        <tr key={r.id}>
                          <td className="thtt-stt">{i + 1}</td>
                          <td>
                            <input
                              type="text"
                              className="tkbtv-input tkbtv-input--xs"
                              value={r.hoTen}
                              onChange={(e) => updateXinYKien(r.id, { hoTen: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="tkbtv-input tkbtv-input--xs"
                              value={r.cccd}
                              onChange={(e) => updateXinYKien(r.id, { cccd: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="tkbtv-input tkbtv-input--xs"
                              placeholder="dd/mm/yyyy"
                              value={r.ngaySinh}
                              onChange={(e) => updateXinYKien(r.id, { ngaySinh: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="tkbtv-input tkbtv-input--xs"
                              value={r.vaiTro?.name ?? ''}
                              onChange={(e) =>
                                updateXinYKien(r.id, {
                                  vaiTro: { code: e.target.value, name: e.target.value },
                                })
                              }
                            />
                          </td>
                          <td>
                            <RowActions
                              onAdd={addXinYKien}
                              onRemove={() => removeXinYKien(r.id)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* VI — Hồ sơ đính kèm */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">VI. HỒ SƠ ĐÍNH KÈM</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <div className="thtt-table-header-row">
                  <span />
                  <button type="button" className="thtt-add-link" onClick={addHoSo}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Thêm mới hồ sơ
                  </button>
                </div>
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
                    {hoSo.map((r, i) => (
                      <tr key={r.id}>
                        <td className="thtt-stt">{i + 1}</td>
                        <td>
                          <a href="#" className="thtt-link" onClick={(e) => e.preventDefault()}>
                            {r.tenGiayTo || '—'}
                          </a>
                        </td>
                        <td className="thtt-empty-cell">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td className="thtt-empty-cell">—</td>
                        <td>
                          <RowActions
                            onAdd={addHoSo}
                            onRemove={hoSo.length > 1 ? () => removeHoSo(r.id) : undefined}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* VII — Thông tin nhận thông báo */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">
              VII. THÔNG TIN NHẬN THÔNG BÁO TÌNH TRẠNG HỒ SƠ, KẾT QUẢ GIẢI QUYẾT HỒ SƠ
            </div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Hình thức nhận thông báo <span className="tkbtv-req">*</span>
                  </label>
                  <MultiSelect
                    value={s7ThongBao}
                    options={THONG_BAO_OPTIONS}
                    placeholder="Chọn hình thức"
                    onChange={setS7ThongBao}
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
                    value={s7KetQua}
                    placeholder="Chọn hình thức"
                    items={KET_QUA_OPTIONS}
                    onChange={setS7KetQua}
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
                    value={s7Email}
                    onChange={(e) => setS7Email(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* VIII — Lệ phí */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">VIII. THÔNG TIN LỆ PHÍ</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <div className="tkbtv-radio-group">
                  <label
                    className={`tkbtv-radio${lePhi === 'co-phi' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setLePhi('co-phi')}
                  >
                    <span className="tkbtv-radio-dot" /> Có phí
                  </label>
                  <label
                    className={`tkbtv-radio${lePhi === 'mien-phi' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setLePhi('mien-phi')}
                  >
                    <span className="tkbtv-radio-dot" /> Miễn phí (Trường hợp ưu tiên)
                  </label>
                  <label
                    className={`tkbtv-radio${lePhi === 'khong-phai-nop' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setLePhi('khong-phai-nop')}
                  >
                    <span className="tkbtv-radio-dot" /> Không phải nộp lệ phí
                  </label>
                </div>
              </div>

              <div className="thtt-fee-card">
                <div className="thtt-fee-info">
                  <span className="thtt-fee-label">TỔNG LỆ PHÍ</span>
                  <span className="thtt-fee-value">15.000 VNĐ</span>
                </div>
                <div className="thtt-fee-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
              </div>

              <div className="tkbtv-field">
                <label className="tkbtv-label">Lý do miễn lệ phí</label>
                <Dropdown
                  value={lyDoMienPhi}
                  placeholder=""
                  items={LY_DO_MIEN_PHI_ITEMS}
                  onChange={setLyDoMienPhi}
                />
              </div>
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
        title="Xác nhận nộp hồ sơ đăng ký tạm trú theo danh sách"
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
            console.warn('[TamTruDS] back-save fail:', (err as Error).message);
          }
          const route = getTamTruScanRoute();
          if (route) navigate(route);
        }}
      />
    </>
  );
}
