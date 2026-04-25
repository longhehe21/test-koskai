const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000';

export interface TimelineEvent {
  statusCode: string;
  statusName: string;
  note: string | null;
  changedAt: string;
}

export interface TrackingDetail {
  trackingCode: string;
  procedureCode: string;
  procedureName: string;
  statusCode: string;
  statusName: string;
  statusColor: string;
  agencyName: string | null;
  processingDays: number | null;
  expectedResultDate: string | null;
  createdAt: string;
  submittedAt: string | null;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export class ApiError extends Error {
  constructor(public status: number, message?: string) {
    super(message ?? `HTTP ${status}`);
  }
}

/**
 * GET /public/tracking/:code — public endpoint, không auth.
 * 404 = không tìm thấy mã. 400 = code format sai. 429 = rate-limited.
 */
export async function getTracking(code: string): Promise<TrackingDetail> {
  const res = await fetch(`${API_BASE}/public/tracking/${encodeURIComponent(code)}`);
  if (!res.ok) {
    let msg: string | undefined;
    try {
      const body = (await res.json()) as { error?: string };
      msg = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as TrackingDetail;
}
