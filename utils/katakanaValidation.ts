/**
 * カタカナバリデーションユーティリティ
 */

// 全角カタカナの正規表現
const KATAKANA_REGEX = /^[\u30A0-\u30FF]+$/;

// 半角カタカナの正規表現  
const HALF_KATAKANA_REGEX = /^[\uFF66-\uFF9F]+$/;

// カタカナ（全角・半角）の正規表現
const KATAKANA_ANY_REGEX = /^[\u30A0-\u30FF\uFF66-\uFF9F]+$/;

/**
 * 文字列が全角カタカナのみかどうかをチェック
 */
export function isFullKatakana(text: string): boolean {
  return KATAKANA_REGEX.test(text);
}

/**
 * 文字列が半角カタカナのみかどうかをチェック
 */
export function isHalfKatakana(text: string): boolean {
  return HALF_KATAKANA_REGEX.test(text);
}

/**
 * 文字列がカタカナ（全角・半角）のみかどうかをチェック
 */
export function isKatakana(text: string): boolean {
  return KATAKANA_ANY_REGEX.test(text);
}

/**
 * ひらがなをカタカナに変換
 */
export function hiraganaToKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (char) => {
    const code = char.charCodeAt(0);
    return String.fromCharCode(code + 0x60);
  });
}

/**
 * 半角カタカナを全角カタカナに変換
 */
export function halfToFullKatakana(text: string): string {
  const basicMap: { [key: string]: string } = {
    'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー',
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ﾝ': 'ン',
  };

  const voicedMap: { [key: string]: string } = {
    'ｶ': 'ガ', 'ｷ': 'ギ', 'ｸ': 'グ', 'ｹ': 'ゲ', 'ｺ': 'ゴ',
    'ｻ': 'ザ', 'ｼ': 'ジ', 'ｽ': 'ズ', 'ｾ': 'ゼ', 'ｿ': 'ゾ',
    'ﾀ': 'ダ', 'ﾁ': 'ヂ', 'ﾂ': 'ヅ', 'ﾃ': 'デ', 'ﾄ': 'ド',
    'ﾊ': 'バ', 'ﾋ': 'ビ', 'ﾌ': 'ブ', 'ﾍ': 'ベ', 'ﾎ': 'ボ',
  };

  const semiVoicedMap: { [key: string]: string } = {
    'ﾊ': 'パ', 'ﾋ': 'ピ', 'ﾌ': 'プ', 'ﾍ': 'ペ', 'ﾎ': 'ポ',
  };

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    // 濁音処理（文字 + ﾞ）
    if (nextChar === 'ﾞ' && voicedMap[char]) {
      result += voicedMap[char];
      i++; // 濁点をスキップ
      continue;
    }

    // 半濁音処理（文字 + ﾟ）
    if (nextChar === 'ﾟ' && semiVoicedMap[char]) {
      result += semiVoicedMap[char];
      i++; // 半濁点をスキップ
      continue;
    }

    // 基本変換
    result += basicMap[char] || char;
  }

  return result;
}

/**
 * 日本語テキストをカタカナに変換（ひらがな→カタカナ、半角→全角）
 */
export function normalizeToKatakana(text: string): string {
  // ひらがなをカタカナに変換
  let result = hiraganaToKatakana(text);
  // 半角カタカナを全角カタカナに変換
  result = halfToFullKatakana(result);
  return result;
}

/**
 * カタカナのバリデーション結果
 */
export interface KatakanaValidationResult {
  isValid: boolean;
  isKatakana: boolean;
  isFullWidth: boolean;
  normalizedText?: string;
  errorMessage?: string;
}

/**
 * カタカナバリデーションを実行
 */
export function validateKatakana(text: string, options: {
  allowHalfWidth?: boolean;
  autoNormalize?: boolean;
} = {}): KatakanaValidationResult {
  const { allowHalfWidth = false, autoNormalize = false } = options;

  if (!text || text.trim() === '') {
    return {
      isValid: false,
      isKatakana: false,
      isFullWidth: false,
      errorMessage: '名前カナは必須です'
    };
  }

  const trimmedText = text.trim();
  const isKatakanaOnly = isKatakana(trimmedText);
  const isFullWidthOnly = isFullKatakana(trimmedText);

  if (!isKatakanaOnly) {
    // 自動正規化が有効な場合
    if (autoNormalize) {
      const normalized = normalizeToKatakana(trimmedText);
      if (isKatakana(normalized)) {
        return {
          isValid: true,
          isKatakana: true,
          isFullWidth: isFullKatakana(normalized),
          normalizedText: normalized
        };
      }
    }

    return {
      isValid: false,
      isKatakana: false,
      isFullWidth: false,
      errorMessage: 'カタカナで入力してください'
    };
  }

  // 半角カタカナが許可されていない場合
  if (!allowHalfWidth && !isFullWidthOnly) {
    if (autoNormalize) {
      const normalized = halfToFullKatakana(trimmedText);
      return {
        isValid: true,
        isKatakana: true,
        isFullWidth: true,
        normalizedText: normalized
      };
    }

    return {
      isValid: false,
      isKatakana: true,
      isFullWidth: false,
      errorMessage: '全角カタカナで入力してください'
    };
  }

  return {
    isValid: true,
    isKatakana: true,
    isFullWidth: isFullWidthOnly
  };
}
