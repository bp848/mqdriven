import { describe, expect, it } from 'vitest';
import tailwindConfig from '../tailwind.config';

describe('tailwind config', () => {
  it('uses class-based dark mode so html.dark controls theme', () => {
    expect(tailwindConfig.darkMode).toBe('class');
  });

  it('scans root-level ts/tsx files so App.tsx dark classes are generated', () => {
    const content = tailwindConfig.content as string[];
    expect(content).toContain('./*.{ts,tsx,js,jsx}');
  });
});
