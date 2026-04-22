import '@styles/pages/tao-ho-so-thuong-tru.css';
import '@styles/pages/tao-ho-so-tam-tru-danh-sach.css';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useCurrentUser } from '@hooks/useCurrentUser';
import { useUnsavedChangesGuard } from '@hooks/useUnsavedChangesGuard';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';
import {
  ConfirmSubmitModal,
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
  QUAN_HE_ITEMS,
  RowActions,
} from './tao-ho-so-thuong-tru/shared';

type HoSoMoi = 'vao-ho' | 'lap-ho-moi';
type NguoiKhai = 'nguoi-khai' | 'khai-ho';
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

interface ThanhVienRow {
  id: number;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: string;
  cccd: string;
  quanHe: DropdownItem | null;
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
}

const emptyThanhVien = (id: number): ThanhVienRow => ({
  id,
  hoTen: '',
  ngaySinh: '',
  gioiTinh: '',
  cccd: '',
  quanHe: null,
});

const emptyXinYKien = (id: number): XinYKienRow => ({
  id,
  hoTen: '',
  cccd: '',
  ngaySinh: '',
  vaiTro: null,
});

export default function TaoHoSoTamTruNhanKhauHoPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const truongHopFromFlow = useTamTruFlowStore((s) => s.truongHop);
  const defaultTruongHop = useMemo(
    () =>
      TRUONG_HOP_ITEMS.find((t) => t.code === truongHopFromFlow) ?? TRUONG_HOP_ITEMS[1],
    [truongHopFromFlow],
  );

  usePageHeader({ title: 'Hồ sơ đăng ký tạm trú' });

  // Section I
  const [s1Province, setS1Province] = useState<DropdownItem | null>(null);
  const [s1Ward, setS1Ward] = useState<DropdownItem | null>(null);
  const [s1CoQuan, setS1CoQuan] = useState<DropdownItem | null>(COQUAN_ITEMS[0]);
  const [s1Sdt, setS1Sdt] = useState('');

  // Section II
  const [loaiThuTuc, setLoaiThuTuc] = useState<DropdownItem | null>(LOAI_THU_TUC_ITEMS[0]);
  const [truongHop, setTruongHop] = useState<DropdownItem | null>(defaultTruongHop);
  const [hoSoMoi, setHoSoMoi] = useState<HoSoMoi>('lap-ho-moi');

  // Section III — Người đề nghị
  const [nguoiKhai, setNguoiKhai] = useState<NguoiKhai>('nguoi-khai');
  const [ddHoTen, setDdHoTen] = useState(user.hoTen);
  const [ddNgaySinh, setDdNgaySinh] = useState(user.ngaySinh);
  const [ddGioiTinh, setDdGioiTinh] = useState<DropdownItem | null>(
    GIOI_TINH_ITEMS.find((g) => g.name === user.gioiTinh) ?? null,
  );
  const [ddCccd, setDdCccd] = useState(user.cccd);
  const [ddSdt, setDdSdt] = useState(user.sdt);
  const [ddEmail, setDdEmail] = useState('');

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

  // Section IV — Thông tin đề nghị
  const [s4Province, setS4Province] = useState<DropdownItem | null>(null);
  const [s4Ward, setS4Ward] = useState<DropdownItem | null>(null);
  const [s4DiaChi, setS4DiaChi] = useState('Số 120 Trần Cung');
  const [chuHoHoTen, setChuHoHoTen] = useState('');
  const [chuHoQuanHe, setChuHoQuanHe] = useState<DropdownItem | null>(null);
  const [chuHoCccd, setChuHoCccd] = useState('');
  const [noiDungDeNghi, setNoiDungDeNghi] = useState('Đăng ký tạm trú tại Phường Ba Đình - Thành phố Hà Nội');
  const [thoiHanTamTru, setThoiHanTamTru] = useState('');

  // Section V — Thành viên hộ gia đình cùng thay đổi
  const [thanhVien, setThanhVien] = useState<ThanhVienRow[]>([
    {
      id: 1,
      hoTen: 'Nguyễn Văn A',
      ngaySinh: '30/01/2004',
      gioiTinh: 'Nam',
      cccd: '03830xxxxxxx',
      quanHe: QUAN_HE_ITEMS.find((q) => q.code === 'con') ?? null,
    },
  ]);
  const [thanhVienNext, setThanhVienNext] = useState(2);

  // Section VI — Xác nhận tờ khai
  const [nguoiKeKhai, setNguoiKeKhai] = useState<NguoiKeKhai[]>([]);
  const [xinYKien, setXinYKien] = useState<XinYKienRow[]>([]);
  const [xinYKienNext, setXinYKienNext] = useState(1);

  // Section VII — Hồ sơ đính kèm
  const [hoSo, setHoSo] = useState<HoSoRow[]>([
    { id: 1, tenGiayTo: 'Giấy tờ chứng minh quyền sở hữu đất' },
  ]);
  const [hoSoNext, setHoSoNext] = useState(2);

  // Section VIII — Nhận thông báo
  const [s8ThongBao, setS8ThongBao] = useState<string[]>([]);
  const [s8KetQua, setS8KetQua] = useState<DropdownItem | null>(null);
  const [s8Email, setS8Email] = useState('');
  const showEmail = s8ThongBao.includes('email') || s8KetQua?.code === 'email';

  // Section IX — Lệ phí
  const [lePhi, setLePhi] = useState<LePhi>('co-phi');
  const [lyDoMienPhi, setLyDoMienPhi] = useState<DropdownItem | null>(null);

  // Commit + draft
  const [committed, setCommitted] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };
  const { guard, proceed, cancel, isPrompting } = useUnsavedChangesGuard(isDirty);

  // Section I — auto-fill cơ quan theo ward
  const handleS1Ward = (item: DropdownItem) => {
    setS1Ward(item);
    setS1CoQuan({ code: `coquan-${item.code}`, name: `Công an ${item.name}` });
  };

  // Section V handlers
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

  // Section VI handlers
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

  // Section VII handlers
  const addHoSo = () => {
    setHoSo((prev) => [...prev, { id: hoSoNext, tenGiayTo: '' }]);
    setHoSoNext((n) => n + 1);
  };
  const removeHoSo = (id: number) => {
    setHoSo((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = () => {
    if (!committed) return;
    setShowConfirmSubmit(true);
  };

  const handleConfirmSubmit = () => {
    setShowConfirmSubmit(false);
    setIsDirty(false);
    navigate('/nop-ho-so-thanh-cong');
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
              <div className="tkbtv-field">
                <div className="tkbtv-radio-group">
                  <label
                    className={`tkbtv-radio${hoSoMoi === 'vao-ho' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setHoSoMoi('vao-ho')}
                  >
                    <span className="tkbtv-radio-dot" /> Đăng ký tạm trú vào hộ đã có
                  </label>
                  <label
                    className={`tkbtv-radio${hoSoMoi === 'lap-ho-moi' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setHoSoMoi('lap-ho-moi')}
                  >
                    <span className="tkbtv-radio-dot" /> Đăng ký tạm trú lập hộ mới
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* III — Người đề nghị */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">III. THÔNG TIN NGƯỜI ĐỀ NGHỊ ĐĂNG KÝ TẠM TRÚ</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <div className="tkbtv-radio-group tkbtv-radio-group--stack">
                  <label
                    className={`tkbtv-radio${nguoiKhai === 'nguoi-khai' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setNguoiKhai('nguoi-khai')}
                  >
                    <span className="tkbtv-radio-dot" />
                    Người khai thông tin là người Đăng ký tạm trú (tự động điền các thông tin của chủ tài khoản được lấy từ dữ liệu dân cư)
                  </label>
                  <label
                    className={`tkbtv-radio${nguoiKhai === 'khai-ho' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setNguoiKhai('khai-ho')}
                  >
                    <span className="tkbtv-radio-dot" />
                    Khai hộ (yêu cầu khai đúng các trường hợp thông tin có trong cơ sở dữ liệu quốc gia về dân cư của người được khai hộ)
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
              </div>

              <div className="tkbtv-row tkbtv-row--three">
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Số CCCD/Hộ chiếu <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={ddCccd}
                    onChange={(e) => setDdCccd(e.target.value)}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Số điện thoại <span className="tkbtv-req">*</span>
                  </label>
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
            </div>
          </div>

          {/* IV — Thông tin đề nghị */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">IV. THÔNG TIN ĐỀ NGHỊ ĐĂNG KÝ TẠM TRÚ</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <ProvinceWardSelect
                  province={s4Province}
                  ward={s4Ward}
                  onProvinceChange={setS4Province}
                  onWardChange={setS4Ward}
                  defaultProvinceName="Thành phố Hà Nội"
                  defaultWardName="Phường Ba Đình"
                  provinceLabel="Tỉnh/Thành phố"
                  wardLabel="Xã/Phường"
                  provinceRequired
                  wardRequired
                />
              </div>
              <div className="tkbtv-field">
                <label className="tkbtv-label">
                  Địa chỉ (số nhà, đường phố, thôn, làng, ấp, bản, buôn, phum, sóc) <span className="tkbtv-req">*</span>
                </label>
                <input
                  type="text"
                  className="tkbtv-input"
                  value={s4DiaChi}
                  onChange={(e) => setS4DiaChi(e.target.value)}
                />
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
              <div className="tkbtv-field">
                <label className="tkbtv-label">
                  Nội dung đề nghị <span className="tkbtv-req">*</span>
                </label>
                <input
                  type="text"
                  className="tkbtv-input"
                  value={noiDungDeNghi}
                  onChange={(e) => setNoiDungDeNghi(e.target.value)}
                />
              </div>
              <div className="tkbtv-field tkbtv-field--half">
                <label className="tkbtv-label">
                  Thời hạn tạm trú đề nghị đến ngày <span className="tkbtv-req">*</span>
                </label>
                <DatePicker
                  value={thoiHanTamTru}
                  placeholder="dd/mm/yyyy"
                  onChange={setThoiHanTamTru}
                />
              </div>
            </div>
          </div>

          {/* V — Thành viên hộ gia đình */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">
              V. NHỮNG THÀNH VIÊN TRONG HỘ GIA ĐÌNH CÙNG THAY ĐỔI
            </div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <div className="thtt-table-header-row">
                  <span />
                  <button type="button" className="thtt-add-link" onClick={addThanhVien}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Thêm thành viên
                  </button>
                </div>
                <table className="thtt-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>HỌ VÀ TÊN</th>
                      <th>NGÀY SINH</th>
                      <th>GIỚI TÍNH</th>
                      <th>SỐ ĐỊNH DANH</th>
                      <th>QUAN HỆ</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thanhVien.length === 0 ? (
                      <tr>
                        <td className="thtt-empty-cell" colSpan={7}>—</td>
                      </tr>
                    ) : (
                      thanhVien.map((r, i) => (
                        <tr key={r.id}>
                          <td className="thtt-stt">{String(i + 1).padStart(2, '0')}</td>
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
                            <RowActions
                              onAdd={addThanhVien}
                              onRemove={() => removeThanhVien(r.id)}
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

          {/* VI — Xác nhận tờ khai */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">
              VI. THÔNG TIN XÁC NHẬN TỜ KHAI THÔNG TIN CƯ TRÚ BẢN ĐIỆN TỬ
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

          {/* VII — Hồ sơ đính kèm */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">VII. HỒ SƠ ĐÍNH KÈM</div>
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

          {/* VIII — Nhận thông báo */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">
              VIII. THÔNG TIN NHẬN THÔNG BÁO TÌNH TRẠNG HỒ SƠ, KẾT QUẢ GIẢI QUYẾT HỒ SƠ
            </div>
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

          {/* IX — Lệ phí */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">IX. THÔNG TIN LỆ PHÍ</div>
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
          onDraft={() => setShowDraft(true)}
          onSubmit={handleSubmit}
          submitEnabled={committed}
        />
      </div>

      <DraftSavedToast
        open={showDraft}
        onClose={() => setShowDraft(false)}
        listLabel="Xem danh sách hồ sơ"
        onList={() => navigate('/ho-so-cua-toi?status=draft')}
      />

      <UnsavedChangesModal
        open={isPrompting}
        onClose={cancel}
        onSaveDraft={() => {
          cancel();
          setShowDraft(true);
        }}
        onDiscard={proceed}
      />

      <ConfirmSubmitModal
        open={showConfirmSubmit}
        onCancel={() => setShowConfirmSubmit(false)}
        onConfirm={handleConfirmSubmit}
        title="Xác nhận nộp hồ sơ đăng ký tạm trú theo nhân khẩu hộ"
      />
    </>
  );
}
