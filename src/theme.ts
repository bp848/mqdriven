const THEME_STORAGE_KEY = 'mq_theme';
const LEGACY_THEME_STORAGE_KEYS = ['theme', 'darkMode'] as const;

export type ThemePreference = 'light' | 'dark' | 'system';

const isValidThemePreference = (value: string | null): value is ThemePreference => {
  return value === 'light' || value === 'dark' || value === 'system';
};

export const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isValidThemePreference(raw)) return raw;

  for (const legacyKey of LEGACY_THEME_STORAGE_KEYS) {
    const legacyRaw = window.localStorage.getItem(legacyKey);
    if (legacyRaw === 'dark' || legacyRaw === 'light') {
      return legacyRaw;
    }
    if (legacyRaw === '1' || legacyRaw === 'true') {
      return 'dark';
    }
    if (legacyRaw === '0' || legacyRaw === 'false') {
      return 'light';
    }
  }

  return 'system';
};

export const resolveDarkMode = (preference: ThemePreference): boolean => {
  if (preference === 'dark') {
    return true;
  }
  if (preference === 'light') {
    return false;
  }
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const applyDarkClass = (isDark: boolean) => {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('dark', isDark);
};


export const setStoredThemePreference = (preference: ThemePreference) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
};

export const applyThemePreference = (preference: ThemePreference) => {
  applyDarkClass(resolveDarkMode(preference));
};

export const initializeTheme = (): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const applyCurrentTheme = () => {
    applyThemePreference(getStoredThemePreference());
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
