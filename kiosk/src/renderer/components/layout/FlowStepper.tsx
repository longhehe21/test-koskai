import '@styles/components/flow-stepper.css';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlowStepper } from '@hooks/useFlowStepper';
import { sound } from '@services/soundService';

/**
 * Thanh progress stepper — ẩn khi không trong flow (login, services, list).
 *
 * Click behavior:
 *  - Step done (trước current): clickable, navigate về step.jumpTo
 *  - Step active: no-op
 *  - Step todo (sau current): disabled — không cho skip forward tránh miss
 *    data đã nhập ở các bước trung gian
 */
export function FlowStepper() {
  const state = useFlowStepper();
  const navigate = useNavigate();

  // Sound khi đổi step — track prev để phân biệt forward/back.
  // Ref lưu {flowId, stepIndex} của render trước, so sánh ở effect.
  const prevRef = useRef<{ flowId: string; idx: number } | null>(null);
  useEffect(() => {
    if (!state) {
      prevRef.current = null;
      return;
    }
    const prev = prevRef.current;
    const curr = { flowId: state.flow.id, idx: state.currentStepIndex };
    // Chỉ phát sound khi cùng flow và step index đổi — skip lần mount đầu.
    if (prev && prev.flowId === curr.flowId && prev.idx !== curr.idx) {
      if (curr.idx > prev.idx) {
        sound.stepForward();
      } else {
        sound.stepBack();
      }
    }
    prevRef.current = curr;
  }, [state]);

  if (!state) return null;

  const { flow, currentStepIndex } = state;

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex >= currentStepIndex) return; // chỉ cho jump back
    const step = flow.steps[stepIndex];
    const target = step.jumpTo ?? step.matches[0];
    if (target) navigate(target);
  };

  return (
    <nav className="flow-stepper" aria-label={`Tiến trình: ${flow.label}`}>
      <ol className="flow-stepper-list">
        {flow.steps.map((step, index) => {
          const isDone = index < currentStepIndex;
          const isActive = index === currentStepIndex;
          const isClickable = isDone;
          const stateClass = isDone
            ? 'flow-step--done'
            : isActive
              ? 'flow-step--active'
              : 'flow-step--todo';

          return (
            <li key={step.key} className={`flow-step ${stateClass}`}>
              <button
                type="button"
                className="flow-step-btn"
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                aria-current={isActive ? 'step' : undefined}
                title={isClickable ? `Quay về: ${step.label}` : step.label}
              >
                <span className="flow-step-marker">
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span className="flow-step-num">{index + 1}</span>
                  )}
                </span>
                <span className="flow-step-label">{step.label}</span>
              </button>
              {index < flow.steps.length - 1 && (
                <span className="flow-step-connector" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
