import { usePageHeader } from '@hooks/usePageHeader';
import type { PageHeaderConfig } from '@store/layoutStore';

interface PagePlaceholderProps {
  title: string;
  description?: string;
  header?: Partial<PageHeaderConfig>;
}

/**
 * Placeholder component cho các page chưa port từ UI repo.
 * Phase 5: thay bằng component thực, import CSS per-page tương ứng.
 */
export function PagePlaceholder({ title, description, header }: PagePlaceholderProps) {
  usePageHeader({ title, ...header });

  return (
    <div className="flex flex-col items-center gap-4 p-10 text-center">
      <div className="rounded-2xl border-2 border-dashed border-kiosk-border bg-white px-10 py-12 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-kiosk-text-muted">
          Placeholder
        </p>
        <h2 className="mt-2 text-3xl font-bold text-kiosk-text">{title}</h2>
        {description && (
          <p className="mt-3 max-w-md text-sm leading-relaxed text-kiosk-text-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
