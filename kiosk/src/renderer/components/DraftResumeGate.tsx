/**
 * DraftResumeGate — wrapper component gate render đến khi resume-data load xong.
 *
 * Usage:
 *   export default function Page() {
 *     return (
 *       <DraftResumeGate procedureCode="tam-vang">
 *         {(loadedAppId) => <InnerForm key={loadedAppId ?? 'fresh'} />}
 *       </DraftResumeGate>
 *     );
 *   }
 *
 * Tại sao: useState inner form init 1 LẦN tại mount. Nếu setForm(store) từ API
 * chạy SAU khi useState đã init → local state vẫn trống. Gate chờ data
 * hydrate rồi mới mount inner → useState đọc cache (đã có data) → hiện đúng.
 *
 * Cross-session: wrapper check `detail.submittedAt` — nếu đã nộp → redirect
 * /ho-so-cua-toi (chặn edit hồ sơ đã nộp dù FE lỡ lọt).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDraftFormStore } from '@store/draftFormStore';
import { useScanStore } from '@store/scanStore';
import {
  getApplication,
  hydrateScansFromServer,
} from '@services/applicationService';

interface DraftResumeGateProps {
  procedureCode: string;
  children: (loadedAppId: number | null) => ReactNode;
  /** Tuỳ chỉnh UI loading. Mặc định text đơn giản. */
  loadingLabel?: string;
}

function parseResumeAppId(search: string): number | null {
  const id = Number(new URLSearchParams(search).get('appId'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function DraftResumeGate({
  procedureCode,
  children,
  loadingLabel = 'Đang tải hồ sơ nháp...',
}: DraftResumeGateProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const resumeAppId = useMemo(() => parseResumeAppId(location.search), [location.search]);

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
        if (detail.submittedAt) {
          // Hồ sơ đã nộp → chặn edit, redirect list
          navigate('/ho-so-cua-toi', { replace: true });
          return;
        }
        if (detail.formDataJson) {
          useDraftFormStore.getState().setForm(procedureCode, detail.formDataJson);
        }
        useDraftFormStore.getState().setAppId(procedureCode, detail.id);
        // Hydrate ảnh scan từ server → XemTruocHoSoPage / form section đọc được
        await hydrateScansFromServer(
          detail.id,
          procedureCode,
          useScanStore.getState().saveDoc,
        );
        if (cancelled) return;
        setLoadedAppId(detail.id);
      } catch (err) {
        console.warn(`[${procedureCode}] load draft fail:`, (err as Error).message);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeAppId, procedureCode, navigate]);

  if (!ready) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
        {loadingLabel}
      </div>
    );
  }

  return <>{children(loadedAppId)}</>;
}
