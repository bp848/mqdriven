import { describe, expect, it } from 'vitest';
import {
  isFullKatakana,
  isHalfKatakana,
  isKatakana,
  hiraganaToKatakana,
  halfToFullKatakana,
  normalizeToKatakana,
  validateKatakana,
  type KatakanaValidationResult
} from '../utils/katakanaValidation';

describe('katakana validation', () => {
  describe('isFullKatakana', () => {
    it('returns true for full-width katakana', () => {
      expect(isFullKatakana('ヤマダタロウ')).toBe(true);
      expect(isFullKatakana('アキコ')).toBe(true);
    });

    it('returns false for non-katakana', () => {
      expect(isFullKatakana('山田太郎')).toBe(false);
      expect(isFullKatakana('やまだたろう')).toBe(false);
      expect(isFullKatakana('ﾔﾏﾀﾞﾀﾛｳ')).toBe(false);
      expect(isFullKatakana('Yamada')).toBe(false);
    });
  });

  describe('isHalfKatakana', () => {
    it('returns true for half-width katakana', () => {
      expect(isHalfKatakana('ﾔﾏﾀﾞﾀﾛｳ')).toBe(true);
      expect(isHalfKatakana('ｱｷｺ')).toBe(true);
    });

    it('returns false for non-half-katakana', () => {
      expect(isHalfKatakana('ヤマダタロウ')).toBe(false);
      expect(isHalfKatakana('山田太郎')).toBe(false);
      expect(isHalfKatakana('やまだたろう')).toBe(false);
      expect(isHalfKatakana('Yamada')).toBe(false);
    });
  });

  describe('isKatakana', () => {
    it('returns true for any katakana', () => {
      expect(isKatakana('ヤマダタロウ')).toBe(true);
      expect(isKatakana('ﾔﾏﾀﾞﾀﾛｳ')).toBe(true);
      expect(isKatakana('ﾔﾏﾀﾞﾀﾛｳｱｷｺ')).toBe(true);
    });

    it('returns false for non-katakana', () => {
      expect(isKatakana('山田太郎')).toBe(false);
      expect(isKatakana('やまだたろう')).toBe(false);
      expect(isKatakana('Yamada')).toBe(false);
    });
  });

  describe('hiraganaToKatakana', () => {
    it('converts hiragana to katakana', () => {
      expect(hiraganaToKatakana('やまだたろう')).toBe('ヤマダタロウ');
      expect(hiraganaToKatakana('あきこ')).toBe('アキコ');
    });

    it('leaves katakana unchanged', () => {
      expect(hiraganaToKatakana('ヤマダタロウ')).toBe('ヤマダタロウ');
    });
  });

  describe('halfToFullKatakana', () => {
    it('converts half-width to full-width katakana', () => {
      expect(halfToFullKatakana('ﾔﾏﾀﾞﾀﾛｳ')).toBe('ヤマダタロウ');
      expect(halfToFullKatakana('ｱｷｺ')).toBe('アキコ');
    });

    it('handles voiced sounds', () => {
      expect(halfToFullKatakana('ｶﾞｷﾞｸﾞｹﾞｺﾞ')).toBe('ガギグゲゴ');
    });

    it('handles semi-voiced sounds', () => {
      expect(halfToFullKatakana('ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ')).toBe('パピプペポ');
    });
  });

  describe('normalizeToKatakana', () => {
    it('converts hiragana and half-kata to full-kata', () => {
      expect(normalizeToKatakana('やまだたろう')).toBe('ヤマダタロウ');
      expect(normalizeToKatakana('ﾔﾏﾀﾞﾀﾛｳ')).toBe('ヤマダタロウ');
      expect(normalizeToKatakana('やまだﾀﾛｳ')).toBe('ヤマダタロウ');
    });
  });

  describe('validateKatakana', () => {
    it('validates correct full-width katakana', () => {
      const result = validateKatakana('ヤマダタロウ');
      expect(result.isValid).toBe(true);
      expect(result.isKatakana).toBe(true);
      expect(result.isFullWidth).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('rejects non-katakana', () => {
      const result = validateKatakana('山田太郎');
      expect(result.isValid).toBe(false);
      expect(result.isKatakana).toBe(false);
      expect(result.errorMessage).toBe('カタカナで入力してください');
    });

    it('rejects half-width when not allowed', () => {
      const result = validateKatakana('ﾔﾏﾀﾞﾀﾛｳ', { allowHalfWidth: false });
      expect(result.isValid).toBe(false);
      expect(result.isKatakana).toBe(true);
      expect(result.isFullWidth).toBe(false);
      expect(result.errorMessage).toBe('全角カタカナで入力してください');
    });

    it('allows half-width when permitted', () => {
      const result = validateKatakana('ﾔﾏﾀﾞﾀﾛｳ', { allowHalfWidth: true });
      expect(result.isValid).toBe(true);
      expect(result.isKatakana).toBe(true);
      expect(result.isFullWidth).toBe(false);
      expect(result.errorMessage).toBeUndefined();
    });

    it('auto-normalizes hiragana to katakana', () => {
      const result = validateKatakana('やまだたろう', { autoNormalize: true });
      expect(result.isValid).toBe(true);
      expect(result.isKatakana).toBe(true);
      expect(result.isFullWidth).toBe(true);
      expect(result.normalizedText).toBe('ヤマダタロウ');
    });

    it('auto-normalizes half-width to full-width', () => {
      const result = validateKatakana('ﾔﾏﾀﾞﾀﾛｳ', { allowHalfWidth: false, autoNormalize: true });
      expect(result.isValid).toBe(true);
      expect(result.isKatakana).toBe(true);
      expect(result.isFullWidth).toBe(true);
      expect(result.normalizedText).toBe('ヤマダタロウ');
    });

    it('handles empty input', () => {
      const result = validateKatakana('');
      expect(result.isValid).toBe(false);
      expect(result.isKatakana).toBe(false);
      expect(result.errorMessage).toBe('名前カナは必須です');
    });

    it('handles null/undefined input', () => {
      const result1 = validateKatakana(null as any);
      const result2 = validateKatakana(undefined as any);
      
      expect(result1.isValid).toBe(false);
      expect(result1.errorMessage).toBe('名前カナは必須です');
      
      expect(result2.isValid).toBe(false);
      expect(result2.errorMessage).toBe('名前カナは必須です');
    });

    it('handles mixed content with auto-normalize', () => {
      const result = validateKatakana('やまだﾀﾛｳ', { autoNormalize: true });
      expect(result.isValid).toBe(true);
      expect(result.normalizedText).toBe('ヤマダタロウ');
    });

    it('fails mixed content without auto-normalize', () => {
      const result = validateKatakana('やまだﾀﾛｳ');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('カタカナで入力してください');
    });
  });
});
