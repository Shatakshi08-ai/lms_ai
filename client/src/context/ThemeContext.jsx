import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { THEMES, THEME_ALIASES } from '../data/themes.js';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'lms_theme';

function applyCssTokens(theme) {
  const root = document.documentElement;
  Object.entries(theme.tokens).forEach(([key, value]) => root.style.setProperty(key, value));
  root.classList.toggle('dark', theme.dark);
  root.dataset.theme = theme.id;
}

function readStoredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const mapped = THEME_ALIASES[stored] || stored;
  if (mapped && THEMES[mapped]) return mapped;
  return 'warm-library';
}

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    const id = readStoredTheme();
    if (typeof document !== 'undefined') applyCssTokens(THEMES[id] || THEMES['warm-library']);
    return id;
  });

  useEffect(() => {
    const theme = THEMES[themeId] || THEMES['warm-library'];
    localStorage.setItem(STORAGE_KEY, theme.id);
    applyCssTokens(theme);
  }, [themeId]);

  const setTheme = useCallback((id) => {
    if (THEMES[id]) setThemeId(id);
  }, []);

  const theme = THEMES[themeId] || THEMES['warm-library'];

  const value = useMemo(
    () => ({
      themeId: theme.id,
      theme,
      themes: Object.values(THEMES),
      setTheme,
      mode: theme.dark ? 'dark' : 'light',
      toggle: () => setThemeId((id) => (THEMES[id]?.dark ? 'warm-library' : 'dark-rose')),
    }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm: theme.dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            ...theme.antd,
            colorBgBase: theme.tokens['--background-color'],
            colorBgContainer: theme.tokens['--surface-color'],
            colorText: theme.tokens['--text-color'],
            colorBorder: theme.tokens['--border-color'],
            borderRadius: 10,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          },
          components: {
            Layout: {
              headerBg: theme.tokens['--navbar-bg'],
              siderBg: theme.tokens['--sidebar-bg'],
              bodyBg: theme.tokens['--background-color'],
            },
            Menu: {
              darkItemBg: 'transparent',
              darkItemSelectedBg: theme.tokens['--sidebar-active'],
              darkItemHoverBg: theme.tokens['--sidebar-hover'],
              darkItemColor: theme.tokens['--sidebar-text'],
              darkItemSelectedColor: '#ffffff',
            },
            Button: { primaryShadow: 'none' },
            Card: { colorBgContainer: theme.tokens['--surface-color'] },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeContext);
}

export { THEMES };
