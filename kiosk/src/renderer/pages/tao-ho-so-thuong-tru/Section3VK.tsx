import { useEffect, useState } from 'react';
import { DatePicker, Dropdown, ProvinceWardSelect, type DropdownItem } from '@components/ui';
import { useCurrentUser } from '@hooks/useCurrentUser';
import { namesMatch, type Ct01Fields } from '@utils/parseCt01Ocr';

interface Section3VKProps {
  ocrFields?: Ct01Fields | null;
}
import {
  DAN_TOC_ITEMS,
  FOREIGN_COUNTRIES,
  GIOI_TINH_ITEMS,
  MQH_ITEMS,
  RowActions,
  TON_GIAO_ITEMS,
} from './shared';

interface SinhSongRow {
  id: number;
  tuNgay: string;
  denNgay: string;
  choO: string;
  ngheNghiep: string;
  noiLamViec: string;
}

interface GiaDinhRow {
  id: number;
  hoVaTen: string;
  namSinh: string;
  quocTich: DropdownItem | null;
  mqh: DropdownItem | null;
  ngheNghiep: string;
  noiLamViec: string;
  choO: string;
}

const emptySinhSong = (id: number): SinhSongRow => ({
  id,
  tuNgay: '',
  denNgay: '',
  choO: '',
  ngheNghiep: '',
  noiLamViec: '',
});

const emptyGiaDinh = (id: number): GiaDinhRow => ({
  id,
  hoVaTen: '',
  namSinh: '',
  quocTich: null,
  mqh: null,
  ngheNghiep: '',
  noiLamViec: '',
  choO: '',
});

export function Section3VK({ ocrFields }: Section3VKProps = {}) {
  const user = useCurrentUser();
  const isKhaiHoFromOcr = !!(ocrFields?.hoTen && !namesMatch(ocrFields.hoTen, user.hoTen));
  const [khaiBy, setKhaiBy] = useState<'tu-khai' | 'khai-ho'>(
    isKhaiHoFromOcr ? 'khai-ho' : 'tu-khai',
  );

  // Person fields
  const [hoTen, setHoTen] = useState('');
  const [gioiTinh, setGioiTinh] = useState<DropdownItem | null>(null);
  const [ngaySinh, setNgaySinh] = useState('');
  const [hoTenHC, setHoTenHC] = useState('');
  const [danToc, setDanToc] = useState<DropdownItem | null>(null);
  const [tonGiao, setTonGiao] = useState<DropdownItem | null>(null);
  const [quocTichNN, setQuocTichNN] = useState<DropdownItem | null>(null);
  const [cccd, setCccd] = useState('');
  const [sdt, setSdt] = useState('');
  const [email, setEmail] = useState('');
  const [photoSrc, setPhotoSrc] = useState('');

  // Passport
  const [hcSo, setHcSo] = useState('');
  const [hcNgayCap, setHcNgayCap] = useState('');
  const [hcCoQuan, setHcCoQuan] = useState('');
  const [hcDenNgay, setHcDenNgay] = useState('');

  // Nghề nghiệp / nơi làm việc NN
  const [ngheNghiepNN, setNgheNghiepNN] = useState('');
  const [noiLamViecNN, setNoiLamViecNN] = useState('');

  // Tables
  const [sinhSong, setSinhSong] = useState<SinhSongRow[]>([emptySinhSong(1)]);
  const [sinhSongNext, setSinhSongNext] = useState(2);
  const [giaDinh, setGiaDinh] = useState<GiaDinhRow[]>([emptyGiaDinh(1)]);
  const [giaDinhNext, setGiaDinhNext] = useState(2);

  // Nơi cư trú NN
  const [quocGiaCT, setQuocGiaCT] = useState<DropdownItem | null>(null);
  const [noiCuTruNN, setNoiCuTruNN] = useState('');

  // Nơi ở hiện tại VN
  const [province, setProvince] = useState<DropdownItem | null>(null);
  const [ward, setWard] = useState<DropdownItem | null>(null);
  const [diaChi, setDiaChi] = useState('');

  const applyAutoFill = () => {
    setHoTen(user.hoTen);
    setCccd(user.cccd);
    setNgaySinh(user.ngaySinh);
    setGioiTinh(GIOI_TINH_ITEMS.find((i) => i.name === user.gioiTinh) ?? null);
    setDanToc(DAN_TOC_ITEMS.find((i) => i.name === user.danToc) ?? null);
    setPhotoSrc(user.photoSrc);
    setSdt(user.sdt);
    setEmail('');
  };
  /** Khai hộ: fill từ OCR nếu có, còn lại trống */
  const applyKhaiHoFromOcr = () => {
    setHoTen(ocrFields?.hoTen ?? '');
    setCccd(''); // OCR kém, user tự điền
    setNgaySinh(ocrFields?.ngaySinh ?? '');
    setGioiTinh(
      ocrFields?.gioiTinh
        ? GIOI_TINH_ITEMS.find((i) => i.name === ocrFields.gioiTinh) ?? null
        : null,
    );
    setDanToc(null);
    setPhotoSrc('');
    setSdt(ocrFields?.sdt ?? '');
    setEmail(ocrFields?.email ?? '');
  };

  useEffect(() => {
    if (khaiBy === 'tu-khai') applyAutoFill();
    else applyKhaiHoFromOcr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khaiBy]);

  const updateSinhSong = (id: number, patch: Partial<SinhSongRow>) => {
    setSinhSong((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const addSinhSong = () => {
    setSinhSong((prev) => [...prev, emptySinhSong(sinhSongNext)]);
    setSinhSongNext((n) => n + 1);
  };
  const removeSinhSong = (id: number) => {
    if (sinhSong.length <= 1) return;
    setSinhSong((prev) => prev.filter((r) => r.id !== id));
  };

  const updateGiaDinh = (id: number, patch: Partial<GiaDinhRow>) => {
    setGiaDinh((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const addGiaDinh = () => {
    setGiaDinh((prev) => [...prev, emptyGiaDinh(giaDinhNext)]);
    setGiaDinhNext((n) => n + 1);
  };
  const removeGiaDinh = (id: number) => {
    if (giaDinh.length <= 1) return;
    setGiaDinh((prev) => prev.filter((r) => r.id !== id));
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

      <div className="thtt-vk-photo-row">
        <div className="thtt-vk-photo-fields">
          <div className="tkbtv-row tkbtv-row--three">
            <div className="tkbtv-field">
              <label className="tkbtv-label">
                Họ tên <span className="tkbtv-req">*</span>
              </label>
              <input
                type="text"
                className="tkbtv-input"
                value={hoTen}
                onChange={(e) => setHoTen(e.target.value)}
              />
            </div>
            <div className="tkbtv-field">
              <label className="tkbtv-label">
                Giới tính <span className="tkbtv-req">*</span>
              </label>
              <Dropdown
                value={gioiTinh}
                placeholder="Chọn giới tính"
                items={GIOI_TINH_ITEMS}
                onChange={setGioiTinh}
              />
            </div>
            <div className="tkbtv-field">
              <label className="tkbtv-label">
                Ngày, tháng, năm sinh <span className="tkbtv-req">*</span>
              </label>
              <DatePicker value={ngaySinh} onChange={setNgaySinh} />
            </div>
          </div>

          <div className="tkbtv-field">
            <label className="tkbtv-label">
              Họ, chữ đệm và tên trong hộ chiếu/giấy tờ do nước ngoài cấp
            </label>
            <input type="text" className="tkbtv-input" value={hoTenHC} onChange={(e) => setHoTenHC(e.target.value)} />
          </div>

          <div className="tkbtv-row tkbtv-row--three">
            <div className="tkbtv-field">
              <label className="tkbtv-label">
                Dân tộc <span className="tkbtv-req">*</span>
              </label>
              <Dropdown
                value={danToc}
                placeholder="Chọn dân tộc"
                items={DAN_TOC_ITEMS}
                onChange={setDanToc}
              />
            </div>
            <div className="tkbtv-field">
              <label className="tkbtv-label">Tôn giáo</label>
              <Dropdown
                value={tonGiao}
                placeholder="Chọn tôn giáo"
                items={TON_GIAO_ITEMS}
                onChange={setTonGiao}
              />
            </div>
            <div className="tkbtv-field">
              <label className="tkbtv-label">Quốc tịch nước ngoài (nếu có)</label>
              <Dropdown
                value={quocTichNN}
                placeholder="Chọn quốc tịch"
                items={FOREIGN_COUNTRIES}
                onChange={setQuocTichNN}
              />
            </div>
          </div>
        </div>

        <div className="thtt-photo-box">
          {photoSrc ? (
            <img src={photoSrc} alt="Ảnh 4x6" />
          ) : (
            <span className="thtt-photo-label">Ảnh 4x6</span>
          )}
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

      <div className="tkbtv-field">
        <label className="tkbtv-label">
          Số hộ chiếu/ Giấy tờ đi lại quốc tế do nước ngoài cấp/ Giấy tờ do cơ quan có thẩm quyền Việt Nam cấp <span className="tkbtv-req">*</span>
        </label>
      </div>
      <div className="tkbtv-row">
        <div className="tkbtv-field tkbtv-field--half">
          <label className="tkbtv-label tkbtv-label--sub">Số</label>
          <input type="text" className="tkbtv-input" value={hcSo} onChange={(e) => setHcSo(e.target.value)} />
        </div>
        <div className="tkbtv-field tkbtv-field--half">
          <label className="tkbtv-label tkbtv-label--sub">Ngày cấp</label>
          <input
            type="text"
            className="tkbtv-input"
            placeholder="dd/mm/yyyy"
            value={hcNgayCap}
            onChange={(e) => setHcNgayCap(e.target.value)}
          />
        </div>
      </div>
      <div className="tkbtv-row">
        <div className="tkbtv-field tkbtv-field--half">
          <label className="tkbtv-label tkbtv-label--sub">Cơ quan cấp</label>
          <input type="text" className="tkbtv-input" value={hcCoQuan} onChange={(e) => setHcCoQuan(e.target.value)} />
        </div>
        <div className="tkbtv-field tkbtv-field--half">
          <label className="tkbtv-label tkbtv-label--sub">Có giá trị đến ngày</label>
          <input
            type="text"
            className="tkbtv-input"
            placeholder="dd/mm/yyyy"
            value={hcDenNgay}
            onChange={(e) => setHcDenNgay(e.target.value)}
          />
        </div>
      </div>

      <div className="tkbtv-row">
        <div className="tkbtv-field tkbtv-field--half">
          <label className="tkbtv-label">
            Nghề nghiệp ở nước ngoài trước khi nhập cảnh Việt Nam <span className="tkbtv-req">*</span>
          </label>
          <input type="text" className="tkbtv-input" value={ngheNghiepNN} onChange={(e) => setNgheNghiepNN(e.target.value)} />
        </div>
        <div className="tkbtv-field tkbtv-field--half">
          <label className="tkbtv-label">
            Nơi làm việc ở nước ngoài trước khi nhập cảnh Việt Nam <span className="tkbtv-req">(*)</span>
          </label>
          <input type="text" className="tkbtv-input" value={noiLamViecNN} onChange={(e) => setNoiLamViecNN(e.target.value)} />
        </div>
      </div>

      <div className="tkbtv-field">
        <label className="tkbtv-label thtt-table-heading">
          Tóm tắt quá trình sinh sống và làm việc từ khi sinh ra đến nay
        </label>
      </div>
      <table className="thtt-table thtt-table--vk">
        <thead>
          <tr>
            <th>THAO TÁC</th>
            <th>STT</th>
            <th>TỪ NGÀY <span className="tkbtv-req">*</span></th>
            <th>ĐẾN NGÀY <span className="tkbtv-req">*</span></th>
            <th>CHỖ Ở <span className="tkbtv-req">*</span></th>
            <th>NGHỀ NGHIỆP</th>
            <th>NƠI LÀM VIỆC</th>
          </tr>
        </thead>
        <tbody>
          {sinhSong.map((r, i) => (
            <tr key={r.id}>
              <td>
                <RowActions
                  onAdd={addSinhSong}
                  onRemove={sinhSong.length > 1 ? () => removeSinhSong(r.id) : undefined}
                />
              </td>
              <td className="thtt-stt">{i + 1}</td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  placeholder="dd/mm/yyyy"
                  value={r.tuNgay}
                  onChange={(e) => updateSinhSong(r.id, { tuNgay: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  placeholder="dd/mm/yyyy"
                  value={r.denNgay}
                  onChange={(e) => updateSinhSong(r.id, { denNgay: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  value={r.choO}
                  onChange={(e) => updateSinhSong(r.id, { choO: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  value={r.ngheNghiep}
                  onChange={(e) => updateSinhSong(r.id, { ngheNghiep: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  value={r.noiLamViec}
                  onChange={(e) => updateSinhSong(r.id, { noiLamViec: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="tkbtv-field">
        <label className="tkbtv-label thtt-table-heading">Cha, mẹ, vợ, chồng, con</label>
      </div>
      <table className="thtt-table thtt-table--vk">
        <thead>
          <tr>
            <th>THAO TÁC</th>
            <th>STT</th>
            <th>HỌ VÀ TÊN <span className="tkbtv-req">*</span></th>
            <th>NĂM SINH <span className="tkbtv-req">*</span></th>
            <th>QUỐC TỊCH <span className="tkbtv-req">*</span></th>
            <th>MỐI QUAN HỆ <span className="tkbtv-req">*</span></th>
            <th>NGHỀ NGHIỆP</th>
            <th>NƠI LÀM VIỆC</th>
            <th>CHỖ Ở HIỆN NAY <span className="tkbtv-req">*</span></th>
          </tr>
        </thead>
        <tbody>
          {giaDinh.map((r, i) => (
            <tr key={r.id}>
              <td>
                <RowActions
                  onAdd={addGiaDinh}
                  onRemove={giaDinh.length > 1 ? () => removeGiaDinh(r.id) : undefined}
                />
              </td>
              <td className="thtt-stt">{i + 1}</td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  value={r.hoVaTen}
                  onChange={(e) => updateGiaDinh(r.id, { hoVaTen: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  placeholder="yyyy"
                  value={r.namSinh}
                  onChange={(e) => updateGiaDinh(r.id, { namSinh: e.target.value })}
                />
              </td>
              <td>
                <Dropdown
                  value={r.quocTich}
                  placeholder="Chọn"
                  items={FOREIGN_COUNTRIES}
                  onChange={(v) => updateGiaDinh(r.id, { quocTich: v })}
                />
              </td>
              <td>
                <Dropdown
                  value={r.mqh}
                  placeholder="Chọn"
                  items={MQH_ITEMS}
                  onChange={(v) => updateGiaDinh(r.id, { mqh: v })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  value={r.ngheNghiep}
                  onChange={(e) => updateGiaDinh(r.id, { ngheNghiep: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  value={r.noiLamViec}
                  onChange={(e) => updateGiaDinh(r.id, { noiLamViec: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tkbtv-input tkbtv-input--xs"
                  value={r.choO}
                  onChange={(e) => updateGiaDinh(r.id, { choO: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="tkbtv-field">
        <label className="tkbtv-label thtt-table-heading">
          Nơi cư trú ở nước ngoài trước khi nhập cảnh Việt Nam <span className="tkbtv-req">*</span>
        </label>
      </div>
      <div className="tkbtv-row">
        <div className="tkbtv-field tkbtv-field--half">
          <label className="tkbtv-label tkbtv-label--sub">Quốc gia</label>
          <Dropdown
            value={quocGiaCT}
            placeholder="Chọn quốc gia"
            items={FOREIGN_COUNTRIES}
            onChange={setQuocGiaCT}
          />
        </div>
        <div className="tkbtv-field tkbtv-field--half">
          <label className="tkbtv-label tkbtv-label--sub">Nơi cư trú</label>
          <input type="text" className="tkbtv-input" value={noiCuTruNN} onChange={(e) => setNoiCuTruNN(e.target.value)} />
        </div>
      </div>

      <div className="tkbtv-field">
        <label className="tkbtv-label thtt-table-heading">
          Nơi ở hiện tại ở Việt Nam <span className="tkbtv-req">*</span>
        </label>
      </div>
      <div className="tkbtv-row">
        <ProvinceWardSelect
          province={province}
          ward={ward}
          onProvinceChange={setProvince}
          onWardChange={setWard}
        />
      </div>
      <div className="tkbtv-field">
        <label className="tkbtv-label">
          Địa chỉ (số nhà, đường phố, thôn, xóm, làng, ấp, bản, buôn, phum, sóc)
        </label>
        <input type="text" className="tkbtv-input" value={diaChi} onChange={(e) => setDiaChi(e.target.value)} />
      </div>
    </>
  );
}
