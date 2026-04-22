import '@styles/pages/tao-khai-bao-tam-vang.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import {
  ConfirmSubmitModal,
  DatePicker,
  Dropdown,
  MultiSelect,
  ProvinceWardSelect,
  DraftSavedToast,
  FormFooter,
  UnsavedChangesModal,
  type DropdownItem,
} from '@components/ui';
import { useCurrentUser } from '@hooks/useCurrentUser';
import { useUnsavedChangesGuard } from '@hooks/useUnsavedChangesGuard';

type ResidenceType = 'thuong-tru' | 'tam-tru' | 'khac';
type NoiDenType = 'trong-nuoc' | 'nuoc-ngoai';
type GioiTinh = 'Nam' | 'Nữ';

const THONG_BAO_OPTIONS = [
  { code: 'email', label: 'Qua email' },
  { code: 'cong-tt', label: 'Qua cổng thông tin' },
];

const KET_QUA_OPTIONS: DropdownItem[] = [
  { code: 'truc-tiep', name: 'Nhận trực tiếp' },
  { code: 'email', name: 'Qua email' },
  { code: 'cong-tt', name: 'Qua cổng thông tin' },
];

const COUNTRIES: DropdownItem[] = [
  'Hoa Kỳ', 'Nhật Bản', 'Hàn Quốc', 'Trung Quốc', 'Đài Loan',
  'Thái Lan', 'Singapore', 'Malaysia', 'Indonesia', 'Philippines',
  'Úc', 'Canada', 'Anh', 'Pháp', 'Đức',
  'Nga', 'Ấn Độ', 'Lào', 'Campuchia', 'Myanmar',
  'New Zealand', 'Ý', 'Tây Ban Nha', 'Hà Lan', 'Thụy Sĩ',
  'Thụy Điển', 'Na Uy', 'Đan Mạch', 'Phần Lan', 'Ba Lan',
  'Bỉ', 'Áo', 'Bồ Đào Nha', 'Hy Lạp', 'Thổ Nhĩ Kỳ',
  'Ả Rập Saudi', 'UAE', 'Qatar', 'Israel', 'Brazil',
].map((c, i) => ({ code: String(i), name: c }));

const RESIDENCE_LABELS: Record<ResidenceType, string> = {
  'thuong-tru': 'Nơi thường trú',
  'tam-tru': 'Nơi tạm trú',
  khac: 'Địa chỉ nơi ở hiện tại',
};

export default function TaoKhaiBaoTamVangPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  usePageHeader({ title: 'Tạo mới khai báo tạm vắng' });

  // Section I
  const [residenceType, setResidenceType] = useState<ResidenceType>('thuong-tru');
  const [s1Province, setS1Province] = useState<DropdownItem | null>(null);
  const [s1Ward, setS1Ward] = useState<DropdownItem | null>(null);
  const [s1CoQuan, setS1CoQuan] = useState(`Cơ quan ${user.thuongTru.ward}`);
  const [s1Sdt, setS1Sdt] = useState('');

  // Section II
  const [birthday, setBirthday] = useState(user.ngaySinh);
  const [gioiTinh, setGioiTinh] = useState<GioiTinh>('Nam');
  const [s2Province, setS2Province] = useState<DropdownItem | null>(null);
  const [s2Ward, setS2Ward] = useState<DropdownItem | null>(null);
  const [s2DiaChi, setS2DiaChi] = useState(user.thuongTru.diaChi);

  // Section III
  const [noiDen, setNoiDen] = useState<NoiDenType>('trong-nuoc');
  const [s3Province, setS3Province] = useState<DropdownItem | null>(null);
  const [s3Ward, setS3Ward] = useState<DropdownItem | null>(null);
  const [s3Country, setS3Country] = useState<DropdownItem | null>(null);
  const [s3DiaChi, setS3DiaChi] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [lyDo, setLyDo] = useState('');

  // Section IV
  const [s4ThongBao, setS4ThongBao] = useState<string[]>([]);
  const [s4KetQua, setS4KetQua] = useState<DropdownItem | null>(null);
  const [s4Email, setS4Email] = useState('');
  const showEmail = s4ThongBao.includes('email') || s4KetQua?.code === 'email';

  // Commit + draft modal
  const [showDraft, setShowDraft] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };
  const { guard, proceed, cancel, isPrompting } = useUnsavedChangesGuard(isDirty);

  // Apply residence type → sync S2 + readonly
  useEffect(() => {
    if (residenceType === 'thuong-tru') {
      // S1 locked to CCCD → user vẫn thấy default (setup ban đầu)
      setS2DiaChi(user.thuongTru.diaChi);
    } else {
      // S2 mirrors S1 ward/province, địa chỉ cụ thể để trống
      setS2DiaChi('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residenceType]);

  // Khi S1 change, mirror sang S2 (nếu không phải thường trú)
  useEffect(() => {
    if (residenceType === 'thuong-tru') return;
    setS2Province(s1Province);
    setS2Ward(s1Ward);
  }, [residenceType, s1Province, s1Ward]);

  const s1Locked = residenceType === 'thuong-tru';
  const s2Locked = true; // Section II luôn readonly (cá nhân info + địa chỉ mirror)

  const handleS1Coquan = (coquan: string) => {
    setS1CoQuan(coquan || `Cơ quan ${s1Ward?.name ?? user.thuongTru.ward}`);
  };

  const handleSubmit = () => {
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
        <h1 className="tkbtv-page-title">TẠO MỚI KHAI BÁO TẠM VẮNG</h1>

        <div className="tkbtv-form">
          {/* I */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">I. CƠ QUAN THỰC HIỆN</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <label className="tkbtv-label">
                  Nơi thường trú/tạm trú <span className="tkbtv-req">*</span>
                </label>
                <div className="tkbtv-radio-group">
                  {(['thuong-tru', 'tam-tru', 'khac'] as ResidenceType[]).map((t) => (
                    <label
                      key={t}
                      className={`tkbtv-radio${residenceType === t ? ' tkbtv-radio--active' : ''}`}
                      onClick={() => setResidenceType(t)}
                    >
                      <span className="tkbtv-radio-dot" />{' '}
                      {t === 'thuong-tru' ? 'Thường trú' : t === 'tam-tru' ? 'Tạm trú' : 'Khác'}
                    </label>
                  ))}
                </div>
              </div>

              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Tỉnh/Thành phố <span className="tkbtv-req">*</span>
                  </label>
                  {s1Locked ? (
                    <input
                      type="text"
                      className="tkbtv-input tkbtv-input--locked"
                      value={user.thuongTru.province}
                      readOnly
                    />
                  ) : (
                    <ProvinceWardSelect
                      province={s1Province}
                      ward={s1Ward}
                      onProvinceChange={setS1Province}
                      onWardChange={setS1Ward}
                      onCoquan={handleS1Coquan}
                    />
                  )}
                </div>
                {s1Locked && (
                  <div className="tkbtv-field tkbtv-field--half">
                    <label className="tkbtv-label">
                      Xã/Phường/Đặc khu <span className="tkbtv-req">*</span>
                    </label>
                    <input
                      type="text"
                      className="tkbtv-input tkbtv-input--locked"
                      value={user.thuongTru.ward}
                      readOnly
                    />
                  </div>
                )}
              </div>

              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Cơ quan thực hiện <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input tkbtv-input--locked"
                    value={s1CoQuan}
                    readOnly
                  />
                </div>
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="tkbtv-input"
                    placeholder="Số điện thoại Cơ quan thực hiện"
                    value={s1Sdt}
                    onChange={(e) => setS1Sdt(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* II */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">II. THÔNG TIN NGƯỜI KHAI BÁO TẠM VẮNG</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Họ, chữ đệm và tên <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input tkbtv-input--locked"
                    value={user.hoTen}
                    readOnly
                  />
                </div>
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Ngày, tháng, năm sinh <span className="tkbtv-req">*</span>
                  </label>
                  <DatePicker value={birthday} onChange={setBirthday} />
                </div>
              </div>

              <div className="tkbtv-row tkbtv-row--three">
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Giới tính <span className="tkbtv-req">*</span>
                  </label>
                  <div className="tkbtv-radio-group">
                    {(['Nam', 'Nữ'] as GioiTinh[]).map((g) => (
                      <label
                        key={g}
                        className={`tkbtv-radio${gioiTinh === g ? ' tkbtv-radio--active' : ''}`}
                        onClick={() => setGioiTinh(g)}
                      >
                        <span className="tkbtv-radio-dot" /> {g}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Quốc tịch <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input tkbtv-input--locked"
                    value={user.quocTich}
                    readOnly
                  />
                </div>
                <div className="tkbtv-field">
                  <label className="tkbtv-label">
                    Số định danh cá nhân/CCCD <span className="tkbtv-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="tkbtv-input tkbtv-input--locked"
                    value={user.cccd}
                    readOnly
                  />
                </div>
              </div>

              <div className="tkbtv-field">
                <label className="tkbtv-label">
                  {RESIDENCE_LABELS[residenceType]} <span className="tkbtv-req">*</span>
                </label>
              </div>
              <div className="tkbtv-row">
                {residenceType === 'thuong-tru' ? (
                  <>
                    <div className="tkbtv-field tkbtv-field--half">
                      <label className="tkbtv-label tkbtv-label--sub">
                        Tỉnh/Thành phố <span className="tkbtv-req">*</span>
                      </label>
                      <input
                        type="text"
                        className="tkbtv-input tkbtv-input--locked"
                        value={user.thuongTru.province}
                        readOnly
                      />
                    </div>
                    <div className="tkbtv-field tkbtv-field--half">
                      <label className="tkbtv-label tkbtv-label--sub">
                        Xã/Phường/Đặc khu <span className="tkbtv-req">*</span>
                      </label>
                      <input
                        type="text"
                        className="tkbtv-input tkbtv-input--locked"
                        value={user.thuongTru.ward}
                        readOnly
                      />
                    </div>
                  </>
                ) : (
                  <ProvinceWardSelect
                    province={s2Province}
                    ward={s2Ward}
                    onProvinceChange={setS2Province}
                    onWardChange={setS2Ward}
                  />
                )}
              </div>
              <div className="tkbtv-field">
                <label className="tkbtv-label">Địa chỉ cụ thể</label>
                <input
                  type="text"
                  className={`tkbtv-input${s2Locked && residenceType === 'thuong-tru' ? ' tkbtv-input--locked' : ''}`}
                  value={s2DiaChi}
                  readOnly={residenceType === 'thuong-tru'}
                  placeholder={residenceType !== 'thuong-tru' ? 'Nhập địa chỉ cụ thể' : undefined}
                  onChange={(e) => setS2DiaChi(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* III */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">III. NỘI DUNG TẠM VẮNG</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-field">
                <label className="tkbtv-label">
                  Nơi đến <span className="tkbtv-req">*</span>
                </label>
                <div className="tkbtv-radio-group">
                  <label
                    className={`tkbtv-radio${noiDen === 'trong-nuoc' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setNoiDen('trong-nuoc')}
                  >
                    <span className="tkbtv-radio-dot" /> Trong nước
                  </label>
                  <label
                    className={`tkbtv-radio${noiDen === 'nuoc-ngoai' ? ' tkbtv-radio--active' : ''}`}
                    onClick={() => setNoiDen('nuoc-ngoai')}
                  >
                    <span className="tkbtv-radio-dot" /> Nước ngoài
                  </label>
                </div>
              </div>

              {noiDen === 'trong-nuoc' ? (
                <>
                  <div className="tkbtv-row">
                    <ProvinceWardSelect
                      province={s3Province}
                      ward={s3Ward}
                      onProvinceChange={setS3Province}
                      onWardChange={setS3Ward}
                    />
                  </div>
                  <div className="tkbtv-field">
                    <label className="tkbtv-label">
                      Nơi đến (Địa chỉ cụ thể) <span className="tkbtv-req">*</span>
                    </label>
                    <input
                      type="text"
                      className="tkbtv-input"
                      placeholder="Số nhà, đường, thôn, xóm..."
                      value={s3DiaChi}
                      onChange={(e) => setS3DiaChi(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="tkbtv-field">
                    <label className="tkbtv-label">
                      Quốc gia <span className="tkbtv-req">*</span>
                    </label>
                    <Dropdown
                      value={s3Country}
                      placeholder="Chọn Quốc gia"
                      items={COUNTRIES}
                      onChange={setS3Country}
                    />
                  </div>
                  <div className="tkbtv-field">
                    <label className="tkbtv-label">
                      Nơi đến (Địa chỉ cụ thể) <span className="tkbtv-req">*</span>
                    </label>
                    <input
                      type="text"
                      className="tkbtv-input"
                      placeholder="Số nhà, đường, thôn, xóm..."
                      value={s3DiaChi}
                      onChange={(e) => setS3DiaChi(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Tạm vắng từ ngày <span className="tkbtv-req">*</span>
                  </label>
                  <DatePicker value={fromDate} onChange={setFromDate} />
                </div>
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Đến ngày <span className="tkbtv-req">*</span>
                  </label>
                  <DatePicker value={toDate} onChange={setToDate} />
                </div>
              </div>

              <div className="tkbtv-field">
                <label className="tkbtv-label">
                  Lý do tạm vắng <span className="tkbtv-req">*</span>
                </label>
                <textarea
                  className="tkbtv-textarea"
                  placeholder="Ghi rõ lý do (ví dụ: Đi làm xa, học tập...)"
                  value={lyDo}
                  onChange={(e) => setLyDo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* IV */}
          <div className="tkbtv-section">
            <div className="tkbtv-section-header">IV. NHẬN THÔNG BÁO VÀ KẾT QUẢ</div>
            <div className="tkbtv-section-body">
              <div className="tkbtv-row">
                <div className="tkbtv-field tkbtv-field--half">
                  <label className="tkbtv-label">
                    Hình thức nhận thông báo <span className="tkbtv-req">*</span>
                  </label>
                  <MultiSelect
                    value={s4ThongBao}
                    options={THONG_BAO_OPTIONS}
                    placeholder="Chọn hình thức"
                    onChange={setS4ThongBao}
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
                    value={s4KetQua}
                    placeholder="Chọn hình thức"
                    items={KET_QUA_OPTIONS}
                    onChange={setS4KetQua}
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
                    value={s4Email}
                    onChange={(e) => setS4Email(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <FormFooter
          onBack={() => guard(() => navigate(-1))}
          onDraft={() => setShowDraft(true)}
          onSubmit={handleSubmit}
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
        title="Xác nhận nộp hồ sơ khai báo tạm vắng"
      />
    </>
  );
}
