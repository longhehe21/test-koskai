/**
 * useScanUpload — hook upload ảnh scan lên server.
 *
 * Flow:
 *  1. Convert dataURL → Blob
 *  2. FormData {image, applicationId, docCode}
 *  3. POST /documents/upload (qua api client — tự attach Bearer)
 *  4. Update scanStore uploadState + fileId
 *
 * Retry: caller tự gọi lại khi failed (UI có nút retry). Không auto-retry để
 * không spam server khi user đang offline kéo dài.
 */
import { useCallback } from 'react';
import { api, ApiError } from '@services/api';
import { useScanStore } from '@store/scanStore';

interface UploadResponse {
  id: number;
  fileKey: string;
  checksum: string;
  size: number;
}

interface UploadParams {
  flowKey: string;
  docCode: string;
  applicationId: number;
  dataUrl: string;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:([^;]+);base64/.exec(meta)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function useScanUpload() {
  const updateDoc = useScanStore((s) => s.updateDoc);

  const upload = useCallback(
    async (params: UploadParams) => {
      const { flowKey, docCode, applicationId, dataUrl } = params;
      updateDoc(flowKey, docCode, { uploadState: 'uploading', uploadError: undefined });

      try {
        const blob = dataUrlToBlob(dataUrl);
        const fd = new FormData();
        fd.append('image', blob, `${docCode}.jpg`);
        fd.append('applicationId', String(applicationId));
        fd.append('docCode', docCode);

        const res = await api.post<UploadResponse>('/documents/upload', fd);
        updateDoc(flowKey, docCode, {
          uploadState: 'synced',
          fileId: res.id,
          uploadError: undefined,
        });
        return res;
      } catch (err) {
        const msg = err instanceof ApiError
          ? `HTTP ${err.status}`
          : (err as Error).message;
        updateDoc(flowKey, docCode, {
          uploadState: 'failed',
          uploadError: msg,
        });
        throw err;
      }
    },
    [updateDoc],
  );

  return { upload };
}
