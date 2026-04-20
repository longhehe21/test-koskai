import '@styles/pages/tao-ho-so-thuong-tru.css';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import {
  Dropdown,
  DraftSavedToast,
  FormFooter,
  MultiSelect,
  ProvinceWardSelect,
  type DropdownItem,
} from '@components/ui';
import { Section3VN } from './tao-ho-so-thuong-tru/Section3VN';
import { Section3VK } from './tao-ho-so-thuong-tru/Section3VK';
import {
  COQUAN_ITEMS,
  LY_DO_MIEN_PHI_ITEMS,
  RowActions,
  TRUONG_HOP_ITEMS,
  VAI_TRO_ITEMS,
  isVietKieuBranch,
} from './tao-ho-so-thuong-tru/shared';

type HoSoMoi = 'lap-ho-moi' | 'vao-ho';
type NguoiKeKhai = 'chu-ho' | 'chu-so-huu' | 'giam-ho';
type LePhi = 'co-phi' | 'mien-phi';

const THONG_BAO_OPTIONS = [
  { code: 'cong-tt', label: 'Nhận qua cổng thông tin' },
  { code: 'email', label: 'Qua email' },
];

const KET_QUA_OPTIONS: DropdownItem[] = [
  { code: 'truc-tiep', name: 'Nhận trực tiếp' },
  { code: 'cong-tt', name: 'Nhận qua cổng thông tin' },
  { code: 'email', name: 'Qua email' },
];

interface XinYKienRow {
  id: number;
  hoTen: string;
  ngaySinh: string;
  cccd: string;
  vaiTro: DropdownItem | null;
}

const emptyXinYKien = (id: number): XinYKienRow => ({
  id,
  hoTen: '',
  ngaySinh: '',
  cccd: '',
  vaiTro: null,
});

export default function TaoHoSoThuongTruPage() {
  const navigate = useNavigate();
  const isVK = useMemo(() => isVietKieuBranch(), []);

  usePageHeader({ title: 'Hồ sơ đăng ký thường trú' });

  // Section I
  const [s1Province, setS1Province] = useState<DropdownItem | null>(null);
  const [s1Ward, setS1Ward] = useState<DropdownItem | null>(null);
  const [s1CoQuan, setS1CoQuan] = useState<DropdownItem | null>(COQUAN_ITEMS[0]);
  const [s1Sdt, setS1Sdt] = useState('');

  // Section II
  const [hoSoMoi, setHoSoMoi] = useState<HoSoMoi>('lap-ho-moi');
  const [vkCheckbox, setVkCheckbox] = useState(isVK);
  const defaultTruongHop = isVK
    ? TRUONG_HOP_ITEMS.find((t) => t.code === 'nhan-khau') ?? null
    : null;
  const [truongHop, setTruongHop] = useState<DropdownItem | null>(defaultTruongHop);

  // Section IV
  const [s4Province, setS4Province] = useState<DropdownItem | null>(null);
  const [s4Ward, setS4Ward] = useState<DropdownItem | null>(null);
  const [s4DiaChi, setS4DiaChi] = useState('');
  const [chuHoHoTen, setChuHoHoTen] = useState('');
  const [chuHoQuanHe, setChuHoQuanHe] = useState('');
  const [chuHoCccd, setChuHoCccd] = useState('');
  const [noiDung, setNoiDung] = useState('');

  // Section V
  const [nguoiKeKhai, setNguoiKeKhai] = useState<NguoiKeKhai | null>(null);
  const [xinYKien, setXinYKien] = useState<XinYKienRow[]>([emptyXinYKien(1)]);
  const [xinYKienNext, setXinYKienNext] = useState(2);

  // Section VI
  const [s6ThongBao, setS6ThongBao] = useState<string[]>(['cong-tt']);
  const [s6KetQua, setS6KetQua] = useState<DropdownItem | null>(KET_QUA_OPTIONS[0]);
  const [s6Email, setS6Email] = useState('');
  const showEmail = s6ThongBao.includes('email') || s6KetQua?.code === 'email';

  // Section VII
  const [lePhi, setLePhi] = useState<LePhi>('co-phi');
  const [lyDoMienPhi, setLyDoMienPhi] = useState<DropdownItem | null>(null);

  // Commit
  const [committed, setCommitted] = useState(false);
  const [showDraft, setShowDraft] = useState(false);

  const updateXinYKien = (id: number, patch: Partial<XinYKienRow>) => {
    setXinYKien((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const addXinYKien = () => {
    setXinYKien((prev) => [...prev, emptyXinYKien(xinYKienNext)]);
    setXinYKienNext((n) => n + 1);
  };
  const removeXinYKien = (id: number) => {
    if (xinYKien.length <= 1) return;
    setXinYKien((prev) => prev.filter((r) => r.id !== id));
  };

  // Cơ quan tự update theo ward
  const handleS1Ward = (item: DropdownItem) => {
    setS1Ward(item);
    setS1CoQuan({ code: `coquan-${item.code}`, name: `Công an ${item.name}` });
  };

  const handleSubmit = () => {
    if (!committed) return;
    navigate('/nop-ho-so-thanh-cong');
  };

  return (
    <>
      <div className="tkbtv-area">
        <h1 className="tkbtv-page-title">HỒ SƠ ĐĂNG KÝ THƯỜNG TRÚ</h1>
        <p className="tkbtv-page-subtitle">
          Vui lòng chọn trường hợp đăng ký phù hợp để hệ thống hướng dẫn chuẩn bị hồ sơ đính kèm
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
                />
              </div>
              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Cơ quan đăng ký cư trú <span className="tkbtv-req">*</span>
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
              <div className="tkbtv-row tkbtv-row--three">
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Thủ tục <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input tkbtv-input--locked"
                    value="Đăng ký thường trú"
                    readOnly
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">&nbsp;</label>
                  <div className="tkbtv-radio-group tkbtv-radio-group--stack">
                    <label
                      className={`tkbtv-radio${hoSoMoi === 'lap-ho-moi' ? ' tkbtv-radio--active' : ''}`}
                      onClick={() => setHoSoMoi('lap-ho-moi')}
                    >
                      <span className="tkbtv-radio-dot" /> Đăng ký thường trú lập hộ mới
                    </label>
                    <label
                      className={`tkbtv-radio${hoSoMoi === 'vao-ho' ? ' tkbtv-radio--active' : ''}`}
                      onClick={() => setHoSoMoi('vao-ho')}
                    >
                      <span className="tkbtv-radio-dot" /> Đăng ký thường trú vào hộ đã có
                    </label>
                  </div>
                </div>
                <div className="tkbtv-field">
                  <label className="thtt-checkbox thtt-checkbox--inline">
                    <input
                      type="checkbox"
                      checked={vkCheckbox}
                      onChange={(e) => setVkCheckbox(e.target.checked)}
                    />
                    <span className="thtt-checkbox-box" />
                    <span className="thtt-checkbox-text thtt-checkbox-text--sm">
                      CD Việt Nam định cư ở nước ngoài không có hộ chiếu Việt Nam còn giá trị sử dụng
                    </span>
                  </label>
                  <label className="tkbtv-label">
                    Trường hợp <span className="tkbtv-req">*</span>
                  </label>
                  <Dropdown
                    value={truongHop}
                    placeholder="Trường hợp"
                    items={TRUONG_HOP_ITEMS}
                    onChange={setTruongHop}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* III — branch-aware */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">III. THÔNG TIN NGƯỜI ĐỀ NGHỊ ĐĂNG KÝ THƯỜNG TRÚ</div>
            <div className="tkbtv-section-body">{isVK ? <Section3VK /> : <Section3VN />}</div>
          </div>

          {/* IV */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">IV. THÔNG TIN ĐỀ NGHỊ</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <label className="tkbtv-label">
                  Nơi đề nghị đăng ký thường trú <span className="tkbtv-req">*</span>
                </label>
              </div>
              <div className="tkbtv-row">
                <ProvinceWardSelect
                  province={s4Province}
                  ward={s4Ward}
                  onProvinceChange={setS4Province}
                  onWardChange={setS4Ward}
                  defaultProvinceName="Thành phố Hà Nội"
                  defaultWardName="Phường Tây Hồ"
                />
              </div>
              <div className="tkbtv-field">
                <label className="tkbtv-label">
                  Địa chỉ (số nhà, đường phố, thôn, xóm, làng, ấp, bản, buôn, phum, sóc)
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
                    Họ tên chủ hộ <span className="tkbtv-req">*</span>
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
                    Quan hệ với chủ hộ <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    value={chuHoQuanHe}
                    onChange={(e) => setChuHoQuanHe(e.target.value)}
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Số ĐDCN (CCCD) chủ hộ <span className="tkbtv-req">*</span>
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
                <textarea
                  className="tkbtv-textarea"
                  value={noiDung}
                  onChange={(e) => setNoiDung(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* V */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">
              V. THÔNG TIN XÁC NHẬN TỜ KHAI THÔNG TIN CƯ TRÚ BẢN ĐIỆN TỬ
            </div>
            <div className="tkbtv-section-body">
              <p className="thtt-note">
                Công dân kê khai các thông tin sau nếu cần lấy ý kiến đồng ý của chủ hộ; chủ sở
                hữu chỗ ở hợp pháp; cha, mẹ, người giám hộ qua ứng dụng định danh điện tử (VNeID)
                và không bắt buộc đính kèm Tờ khai thay đổi thông tin cư trú (CT01, CT02) có chữ
                ký của người đi xin ý kiến xác nhận qua VNeID.
              </p>

              <div className="tkbtv-field tkbtv-field--half">
                <label className="tkbtv-label">Trạng thái xác nhận</label>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--placeholder"
                  value="Chưa gửi"
                  readOnly
                />
              </div>

              <div className="tkbtv-field">
                <label className="tkbtv-label">Người kê khai là:</label>
                <div className="tkbtv-radio-group">
                  {(['chu-ho', 'chu-so-huu', 'giam-ho'] as NguoiKeKhai[]).map((v) => (
                    <label
                      key={v}
                      className={`tkbtv-radio${nguoiKeKhai === v ? ' tkbtv-radio--active' : ''}`}
                      onClick={() => setNguoiKeKhai(v)}
                    >
                      <span className="tkbtv-radio-dot" />{' '}
                      {v === 'chu-ho'
                        ? 'Chủ hộ'
                        : v === 'chu-so-huu'
                          ? 'Chủ sở hữu chỗ ở hợp pháp'
                          : 'Cha/Mẹ/Người giám hộ'}
                    </label>
                  ))}
                </div>
              </div>

              <div className="tkbtv-field">
                <label className="tkbtv-label">Danh sách người cần xin ý kiến:</label>
                <table className="thtt-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>HỌ VÀ TÊN <span className="tkbtv-req">*</span></th>
                      <th>NGÀY SINH <span className="tkbtv-req">*</span></th>
                      <th>SỐ ĐDCN (CCCD) <span className="tkbtv-req">*</span></th>
                      <th>VAI TRÒ <span className="tkbtv-req">*</span></th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {xinYKien.map((r, i) => (
                      <tr key={r.id}>
                        <td className="thtt-stt">
                          <a href="#" className="thtt-table-index" onClick={(e) => e.preventDefault()}>
                            {i + 1}
                          </a>
                        </td>
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
                            placeholder="dd/mm/yyyy"
                            value={r.ngaySinh}
                            onChange={(e) => updateXinYKien(r.id, { ngaySinh: e.target.value })}
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
                          <Dropdown
                            value={r.vaiTro}
                            placeholder="Chọn"
                            items={VAI_TRO_ITEMS}
                            onChange={(v) => updateXinYKien(r.id, { vaiTro: v })}
                          />
                        </td>
                        <td>
                          <RowActions
                            onAdd={addXinYKien}
                            onRemove={xinYKien.length > 1 ? () => removeXinYKien(r.id) : undefined}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="thtt-vneid-row">
                <p className="thtt-vneid-hint">
                  <em>*Vui lòng kiểm tra tính chính xác của tài khoản định danh điện tử đã cung cấp</em>
                </p>
                <button type="button" className="thtt-vneid-btn">
                  Kiểm tra tài khoản VNeID
                </button>
              </div>
            </div>
          </div>

          {/* VI */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">VI. THÔNG TIN NHẬN THÔNG BÁO & KẾT QUẢ</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">HÌNH THỨC NHẬN THÔNG BÁO</label>
                  <MultiSelect
                    value={s6ThongBao}
                    options={THONG_BAO_OPTIONS}
                    placeholder="Chọn"
                    onChange={setS6ThongBao}
                  />
                </div>
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    HÌNH THỨC NHẬN KẾT QUẢ <span className="tkbtv-req">(*)</span>
                  </label>
                  <Dropdown
                    value={s6KetQua}
                    placeholder="Chọn hình thức"
                    items={KET_QUA_OPTIONS}
                    onChange={setS6KetQua}
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
                    value={s6Email}
                    onChange={(e) => setS6Email(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* VII */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">VII. THÔNG TIN LỆ PHÍ</div>
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
                    className={`tkbtv-radio tkbtv-radio--disabled${lePhi === 'mien-phi' ? ' tkbtv-radio--active' : ''}`}
                  >
                    <span className="tkbtv-radio-dot" /> Miễn phí (Trường hợp ưu tiên)
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
          onBack={() => navigate(-1)}
          onDraft={() => setShowDraft(true)}
          onSubmit={handleSubmit}
          submitEnabled={committed}
        />
      </div>

      <DraftSavedToast
        open={showDraft}
        onClose={() => setShowDraft(false)}
        listLabel="Xem danh sách hồ sơ"
        onList={() => navigate('/ho-so-cua-toi')}
      />
    </>
  );
}
