import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { generateGmailAutoReply } from '../services/geminiService';
import { EmployeeUser } from '../types';

interface EmailAutoReplyPageProps {
  currentUser: EmployeeUser | null;
  isAIOff?: boolean;
}

type GmailMessage = {
  id: string;
  threadId?: string;
  from?: string;
  subject?: string;
  snippet?: string;
  date?: string;
  body?: string;
};

type DraftState = {
  subject: string;
  body: string;
  draftId?: string;
};

const EmailAutoReplyPage: React.FC<EmailAutoReplyPageProps> = ({ currentUser, isAIOff }) => {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
  const [draft, setDraft] = useState<DraftState>({ subject: '', body: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const senderName = useMemo(() => currentUser?.name || currentUser?.email || '担当者', [currentUser]);

  const loadInbox = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/assistant/gmail/inbox?maxResults=25');
      if (!response.ok) throw new Error('受信トレイの取得に失敗しました。');
      const data = await response.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '受信トレイの取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMessage = useCallback(async (id: string) => {
    setError(null);
    setSelectedMessage(null);
    setDraft({ subject: '', body: '' });
    try {
      const response = await fetch(`/api/assistant/gmail/message/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error('メール本文の取得に失敗しました。');
      const data = await response.json();
      if (data?.message) {
        setSelectedMessage(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メール本文の取得に失敗しました。');
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const handleGenerateReply = useCallback(async () => {
    if (!selectedMessage || isAIOff) return;
    setIsGenerating(true);
    setError(null);
    try {
      const reply = await generateGmailAutoReply(
        {
          from: selectedMessage.from,
          subject: selectedMessage.subject,
          body: selectedMessage.body || selectedMessage.snippet,
        },
        senderName
      );
      setDraft({ subject: reply.subject, body: reply.body });
    } catch (err) {
      setError(err instanceof Error ? err.message : '返信下書きの生成に失敗しました。');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedMessage, isAIOff, senderName]);

  const handleCreateDraft = useCallback(async () => {
    if (!selectedMessage) return;
    setIsDrafting(true);
    setError(null);
    try {
      const response = await fetch('/api/assistant/gmail/reply-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedMessage.from || '',
          subject: draft.subject || `Re: ${selectedMessage.subject || ''}`,
          body: draft.body,
        }),
      });
      if (!response.ok) throw new Error('下書きの作成に失敗しました。');
      const data = await response.json();
      setDraft((prev) => ({ ...prev, draftId: data.draftId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '下書きの作成に失敗しました。');
    } finally {
      setIsDrafting(false);
    }
  }, [selectedMessage, draft.subject, draft.body]);

  const handleSendDraft = useCallback(async () => {
    if (!draft.draftId) return;
    setIsSending(true);
    setError(null);
    try {
      const response = await fetch('/api/assistant/gmail/send-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.draftId }),
      });
      if (!response.ok) throw new Error('送信に失敗しました。');
      await loadInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました。');
    } finally {
      setIsSending(false);
    }
  }, [draft.draftId, loadInbox]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">メール自動返信</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">Gmail受信トレイを確認し、AIで返信下書きを作成します。</p>
        </div>
        <button
          type="button"
          onClick={loadInbox}
          className="px-4 py-2 rounded-md bg-slate-800 text-white text-sm hover:bg-slate-700"
          disabled={isLoading}
        >
          受信トレイ更新
        </button>
      </div>
      {error && (
        <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 p-3 text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
            受信トレイ
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
            {isLoading && (
              <div className="p-4 text-sm text-slate-500">読み込み中...</div>
            )}
            {!isLoading && messages.length === 0 && (
              <div className="p-4 text-sm text-slate-500">メールがありません。</div>
            )}
            {messages.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => loadMessage(message.id)}
                className={`w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 ${selectedMessage?.id === message.id ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
              >
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{message.subject || '（件名なし）'}</p>
                <p className="text-xs text-slate-500 truncate">{message.from}</p>
                <p className="text-xs text-slate-400 truncate">{message.snippet}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 p-4 space-y-4">
          {!selectedMessage && (
            <div className="text-sm text-slate-500">受信メールを選択してください。</div>
          )}
          {selectedMessage && (
            <>
              <div>
                <p className="text-xs text-slate-500">From</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{selectedMessage.from || '不明'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Subject</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{selectedMessage.subject || '（件名なし）'}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-3 text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-200 min-h-[120px]">
                {selectedMessage.body || selectedMessage.snippet || '本文が取得できませんでした。'}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">AI返信下書き</p>
                  <button
                    type="button"
                    onClick={handleGenerateReply}
                    disabled={isGenerating || isAIOff}
                    className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50"
                  >
                    {isGenerating ? '生成中...' : 'AIで作成'}
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) => setDraft((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="件名"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-md p-2 text-sm bg-white dark:bg-slate-900"
                  />
                  <textarea
                    value={draft.body}
                    onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
                    placeholder="本文"
                    rows={8}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-md p-2 text-sm bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCreateDraft}
                    disabled={isDrafting || !draft.body}
                    className="px-3 py-2 rounded-md bg-slate-800 text-white text-sm hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isDrafting ? '下書き作成中...' : '下書きを作成'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendDraft}
                    disabled={isSending || !draft.draftId}
                    className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isSending ? '送信中...' : '下書きを送信'}
                  </button>
                  {draft.draftId && (
                    <span className="text-xs text-slate-500 self-center">Draft ID: {draft.draftId}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailAutoReplyPage;
