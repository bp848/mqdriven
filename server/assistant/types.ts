export type ChatMsg = { role: 'user' | 'assistant'; text: string; ts: number };

export type ToolName =
  | 'calendar_today'
  | 'drive_search'
  | 'drive_suggest_path'
  | 'gmail_get'
  | 'gmail_inbox'
  | 'gmail_draft'
  | 'gws_summary'
  | 'ocr_image'
  | 'finalize_save'
  | 'log_event'
  | 'generate_daily_report';

export type ToolAction = {
  id: string;
  label: string;
  tool: ToolName;
  args?: any;
  danger?: boolean;
};

export type Preview = {
  activeTab?: 'Draft' | 'Files' | 'Manual' | 'Log';
  draft?: { title: string; content: string };
  files?: { suggestedPath: string; suggestedName: string; note?: string };
  manual?: { hits: { title: string; snippet: string; url?: string }[] };
  log?: { markdown: string };
};

export type ChatResponse = {
  assistantText?: string;
  actions?: ToolAction[];
  preview?: Preview;
};
