import { useEffect, useState } from 'react';
import type { MountDrawerState } from '../../../types';

export function useAdvancedSectionState(
  drawerState: MountDrawerState | null,
  isDrawerOpen: boolean
) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (isDrawerOpen) {
      setAdvancedOpen(drawerState?.mode === 'edit');
    }
  }, [drawerState?.mode, isDrawerOpen]);

  return { advancedOpen, setAdvancedOpen };
}
