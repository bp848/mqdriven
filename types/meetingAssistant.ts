export interface MeetingTask {
  id: string;
  description: string;
  assignedTo: string;
  status: '未着手' | '進行中' | '完了';
}

export interface TranscriptionEntry {
  speaker: 'user' | 'model';
  text: string;
}
