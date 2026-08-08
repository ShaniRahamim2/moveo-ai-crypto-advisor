import { useCallback, useState } from 'react';
import type { SectionType } from '../feedback/queries';

const STORAGE_KEY = 'crypto-advisor.collapsed-sections';

/**
 * Which sections are folded away is a display preference, not user data, so it
 * lives in localStorage: no schema change and no network call. It does have to
 * persist, though — a section springing back open on reload would stand out
 * precisely because votes and dismissals do survive.
 */
function readCollapsed(): SectionType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SectionType[]) : [];
  } catch {
    return [];
  }
}

export function useCollapsedSection(section: SectionType) {
  // Everything opens expanded by default; a collapsed initial state reads as
  // content that failed to load.
  const [collapsed, setCollapsed] = useState(() => readCollapsed().includes(section));

  const toggle = useCallback(() => {
    setCollapsed((wasCollapsed) => {
      const next = !wasCollapsed;
      try {
        const current = new Set(readCollapsed());
        if (next) {
          current.add(section);
        } else {
          current.delete(section);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
      } catch {
        // A private-mode storage failure must not break the control.
      }
      return next;
    });
  }, [section]);

  return { collapsed, toggle };
}
