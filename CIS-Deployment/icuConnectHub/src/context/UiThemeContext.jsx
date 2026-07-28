import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const UI_THEMES = [
  { id: 'classic', label: 'Classic', hint: 'Original clinical layout' },
  { id: 'glass', label: 'Glass iOS', hint: 'Frosted panels & depth' },
  { id: 'clinical', label: 'Clinical', hint: 'Structured EMR style' },
  { id: 'soft', label: 'Soft', hint: 'Rounded & calm spacing' },
];

const STORAGE_KEY = 'icuConnectHub.uiTheme';

function readInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (UI_THEMES.some((t) => t.id === saved)) {
      document.documentElement.setAttribute('data-ui-theme', saved);
      return saved;
    }
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute('data-ui-theme', 'classic');
  return 'classic';
}

const UiThemeContext = createContext(null);

export function UiThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', themeId);
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      /* ignore */
    }
  }, [themeId]);

  const setTheme = useCallback((id) => {
    if (UI_THEMES.some((t) => t.id === id)) setThemeId(id);
  }, []);

  const value = useMemo(
    () => ({ themeId, setTheme, themes: UI_THEMES }),
    [themeId, setTheme],
  );

  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>;
}

export function useUiTheme() {
  const ctx = useContext(UiThemeContext);
  if (!ctx) throw new Error('useUiTheme must be used within UiThemeProvider');
  return ctx;
}
