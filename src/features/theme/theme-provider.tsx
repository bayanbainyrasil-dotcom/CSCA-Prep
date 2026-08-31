import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';

type Theme = 'system' | 'light' | 'dark';
const ThemeSchema = z.enum(['system', 'light', 'dark']);
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

function readTheme(): Theme {
  const parsed = ThemeSchema.safeParse(localStorage.getItem('csca-theme'));
  return parsed.success ? parsed.data : 'system';
}

function applyTheme(theme: Theme) {
  const isDark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    localStorage.setItem('csca-theme', nextTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    const query = matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme(theme);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [setTheme, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider.');
  return value;
}
