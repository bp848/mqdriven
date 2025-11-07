import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, ThumbsUp, ThumbsDown, Copy, CheckCircle, X } from './Icons';

interface Message {
  id: string;
  type: 'ai' | 'user';
  text: string;
  timestamp: Date;
  hasButtons?: boolean;
  outputData?: any;
}

interface OtsuboneAIProps {
  currentUser: any;
  onDataSubmit?: (type: string, data: any) => Promise<void>;
}

const OtsuboneAI: React.FC<OtsuboneAIProps> = ({ currentUser, onDataSubmit }) => {
  // ユーザー名と敬称を取得
  const userName = currentUser?.name || 'お客';
  const userTitle = '様';
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      text: `${userName}${userTitle}、こんにちは！😊\n\nいつもお疲れ様です！\n\n私も文章堂の一員として、システムの稼働を全力でサポートしております。経営計画書もしっかり読んで、会社の目標達成に向けて頑張っております！\n\n何かお手伝いできることはございますでしょうか？\n\n例えば：\n• 日報を提出したい\n• 経費精算したい\n• 領収書を登録したい\n• データを入力したい\n\nなど、何でもお気軽にお申し付けくださいませ。一緒に頑張りましょう！`,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversationContext, setConversationContext] = useState<any>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (type: 'ai' | 'user', text: string, hasButtons = false, outputData?: any) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date(),
      hasButtons,
      outputData,
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleAIResponse = async (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();

    // 日報の処理
    if (lowerMessage.includes('日報') || lowerMessage.includes('にっぽう')) {
      if (!conversationContext.dailyReportStarted) {
        setConversationContext({ dailyReportStarted: true });
        setTimeout(() => {
          addMessage('ai', '日報ですね！承知しました。\n\n今日の業務内容を教えてください。\n\nコピペでも、箇条書きでも、何でも大丈夫です。');
        }, 500);
      } else if (!conversationContext.dailyReportContent) {
        setConversationContext(prev => ({ ...prev, dailyReportContent: userMessage }));
        setTimeout(() => {
          addMessage('ai', `ありがとうございます！\n\n以下の内容で日報を登録しますね：\n\n━━━━━━━━━━━━━━━━\n${userMessage}\n━━━━━━━━━━━━━━━━\n\nこの内容でよろしいですか？`, true, { type: 'daily_report', content: userMessage });
        }, 500);
      }
    }
    // 経費精算の処理
    else if (lowerMessage.includes('経費') || lowerMessage.includes('精算') || lowerMessage.includes('領収書')) {
      if (!conversationContext.expenseStarted) {
        setConversationContext({ expenseStarted: true });
        setTimeout(() => {
          addMessage('ai', '経費精算ですね！\n\n領収書の写真をアップロードするか、以下の情報を教えてください：\n\n• 金額\n• 使用目的\n• 日付\n\nコピペでも大丈夫です！');
        }, 500);
      } else if (!conversationContext.expenseData) {
        // 簡易的な金額抽出
        const amountMatch = userMessage.match(/(\d{1,3}(,\d{3})*|\d+)円?/);
        const amount = amountMatch ? amountMatch[1].replace(/,/g, '') : null;
        
        setConversationContext(prev => ({ ...prev, expenseData: userMessage }));
        setTimeout(() => {
          addMessage('ai', `承知しました！\n\n以下の内容で経費精算を申請しますね：\n\n━━━━━━━━━━━━━━━━\n${userMessage}\n${amount ? `\n金額: ${amount}円` : ''}\n━━━━━━━━━━━━━━━━\n\nこの内容でよろしいですか？`, true, { type: 'expense', content: userMessage, amount });
        }, 500);
      }
    }
    // データ入力の処理
    else if (lowerMessage.includes('データ') || lowerMessage.includes('入力') || lowerMessage.includes('登録')) {
      if (!conversationContext.dataInputStarted) {
        setConversationContext({ dataInputStarted: true });
        setTimeout(() => {
          addMessage('ai', 'データ入力ですね！\n\nどんなデータを入力したいですか？\n\n例えば：\n• 顧客情報\n• 案件情報\n• 在庫情報\n\nなど、教えてください。');
        }, 500);
      } else if (!conversationContext.dataType) {
        setConversationContext(prev => ({ ...prev, dataType: userMessage }));
        setTimeout(() => {
          addMessage('ai', `${userMessage}のデータですね！\n\nデータをコピペしてください。\n\nExcelからコピーしたものでも、カンマ区切りでも、何でも大丈夫です。`);
        }, 500);
      } else if (!conversationContext.dataContent) {
        setConversationContext(prev => ({ ...prev, dataContent: userMessage }));
        setTimeout(() => {
          addMessage('ai', `ありがとうございます！\n\nデータを確認しました。\n\n━━━━━━━━━━━━━━━━\n${userMessage.substring(0, 200)}${userMessage.length > 200 ? '...' : ''}\n━━━━━━━━━━━━━━━━\n\nこのデータを登録しますか？`, true, { type: 'data_input', dataType: conversationContext.dataType, content: userMessage });
        }, 500);
      }
    }
    // その他の一般的な質問
    else {
      setTimeout(() => {
        addMessage('ai', '承知しました！\n\n以下のことができます：\n\n• 日報の提出\n• 経費精算\n• データ入力\n• 各種申請\n\nどれをお手伝いしましょうか？');
      }, 500);
    }
  };

  const handleFeedback = async (messageId: string, liked: boolean, outputData: any) => {
    if (liked) {
      // 気に入った場合
      addMessage('ai', `✅ ${userName}${userTitle}、ありがとうございます！\n\nただいま登録させていただきますね。\n\n他に何かお手伝いできることはございますでしょうか？`);
      
      // データを実際に登録
      if (onDataSubmit && outputData) {
        try {
          await onDataSubmit(outputData.type, outputData);
          addMessage('ai', `✨ ${userName}${userTitle}、登録が完了いたしました！\n\n私も文章堂の一員として、${userName}${userTitle}の業務を全力でサポートいたします！一緒に頑張りましょう！🙇`);
        } catch (error: any) {
          addMessage('ai', `❌ 大変申し訳ございません。エラーが発生いたしました：${error.message}\n\n恐れ入りますが、もう一度お試しくださいませ。`);
        }
      }
      
      // コンテキストをリセット
      setConversationContext({});
    } else {
      // 気に入らなかった場合
      addMessage('ai', `あらら...${userName}${userTitle}、何か問題がございましたでしょうか？😅\n\nどのようにしたかったのか、教えていただけますと幸いです。\n\n例えば：\n• 内容が違う\n• 形式が違う\n• もっと詳しく書きたい\n\nなど、何でも大丈夫でございます！\n\nお気軽にお申し付けくださいませ。一緒に解決しましょう！`);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage = inputText.trim();
    addMessage('user', userMessage);
    setInputText('');
    setIsProcessing(true);

    await handleAIResponse(userMessage);
    setIsProcessing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gradient-to-r from-pink-600 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2"
        >
          <span className="text-2xl">👩‍💼</span>
          <span className="font-bold">おつぼねさんAI</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[450px] h-[650px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col border-2 border-pink-500 z-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-3xl">
            👩‍💼
          </div>
          <div>
            <h3 className="font-bold text-lg">おつぼねさんAI</h3>
            <p className="text-xs text-pink-100">何でもお任せください</p>
          </div>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          title="最小化（邪魔なら閉じてください）"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-pink-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-sm'
                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
                <p className={`text-xs mt-1 ${message.type === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                  {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            
            {/* フィードバックボタン */}
            {message.hasButtons && message.type === 'ai' && (
              <div className="flex justify-start mt-2 gap-2 ml-2">
                <button
                  onClick={() => handleFeedback(message.id, true, message.outputData)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-semibold"
                >
                  <ThumbsUp className="w-4 h-4" />
                  気に入りました
                </button>
                <button
                  onClick={() => handleFeedback(message.id, false, message.outputData)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold"
                >
                  <ThumbsDown className="w-4 h-4" />
                  気に入りません
                </button>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-pink-200 dark:border-slate-700 rounded-b-2xl">
        {/* クイックアクションボタン */}
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setInputText('日報を提出したい');
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 text-xs rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-colors disabled:opacity-50 font-medium"
          >
            📝 日報
          </button>
          <button
            onClick={() => {
              setInputText('経費精算したい');
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 text-xs rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-colors disabled:opacity-50 font-medium"
          >
            💰 経費精算
          </button>
          <button
            onClick={() => {
              setInputText('データを入力したい');
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 text-xs rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-colors disabled:opacity-50 font-medium"
          >
            📊 データ入力
          </button>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="何でもコピペしてください..."
            disabled={isProcessing}
            rows={3}
            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm resize-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isProcessing}
            className="p-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-xl transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader className="w-6 h-6 animate-spin" />
            ) : (
              <Send className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* ヒント */}
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
          💡 コピペするだけでOK！キーボードを打たなくても大丈夫です
        </div>
      </div>
    </div>
  );
};

export default OtsuboneAI;
