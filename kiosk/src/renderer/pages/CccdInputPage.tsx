/**
 * CccdInputPage — form mock nhập dữ liệu CCCD.
 *
 * Khi chưa có API Bộ Công an, user bấm "Tôi đã hiểu & Bắt đầu quét" ở ScanGuide
 * sẽ đi đến page này (thay vì /cccd-verify thẳng) để nhập mock data:
 *  - Ảnh (upload file hoặc giữ default)
 *  - Số CCCD (12 digits)
 *  - Họ tên
 *  - Ngày sinh (dd/mm/yyyy)
 *  - Giới tính
 *  - Tỉnh / Xã / Địa chỉ chi tiết
 *  - Ngày cấp (dd/mm/yyyy)
 *
 * Submit → setUser(sessionUserStore) → navigate /cccd-verify.
 *
 * Production: sẽ bỏ page này, NFC reader đọc chip → setUser → trực tiếp sang /cccd-verify.
 */
import '@styles/pages/cccd-input.css';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useSessionUserStore, MOCK_USER } from '@store/sessionUserStore';

interface FormState {
  cccd: string;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: 'Nam' | 'Nữ';
  province: string;
  ward: string;
  diaChi: string;
  ngayCap: string;
  photoSrc: string;
}

const INITIAL: FormState = {
  cccd: '',
  hoTen: '',
  ngaySinh: '',
  gioiTinh: 'Nam',
  province: '',
  ward: '',
  diaChi: '',
  ngayCap: '',
  photoSrc: '',
};

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

export default function CccdInputPage() {
  const navigate = useNavigate();
  const setUser = useSessionUserStore((s) => s.setUser);

  usePageHeader({
    title: 'Nhập dữ liệu CCCD (Mock)',
    showUserBadge: false,
    showDocs: false,
  });

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update('photoSrc', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const fillMock = () => {
    setForm({
      cccd: MOCK_USER.cccd,
      hoTen: MOCK_USER.hoTen,
      ngaySinh: MOCK_USER.ngaySinh,
      gioiTinh: MOCK_USER.gioiTinh as 'Nam' | 'Nữ',
      province: MOCK_USER.thuongTru.province,
      ward: MOCK_USER.thuongTru.ward,
      diaChi: MOCK_USER.thuongTru.diaChi,
      ngayCap: MOCK_USER.ngayCap ?? '',
      photoSrc: MOCK_USER.photoSrc,
    });
    setErrors({});
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!/^\d{12}$/.test(form.cccd)) errs.cccd = 'CCCD phải đủ 12 chữ số';
    if (!form.hoTen.trim()) errs.hoTen = 'Nhập họ tên';
    if (!DATE_RE.test(form.ngaySinh)) errs.ngaySinh = 'Định dạng dd/mm/yyyy';
    if (!form.province.trim()) errs.province = 'Nhập tỉnh/thành';
    if (!form.ward.trim()) errs.ward = 'Nhập xã/phường';
    if (!form.diaChi.trim()) errs.diaChi = 'Nhập địa chỉ chi tiết';
    if (!DATE_RE.test(form.ngayCap)) errs.ngayCap = 'Định dạng dd/mm/yyyy';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setUser({
      cccd: form.cccd,
      hoTen: form.hoTen.trim().toUpperCase(),
      ngaySinh: form.ngaySinh,
      gioiTinh: form.gioiTinh,
      danToc: 'Kinh',
      quocTich: 'Việt Nam',
      sdt: '',
      photoSrc: form.photoSrc || '/assets/user-demo.svg',
      ngayCap: form.ngayCap,
      thuongTru: {
        province: form.province.trim(),
        ward: form.ward.trim(),
        diaChi: form.diaChi.trim(),
      },
    });
    navigate('/cccd-verify');
  };

  return (
    <div className="cccd-input-area">
      <div className="cccd-input-header">
        <h1>Nhập dữ liệu CCCD (giả lập)</h1>
        <p>
          Chưa có API Bộ Công an — nhập thông tin mock để test flow. Sau này NFC reader
          sẽ đọc tự động.
        </p>
      </div>

      <div className="cccd-input-body">
        <div className="cccd-input-grid">
          {/* Photo uploader */}
          <div className="cccd-photo-uploader">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
            <div
              className="cccd-photo-preview"
              onClick={() => fileRef.current?.click()}
            >
              {form.photoSrc ? (
                <img src={form.photoSrc} alt="Ảnh CCCD" />
              ) : (
                <div className="cccd-photo-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  <span>Click để chọn ảnh</span>
                </div>
              )}
            </div>
            <div className="cccd-photo-hint">
              Click vào ô trên để chọn ảnh từ máy.<br />
              Khuyến nghị tỷ lệ 3:4.
            </div>
          </div>

          {/* Form fields */}
          <div className="cccd-form-fields">
            <div className="cccd-field">
              <label className="cccd-field-label">
                Số CCCD <span className="req">*</span>
              </label>
              <input
                className={`cccd-field-input${errors.cccd ? ' has-error' : ''}`}
                type="text"
                inputMode="numeric"
                maxLength={12}
                placeholder="12 chữ số"
                value={form.cccd}
                onChange={(e) => update('cccd', e.target.value.replace(/\D/g, ''))}
              />
              {errors.cccd && <span className="cccd-field-error">{errors.cccd}</span>}
            </div>

            <div className="cccd-field">
              <label className="cccd-field-label">
                Họ và tên <span className="req">*</span>
              </label>
              <input
                className={`cccd-field-input${errors.hoTen ? ' has-error' : ''}`}
                type="text"
                placeholder="VD: NGUYỄN VĂN A"
                value={form.hoTen}
                onChange={(e) => update('hoTen', e.target.value)}
              />
              {errors.hoTen && <span className="cccd-field-error">{errors.hoTen}</span>}
            </div>

            <div className="cccd-field">
              <label className="cccd-field-label">
                Ngày sinh <span className="req">*</span>
              </label>
              <input
                className={`cccd-field-input${errors.ngaySinh ? ' has-error' : ''}`}
                type="text"
                placeholder="dd/mm/yyyy"
                maxLength={10}
                value={form.ngaySinh}
                onChange={(e) => update('ngaySinh', e.target.value)}
              />
              {errors.ngaySinh && (
                <span className="cccd-field-error">{errors.ngaySinh}</span>
              )}
            </div>

            <div className="cccd-field">
              <label className="cccd-field-label">
                Giới tính <span className="req">*</span>
              </label>
              <select
                className="cccd-field-select"
                value={form.gioiTinh}
                onChange={(e) =>
                  update('gioiTinh', e.target.value as 'Nam' | 'Nữ')
                }
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>

            <div className="cccd-field">
              <label className="cccd-field-label">
                Tỉnh/Thành phố <span className="req">*</span>
              </label>
              <input
                className={`cccd-field-input${errors.province ? ' has-error' : ''}`}
                type="text"
                placeholder="VD: Thành phố Hà Nội"
                value={form.province}
                onChange={(e) => update('province', e.target.value)}
              />
              {errors.province && (
                <span className="cccd-field-error">{errors.province}</span>
              )}
            </div>

            <div className="cccd-field">
              <label className="cccd-field-label">
                Xã/Phường <span className="req">*</span>
              </label>
              <input
                className={`cccd-field-input${errors.ward ? ' has-error' : ''}`}
                type="text"
                placeholder="VD: Phường Ba Đình"
                value={form.ward}
                onChange={(e) => update('ward', e.target.value)}
              />
              {errors.ward && <span className="cccd-field-error">{errors.ward}</span>}
            </div>

            <div className="cccd-field cccd-field--full">
              <label className="cccd-field-label">
                Địa chỉ chi tiết (trên CCCD) <span className="req">*</span>
              </label>
              <textarea
                className={`cccd-field-textarea${errors.diaChi ? ' has-error' : ''}`}
                placeholder="Số nhà, tên đường, tên thôn/khu phố..."
                value={form.diaChi}
                onChange={(e) => update('diaChi', e.target.value)}
              />
              {errors.diaChi && <span className="cccd-field-error">{errors.diaChi}</span>}
            </div>

            <div className="cccd-field">
              <label className="cccd-field-label">
                Ngày cấp <span className="req">*</span>
              </label>
              <input
                className={`cccd-field-input${errors.ngayCap ? ' has-error' : ''}`}
                type="text"
                placeholder="dd/mm/yyyy"
                maxLength={10}
                value={form.ngayCap}
                onChange={(e) => update('ngayCap', e.target.value)}
              />
              {errors.ngayCap && (
                <span className="cccd-field-error">{errors.ngayCap}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="cccd-input-footer">
        <button
          type="button"
          className="cccd-input-btn cccd-input-btn--back"
          onClick={() => navigate(-1)}
        >
          ← Quay lại
        </button>
        <button
          type="button"
          className="cccd-input-btn cccd-input-btn--mock"
          onClick={fillMock}
          title="Điền nhanh dữ liệu mẫu để test"
        >
          ⚡ Điền nhanh mẫu
        </button>
        <button
          type="button"
          className="cccd-input-btn cccd-input-btn--submit"
          onClick={handleSubmit}
        >
          Xác nhận & Tiếp tục
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}
