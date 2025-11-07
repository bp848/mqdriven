/**
 * 超親切なバリデーションシステム
 * ITリテラシーが低い人でも理解できるエラーメッセージと解決方法を提供
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  solution: string;
  example?: string;
  severity: 'error' | 'warning';
}

/**
 * メールアドレスのバリデーション
 */
export const validateEmail = (email: string): ValidationError | null => {
  if (!email || email.trim() === '') {
    return {
      field: 'email',
      message: '❌ メールアドレスが入力されていません',
      solution: '📝 メールアドレスを入力してください。\n\n例えば：yamada@example.com のような形式で入力してください。',
      example: 'yamada@example.com',
      severity: 'error',
    };
  }

  if (!email.includes('@')) {
    return {
      field: 'email',
      message: '❌ メールアドレスに「@」が含まれていません',
      solution: '📝 メールアドレスには必ず「@」マークが必要です。\n\n正しい例：yamada@example.com\n間違った例：yamadaexample.com',
      example: 'yamada@example.com',
      severity: 'error',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      field: 'email',
      message: '❌ メールアドレスの形式が正しくありません',
      solution: '📝 メールアドレスは以下の形式で入力してください：\n\n• 名前@会社名.com\n• 例：yamada@example.com\n\n【よくある間違い】\n• スペースが入っている → スペースを削除してください\n• .com などがない → .com や .co.jp を追加してください',
      example: 'yamada@example.com',
      severity: 'error',
    };
  }

  return null;
};

/**
 * 郵便番号のバリデーション
 */
export const validatePostalCode = (postalCode: string): ValidationError | null => {
  if (!postalCode || postalCode.trim() === '') {
    return {
      field: 'postalCode',
      message: '❌ 郵便番号が入力されていません',
      solution: '📝 郵便番号を入力してください。\n\n【入力方法】\n• ハイフン（-）は入れても入れなくてもOKです\n• 例1：123-4567（ハイフンあり）\n• 例2：1234567（ハイフンなし）\n\nどちらでも大丈夫です！',
      example: '123-4567 または 1234567',
      severity: 'error',
    };
  }

  // ハイフンを削除して数字のみにする
  const cleaned = postalCode.replace(/-/g, '');

  if (!/^\d+$/.test(cleaned)) {
    return {
      field: 'postalCode',
      message: '❌ 郵便番号に数字以外の文字が含まれています',
      solution: '📝 郵便番号は数字だけで入力してください。\n\n【正しい例】\n• 123-4567\n• 1234567\n\n【間違った例】\n• 一二三-四五六七（漢数字はダメです）\n• 123-456７（全角数字はダメです）\n\n半角の数字で入力してください。',
      example: '123-4567',
      severity: 'error',
    };
  }

  if (cleaned.length !== 7) {
    return {
      field: 'postalCode',
      message: `❌ 郵便番号の桁数が正しくありません（現在：${cleaned.length}桁）`,
      solution: '📝 郵便番号は7桁で入力してください。\n\n【正しい例】\n• 123-4567（7桁）\n• 1234567（7桁）\n\n【間違った例】\n• 123-456（6桁 → 1桁足りません）\n• 123-45678（8桁 → 1桁多いです）\n\n郵便番号は必ず7桁です。もう一度確認してください。',
      example: '123-4567',
      severity: 'error',
    };
  }

  return null;
};

/**
 * 電話番号のバリデーション
 */
export const validatePhoneNumber = (phoneNumber: string): ValidationError | null => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return {
      field: 'phoneNumber',
      message: '❌ 電話番号が入力されていません',
      solution: '📝 電話番号を入力してください。\n\n【入力方法】\n• ハイフン（-）は入れても入れなくてもOKです\n• 例1：03-1234-5678（ハイフンあり）\n• 例2：0312345678（ハイフンなし）\n\n【国際電話の場合】\n• +81-3-1234-5678\n• 最初の0は省略して、+81の後に続けます',
      example: '03-1234-5678',
      severity: 'error',
    };
  }

  // +81などの国際番号、ハイフン、スペースを削除
  const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');

  if (!/^\d+$/.test(cleaned)) {
    return {
      field: 'phoneNumber',
      message: '❌ 電話番号に数字以外の文字が含まれています',
      solution: '📝 電話番号は数字だけで入力してください。\n\n【正しい例】\n• 03-1234-5678\n• 090-1234-5678\n• 0312345678\n\n【間違った例】\n• ０３-１２３４-５６７８（全角数字はダメです）\n• 03(1234)5678（カッコはダメです）\n\n半角の数字で入力してください。',
      example: '03-1234-5678',
      severity: 'error',
    };
  }

  // 国際番号の処理
  let finalNumber = cleaned;
  if (cleaned.startsWith('81')) {
    // +81の後に0を追加する必要があるか確認
    finalNumber = '0' + cleaned.substring(2);
  }

  if (finalNumber.length < 10 || finalNumber.length > 11) {
    return {
      field: 'phoneNumber',
      message: `❌ 電話番号の桁数が正しくありません（現在：${finalNumber.length}桁）`,
      solution: '📝 電話番号は10桁または11桁で入力してください。\n\n【固定電話（10桁）】\n• 03-1234-5678\n• 06-1234-5678\n\n【携帯電話（11桁）】\n• 090-1234-5678\n• 080-1234-5678\n\n桁数を確認してください。',
      example: '03-1234-5678 または 090-1234-5678',
      severity: 'error',
    };
  }

  return null;
};

/**
 * 金額のバリデーション
 */
export const validateAmount = (amount: string | number, fieldName: string = '金額'): ValidationError | null => {
  const amountStr = String(amount).trim();

  if (!amountStr || amountStr === '') {
    return {
      field: 'amount',
      message: `❌ ${fieldName}が入力されていません`,
      solution: `📝 ${fieldName}を入力してください。\n\n【入力方法】\n• 数字だけを入力してください\n• カンマ（,）は入れても入れなくてもOKです\n• 例1：5000\n• 例2：5,000\n\nどちらでも大丈夫です！`,
      example: '5000 または 5,000',
      severity: 'error',
    };
  }

  // カンマと円マークを削除
  const cleaned = amountStr.replace(/[,円¥]/g, '');

  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return {
      field: 'amount',
      message: `❌ ${fieldName}に数字以外の文字が含まれています`,
      solution: `📝 ${fieldName}は数字だけで入力してください。\n\n【正しい例】\n• 5000\n• 5,000\n• 5000円（円マークは自動で削除されます）\n\n【間違った例】\n• 五千円（漢数字はダメです）\n• ５０００（全角数字はダメです）\n• 5千円（千などの単位はダメです）\n\n半角の数字で入力してください。`,
      example: '5000',
      severity: 'error',
    };
  }

  const numericAmount = parseFloat(cleaned);

  if (numericAmount < 0) {
    return {
      field: 'amount',
      message: `❌ ${fieldName}がマイナスになっています`,
      solution: `📝 ${fieldName}はプラスの数字で入力してください。\n\n【正しい例】\n• 5000\n• 10000\n\n【間違った例】\n• -5000（マイナスはダメです）\n\nマイナス記号を削除してください。`,
      example: '5000',
      severity: 'error',
    };
  }

  return null;
};

/**
 * 必須項目のバリデーション
 */
export const validateRequired = (value: any, fieldName: string): ValidationError | null => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return {
      field: 'required',
      message: `❌ 「${fieldName}」が入力されていません`,
      solution: `📝 「${fieldName}」は必須項目です。必ず入力してください。\n\n【入力方法】\n1. 「${fieldName}」の入力欄を探してください\n2. 入力欄に適切な内容を入力してください\n3. 入力したら、もう一度送信ボタンを押してください\n\n入力欄が見つからない場合は、画面を上にスクロールして探してください。`,
      severity: 'error',
    };
  }

  return null;
};

/**
 * 日付のバリデーション
 */
export const validateDate = (dateStr: string, fieldName: string = '日付'): ValidationError | null => {
  if (!dateStr || dateStr.trim() === '') {
    return {
      field: 'date',
      message: `❌ ${fieldName}が入力されていません`,
      solution: `📝 ${fieldName}を入力してください。\n\n【入力方法】\n• カレンダーから選択してください\n• または、以下の形式で入力してください：\n  - 2024/11/06\n  - 2024-11-06\n\nどちらの形式でも大丈夫です！`,
      example: '2024/11/06',
      severity: 'error',
    };
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return {
      field: 'date',
      message: `❌ ${fieldName}の形式が正しくありません`,
      solution: `📝 ${fieldName}を正しい形式で入力してください。\n\n【正しい例】\n• 2024/11/06\n• 2024-11-06\n\n【間違った例】\n• 2024/13/01（13月はありません）\n• 2024/11/32（32日はありません）\n• 令和6年11月6日（和暦はダメです）\n\nカレンダーから選択すると間違いがありません。`,
      example: '2024/11/06',
      severity: 'error',
    };
  }

  return null;
};

/**
 * 全てのバリデーションエラーを表示用にフォーマット
 */
export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return '';

  let message = '⚠️ 以下の項目を修正してください：\n\n';
  
  errors.forEach((error, index) => {
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `【問題 ${index + 1}】\n`;
    message += `${error.message}\n\n`;
    message += `${error.solution}\n`;
    if (error.example) {
      message += `\n💡 入力例：${error.example}\n`;
    }
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  });

  message += `\n📌 上記の内容を修正したら、もう一度送信ボタンを押してください。\n`;
  message += `\n❓ わからないことがあれば、右下のチャットでお気軽にご質問ください。`;

  return message;
};
