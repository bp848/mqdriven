const THEME_STORAGE_KEY = 'mq_theme';

type ThemePreference = 'light' | 'dark' | 'system';

const isValidThemePreference = (value: string | null): value is ThemePreference => {
  return value === 'light' || value === 'dark' || value === 'system';
};

const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isValidThemePreference(raw) ? raw : 'system';
};

const resolveDarkMode = (preference: ThemePreference): boolean => {
  if (preference === 'dark') {
    return true;
  }
  if (preference === 'light') {
    return false;
  }
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const applyDarkClass = (isDark: boolean) => {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('dark', isDark);
};

export const initializeTheme = (): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const applyCurrentTheme = () => {
    applyDarkClass(resolveDarkMode(getStoredThemePreference()));
  };

  applyCurrentTheme();

  const handleSystemThemeChange = () => {
    if (getStoredThemePreference() === 'system') {
      applyCurrentTheme();
    }
  };

  mediaQuery.addEventListener('change', handleSystemThemeChange);

  return () => {
    mediaQuery.removeEventListener('change', handleSystemThemeChange);
  };
};

export { THEME_STORAGE_KEY };
