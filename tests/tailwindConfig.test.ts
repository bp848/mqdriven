import { describe, expect, it } from 'vitest';
import tailwindConfig from '../tailwind.config';

describe('tailwind config', () => {
  it('uses class-based dark mode so html.dark controls theme', () => {
    expect(tailwindConfig.darkMode).toBe('class');
  });
});
