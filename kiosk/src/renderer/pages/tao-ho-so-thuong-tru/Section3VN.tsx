import { useEffect, useState } from 'react';
import { DatePicker, Dropdown, type DropdownItem } from '@components/ui';
import { GIOI_TINH_ITEMS, QUAN_HE_ITEMS, RowActions } from './shared';
import { useCurrentUser } from '@hooks/useCurrentUser';
import { namesMatch, type Ct01Fields } from '@utils/parseCt01Ocr';
import { useDraftFormStore } from '@store/draftFormStore';

const PROCEDURE_CODE = 'thuong-tru';

interface Section3VNProps {
  /** Nếu có OCR → auto detect khai hộ + fill thông tin người được khai từ OCR */
  ocrFields?: Ct01Fields | null;
}

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

export function Section3VN({ ocrFields }: Section3VNProps = {}) {
  const user = useCurrentUser();
  const patchForm = useDraftFormStore((s) => s.patchForm);
  // Nếu có cached draft → hydrate từ store (load khi user resume)
  const cachedS3 = useDraftFormStore((s) =>
    (s.forms[PROCEDURE_CODE] as { section3?: Record<string, unknown> } | undefined)?.section3,
  );
  // Lookup gender item theo giá trị user (Nam/Nữ) để pre-fill Dropdown
  const userGenderItem = GIOI_TINH_ITEMS.find(
    (it) => it.name.toLowerCase() === user.gioiTinh.toLowerCase(),
  ) ?? null;
  const ocrGenderItem = ocrFields?.gioiTinh
    ? GIOI_TINH_ITEMS.find((it) => it.name === ocrFields.gioiTinh) ?? null
    : null;

  // Logic auto khai hộ: nếu OCR có hoTen và KHÁC user → khai hộ, fill từ OCR.
  // Nếu match hoặc không có OCR → tự khai, fill từ user.
  const isKhaiHoFromOcr = !!(ocrFields?.hoTen && !namesMatch(ocrFields.hoTen, user.hoTen));

  // OCR marker: tên được scan khi section3 cached lần trước. Dùng để detect
  // scan mới (người khác) → phải bỏ cache, init lại từ OCR.
  // Không có marker trùng → cache stale (parser cũ, scan cũ) → không dùng.
  // Why: scan CT01 parser cũ lỗi cache khaiBy='tu-khai' → user scan lại parser
  // mới, cache vẫn override → không tự tick "Khai hộ".
  const currentOcrHoTen = ocrFields?.hoTen ?? null;
  const cachedMarker = (cachedS3?.__ocrHoTenMarker as string | undefined) ?? null;
  const useCachedData = !!cachedS3 && currentOcrHoTen === cachedMarker;

  // Ưu tiên: cached (nếu marker khớp) > OCR-derived > user/default
  const [khaiBy, setKhaiBy] = useState<'tu-khai' | 'khai-ho'>(
    useCachedData && cachedS3!.khaiBy
      ? (cachedS3!.khaiBy as 'tu-khai' | 'khai-ho')
      : (isKhaiHoFromOcr ? 'khai-ho' : 'tu-khai'),
  );
  const [hoTen, setHoTen] = useState(
    useCachedData && cachedS3!.hoTen !== undefined
      ? (cachedS3!.hoTen as string)
      : (isKhaiHoFromOcr ? ocrFields!.hoTen! : user.hoTen),
  );
  const [ngaySinh, setNgaySinh] = useState(
    useCachedData && cachedS3!.ngaySinh !== undefined
      ? (cachedS3!.ngaySinh as string)
      : (isKhaiHoFromOcr ? (ocrFields!.ngaySinh ?? '') : user.ngaySinh),
  );
  const [gioiTinh, setGioiTinh] = useState<DropdownItem | null>(
    useCachedData && cachedS3!.gioiTinh !== undefined
      ? (cachedS3!.gioiTinh as DropdownItem | null)
      : (isKhaiHoFromOcr ? ocrGenderItem : userGenderItem),
  );
  const [cccd, setCccd] = useState(
    useCachedData && cachedS3!.cccd !== undefined
      ? (cachedS3!.cccd as string)
      : (isKhaiHoFromOcr ? '' : user.cccd),
  );
  const [sdt, setSdt] = useState(
    useCachedData && cachedS3!.sdt !== undefined
      ? (cachedS3!.sdt as string)
      : (isKhaiHoFromOcr ? (ocrFields!.sdt ?? '') : user.sdt),
  );
  const [email, setEmail] = useState(
    useCachedData && cachedS3!.email !== undefined
      ? (cachedS3!.email as string)
      : (isKhaiHoFromOcr ? (ocrFields!.email ?? '') : ''),
  );

  const handleKhaiByChange = (v: 'tu-khai' | 'khai-ho') => {
    setKhaiBy(v);
    if (v === 'tu-khai') {
      setHoTen(user.hoTen);
      setNgaySinh(user.ngaySinh);
      setGioiTinh(userGenderItem);
      setCccd(user.cccd);
      setSdt(user.sdt);
      setEmail('');
    } else {
      // Khai hộ: fill từ OCR nếu có, không thì trống để user điền
      setHoTen(ocrFields?.hoTen ?? '');
      setNgaySinh(ocrFields?.ngaySinh ?? '');
      setGioiTinh(ocrGenderItem);
      setCccd('');
      setSdt(ocrFields?.sdt ?? '');
      setEmail(ocrFields?.email ?? '');
    }
  };

  const [thanhVien, setThanhVien] = useState<ThanhVien[]>(
    (cachedS3?.thanhVien as ThanhVien[] | undefined) ?? [emptyTv(1)],
  );
  const [nextId, setNextId] = useState(2);

  // Mirror state → draftFormStore để parent đọc khi "Lưu nháp".
  // __ocrHoTenMarker: pin snapshot OCR hoTen vào cache — lần sau mount, so
  // sánh marker với current OCR để quyết định cache còn valid không.
  useEffect(() => {
    patchForm(PROCEDURE_CODE, {
      section3: {
        __ocrHoTenMarker: currentOcrHoTen,
        khaiBy,
        hoTen,
        ngaySinh,
        gioiTinh,
        cccd,
        sdt,
        email,
        thanhVien,
      },
    });
  }, [khaiBy, hoTen, ngaySinh, gioiTinh, cccd, sdt, email, thanhVien, currentOcrHoTen, patchForm]);

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
              onClick={() => handleKhaiByChange(v)}
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

      <h3 className="thtt-table-title">Những thành viên trong hộ gia đình cùng thay đổi</h3>
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
