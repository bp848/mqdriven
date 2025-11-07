import React, { useState, useEffect, useRef } from 'react';
import { startBugReportChat } from '../services/geminiService';
import { Chat } from '@google/genai';
import { X, Loader, Send, Sparkles } from './Icons';
import { BugReport } from '../types';

interface BugReportChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onReportSubmit: (report: Omit<BugReport, 'id' | 'created_at' | 'status' | 'reporter_name'>) => Promise<void>;
    isAIOff: boolean;
}

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
}

const BugReportChatModal: React.FC<BugReportChatModalProps> = ({ isOpen, onClose, onReportSubmit, isAIOff }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        if (isOpen) {
            if (isAIOff) {
                setMessages([{ 
                    id: 'init', 
                    role: 'model', 
                    content: 'AI機能は現在無効です。' 
                }]);
                return;
            }
            chatRef.current = startBugReportChat();
            setMessages([{ 
                id: 'init', 
                role: 'model', 
                content: 'こんにちは！バグ報告・改善要望アシスタントです。\n発生している問題や改善したい点について、できるだけ詳しく教えてください。' 
            }]);
            setError('');
        }
    }, [isOpen, isAIOff]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !chatRef.current || isAIOff) return;

        const newUserMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: input };
        setMessages(prev => [...prev, newUserMessage]);
        const userText = input;
        setInput('');
        setIsLoading(true);
        setError('');

        try {
            const stream = await chatRef.current.sendMessageStream({ message: userText });
            const aiMessageId = `model-${Date.now()}`;
            let isFirstChunk = true;
            
            setMessages(prev => [...prev, { id: aiMessageId, role: 'model', content: '' }]);

            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk.text;
                // Check if the response is likely a JSON object
                if (isFirstChunk && fullResponse.trim().startsWith('{')) {
                    // Don't stream JSON, wait for the full response
                } else {
                     setMessages(prev => prev.map(m => 
                        m.id === aiMessageId ? { ...m, content: fullResponse } : m
                    ));
                }
                isFirstChunk = false;
            }
            
            // After streaming, try to parse as JSON
            try {
                const parsed = JSON.parse(fullResponse);
                if(parsed.report_type && parsed.summary && parsed.description) {
                    await onReportSubmit(parsed);
                    const successMessage = `「${parsed.summary}」という内容で報告を受け付けました。ご協力ありがとうございます！このウィンドウは3秒後に閉じます。`;
                    setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: successMessage } : m));
                    setTimeout(() => onClose(), 3000);
                    return; // Stop further processing
                }
            } catch (e) {
                // Not a JSON object, or not the one we want. The streamed text is already displayed.
            }

        } catch (err) {
            const errorMessage = "申し訳ありません、エラーが発生しました。もう一度お試しください。";
            setError(errorMessage);
            setMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'model', content: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[150] p-4 font-sans">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-500" />
                        AI 改善要望アシスタント
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => (
                        <div key={message.id} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                            {message.role === 'model' && <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>}
                            <div className={`max-w-md p-3 rounded-2xl whitespace-pre-wrap break-words ${message.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none'}`}>
                                {message.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
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
                    {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isLoading ? "AIが応答中です..." : (isAIOff ? "AI機能は無効です" : "問題点や改善案を入力してください...")}
                            disabled={isLoading || isAIOff}
                            className="w-full bg-slate-100 dark:bg-slate-700 border border-transparent text-slate-900 dark:text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim() || isAIOff}
                            className="bg-purple-600 text-white p-3 rounded-lg shadow-sm hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex-shrink-0"
                            aria-label="Send message"
                        >
                            <Send className="w-6 h-6" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BugReportChatModal;
