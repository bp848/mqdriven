const { mcpHostSingleton: mcp } = require('./mcpHost');
const { appendEvent, readEventsForToday } = require('./eventLog');

const USER_ID_HEADER = 'x-user-id';

function getUserId(req) {
  return req?.headers?.[USER_ID_HEADER] || 'unknown-user';
}

function recordAction(userId, action, target, source) {
  appendEvent({
    ts: Date.now(),
    userId,
    type: action,
    payload: {
      source,
      target,
    },
  });
}

async function handleChat(req, message, uploadedFiles) {
  const userId = getUserId(req);

  appendEvent({
    ts: Date.now(),
    userId,
    type: 'chat.user',
    payload: { message, files: uploadedFiles },
  });

  const lower = (message || '').toLowerCase();

  if (lower.includes('予定') || lower.includes('スケジュール') || lower.includes('今日')) {
    const today = await mcp.calendar_today();
    recordAction(userId, 'calendar_read', 'today', 'google_calendar');
    const assistantText =
      `おはようございます。今日の予定です。\n` +
      today.items.map((item) => `${item.time}  ${item.title}`).join('\n') +
      `\n\nでは、次に何をしますか？（例：OCR / メール / 見積 / 議事録）`;

    const actions = [
      { id: 'next_ocr', label: 'OCRを開始', tool: 'ocr_image' },
      { id: 'next_mail', label: 'メール下書き', tool: 'gmail_draft', args: { to: '', subject: '' } },
      { id: 'next_manual', label: 'マニュアル検索', tool: 'drive_search', args: { query: 'OCR' } },
      { id: 'next_report', label: '日報（自動）生成', tool: 'generate_daily_report' },
    ];

    return { assistantText, actions };
  }

  if (lower.includes('ocr') || lower.includes('読み取') || uploadedFiles.length) {
    const target = uploadedFiles[0]?.name || '（未指定ファイル）';
    const assistantText =
      `かしこまりました。スケジュール上はOCRですね。\n対象は「${target}」でよろしいですか？\n` +
      `OKなら「OCR実行」を押してください。`;

    const actions = [
      { id: 'do_ocr', label: 'OCR実行', tool: 'ocr_image', args: { fileName: target } },
      { id: 'manual_ocr', label: '手順書を開く', tool: 'drive_search', args: { query: 'OCR 手順' } },
    ];

    const filesSuggest = await mcp.drive_suggest_path('OCR結果');
    return {
      assistantText,
      actions,
      preview: {
        activeTab: 'Files',
        files: filesSuggest,
      },
    };
  }

  if (lower.includes('メール') || lower.includes('mail') || lower.includes('gmail')) {
    const assistantText =
      `承知しました。メールは「送信」ではなく、まず下書きを作ります。\n宛先・件名・要点をください。\n` +
      `（例：橋本社長、日報、今日の要点3つ）`;

    const actions = [
      {
        id: 'draft_template',
        label: '日報メール雛形',
        tool: 'gmail_draft',
        args: { to: 'hashimoto', subject: '日報', body: '' },
      },
    ];

    return { assistantText, actions };
  }

  if (lower.includes('マニュアル') || lower.includes('手順')) {
    const res = await mcp.drive_search(message);
    recordAction(userId, 'drive_search', message, 'google_drive');
    const assistantText =
      '了解。関連マニュアルを探しました。\n右の「Manual」に候補を出しました。必要なら“音声で読む用”に短縮もします。';
    return {
      assistantText,
      preview: { activeTab: 'Manual', manual: { hits: res.hits } },
      actions: [{ id: 'report', label: '日報（自動）生成', tool: 'generate_daily_report' }],
    };
  }

  return {
    assistantText:
      `了解。次に何をしますか？\n` +
      `- OCR（画像/PDF）\n- メール下書き（Gmail）\n- マニュアル提示（Drive）\n- 日報（自動）\n\nどれでも「ボタン」で進めます。`,
    actions: [
      { id: 'a1', label: '今日の予定', tool: 'calendar_today' },
      { id: 'a2', label: 'OCRを開始', tool: 'ocr_image' },
      { id: 'a3', label: 'マニュアル検索', tool: 'drive_search', args: { query: '作業 手順' } },
      { id: 'a4', label: '日報（自動）生成', tool: 'generate_daily_report' },
    ],
  };
}

async function runTool(req, tool, args) {
  const userId = getUserId(req);

  appendEvent({ ts: Date.now(), userId, type: 'tool.run', payload: { tool, args } });

  if (tool === 'calendar_today') {
    const today = await mcp.calendar_today();
    recordAction(userId, 'calendar_read', 'today', 'google_calendar');
    return { assistantText: today.items.map((item) => `${item.time}  ${item.title}`).join('\n') };
  }

  if (tool === 'drive_search') {
    const q = String(args?.query || '');
    const res = await mcp.drive_search(q);
    recordAction(userId, 'drive_search', q, 'google_drive');
    return {
      assistantText: `検索しました（${res.source}）。`,
      preview: { activeTab: 'Manual', manual: { hits: res.hits } },
    };
  }

  if (tool === 'drive_suggest_path') {
    const ctx = String(args?.context || '');
    const s = await mcp.drive_suggest_path(ctx);
    return { assistantText: '保存提案を更新しました。', preview: { activeTab: 'Files', files: s } };
  }

  if (tool === 'gmail_draft') {
    const to = String(args?.to || '');
    const subject = String(args?.subject || '');
    const body =
      args?.body ||
      `橋本社長様\n\nいつもありがとうございます。\n本日の業務報告です。\n\n（ここに要点）\n\n以上、ご報告申し上げます。\n--`;
    const draft = await mcp.gmail_draft(to, subject, body);
    recordAction(userId, 'mail_draft', subject || '（件名未設定）', 'gmail');

    return {
      assistantText: '下書きを作成しました（送信はしていません）。',
      preview: { activeTab: 'Draft', draft: { title: `Gmail下書き: ${subject || '（件名未設定）'}`, content: draft.body } },
      actions: [
        { id: 'save', label: '保存先を提案', tool: 'drive_suggest_path', args: { context: '日報メール下書き' } },
      ],
    };
  }

  if (tool === 'ocr_image') {
    const fileName = String(args?.fileName || '（未指定）');
    const text = `【OCR結果（仮）】\n対象: ${fileName}\n\n・会社名: ＿＿＿\n・氏名: ＿＿＿\n・電話: ＿＿＿\n・メール: ＿＿＿\n`;
    appendEvent({ ts: Date.now(), userId, type: 'ocr.done', payload: { fileName, text } });

    const s = await mcp.drive_suggest_path('OCR結果');
    return {
      assistantText: 'OCRしました。登録はこちらでよろしいですか？（右に結果／保存提案を表示）',
      preview: {
        activeTab: 'Draft',
        draft: { title: 'OCR結果', content: text },
        files: s,
      },
      actions: [
        { id: 'confirm_save', label: '保存先このまま', tool: 'finalize_save', args: s, danger: true },
        { id: 'manual', label: '手順書', tool: 'drive_search', args: { query: '名刺 OCR 登録' } },
      ],
    };
  }

  if (tool === 'finalize_save') {
    appendEvent({ ts: Date.now(), userId, type: 'save.finalized', payload: args });
    recordAction(userId, 'drive_save', args?.suggestedName || '保存確定', 'google_drive');
    return {
      assistantText: '保存を確定しました（現状はログのみ）。次に何をしますか？',
      actions: [
        { id: 'next', label: '日報（自動）生成', tool: 'generate_daily_report' },
        { id: 'plan', label: '今日の予定', tool: 'calendar_today' },
      ],
    };
  }

  if (tool === 'generate_daily_report') {
    const ev = readEventsForToday();
    const md =
      `橋本社長様\n\nいつもありがとうございます。\n（自動生成）本日の業務ログです。\n\n` +
      ev
        .map((entry) => {
          const t = new Date(entry.ts).toTimeString().slice(0, 5);
          return `- ${t}  ${entry.type}  ${JSON.stringify(entry.payload).slice(0, 140)}`;
        })
        .join('\n') +
      `\n\n以上、ご報告申し上げます。\n--`;

    return { assistantText: '日報（自動）を生成しました。', preview: { activeTab: 'Log', log: { markdown: md } } };
  }

  return { assistantText: '未対応のツールです。', actions: [{ id: 'a', label: '今日の予定', tool: 'calendar_today' }] };
}

module.exports = {
  handleChat,
  runTool,
};
