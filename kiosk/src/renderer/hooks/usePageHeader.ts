import { useEffect } from 'react';
import { useLayoutStore, type PageHeaderConfig } from '@store/layoutStore';

type UsePageHeaderOptions = Partial<PageHeaderConfig> & { title: string };

/**
 * Cấu hình header cho page hiện tại. Gọi trong component page.
 * Default: showBack = true, showUserBadge = true, showDocs = true.
 */
export function usePageHeader(options: UsePageHeaderOptions): void {
  const setHeader = useLayoutStore((s) => s.setHeader);

  const {
    title,
    showBack = true,
    showUserBadge = true,
    showDocs = true,
    userName,
    onBack,
  } = options;

  useEffect(() => {
    setHeader({ title, showBack, showUserBadge, showDocs, userName, onBack });
  }, [title, showBack, showUserBadge, showDocs, userName, onBack, setHeader]);
}
