
// Model Definitions
export const MODEL_TRANSCRIPTION = 'gemini-2.5-flash';
export const MODEL_ANALYSIS = 'gemini-3-pro-preview';
export const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';

// Configuration
export const THINKING_BUDGET = 32768;

// Prompts
export const ANALYSIS_SYSTEM_INSTRUCTION = `
あなたは熟練したエグゼクティブアシスタント兼プロジェクトマネージャーです。
会議の文字起こしを分析し、専門的な議事録を作成するのがあなたの仕事です。
簡潔な要約、適切なタイトル、そして具体的なアクションアイテムのリストを抽出してください。
出力はすべて日本語で行ってください。
アクションアイテムには、担当者（推測できる場合、なければ「未定」）と優先度（High/Medium/Low）を含めてください。
`;
