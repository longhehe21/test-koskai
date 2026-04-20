import { useState } from 'react';
import { DatePicker, Dropdown, type DropdownItem } from '@components/ui';
import { GIOI_TINH_ITEMS, QUAN_HE_ITEMS, RowActions } from './shared';

interface ThanhVien {
  id: number;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: DropdownItem | null;
  cccd: string;
  quanHe: DropdownItem | null;
}

function emptyTv(id: number): ThanhVien {
  return { id, hoTen: '', ngaySinh: '', gioiTinh: null, cccd: '', quanHe: null };
}

export function Section3VN() {
  const [khaiBy, setKhaiBy] = useState<'tu-khai' | 'khai-ho'>('tu-khai');
  const [hoTen, setHoTen] = useState('');
  const [ngaySinh, setNgaySinh] = useState('');
  const [gioiTinh, setGioiTinh] = useState<DropdownItem | null>(null);
  const [cccd, setCccd] = useState('');
  const [sdt, setSdt] = useState('');
  const [email, setEmail] = useState('');

  const [thanhVien, setThanhVien] = useState<ThanhVien[]>([emptyTv(1)]);
  const [nextId, setNextId] = useState(2);

  const updateTv = (id: number, patch: Partial<ThanhVien>) => {
    setThanhVien((prev) => prev.map((tv) => (tv.id === id ? { ...tv, ...patch } : tv)));
  };
  const addTv = () => {
    setThanhVien((prev) => [...prev, emptyTv(nextId)]);
    setNextId((n) => n + 1);
  };
  const removeTv = (id: number) => {
    if (thanhVien.length <= 1) return;
    setThanhVien((prev) => prev.filter((tv) => tv.id !== id));
  };

  return (
    <>
      <div className="tkbtv-field">
        <div className="tkbtv-radio-group">
          {(['tu-khai', 'khai-ho'] as const).map((v) => (
            <label
              key={v}
              className={`tkbtv-radio${khaiBy === v ? ' tkbtv-radio--active' : ''}`}
              onClick={() => setKhaiBy(v)}
            >
              <span className="tkbtv-radio-dot" /> {v === 'tu-khai' ? 'Tự khai' : 'Khai hộ'}
            </label>
          ))}
        </div>
      </div>

      <div className="tkbtv-row tkbtv-row--three">
        <div className="tkbtv-field">
          <label className="tkbtv-label">
            Họ tên <span className="tkbtv-req">*</span>
          </label>
          <input type="text" className="tkbtv-input" value={hoTen} onChange={(e) => setHoTen(e.target.value)} />
        </div>
        <div className="tkbtv-field">
          <label className="tkbtv-label">
            Ngày sinh <span className="tkbtv-req">*</span>
          </label>
          <DatePicker value={ngaySinh} onChange={setNgaySinh} />
        </div>
        <div className="tkbtv-field">
          <label className="tkbtv-label">
            Giới tính <span className="tkbtv-req">*</span>
          </label>
          <Dropdown value={gioiTinh} placeholder="Chọn giới tính" items={GIOI_TINH_ITEMS} onChange={setGioiTinh} />
        </div>
      </div>

      <div className="tkbtv-row tkbtv-row--three">
        <div className="tkbtv-field">
          <label className="tkbtv-label">
            Số ĐDCN (CCCD) <span className="tkbtv-req">*</span>
          </label>
          <input type="text" className="tkbtv-input" value={cccd} onChange={(e) => setCccd(e.target.value)} />
        </div>
        <div className="tkbtv-field">
          <label className="tkbtv-label">SĐT liên hệ</label>
          <input type="text" className="tkbtv-input" value={sdt} onChange={(e) => setSdt(e.target.value)} />
        </div>
        <div className="tkbtv-field">
          <label className="tkbtv-label">Email</label>
          <input type="email" className="tkbtv-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <table className="thtt-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>HỌ VÀ TÊN</th>
            <th>NGÀY SINH</th>
            <th>GIỚI TÍNH</th>
            <th>SỐ ĐDCN (CCCD)</th>
            <th>QUAN HỆ VỚI CHỦ HỘ</th>
            <th>THAO TÁC</th>
          </tr>
        </thead>
        <tbody>
          {thanhVien.map((tv, i) => (
            <tr key={tv.id}>
              <td className="thtt-stt">{i + 1}</td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  value={tv.hoTen}
                  onChange={(e) => updateTv(tv.id, { hoTen: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  placeholder="dd/mm/yyyy"
                  value={tv.ngaySinh}
                  onChange={(e) => updateTv(tv.id, { ngaySinh: e.target.value })}
                />
              </td>
              <td>
                <Dropdown
                  value={tv.gioiTinh}
                  placeholder="Chọn"
                  items={GIOI_TINH_ITEMS}
                  onChange={(v) => updateTv(tv.id, { gioiTinh: v })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  value={tv.cccd}
                  onChange={(e) => updateTv(tv.id, { cccd: e.target.value })}
                />
              </td>
              <td>
                <Dropdown
                  value={tv.quanHe}
                  placeholder="Chọn"
                  items={QUAN_HE_ITEMS}
                  onChange={(v) => updateTv(tv.id, { quanHe: v })}
                />
              </td>
              <td>
                <RowActions
                  onAdd={addTv}
                  onRemove={thanhVien.length > 1 ? () => removeTv(tv.id) : undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
