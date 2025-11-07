import React, { useState, useEffect, useRef } from 'react';
import { startBusinessConsultantChat } from '../services/geminiService';
import { Chat } from '@google/genai';
import { Loader, Send, Sparkles, Lightbulb } from './Icons';
import { Job, Customer, JournalEntry, EmployeeUser } from '../types';
import InteractivePromptBuilder from './InteractivePromptBuilder';

interface AIChatPageProps {
    currentUser: EmployeeUser | null;
    jobs: Job[];
    customers: Customer[];
    journalEntries: JournalEntry[];
}

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
    sources?: { uri: string; title: string; }[];
}

const AIChatPage: React.FC<AIChatPageProps> = ({ currentUser, jobs, customers, journalEntries }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        chatRef.current = startBusinessConsultantChat();
        if (mounted.current) {
            setMessages([{
                id: 'init',
                role: 'model',
                content: 'こんにちは。私はあなたの会社の経営相談AIアシスタントです。売上向上のための戦略、コスト削減のアイデア、市場トレンド分析など、経営に関するご質問に何でもお答えします。どのようなことにお悩みですか？'
            }]);
            setIsLoading(false);
        }
    }, []);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !chatRef.current) return;

        const newUserMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: input };
        setMessages(prev => [...prev, newUserMessage]);
        
        const contextSummary = `
--- データコンテキスト ---
- 直近の案件数: ${jobs.length}
- 総顧客数: ${customers.length}
- 最近の売上上位3件: ${jobs.slice(0, 3).map(j => `${j.title} (${j.price}円)`).join(', ')}
--- 質問 ---
${input}
`;
        
        setInput('');
        setIsLoading(true);

        try {
            const stream = await chatRef.current.sendMessageStream({ message: contextSummary });
            const aiMessageId = `model-${Date.now()}`;
            if(mounted.current) {
                setMessages(prev => [...prev, { id: aiMessageId, role: 'model', content: '', sources: [] }]);
            }

            let fullResponse = '';
            const allSources = new Map<string, { uri: string; title: string; }>();

            for await (const chunk of stream) {
                if (!mounted.current) return;
                fullResponse += chunk.text;
                
                const rawChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                const sources = rawChunks.map((c: any) => c.web).filter(Boolean);
                sources.forEach((source: any) => {
                    if (source.uri) {
                        allSources.set(source.uri, source);
                    }
                });

                setMessages(prev => prev.map(m => 
                    m.id === aiMessageId ? { ...m, content: fullResponse, sources: Array.from(allSources.values()) } : m
                ));
            }
        } catch (err) {
            const errorMessage = "申し訳ありません、エラーが発生しました。もう一度お試しください。";
             if (mounted.current) {
                setMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'model', content: errorMessage }]);
            }
        } finally {
            if (mounted.current) {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-purple-500" />
                    AI経営相談チャット
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div key={message.id} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                        {message.role === 'model' && <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>}
                        <div className={`max-w-xl p-3 rounded-2xl whitespace-pre-wrap ${message.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none'}`}>
                           <div className="prose prose-sm dark:prose-invert max-w-none">{message.content}</div>
                           {message.sources && message.sources.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
                                    <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">情報源</h4>
                                    <ul className="list-disc pl-5 space-y-1 mt-1">
                                        {message.sources.map((source, index) => (
                                            <li key={index}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm truncate block" title={source.title || source.uri}>
                                                    {source.title || source.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex items-start gap-3">
                         <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>
                         <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-700 rounded-bl-none">
                            <Loader className="w-5 h-5 animate-spin text-slate-500"/>
                         </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                {/* プロンプトビルダーボタン */}
                <div className="mb-3 flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 flex-1">
                        <strong>質問の仕方がわからない？</strong> AIアシスタントが質問を手伝います
                    </p>
                    <button
                        onClick={() => setShowPromptBuilder(true)}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        質問を手伝ってもらう
                    </button>
                </div>

                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isLoading ? "AIが応答中です..." : "経営に関する質問を入力... (例: 今月の収益トップ3の案件について分析して)"}
                        disabled={isLoading}
                        className="w-full bg-slate-100 dark:bg-slate-700 border border-transparent text-slate-900 dark:text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="bg-purple-600 text-white p-3 rounded-lg shadow-sm hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex-shrink-0"
                    >
                        <Send className="w-6 h-6" />
                    </button>
                </form>
            </div>

            {/* プロンプトビルダーモーダル */}
            {showPromptBuilder && (
                <InteractivePromptBuilder
                    onPromptGenerated={(prompt) => {
                        setInput(prompt);
                        setShowPromptBuilder(false);
                    }}
                    onClose={() => setShowPromptBuilder(false)}
                />
            )}
        </div>
    );
};

export default AIChatPage;