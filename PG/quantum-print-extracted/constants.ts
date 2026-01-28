
export const MAIN_CATEGORIES = [
  { id: 'print-book', label: '印刷・製本（冊子系）', icon: '📚' },
  { id: 'print-sheet', label: '印刷（ペラ物）', icon: '📄' },
  { id: 'business-card', label: '名刺', icon: '📇' },
  { id: 'envelope', label: '封筒', icon: '✉️' },
  { id: 'display', label: '備品・表示物', icon: '📛' },
  { id: 'logistics-ops', label: '配送・発送代行', icon: '🚚' },
  { id: 'shipping-cost', label: '送料（単純送料）', icon: '📦' },
  { id: 'postage', label: '郵便料金', icon: '📮' },
  { id: 'storage', label: '保管費', icon: '🏢' },
  { id: 'warehouse', label: '倉庫・在庫管理', icon: '🏬' },
  { id: 'manuscript', label: '原稿料', icon: '✍️' },
  { id: 'web-ops', label: 'Web更新・運用', icon: '🌐' },
  { id: 'system-fee', label: 'システム利用・サイト利用', icon: '💻' },
  { id: 'adjustment', label: '調整・値引/値増', icon: '⚖️' },
  { id: 'other-service', label: 'その他サービス', icon: '✨' },
];

export const SUB_CATEGORIES = [
  '冊子/雑誌/機関誌/社内報', 'チラシ', 'カタログ', 'ポスター', 
  'はがき/年賀状', '表彰状', 'カード', '組織図/資料', 
  '名札', 'ネームプレート', '写真/額装'
];

export const KEYWORD_MAP: Record<string, string> = {
  '名刺': 'business-card',
  '名札': 'display', 'ネームプレート': 'display', '額縁': 'display', '写真': 'display',
  '封筒': 'envelope', '長3': 'envelope', '角2': 'envelope',
  '社内報': 'print-book', '機関誌': 'print-book', '報告書': 'print-book', '製本': 'print-book',
  'チラシ': 'print-sheet', 'ポスター': 'print-sheet', '表彰状': 'print-sheet', '年賀状': 'print-sheet',
  '物流': 'logistics-ops', '発送費': 'logistics-ops', '発送代行': 'logistics-ops',
  '送料': 'shipping-cost',
  '郵便': 'postage', '第三種': 'postage',
  '保管費': 'storage',
  '倉庫': 'warehouse', '在庫管理': 'warehouse',
  '原稿料': 'manuscript',
  'ホームページ': 'web-ops', '更新': 'web-ops', '管理費': 'web-ops',
  '発注サイト': 'system-fee'
};

export const BOOK_SIZES = ['A4', 'B5', 'A5', 'AB判', '四六判', '文庫', '新書', 'A3', 'カスタム'];
export const BINDING_OPTIONS = ['無線綴じ', '中綴じ', '上製本', '平綴じ', 'リング製本', 'なし（ペラ）'];
export const PAPER_TYPES = ['上質 70kg', '上質 90kg', 'コート 110kg', 'マットコート 110kg', 'アートポスト 180kg', '書籍用紙 72.5kg'];
export const COLOR_OPTIONS = ['本文モノクロ / 表紙カラー', '全ページフルカラー', '全ページモノクロ'];
// Added missing special processing options to resolve import errors
export const SPECIAL_PROCESSING_OPTIONS = ['なし', 'PP加工（グロス）', 'PP加工（マット）', '箔押し', 'エンボス加工', '穴あけ', '折り加工'];
