
export interface TranscriptEntry {
  timestamp: string;
  text: string;
}

export interface SummaryData {
  title: string;
  overview: string;
  decisions: string[];
  keyPoints: string[];
  nextActions: string[];
  topic?: string;
  attendees?: string[];
  location?: string;
  category?: string;
  atmosphere?: string;
}

export interface MediaMetadata {
  name: string;
  size: number;
  type: string;
  url: string;
  base64: string;
}

export type VisibilityLevel = 'private' | 'team' | 'public';

export interface HistoryEntry {
  id: string;
  date: string;
  fileName: string;
  author: string;
  ownerId: string;
  department: string;
  status: '解析済み' | '共有済み' | '下書き' | '解析中';
  visibility: VisibilityLevel;
  transcript: TranscriptEntry[];
  summary?: SummaryData;
  wordCount: number;
  charCount: number;
}
