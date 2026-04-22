import '@styles/pages/tao-thong-bao-luu-tru.css';
import '@styles/pages/luu-tru-ho-so.css';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import {
  ConfirmSubmitModal,
  Dropdown,
  MultiSelect,
  Modal,
  DraftSavedToast,
  FormFooter,
  ProvinceWardSelect,
  UnsavedChangesModal,
  type DropdownItem,
} from '@components/ui';
import { useCurrentUser } from '@hooks/useCurrentUser';
import { useUnsavedChangesGuard } from '@hooks/useUnsavedChangesGuard';
import { NguoiLuuTruModal } from './tao-thong-bao-luu-tru/NguoiLuuTruModal';

type AddrType = 'thuong-tru' | 'tam-tru' | 'khac';

const LOAI_HINH_OPTIONS: DropdownItem[] = [
  { code: 'ktxsv', name: 'Ký túc xá sinh viên' },
  { code: 'nhatro', name: 'Nhà ngăn phòng cho thuê' },
  { code: 'dulich', name: 'Cơ sở lưu trú du lịch' },
  { code: 'chuabenh', name: 'Cơ sở chữa bệnh' },
  { code: 'khac', name: 'Cơ sở khác' },
  { code: 'hogiadinh', name: 'Hộ gia đình' },
];

const FREE_INPUT_NAMES = new Set(['Cơ sở khác', 'Hộ gia đình']);

const MOCK_CO_SO: DropdownItem[] = [
  { code: 'A', name: 'Cơ sở lưu trú A' },
  { code: 'B', name: 'Cơ sở lưu trú B' },
  { code: 'C', name: 'Cơ sở lưu trú C' },
  { code: 'D', name: 'Cơ sở lưu trú D' },
  { code: 'E', name: 'Cơ sở lưu trú E' },
];

const THONG_BAO_OPTIONS = [
  { code: 'email', label: 'Qua email' },
  { code: 'cong-tt', label: 'Qua cổng thông tin' },
];

const KET_QUA_OPTIONS: DropdownItem[] = [
  { code: 'truc-tiep', name: 'Nhận trực tiếp' },
  { code: 'email', name: 'Qua email' },
  { code: 'cong-tt', name: 'Qua cổng thông tin' },
];

function SectionHeader({ no, title }: { no: string; title: string }) {
  return (
    <div className="ttbl-section-head">
      <span>
        {no}. {title}
      </span>
    </div>
  );
}

export default function TaoThongBaoLuuTruPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  usePageHeader({ title: 'Tạo thông báo lưu trú' });

  // Section I
  const [s1Province, setS1Province] = useState<DropdownItem | null>(null);
  const [s1Ward, setS1Ward] = useState<DropdownItem | null>(null);
  const [s1CoQuan, setS1CoQuan] = useState('Công an Phường Ba Đình');
  const [s1Sdt, setS1Sdt] = useState('');

  // Section II
  const [s2AddrType, setS2AddrType] = useState<AddrType>('thuong-tru');
  const [s2HoTen, setS2HoTen] = useState('');
  const [s2Sdt, setS2Sdt] = useState('');
  const [s2Cccd, setS2Cccd] = useState('');
  const [s2DiaChi, setS2DiaChi] = useState('');
  const [s2Province, setS2Province] = useState<DropdownItem | null>(null);
  const [s2Ward, setS2Ward] = useState<DropdownItem | null>(null);

  // Section III
  const [s3LoaiHinh, setS3LoaiHinh] = useState<DropdownItem | null>(null);
  const [s3TenCoSoInput, setS3TenCoSoInput] = useState('');
  const [s3TenCoSoSelect, setS3TenCoSoSelect] = useState<DropdownItem | null>(null);
  const [s3DiaChi, setS3DiaChi] = useState('');
  const isFreeInput = s3LoaiHinh ? FREE_INPUT_NAMES.has(s3LoaiHinh.name) : false;

  // Section V
  const [s5ThongBao, setS5ThongBao] = useState<string[]>([]);
  const [s5KetQua, setS5KetQua] = useState<DropdownItem | null>(null);
  const [s5Email, setS5Email] = useState('');
  const showEmail = s5ThongBao.includes('email') || s5KetQua?.code === 'email';

  // Commit + modals
  const [committed, setCommitted] = useState(false);
  const [showThemNguoi, setShowThemNguoi] = useState(false);
  const [showMauPreview, setShowMauPreview] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };
  const { guard, proceed, cancel, isPrompting } = useUnsavedChangesGuard(isDirty);

  // Apply address type — auto-fill from CCCD + readonly
  useEffect(() => {
    if (s2AddrType === 'thuong-tru') {
      setS2HoTen(user.hoTen);
      setS2Sdt(user.sdt);
      setS2Cccd(user.cccd);
      setS2DiaChi(user.thuongTru.diaChi);
    } else {
      setS2HoTen(user.hoTen);
      setS2Sdt(user.sdt);
      setS2Cccd(user.cccd);
      setS2Province(null);
      setS2Ward(null);
      setS2DiaChi('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s2AddrType]);

  // Auto-fill coquan khi ward đổi ở Section I
  const handleS1Coquan = (coquan: string) => {
    if (coquan) setS1CoQuan(coquan);
  };

  const s2Locked = s2AddrType === 'thuong-tru';

  const s3ProvinceText = useMemo(() => s1Province?.name ?? user.thuongTru.province, [s1Province]);
  const s3WardText = useMemo(() => s1Ward?.name ?? user.thuongTru.ward, [s1Ward]);

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
        className="ttbl-area"
        onFocusCapture={markDirty}
        onChangeCapture={markDirty}
      >
        <h1 className="ttbl-heading">TẠO MỚI THÔNG BÁO LƯU TRÚ</h1>

        <div className="ttbl-form">
          {/* I */}
          <div className="ttbl-card">
            <SectionHeader no="I" title="CƠ QUAN THỰC HIỆN" />
            <div className="ttbl-card-body">
              <div className="ttbl-row">
                <div className="ttbl-field">
                  <label className="ttbl-label">
                    Tỉnh/Thành phố <span className="ttbl-req">*</span>
                  </label>
                  <ProvinceWardSelect
                    province={s1Province}
                    ward={s1Ward}
                    onProvinceChange={setS1Province}
                    onWardChange={setS1Ward}
                    defaultProvinceName={user.thuongTru.province}
                    defaultWardName={user.thuongTru.ward}
                    onCoquan={handleS1Coquan}
                  />
                </div>
              </div>
              <div className="ttbl-row">
                <div className="ttbl-field">
                  <label className="ttbl-label">
                    Cơ quan thực hiện <span className="ttbl-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="ttbl-input ttbl-input--locked"
                    value={s1CoQuan}
                    readOnly
                  />
                </div>
                <div className="ttbl-field">
                  <label className="ttbl-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="ttbl-input"
                    placeholder="Số điện thoại Cơ quan thực hiện"
                    value={s1Sdt}
                    onChange={(e) => setS1Sdt(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* II */}
          <div className="ttbl-card">
            <SectionHeader no="II" title="THÔNG TIN NGƯỜI THÔNG BÁO" />
            <div className="ttbl-card-body">
              <div className="ttbl-row">
                <div className="ttbl-field">
                  <label className="ttbl-label">Họ và tên</label>
                  <input
                    type="text"
                    className={`ttbl-input${s2Locked ? ' ttbl-input--locked' : ''}`}
                    value={s2HoTen}
                    readOnly={s2Locked}
                    onChange={(e) => setS2HoTen(e.target.value)}
                  />
                </div>
                <div className="ttbl-field">
                  <label className="ttbl-label">Số điện thoại</label>
                  <input
                    type="text"
                    className={`ttbl-input${s2Locked ? ' ttbl-input--locked' : ''}`}
                    placeholder="Số điện thoại"
                    value={s2Sdt}
                    readOnly={s2Locked}
                    onChange={(e) => setS2Sdt(e.target.value)}
                  />
                </div>
              </div>
              <div className="ttbl-row">
                <div className="ttbl-field">
                  <label className="ttbl-label">CMND/CCCD/Số định danh</label>
                  <input
                    type="text"
                    className={`ttbl-input${s2Locked ? ' ttbl-input--locked' : ''}`}
                    value={s2Cccd}
                    readOnly={s2Locked}
                    onChange={(e) => setS2Cccd(e.target.value)}
                  />
                </div>
                <div className="ttbl-field">
                  <label className="ttbl-label">Loại địa chỉ</label>
                  <div className="ttbl-radio-group">
                    {(['thuong-tru', 'tam-tru', 'khac'] as AddrType[]).map((t) => (
                      <label key={t} className="ttbl-radio">
                        <input
                          type="radio"
                          name="loai-dc"
                          value={t}
                          checked={s2AddrType === t}
                          onChange={() => setS2AddrType(t)}
                        />
                        <span className="ttbl-radio-mark" />
                        {t === 'thuong-tru'
                          ? 'Địa chỉ thường trú'
                          : t === 'tam-tru'
                            ? 'Địa chỉ tạm trú'
                            : 'Địa chỉ khác'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="ttbl-row">
                <ProvinceWardSelect
                  province={s2Province}
                  ward={s2Ward}
                  onProvinceChange={setS2Province}
                  onWardChange={setS2Ward}
                  defaultProvinceName={s2AddrType === 'thuong-tru' ? user.thuongTru.province : undefined}
                  defaultWardName={s2AddrType === 'thuong-tru' ? user.thuongTru.ward : undefined}
                />
              </div>
              <div className="ttbl-field">
                <label className="ttbl-label">Địa chỉ (số nhà, đường phố,…)</label>
                <input
                  type="text"
                  className={`ttbl-input${s2Locked ? ' ttbl-input--locked' : ''}`}
                  value={s2DiaChi}
                  readOnly={s2Locked}
                  onChange={(e) => setS2DiaChi(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* III */}
          <div className="ttbl-card">
            <SectionHeader no="III" title="THÔNG TIN CƠ SỞ LƯU TRÚ" />
            <div className="ttbl-card-body">
              <div className="ttbl-row">
                <div className="ttbl-field">
                  <label className="ttbl-label">
                    Loại hình cơ sở lưu trú <span className="ttbl-req">*</span>
                  </label>
                  <Dropdown
                    value={s3LoaiHinh}
                    placeholder="Chọn"
                    items={LOAI_HINH_OPTIONS}
                    onChange={setS3LoaiHinh}
                  />
                </div>
                <div className="ttbl-field">
                  <label className="ttbl-label">
                    Tên cơ sở lưu trú <span className="ttbl-req">*</span>
                  </label>
                  {isFreeInput ? (
                    <input
                      type="text"
                      className="ttbl-input"
                      placeholder="Nhập tên cơ sở"
                      value={s3TenCoSoInput}
                      onChange={(e) => setS3TenCoSoInput(e.target.value)}
                    />
                  ) : (
                    <Dropdown
                      value={s3TenCoSoSelect}
                      placeholder="Chọn cơ sở lưu trú"
                      items={MOCK_CO_SO}
                      onChange={setS3TenCoSoSelect}
                      locked={!s3LoaiHinh}
                    />
                  )}
                </div>
              </div>
              <div className="ttbl-row">
                <div className="ttbl-field">
                  <label className="ttbl-label">
                    Tỉnh/Thành phố <span className="ttbl-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="ttbl-input ttbl-input--locked"
                    value={s3ProvinceText}
                    readOnly
                  />
                </div>
                <div className="ttbl-field">
                  <label className="ttbl-label">
                    Xã/Phường/Đặc khu <span className="ttbl-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="ttbl-input ttbl-input--locked"
                    value={s3WardText}
                    readOnly
                  />
                </div>
              </div>
              <div className="ttbl-field">
                <label className="ttbl-label">
                  Địa chỉ (số nhà, đường phố,…) <span className="ttbl-req">*</span>
                </label>
                <input
                  type="text"
                  className="ttbl-input"
                  placeholder="Nhập địa chỉ chi tiết"
                  value={s3DiaChi}
                  onChange={(e) => setS3DiaChi(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* IV */}
          <div className="ttbl-card">
            <SectionHeader no="IV" title="THÔNG TIN VỀ NGƯỜI LƯU TRÚ" />
            <div className="ttbl-card-body">
              <div className="ttbl-actions-row">
                <button type="button" className="ttbl-btn-ghost">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#374151" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="6" width="10" height="6" rx="1" />
                    <path d="M4 6V3h8v3M5 12v2h6v-2" />
                  </svg>
                  In lấy mẫu
                </button>
                <button type="button" className="ttbl-btn-ghost">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#374151" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                    <path d="M1 8h14" />
                  </svg>
                  Quét lấy danh sách
                </button>
                <button type="button" className="ttbl-btn-ghost" onClick={() => setShowMauPreview(true)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#374151" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
                    <circle cx="8" cy="8" r="2" />
                  </svg>
                  Xem mẫu thông tin người lưu trú
                </button>
                <button type="button" className="ttbl-btn-primary" onClick={() => setShowThemNguoi(true)}>
                  + Thêm mới người lưu trú
                </button>
              </div>
              <div className="ttbl-empty">
                <div className="ttbl-empty-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.6">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                    <line x1="3" y1="3" x2="21" y2="21" strokeWidth="1.3" />
                  </svg>
                </div>
                <p className="ttbl-empty-title">Chưa có thông tin người lưu trú nào.</p>
                <p className="ttbl-empty-sub">Vui lòng thêm mới hoặc tải lên file danh sách file.</p>
              </div>
            </div>
          </div>

          {/* V */}
          <div className="ttbl-card">
            <SectionHeader no="V" title="THÔNG TIN NHẬN THÔNG BÁO TÌNH TRẠNG HỒ SƠ" />
            <div className="ttbl-card-body">
              <div className="ttbl-row">
                <div className="ttbl-field">
                  <label className="ttbl-label">
                    Hình thức nhận thông báo <span className="ttbl-req">*</span>
                  </label>
                  <MultiSelect
                    value={s5ThongBao}
                    options={THONG_BAO_OPTIONS}
                    placeholder="Chọn hình thức"
                    onChange={setS5ThongBao}
                  />
                  <p className="ttbl-helper">
                    Bạn có thể chọn đồng thời nhiều phương thức để nhận cập nhật mới nhất về hồ sơ
                    của mình.
                  </p>
                </div>
                <div className="ttbl-field">
                  <label className="ttbl-label">
                    Hình thức nhận kết quả <span className="ttbl-req">*</span>
                  </label>
                  <Dropdown
                    value={s5KetQua}
                    placeholder="Chọn hình thức"
                    items={KET_QUA_OPTIONS}
                    onChange={setS5KetQua}
                  />
                </div>
              </div>

              {showEmail && (
                <div className="ttbl-field">
                  <label className="ttbl-label">
                    Email <span className="ttbl-req">*</span>
                  </label>
                  <input
                    type="email"
                    className="ttbl-input"
                    placeholder="example@gmail.com"
                    value={s5Email}
                    onChange={(e) => setS5Email(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="ttbl-commit">
            <label className="ttbl-check">
              <input
                type="checkbox"
                checked={committed}
                onChange={(e) => setCommitted(e.target.checked)}
              />
              <span className="ttbl-check-mark" />
              Tôi xin chịu trách nhiệm trước pháp luật về lời khai trên.
            </label>
          </div>
        </div>

        <FormFooter
          variant="ttbl"
          onBack={() => guard(() => navigate(-1))}
          onDraft={() => setShowDraft(true)}
          onSubmit={handleSubmit}
          submitEnabled={committed}
        />
      </div>

      <NguoiLuuTruModal
        open={showThemNguoi}
        onClose={() => setShowThemNguoi(false)}
        onSave={() => setShowThemNguoi(false)}
      />

      <Modal
        open={showMauPreview}
        overlayClassName="maudon-overlay"
        visibleClassName="maudon-overlay--visible"
        onClose={() => setShowMauPreview(false)}
        portalSelector=".kiosk-content-panel"
      >
        <div className="maudon-container" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="maudon-close"
            onClick={() => setShowMauPreview(false)}
            aria-label="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="#374151"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <img
            src="/assets/mau-lay-thong-tin-nguoi-luu-tru.svg"
            alt="Mẫu lấy thông tin người lưu trú"
            className="maudon-image"
          />
        </div>
      </Modal>

      <DraftSavedToast
        open={showDraft}
        onClose={() => setShowDraft(false)}
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
        title="Xác nhận gửi thông báo lưu trú"
      />
    </>
  );
}

