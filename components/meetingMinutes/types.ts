export interface TranscriptEntry {
  timestamp: string;
  text: string;
}

export interface OptimizationEntry {
  id: string;
  original: string;
  optimized: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface SummaryData {
  title: string;
  overview: string;
  decisions: string[];
  keyPoints: string[];
  nextActions: string[];
}

export interface MediaMetadata {
  name: string;
  size: number;
  type: string;
  url: string;
  base64: string;
}

export interface AnalysisResults {
  transcript: TranscriptEntry[];
  wordCount: number;
  charCount: number;
  topWords: { text: string; size: number }[];
  summary?: SummaryData;
}

export interface HistoryEntry {
  id: string;
  date: string;
  fileName: string;
  transcript: TranscriptEntry[];
  summary?: SummaryData;
  wordCount: number;
  charCount: number;
  analysis?: AnalysisResults;
}
