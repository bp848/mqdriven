export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
}

export interface MeetingSummary {
  summary: string;
  keyDecisions: string[];
  actionItems: ActionItem[];
}
