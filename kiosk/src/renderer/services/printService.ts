/**
 * Print service cho máy in nhiệt 80mm (theo CLAUDE.md spec).
 *
 * Hiện stub — log payload + simulate latency. Khi tích hợp hardware:
 *   - Thay body hàm bằng `window.kioskApi.invoke('printer:receipt', payload)`
 *     (preload IPC) hoặc fetch API nội bộ.
 *   - Xử lý error printer (out of paper, offline) bằng cách trả về
 *     `{ success: false, error: 'Máy in hết giấy' }`.
 *
 * UI không cần biết hardware detail — chỉ gọi `printReceipt(data)`.
 */

export interface ReceiptData {
  applicationCode: string;
  procedureName: string;
  submittedAt: string; // ISO date hoặc display format
  processingDays?: number;
  expectedResultDate?: string;
  /** URL encode cho QR tra cứu hồ sơ. */
  trackingUrl?: string;
}

export interface PrintResult {
  success: boolean;
  error?: string;
}

export async function printReceipt(data: ReceiptData): Promise<PrintResult> {
  // eslint-disable-next-line no-console
  console.debug('[printer] receipt', data);
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { success: true };
}
