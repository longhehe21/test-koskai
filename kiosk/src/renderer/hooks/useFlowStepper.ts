import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  FLOWS,
  findPathMatches,
  findUniqueFlow,
  type FlowDef,
  type FlowId,
} from '@renderer/flows/flowConfig';

const STORAGE_KEY = 'kiosk.currentFlow';

interface FlowState {
  flow: FlowDef;
  currentStepIndex: number;
}

/**
 * Detect flow + step hiện tại dựa trên pathname.
 *
 * Strategy:
 *  1. Nếu path match unique 1 flow → set currentFlow vào sessionStorage
 *  2. Nếu path shared (nhiều flow cùng dùng, vd /nop-ho-so-thanh-cong) →
 *     đọc flowId từ sessionStorage để chọn flow đúng
 *  3. Nếu path không match flow nào (vd /services, /cu-tru) → return null,
 *     stepper ẩn
 *
 * sessionStorage reset khi user đóng kiosk → phù hợp retention PII.
 */
export function useFlowStepper(): FlowState | null {
  const { pathname } = useLocation();

  // Update session storage mỗi khi path unique match 1 flow → "nhớ" flow.
  useEffect(() => {
    const unique = findUniqueFlow(pathname);
    if (unique) {
      try {
        sessionStorage.setItem(STORAGE_KEY, unique.flowId);
      } catch {
        /* private mode — silent */
      }
    }
  }, [pathname]);

  return useMemo(() => {
    const matches = findPathMatches(pathname);
    if (matches.length === 0) return null;

    // Case 1: unique match — dùng luôn, không cần đọc session.
    if (matches.length === 1) {
      const { flowId, stepIndex } = matches[0];
      return { flow: FLOWS[flowId], currentStepIndex: stepIndex };
    }

    // Case 2: shared path — đọc flowId từ session.
    let storedFlowId: string | null = null;
    try {
      storedFlowId = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const match =
      matches.find((m) => m.flowId === storedFlowId) ?? matches[0];
    return { flow: FLOWS[match.flowId], currentStepIndex: match.stepIndex };
  }, [pathname]);
}

/** Xóa flow state — gọi khi user logout / về menu dịch vụ để reset progress. */
export function clearCurrentFlow(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export type { FlowId };
