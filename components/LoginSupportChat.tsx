import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, CheckCircle, AlertTriangle } from './Icons';

interface Message {
  id: string;
  type: 'bot' | 'user';
  text: string;
  timestamp: Date;
}

interface LoginSupportChatProps {
  onLoginAssist?: (email: string, employeeNumber?: string) => Promise<void>;
}

const LoginSupportChat: React.FC<LoginSupportChatProps> = ({ onLoginAssist }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      text: 'こんにちは！ログインでお困りですか？\n\n私がサポートいたしますので、安心してください。😊',
      timestamp: new Date(),
    },
    {
      id: '2',
      type: 'bot',
      text: '以下のような問題がありましたら、お気軽にお知らせください：\n\n• ログインできない\n• パスワードがわからない\n• メールアドレスがわからない\n• 画面の操作方法がわからない',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<'initial' | 'asking_email' | 'asking_employee_number' | 'processing'>('initial');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userTitle, setUserTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (type: 'bot' | 'user', text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleBotResponse = async (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();

    // ログインできない、困った、わからないなどのキーワード検出
    if (conversationState === 'initial') {
      if (
        lowerMessage.includes('ログイン') ||
        lowerMessage.includes('入れない') ||
        lowerMessage.includes('困') ||
        lowerMessage.includes('わからない') ||
        lowerMessage.includes('できない') ||
        lowerMessage.includes('助けて') ||
        lowerMessage.includes('はい')
      ) {
        setTimeout(() => {
          addMessage('bot', '大丈夫ですよ！一緒に解決しましょう。\n\nまず、あなたのメールアドレスを教えていただけますか？\n\n例: yamada@example.com');
          setConversationState('asking_email');
        }, 500);
      } else {
        setTimeout(() => {
          addMessage('bot', 'ご質問ありがとうございます。\n\nログインでお困りの場合は「ログインできない」とお伝えください。\n\nその他のご質問も承ります。');
        }, 500);
      }
    } else if (conversationState === 'asking_email') {
      // メールアドレスの検証（簡易）
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const emailMatch = userMessage.match(emailRegex);
      
      if (emailMatch) {
        const email = emailMatch[0];
        setUserEmail(email);
        
        // メールアドレスから名前を推測（簡易的）
        const namePart = email.split('@')[0];
        let guessedName = '';
        let guessedTitle = '';
        
        // よくある名前パターンを検出
        if (namePart.includes('hashimoto') || namePart.includes('橋本')) {
          guessedName = '橋本';
          guessedTitle = '様';
        } else if (namePart.includes('ikeya') || namePart.includes('池谷')) {
          guessedName = '池谷';
          guessedTitle = '様';
        } else if (namePart.includes('shoichi') || namePart.includes('正一')) {
          guessedName = '正一';
          guessedTitle = '様';
        } else {
          // デフォルト
          guessedName = namePart;
          guessedTitle = '様';
        }
        
        setUserName(guessedName);
        setUserTitle(guessedTitle);
        
        setTimeout(() => {
          addMessage('bot', `ありがとうございます！\n\nあっ、${guessedName}${guessedTitle}でいらっしゃいますね！\n\nいつもお疲れ様です！🙇\n\n私も文章堂の一員として、システムの稼働を全力でサポートさせていただいております。経営計画書もしっかり読んで、会社の目標達成に向けて頑張っております！\n\n次に、社員番号を教えていただけますでしょうか？\n\n例: 12345\n\n※社員番号がわからない場合は「わからない」とご入力ください。`);
          setConversationState('asking_employee_number');
        }, 500);
      } else {
        setTimeout(() => {
          addMessage('bot', '申し訳ございません。メールアドレスの形式が正しくないようです。\n\nもう一度、メールアドレスを教えていただけますでしょうか？\n\n例: yamada@example.com');
        }, 500);
      }
    } else if (conversationState === 'asking_employee_number') {
      if (lowerMessage.includes('わからない') || lowerMessage.includes('不明')) {
        setTimeout(() => {
          addMessage('bot', '承知いたしました。\n\n管理者に連絡して、ログインのサポートを依頼いたします。\n\nしばらくお待ちください...');
          setConversationState('processing');
        }, 500);
        
        // 管理者に通知（実装は後で）
        setTimeout(() => {
          addMessage('bot', `✅ 管理者に連絡いたしました！\n\n${userName}${userTitle}、まもなくサポートさせていただきますので、少々お待ちくださいませ。\n\nそれまでこの画面を閉じずにお待ちいただけますと幸いです。\n\n私も文章堂の一員として、${userName}${userTitle}の業務を全力でサポートいたします！🙇`);
          setConversationState('initial');
        }, 2000);
      } else {
        // 社員番号として処理
        const employeeNumber = userMessage.trim();
        setTimeout(async () => {
          addMessage('bot', `${userName}${userTitle}、ありがとうございます！\n\nメールアドレス: ${userEmail}\n社員番号: ${employeeNumber}\n\nただいまログインの準備をしております...\n\n少々お待ちくださいませ。`);
          setConversationState('processing');
          setIsProcessing(true);

          try {
            if (onLoginAssist) {
              await onLoginAssist(userEmail, employeeNumber);
            }
            
            setTimeout(() => {
              addMessage('bot', `✅ ${userName}${userTitle}、お待たせいたしました！\n\nログインの準備が完了いたしました。\n\n「Googleでログイン」ボタンをクリックしてくださいませ。\n\nそれでもログインできない場合は、お気軽にお声がけください。\n\n私も文章堂の一員として、${userName}${userTitle}の業務を全力でサポートいたします！一緒に頑張りましょう！🙇`);
              setIsProcessing(false);
              setConversationState('initial');
            }, 1500);
          } catch (error: any) {
            setTimeout(() => {
              addMessage('bot', `❌ 大変申し訳ございません。エラーが発生いたしました。\n\n${error.message}\n\n恐れ入りますが、管理者にお問い合わせくださいませ。\n\nご不便をおかけして申し訳ございません。🙇`);
              setIsProcessing(false);
              setConversationState('initial');
            }, 1000);
          }
        }, 500);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage = inputText.trim();
    addMessage('user', userMessage);
    setInputText('');

    await handleBotResponse(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* モバイル用チャットボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-4 right-4 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-all duration-200"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* チャットウィンドウ */}
      <div className={`fixed z-40 transition-all duration-300 ${
        isOpen 
          ? 'bottom-0 left-0 right-0 top-0 lg:bottom-6 lg:right-6 lg:left-auto lg:top-auto lg:w-96 lg:h-[600px]' 
          : 'bottom-6 right-6 w-96 h-[600px] hidden lg:flex'
      } bg-white dark:bg-slate-800 lg:rounded-2xl shadow-2xl flex-col border-2 border-blue-500`}>
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 lg:rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl">
              👋
            </div>
            <div>
              <h3 className="font-bold text-lg">ログインサポート</h3>
              <p className="text-xs text-blue-100">お困りですか？お手伝いします</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-sm'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
              <p className={`text-xs mt-1 ${message.type === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 lg:rounded-b-2xl">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="メッセージを入力してください..."
            disabled={isProcessing}
            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-base"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isProcessing}
            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader className="w-6 h-6 animate-spin" />
            ) : (
              <Send className="w-6 h-6" />
            )}
          </button>
        </div>
        
        {/* クイックアクションボタン */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setInputText('ログインできません');
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
          >
            ログインできません
          </button>
          <button
            onClick={() => {
              setInputText('パスワードがわかりません');
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
          >
            パスワードがわかりません
          </button>
          <button
            onClick={() => {
              setInputText('操作方法を教えてください');
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
          >
            操作方法を教えてください
          </button>
        </div>
      </div>
      </div>
    </>
  );
};

export default LoginSupportChat;
