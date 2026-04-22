// Service layer cho feedback — tách khỏi UI để sau này plug API/IPC thật vào
// mà không phải sửa component. Khớp schema DB bảng `feedbacks`
// (application_id, rating_score, comment).

export interface FeedbackPayload {
  applicationId: string;
  ratingScore: number; // 1..5
  comment?: string;
}

export interface FeedbackResult {
  success: boolean;
  error?: string;
}

/**
 * Gửi đánh giá dịch vụ. Hiện là stub — sau này thay bằng
 * `window.ipcRenderer.invoke('feedback:submit', payload)` hoặc
 * `fetch('/api/feedbacks', ...)` khi server sẵn sàng.
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  await new Promise((resolve) => setTimeout(resolve, 400)); // simulate latency
  return { success: true };
}
