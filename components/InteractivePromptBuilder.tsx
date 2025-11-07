import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, CheckCircle, Lightbulb, AlertTriangle } from './Icons';

interface Message {
  id: string;
  type: 'ai' | 'user';
  text: string;
  timestamp: Date;
}

interface PromptBuilderProps {
  onPromptGenerated: (prompt: string) => void;
  onClose: () => void;
}

interface CollectedInfo {
  purpose?: string;        // 何を作りたいか
  target?: string;         // 誰向けか
  details?: string[];      // 具体的な内容
  format?: string;         // 出力形式
  deadline?: string;       // 期限
  additionalInfo?: string; // その他
}

const InteractivePromptBuilder: React.FC<PromptBuilderProps> = ({ onPromptGenerated, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      text: 'こんにちは！😊\n\nAIで資料を作るお手伝いをします。\n\n難しいことは考えなくて大丈夫です。私が質問しますので、思いついたことを教えてください。',
      timestamp: new Date(),
    },
    {
      id: '2',
      type: 'ai',
      text: 'まず、何を作りたいですか？\n\n例えば：\n• 提案書\n• 報告書\n• プレゼン資料\n• メール文\n• 企画書\n\nなど、簡単に教えてください。',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationStep, setConversationStep] = useState<'purpose' | 'target' | 'details' | 'format' | 'confirm' | 'done'>('purpose');
  const [collectedInfo, setCollectedInfo] = useState<CollectedInfo>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (type: 'ai' | 'user', text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const generateFinalPrompt = (info: CollectedInfo): string => {
    let prompt = '';

    // 目的
    if (info.purpose) {
      prompt += `【作成する資料】\n${info.purpose}\n\n`;
    }

    // 対象者
    if (info.target) {
      prompt += `【対象者・提出先】\n${info.target}\n\n`;
    }

    // 具体的な内容
    if (info.details && info.details.length > 0) {
      prompt += `【含めるべき内容】\n`;
      info.details.forEach((detail, index) => {
        prompt += `${index + 1}. ${detail}\n`;
      });
      prompt += '\n';
    }

    // 出力形式
    if (info.format) {
      prompt += `【出力形式】\n${info.format}\n\n`;
    }

    // 期限
    if (info.deadline) {
      prompt += `【期限】\n${info.deadline}\n\n`;
    }

    // その他
    if (info.additionalInfo) {
      prompt += `【その他の要望】\n${info.additionalInfo}\n\n`;
    }

    prompt += `上記の情報をもとに、わかりやすく、説得力のある資料を作成してください。`;

    return prompt;
  };

  const handleAIResponse = async (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();

    if (conversationStep === 'purpose') {
      // 目的を収集
      setCollectedInfo(prev => ({ ...prev, purpose: userMessage }));
      
      setTimeout(() => {
        addMessage('ai', `なるほど、「${userMessage}」を作るんですね！\n\n次に、これは誰に向けて作りますか？\n\n例えば：\n• 社長向け\n• お客様向け\n• 取引先向け\n• 社内の〇〇部門向け\n\nなど、教えてください。`);
        setConversationStep('target');
      }, 500);
    } else if (conversationStep === 'target') {
      // 対象者を収集
      setCollectedInfo(prev => ({ ...prev, target: userMessage }));
      
      setTimeout(() => {
        addMessage('ai', `わかりました！「${userMessage}」向けですね。\n\n次に、どんな内容を入れたいですか？\n\n例えば：\n• 商品の説明\n• 価格や見積もり\n• 実績や事例\n• スケジュール\n\n思いつくことを教えてください。\n複数ある場合は、一つずつ教えてください。\n\n全部言い終わったら「以上です」と言ってください。`);
        setConversationStep('details');
        setCollectedInfo(prev => ({ ...prev, details: [] }));
      }, 500);
    } else if (conversationStep === 'details') {
      // 詳細を収集
      if (lowerMessage.includes('以上') || lowerMessage.includes('終わり') || lowerMessage.includes('それだけ')) {
        setTimeout(() => {
          addMessage('ai', `ありがとうございます！\n\n最後に、どんな形式で出力しますか？\n\n例えば：\n• 箇条書き\n• 文章形式\n• 表形式\n• プレゼン用のスライド形式\n\n特に希望がなければ「おまかせ」と言ってください。`);
          setConversationStep('format');
        }, 500);
      } else {
        setCollectedInfo(prev => ({
          ...prev,
          details: [...(prev.details || []), userMessage]
        }));
        
        setTimeout(() => {
          addMessage('ai', `了解しました！「${userMessage}」を入れますね。\n\n他にもありますか？\nあれば教えてください。\n全部言い終わったら「以上です」と言ってください。`);
        }, 500);
      }
    } else if (conversationStep === 'format') {
      // 出力形式を収集
      setCollectedInfo(prev => ({ ...prev, format: userMessage }));
      
      setTimeout(() => {
        const info = { ...collectedInfo, format: userMessage };
        const finalPrompt = generateFinalPrompt(info);
        
        addMessage('ai', `完璧です！✨\n\n以下の内容で資料を作成します：\n\n━━━━━━━━━━━━━━━━\n\n【作成する資料】\n${info.purpose}\n\n【対象者】\n${info.target}\n\n【含める内容】\n${info.details?.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\n【出力形式】\n${info.format}\n\n━━━━━━━━━━━━━━━━\n\nこの内容でよろしいですか？\n\n「はい」と言っていただければ、AIに指示を出します！`);
        setConversationStep('confirm');
      }, 500);
    } else if (conversationStep === 'confirm') {
      if (lowerMessage.includes('はい') || lowerMessage.includes('ok') || lowerMessage.includes('お願い')) {
        const finalPrompt = generateFinalPrompt(collectedInfo);
        
        setTimeout(() => {
          addMessage('ai', `✅ 完了しました！\n\nAIに以下の指示を送ります：\n\n━━━━━━━━━━━━━━━━\n${finalPrompt}\n━━━━━━━━━━━━━━━━\n\nこれで資料が作成されます！`);
          setConversationStep('done');
          
          // プロンプトを親コンポーネントに渡す
          setTimeout(() => {
            onPromptGenerated(finalPrompt);
          }, 1000);
        }, 500);
      } else {
        setTimeout(() => {
          addMessage('ai', `わかりました。もう一度最初からやり直しますね。\n\n何を作りたいですか？`);
          setConversationStep('purpose');
          setCollectedInfo({});
        }, 500);
      }
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

  const getQuickButtons = () => {
    if (conversationStep === 'purpose') {
      return [
        { label: '提案書', value: '提案書' },
        { label: '報告書', value: '報告書' },
        { label: 'プレゼン資料', value: 'プレゼン資料' },
        { label: 'メール文', value: 'メール文' },
      ];
    } else if (conversationStep === 'target') {
      return [
        { label: '社長向け', value: '社長向け' },
        { label: 'お客様向け', value: 'お客様向け' },
        { label: '取引先向け', value: '取引先向け' },
        { label: '社内向け', value: '社内向け' },
      ];
    } else if (conversationStep === 'details') {
      return [
        { label: '以上です', value: '以上です' },
      ];
    } else if (conversationStep === 'format') {
      return [
        { label: '箇条書き', value: '箇条書き' },
        { label: '文章形式', value: '文章形式' },
        { label: 'おまかせ', value: 'おまかせ' },
      ];
    } else if (conversationStep === 'confirm') {
      return [
        { label: 'はい、お願いします', value: 'はい、お願いします' },
        { label: 'やり直す', value: 'やり直す' },
      ];
    }
    return [];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-3xl h-[700px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl">
              💡
            </div>
            <div>
              <h3 className="font-bold text-lg">AIアシスタント</h3>
              <p className="text-xs text-green-100">質問に答えるだけで、適切な指示を作成します</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            ✕
          </button>
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
                    ? 'bg-green-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-sm border border-slate-200 dark:border-slate-700'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
                <p className={`text-xs mt-1 ${message.type === 'user' ? 'text-green-100' : 'text-slate-400'}`}>
                  {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 入力エリア */}
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl">
          {/* クイックアクションボタン */}
          {getQuickButtons().length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {getQuickButtons().map((button, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setInputText(button.value);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50 font-medium"
                >
                  {button.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="ここに入力してください..."
              disabled={isProcessing || conversationStep === 'done'}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-base"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isProcessing || conversationStep === 'done'}
              className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <Loader className="w-6 h-6 animate-spin" />
              ) : (
                <Send className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* ヒント */}
          <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-200">
              💡 <strong>ヒント：</strong> 難しく考えなくて大丈夫です。思いついたことを簡単に教えてください。AIが質問しながら、必要な情報を引き出します。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractivePromptBuilder;
