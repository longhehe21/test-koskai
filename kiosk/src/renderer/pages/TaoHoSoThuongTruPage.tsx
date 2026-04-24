import '@styles/pages/tao-ho-so-thuong-tru.css';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useUnsavedChangesGuard } from '@hooks/useUnsavedChangesGuard';
import { useScanStore } from '@store/scanStore';
import { useDraftFormStore } from '@store/draftFormStore';
import { parseCt01Ocr } from '@utils/parseCt01Ocr';
import { findProvinceForWard } from '@utils/wardToProvinceMap';
import {
  createOrUpdateDraft,
  getApplication,
  hydrateScansFromServer,
  submitApplication,
} from '@services/applicationService';
import { useScanUpload } from '@hooks/useScanUpload';
import {
  ConfirmSubmitModal,
  Dropdown,
  DraftSavedToast,
  FormFooter,
  MultiSelect,
  ProvinceWardSelect,
  UnsavedChangesModal,
  type DropdownItem,
} from '@components/ui';
import { sound } from '@services/soundService';
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

const PROCEDURE_CODE = 'thuong-tru';

/**
 * Parse ?appId=123 từ URL. Null nếu không hợp lệ.
 * Hoisted ra ngoài để wrapper + inner form chia sẻ (DRY).
 */
function parseResumeAppId(search: string): number | null {
  const id = Number(new URLSearchParams(search).get('appId'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Wrapper: gate render đến khi resume-data load xong.
 *
 * Why: 20+ useState ở inner form init 1 LẦN tại mount. Nếu setForm(store) từ
 * API chạy SAU khi useState đã init (vì async) → local state vẫn trống dù
 * store có data → "nhấn sửa thì giống như mới".
 *
 * Fix: inner form chỉ mount SAU khi store đã được hydrate từ server. Dùng key
 * theo appId để force remount khi user click resume cho hồ sơ khác.
 */
export default function TaoHoSoThuongTruPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const resumeAppId = useMemo(() => parseResumeAppId(location.search), [location.search]);

  // Nếu không có resumeAppId → ready ngay (đọc sessionStorage cache nếu có)
  const [ready, setReady] = useState(!resumeAppId);
  const [loadedAppId, setLoadedAppId] = useState<number | null>(null);

  useEffect(() => {
    if (!resumeAppId) {
      setReady(true);
      setLoadedAppId(null);
      return;
    }
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const detail = await getApplication(resumeAppId);
        if (cancelled) return;
        // Chặn edit hồ sơ đã nộp: server cũng block PATCH, nhưng FE redirect
        // sớm để UX rõ (hiện list thay vì form read-only dễ nhầm).
        if (detail.submittedAt) {
          navigate('/ho-so-cua-toi', { replace: true });
          return;
        }
        if (detail.formDataJson) {
          useDraftFormStore.getState().setForm(PROCEDURE_CODE, detail.formDataJson);
        }
        useDraftFormStore.getState().setAppId(PROCEDURE_CODE, detail.id);
        // Hydrate scanStore từ application_files trên server → XemTruocHoSoPage
        // đọc scanStore thấy ảnh đã lưu lúc lưu nháp trước đó (cross-session).
        await hydrateScansFromServer(
          detail.id,
          PROCEDURE_CODE,
          useScanStore.getState().saveDoc,
        );
        if (cancelled) return;
        setLoadedAppId(detail.id);
      } catch (err) {
        console.warn('[TaoHoSoThuongTru] load draft fail:', (err as Error).message);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [resumeAppId, navigate]);

  if (!ready) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
        Đang tải hồ sơ nháp...
      </div>
    );
  }

  // key: force remount khi chuyển từ fresh ↔ resume hồ sơ khác nhau
  return <TaoHoSoThuongTruForm key={loadedAppId ?? 'fresh'} />;
}

function TaoHoSoThuongTruForm() {
  const navigate = useNavigate();
  const isVK = useMemo(() => isVietKieuBranch(), []);

  const setAppId = useDraftFormStore((s) => s.setAppId);
  const getAppId = useDraftFormStore((s) => s.getAppId);
  const setForm = useDraftFormStore((s) => s.setForm);
  const getForm = useDraftFormStore((s) => s.getForm);
  // Snapshot cachedForm tại mount — dùng cho useState inits. Wrapper đã đảm
  // bảo store có data TRƯỚC khi inner form mount (resume) hoặc có cache cũ
  // từ sessionStorage (navigate-back). Re-render sau đó KHÔNG re-init state.
  const cachedForm = useMemo(
    () => (useDraftFormStore.getState().forms[PROCEDURE_CODE] ?? {}) as Record<string, unknown>,
    [],
  );
  const c1 = (cachedForm.section1 ?? {}) as Record<string, unknown>;
  const c2 = (cachedForm.section2 ?? {}) as Record<string, unknown>;
  const c4 = (cachedForm.section4 ?? {}) as Record<string, unknown>;
  const c5 = (cachedForm.section5 ?? {}) as Record<string, unknown>;
  const c6 = (cachedForm.section6 ?? {}) as Record<string, unknown>;
  const c7 = (cachedForm.section7 ?? {}) as Record<string, unknown>;

  usePageHeader({ title: 'Hồ sơ đăng ký thường trú' });

  // Parse OCR CT01 user đã scan — extract đủ các trường để auto-fill form
  const allDocs = useScanStore((s) => s.docs);
  const ct01OcrText = useMemo(() => {
    const prefix = 'thuong-tru:';
    for (const [k, doc] of Object.entries(allDocs)) {
      if (k.startsWith(prefix)
        && doc.matchCode === 'ct01-to-khai-thay-doi-thong-tin-cu-tru'
        && doc.ocrText) {
        return doc.ocrText;
      }
    }
    return null;
  }, [allDocs]);
  const ocrFields = useMemo(
    () => (ct01OcrText ? parseCt01Ocr(ct01OcrText) : null),
    [ct01OcrText],
  );
  const defaultWardName = ocrFields?.ward ?? 'Phường Ba Đình';
  const defaultProvinceName = ocrFields?.ward
    ? findProvinceForWard(ocrFields.ward)
    : 'Thành phố Hà Nội';

  // Debug log các field đã parse được từ OCR
  useEffect(() => {
    if (!ocrFields) return;
    console.group('%c[TaoHoSoThuongTru] OCR fields parsed', 'color:#f59e0b;font-weight:700');
    console.table(ocrFields);
    console.log('defaultProvinceName:', defaultProvinceName);
    console.log('defaultWardName:', defaultWardName);
    console.groupEnd();
  }, [ocrFields, defaultProvinceName, defaultWardName]);

  // Section I — ưu tiên cached draft (resume/session) > default
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
  const [hoSoMoi, setHoSoMoi] = useState<HoSoMoi>(
    (c2.hoSoMoi as HoSoMoi) ?? 'lap-ho-moi',
  );
  const defaultTruongHop = isVK
    ? TRUONG_HOP_ITEMS.find((t) => t.code === 'nhan-khau') ?? null
    : null;
  const [truongHop, setTruongHop] = useState<DropdownItem | null>(
    (c2.truongHop as DropdownItem | null) ?? defaultTruongHop,
  );

  // Section IV — ưu tiên cached > OCR > default
  const [s4Province, setS4Province] = useState<DropdownItem | null>(
    (c4.province as DropdownItem | null) ?? null,
  );
  const [s4Ward, setS4Ward] = useState<DropdownItem | null>(
    (c4.ward as DropdownItem | null) ?? null,
  );
  const [s4DiaChi, setS4DiaChi] = useState((c4.diaChi as string) ?? '');
  const [chuHoHoTen, setChuHoHoTen] = useState(
    (c4.chuHoHoTen as string) ?? ocrFields?.hoTenChuHo ?? '',
  );
  const [chuHoQuanHe, setChuHoQuanHe] = useState(
    (c4.chuHoQuanHe as string) ?? ocrFields?.mqhChuHo ?? '',
  );
  const [chuHoCccd, setChuHoCccd] = useState((c4.chuHoCccd as string) ?? '');
  const [noiDung, setNoiDung] = useState(
    (c4.noiDung as string) ?? ocrFields?.noiDungDeNghi ?? '',
  );

  // Section V
  const [nguoiKeKhai, setNguoiKeKhai] = useState<NguoiKeKhai | null>(
    (c5.nguoiKeKhai as NguoiKeKhai | null) ?? null,
  );
  const initialXinYKien = (c5.xinYKien as XinYKienRow[] | undefined) ?? [emptyXinYKien(1)];
  const [xinYKien, setXinYKien] = useState<XinYKienRow[]>(initialXinYKien);
  const [xinYKienNext, setXinYKienNext] = useState(
    initialXinYKien.length > 0 ? Math.max(...initialXinYKien.map((r) => r.id)) + 1 : 2,
  );

  // Section VI
  const [s6ThongBao, setS6ThongBao] = useState<string[]>(
    (c6.thongBao as string[]) ?? ['cong-tt'],
  );
  const [s6KetQua, setS6KetQua] = useState<DropdownItem | null>(
    (c6.ketQua as DropdownItem | null) ?? KET_QUA_OPTIONS[0],
  );
  const [s6Email, setS6Email] = useState((c6.email as string) ?? '');
  const showEmail = s6ThongBao.includes('email') || s6KetQua?.code === 'email';

  // Section VII
  const [lePhi, setLePhi] = useState<LePhi>((c7.lePhi as LePhi) ?? 'co-phi');
  const [lyDoMienPhi, setLyDoMienPhi] = useState<DropdownItem | null>(
    (c7.lyDoMienPhi as DropdownItem | null) ?? null,
  );

  // Commit
  const [committed, setCommitted] = useState((cachedForm.committed as boolean) ?? false);
  const [showDraft, setShowDraft] = useState(false);
  const [draftTrackingCode, setDraftTrackingCode] = useState<string | null>(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // Dirty tracking: true khi user focus vào field bất kỳ lần đầu.
  // onFocusCapture bắt event từ mọi input/textarea/button con.
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };
  const { guard, proceed, cancel, isPrompting } = useUnsavedChangesGuard(isDirty);

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

  /**
   * Collect toàn bộ state (parent-owned + Section3 mirror từ draftFormStore) → object JSON
   * để gửi lên server lưu nháp.
   *
   * Section III tự mirror state vào draftFormStore (xem Section3VN.tsx useEffect).
   * Đọc FRESH section3 từ store (không dùng cachedForm memoized) để bắt kịp
   * Section3 edits mới nhất trước khi save.
   */
  const buildFormData = (): Record<string, unknown> => {
    const liveForm = (getForm(PROCEDURE_CODE) ?? {}) as { section3?: Record<string, unknown> };
    return {
      section1: {
        province: s1Province,
        ward: s1Ward,
        coquan: s1CoQuan,
        sdt: s1Sdt,
      },
      section2: {
        hoSoMoi,
        truongHop,
      },
      section3: liveForm.section3 ?? {},
      section4: {
        province: s4Province,
        ward: s4Ward,
        diaChi: s4DiaChi,
        chuHoHoTen,
        chuHoQuanHe,
        chuHoCccd,
        noiDung,
      },
      section5: {
        nguoiKeKhai,
        xinYKien,
      },
      section6: {
        thongBao: s6ThongBao,
        ketQua: s6KetQua,
        email: s6Email,
      },
      section7: {
        lePhi,
        lyDoMienPhi,
      },
      committed,
    };
  };

  // Hook upload ảnh scan lên MinIO (encrypt per-citizen key).
  const { upload: uploadScan } = useScanUpload();

  /**
   * Upload các ảnh scan chưa synced của procedure này. Gọi SAU khi có appId.
   * Skip docs có fileId (đã upload) → idempotent khi user save nhiều lần.
   * Lỗi từng file không block save formData — log warning, user vẫn lưu được
   * formData, nút "Lưu nháp" bấm lại sẽ retry.
   */
  const uploadPendingScans = async (appId: number): Promise<void> => {
    const allDocs = useScanStore.getState().docs;
    const prefix = `${PROCEDURE_CODE}:`;
    const pending = Object.entries(allDocs).filter(
      ([k, d]) => k.startsWith(prefix) && !d.fileId && d.uploadState !== 'synced',
    );
    await Promise.all(
      pending.map(async ([key, doc]) => {
        const docCode = key.slice(prefix.length);
        try {
          await uploadScan({
            flowKey: PROCEDURE_CODE,
            docCode,
            applicationId: appId,
            dataUrl: doc.dataUrl,
          });
        } catch (err) {
          console.warn('[TaoHoSoThuongTru] upload scan fail', docCode, (err as Error).message);
        }
      }),
    );
  };

  const handleSaveDraft = async () => {
    try {
      const formData = buildFormData();
      setForm(PROCEDURE_CODE, formData);
      const existingAppId = getAppId(PROCEDURE_CODE);
      const { appId, trackingCode } = await createOrUpdateDraft(
        PROCEDURE_CODE,
        formData,
        existingAppId,
      );
      setAppId(PROCEDURE_CODE, appId);
      // Upload ảnh scan sau khi có appId. Await để đảm bảo xong rồi mới show
      // toast "Đã lưu" — user navigate đi thì cũng không mất ảnh. Lỗi từng
      // file không throw (catch trong uploadPendingScans) → save vẫn success.
      await uploadPendingScans(appId);
      setDraftTrackingCode(trackingCode || null);
      setIsDirty(false);
      setShowDraft(true);
    } catch (err) {
      console.warn('[TaoHoSoThuongTru] save draft fail:', (err as Error).message);
      setDraftTrackingCode(null);
      setShowDraft(true);
    }
  };

  // Bấm "Nộp hồ sơ" → mở modal xác nhận trước. Tránh nộp nhầm.
  const handleSubmit = () => {
    if (!committed) return;
    setShowConfirmSubmit(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmSubmit(false);
    setIsDirty(false); // Đã nộp → không cần guard khi navigate.
    try {
      // Đảm bảo form data + ảnh đã lưu server TRƯỚC khi submit — tránh nộp
      // dữ liệu cũ nếu user edit sau lần Lưu nháp cuối.
      const formData = buildFormData();
      setForm(PROCEDURE_CODE, formData);
      const existingAppId = getAppId(PROCEDURE_CODE);
      const { appId } = await createOrUpdateDraft(
        PROCEDURE_CODE,
        formData,
        existingAppId,
      );
      setAppId(PROCEDURE_CODE, appId);
      await uploadPendingScans(appId);
      // Transition draft → submitted. Sau này BE/list sẽ thấy status 'submitted'.
      await submitApplication(appId);
    } catch (err) {
      console.warn('[TaoHoSoThuongTru] submit fail:', (err as Error).message);
      // Fallback: vẫn navigate để user không kẹt. Status chưa đổi — user retry
      // qua "Hồ sơ của tôi".
    }
    sound.success();
    navigate('/nop-ho-so-thanh-cong');
  };

  return (
    <>
      <div
        className="tkbtv-area"
        onFocusCapture={markDirty}
        onChangeCapture={markDirty}
      >
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
                  defaultProvinceName={defaultProvinceName}
                  defaultWardName={defaultWardName}
                  provinceLabel="Tỉnh/Thành phố"
                  wardLabel="Xã/Phường/Đặc khu"
                  provinceRequired
                  wardRequired
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
                  {/* Bỏ checkbox "CD Việt Nam định cư ở nước ngoài" — đã xác định
                      qua nguồn gốc ở page trước (HoKhauTruongHop / HoKhauSinhSong).
                      `isVK` được compute từ branch → truyền vào Section3 tương ứng. */}
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
            <div className="tkbtv-section-body">
              {isVK ? <Section3VK ocrFields={ocrFields} /> : <Section3VN ocrFields={ocrFields} />}
            </div>
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
                  defaultProvinceName={defaultProvinceName}
                  defaultWardName={defaultWardName}
                  provinceLabel="Tỉnh/Thành phố"
                  wardLabel="Xã/Phường/Đặc khu"
                  provinceRequired
                  wardRequired
                  disabled={!!ocrFields?.ward}
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
          onBack={() => guard(() => navigate(-1))}
          onDraft={handleSaveDraft}
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
      />
    </>
  );
}

