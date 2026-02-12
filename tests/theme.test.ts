import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTheme, THEME_STORAGE_KEY } from '../src/theme';

type Listener = () => void;

const setupMatchMedia = (isDark = false) => {
  let listener: Listener | null = null;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: isDark,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn((_: string, cb: Listener) => {
        listener = cb;
      }),
      removeEventListener: vi.fn(),
    })),
  });

  return {
    fireChange: () => listener?.(),
  };
};

describe('initializeTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('enables dark class when stored preference is dark', () => {
    setupMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    initializeTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('follows system preference when stored preference is missing', () => {
    setupMatchMedia(true);

    initializeTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('updates class on system theme change while in system mode', () => {
    const media = setupMatchMedia(false);

    initializeTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    setupMatchMedia(true);
    media.fireChange();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('supports legacy theme key values', () => {
    setupMatchMedia(false);
    window.localStorage.setItem('theme', 'dark');

    initializeTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('supports legacy darkMode boolean-like values', () => {
    setupMatchMedia(false);
    window.localStorage.setItem('darkMode', 'true');

    initializeTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
