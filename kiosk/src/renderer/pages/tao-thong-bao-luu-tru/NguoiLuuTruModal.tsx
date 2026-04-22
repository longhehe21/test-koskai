import { useState } from 'react';
import { Modal } from '@components/ui';
import { useCurrentUser } from '@hooks/useCurrentUser';

interface PersonFormData {
  idx: number;
  hoTen: string;
  dob: string;
  gioiTinh: string;
  cccd: string;
  sdt: string;
}

function emptyPerson(idx: number): PersonFormData {
  return { idx, hoTen: '', dob: '', gioiTinh: 'Chọn', cccd: '', sdt: '' };
}

interface PersonCardProps {
  person: PersonFormData;
  total: number;
  locked: boolean;
  onChange: (patch: Partial<PersonFormData>) => void;
  onRemove?: () => void;
}

function PersonCard({ person, total, locked, onChange, onRemove }: PersonCardProps) {
  return (
    <div className="tnlt-card tnlt-person-card">
      <div className="tnlt-section-head">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.6">
          <circle cx="8" cy="6" r="3" />
          <path d="M2 14a6 6 0 0 1 12 0" />
        </svg>
        THÔNG TIN VỀ NGƯỜI LƯU TRÚ
        {person.idx === 1 && (
          <span className="tnlt-count-badge">{total} Người lưu trú</span>
        )}
        {onRemove && (
          <button
            type="button"
            className="tnlt-person-remove"
            aria-label="Xóa người lưu trú"
            onClick={onRemove}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4L4 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="tnlt-card-body">
        <div className="tnlt-person-tabs">
          <span className="tnlt-person-tab tnlt-person-tab--active">
            Người lưu trú #{person.idx}
          </span>
        </div>

        <div className="tnlt-grid-3">
          <div className="ttbl-field">
            <label className="ttbl-label">
              Họ và tên <span className="ttbl-req">*</span>
            </label>
            <input
              type="text"
              className={`ttbl-input${locked ? ' ttbl-input--locked' : ''}`}
              placeholder="Nhập họ và tên"
              value={person.hoTen}
              readOnly={locked}
              onChange={(e) => onChange({ hoTen: e.target.value })}
            />
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">
              Ngày, tháng, năm sinh <span className="ttbl-req">*</span>
            </label>
            <div className="tnlt-date">
              <input
                type="text"
                className={`ttbl-input${locked ? ' ttbl-input--locked' : ''}`}
                placeholder="dd/mm/yyyy"
                value={person.dob}
                readOnly={locked}
                onChange={(e) => onChange({ dob: e.target.value })}
              />
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="3" width="14" height="13" rx="2" stroke="#6b7280" strokeWidth="1.4" />
                <path d="M2 7h14M6 1v4M12 1v4" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">
              Giới tính <span className="ttbl-req">*</span>
            </label>
            <select
              className={`ttbl-native-select${locked ? ' ttbl-input--locked' : ''}`}
              disabled={locked}
              value={person.gioiTinh}
              onChange={(e) => onChange({ gioiTinh: e.target.value })}
            >
              <option>Chọn</option>
              <option>Nam</option>
              <option>Nữ</option>
            </select>
          </div>

          <div className="ttbl-field">
            <label className="ttbl-label">
              ĐDCN/CCCD/CMND <span className="ttbl-req">*</span>
            </label>
            <input
              type="text"
              className={`ttbl-input${locked ? ' ttbl-input--locked' : ''}`}
              placeholder="Số định danh/CCCD"
              value={person.cccd}
              readOnly={locked}
              onChange={(e) => onChange({ cccd: e.target.value })}
            />
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">Số hộ chiếu</label>
            <input type="text" className="ttbl-input" placeholder="Nhập số hộ chiếu" />
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">
              Giấy tờ khác <span className="ttbl-req">*</span>
            </label>
            <select className="ttbl-native-select">
              <option>Loại giấy tờ khác</option>
              <option>Giấy khai sinh</option>
              <option>Giấy tùy thân khác</option>
            </select>
          </div>

          <div className="ttbl-field">
            <label className="ttbl-label">Nghề nghiệp</label>
            <select className="ttbl-native-select">
              <option>Chọn nghề nghiệp</option>
              <option>Học sinh / Sinh viên</option>
              <option>Công nhân viên</option>
              <option>Kinh doanh tự do</option>
              <option>Khác</option>
            </select>
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">Số điện thoại</label>
            <input
              type="text"
              className={`ttbl-input${locked ? ' ttbl-input--locked' : ''}`}
              placeholder="Nhập số điện thoại"
              value={person.sdt}
              readOnly={locked}
              onChange={(e) => onChange({ sdt: e.target.value })}
            />
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">Nơi làm việc</label>
            <input type="text" className="ttbl-input" placeholder="Tên cơ quan, đơn vị" />
          </div>
        </div>

        <div className="tnlt-grid-2">
          <div className="ttbl-field">
            <label className="ttbl-label">Quốc tịch</label>
            <input type="text" className="ttbl-input" defaultValue="Việt Nam" />
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">Địa chỉ thường trú hoặc tạm trú</label>
            <div className="ttbl-radio-group">
              <label className="ttbl-radio">
                <input type="radio" name={`tnlt-dc-${person.idx}`} value="tt" defaultChecked />
                <span className="ttbl-radio-mark" />
                Thường trú
              </label>
              <label className="ttbl-radio">
                <input type="radio" name={`tnlt-dc-${person.idx}`} value="tam" />
                <span className="ttbl-radio-mark" />
                Tạm trú
              </label>
              <label className="ttbl-radio">
                <input type="radio" name={`tnlt-dc-${person.idx}`} value="khac" />
                <span className="ttbl-radio-mark" />
                Địa chỉ khác
              </label>
            </div>
          </div>
        </div>

        <div className="tnlt-grid-3">
          <div className="ttbl-field">
            <label className="ttbl-label">Quốc gia</label>
            <select className="ttbl-native-select">
              <option>Việt Nam</option>
              <option>Khác</option>
            </select>
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">Tỉnh/Thành phố</label>
            <select className="ttbl-native-select">
              <option>Chọn</option>
            </select>
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">Xã/Phường/Đặc khu</label>
            <select className="ttbl-native-select">
              <option>Chọn</option>
            </select>
          </div>
        </div>

        <div className="ttbl-field">
          <label className="ttbl-label">Địa chỉ chi tiết</label>
          <input type="text" className="ttbl-input" placeholder="Số nhà, đường, thôn/xóm..." />
        </div>
        <div className="ttbl-field">
          <label className="ttbl-label">
            Lý do lưu trú <span className="ttbl-req">*</span>
          </label>
          <textarea className="ttbl-input tnlt-textarea" placeholder="Nhập chi tiết lý do..." />
        </div>

        <div className="tnlt-grid-3">
          <div className="ttbl-field">
            <label className="ttbl-label">
              Thời gian lưu trú từ ngày <span className="ttbl-req">*</span>
            </label>
            <div className="tnlt-date">
              <input type="text" className="ttbl-input" placeholder="dd/mm/yyyy" />
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="3" width="14" height="13" rx="2" stroke="#6b7280" strokeWidth="1.4" />
                <path d="M2 7h14M6 1v4M12 1v4" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">
              Đến ngày <span className="ttbl-req">*</span>
            </label>
            <div className="tnlt-date">
              <input type="text" className="ttbl-input" placeholder="dd/mm/yyyy" />
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="3" width="14" height="13" rx="2" stroke="#6b7280" strokeWidth="1.4" />
                <path d="M2 7h14M6 1v4M12 1v4" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="ttbl-field">
            <label className="ttbl-label">Số phòng (nếu có)</label>
            <input type="text" className="ttbl-input" placeholder="Nhập số phòng" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface NguoiLuuTruModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function NguoiLuuTruModal({ open, onClose, onSave }: NguoiLuuTruModalProps) {
  const user = useCurrentUser();
  const [isSame, setIsSame] = useState(false);
  const [persons, setPersons] = useState<PersonFormData[]>([emptyPerson(1)]);

  const addPerson = () => {
    setPersons((prev) => [...prev, emptyPerson(prev.length + 1)]);
  };

  const removePerson = (idx: number) => {
    setPersons((prev) =>
      prev.filter((p) => p.idx !== idx).map((p, i) => ({ ...p, idx: i + 1 })),
    );
  };

  const updatePerson = (idx: number, patch: Partial<PersonFormData>) => {
    setPersons((prev) => prev.map((p) => (p.idx === idx ? { ...p, ...patch } : p)));
  };

  const handleToggleSame = (checked: boolean) => {
    setIsSame(checked);
    if (checked && persons.length > 0) {
      setPersons((prev) =>
        prev.map((p, i) =>
          i === 0
            ? {
                ...p,
                hoTen: user.hoTen,
                cccd: user.cccd,
                sdt: user.sdt,
                dob: user.ngaySinh,
                gioiTinh: user.gioiTinh,
              }
            : p,
        ),
      );
    }
  };

  return (
    <Modal
      open={open}
      overlayClassName="tnlt-overlay"
      visibleClassName="tnlt-overlay--visible"
      onClose={onClose}
      portalSelector=".kiosk-content-panel"
    >
      <div className="tnlt-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="tnlt-close" onClick={onClose} aria-label="Đóng">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M6 6l10 10M16 6L6 16" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h2 className="tnlt-title">THÊM MỚI NGƯỜI LƯU TRÚ</h2>

        <div className="tnlt-card">
          <div className="tnlt-section-head">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.6">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3M8 10.5v.5" />
            </svg>
            THÔNG TIN CHUNG
          </div>
          <div className="tnlt-card-body">
            <label className="ttbl-check">
              <input
                type="checkbox"
                checked={isSame}
                onChange={(e) => handleToggleSame(e.target.checked)}
              />
              <span className="ttbl-check-mark" />
              Người khai thông tin là Người lưu trú
            </label>
          </div>
        </div>

        <div>
          {persons.map((person) => (
            <PersonCard
              key={person.idx}
              person={person}
              total={persons.length}
              locked={isSame && person.idx === 1}
              onChange={(patch) => updatePerson(person.idx, patch)}
              onRemove={person.idx > 1 ? () => removePerson(person.idx) : undefined}
            />
          ))}
        </div>

        <button type="button" className="tnlt-add-more" onClick={addPerson}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#2563eb"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          Thêm người lưu trú
        </button>

        <div className="tnlt-footer">
          <button type="button" className="tnlt-btn tnlt-btn--close" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="tnlt-btn tnlt-btn--save" onClick={onSave}>
            Lưu
          </button>
        </div>
      </div>
    </Modal>
  );
}
