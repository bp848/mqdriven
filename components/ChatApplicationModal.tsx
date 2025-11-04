
import React, { useState, useEffect, useRef } from 'react';
import { getApplicationCodes, getUsers, submitApplication, getApprovalRoutes } from '../services/dataService';
import { processApplicationChat } from '../services/geminiService';
import { User, ApplicationCode, ApprovalRoute } from '../types';
import { X, Loader, Send, AlertTriangle } from './Icons';

interface ChatApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialMessage?: string;
    currentUser: User | null;
    isAIOff: boolean;
}

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
}

const ChatApplicationModal: React.FC<ChatApplicationModalProps> = ({ isOpen, onClose, onSuccess, initialMessage, currentUser, isAIOff }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Preload necessary data for the AI
    const [users, setUsers] = useState<User[]>([]);
    const [appCodes, setAppCodes] = useState<ApplicationCode[]>([]);
    const [approvalRoutes, setApprovalRoutes] = useState<ApprovalRoute[]>([]);
    const [isPreloading, setIsPreloading] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    
    useEffect(() => {
        if (!isOpen) {
            setMessages([]);
            setInput('');
            setIsLoading(false);
            setError('');
            return;
        }

        if (isAIOff) {
            setMessages([{ id: 'init', role: 'model', content: 'AI機能は現在無効です。' }]);
            setIsPreloading(false);
            setIsLoading(false);
            return;
        }

        const preloadAndStart = async () => {
            setIsPreloading(true);
            setIsLoading(true);
            setError('');
            try {
                const [fetchedUsers, fetchedAppCodes, fetchedRoutes] = await Promise.all([
                    getUsers(),
                    getApplicationCodes(),
                    getApprovalRoutes()
                ]);
                setUsers(fetchedUsers);
                setAppCodes(fetchedAppCodes);
                setApprovalRoutes(fetchedRoutes);

                if (initialMessage) {
                    const initialUserMessage: Message = { id: `user-init`, role: 'user', content: initialMessage };
                    setMessages([initialUserMessage]);

                    const historyForApi = [{ role: 'user' as const, content: initialMessage }];
                    try {
                        const aiResponseText = await processApplicationChat(historyForApi, fetchedAppCodes, fetchedUsers, fetchedRoutes);
                        const newAiMessage: Message = { id: `model-init`, role: 'model', content: aiResponseText };
                        setMessages(prev => [...prev, newAiMessage]);
                    } catch (aiError) {
                        const aiErrorMessage = aiError instanceof Error ? aiError.message : 'AI応答の取得に失敗しました。';
                        setMessages(prev => [
                            ...prev,
                            {
                                id: `model-init-error`,
                                role: 'model',
                                content: `申し訳ありません。AIの初期応答を取得できませんでした。${aiErrorMessage ? `\n理由: ${aiErrorMessage}` : ''}`
                            }
                        ]);
                        setError(`AIの初期応答の取得に失敗しました: ${aiErrorMessage}`);
                    }
                } else {
                    setMessages([{ id: 'init', role: 'model', content: 'こんにちは。どのようなご用件でしょうか？申請したい内容を自由に入力してください。（例：「経費を申請したい」）' }]);
                }
            } catch (e: any) {
                if (e?.name === 'AbortError') return; // Request was aborted, do nothing
                const fallbackMessage = e instanceof Error ? e.message : 'ユーザーデータの読み込みに失敗しました。';
                setMessages([
                    {
                        id: 'init-error',
                        role: 'model',
                        content: '必要なデータの読み込みに失敗しました。時間をおいてから再度お試しください。'
                    }
                ]);
                setError(`アシスタントの初期化に失敗しました: ${fallbackMessage}`);
            } finally {
                setIsPreloading(false);
                setIsLoading(false);
            }
        };
        
        preloadAndStart();
    }, [isOpen, initialMessage, isAIOff]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || isPreloading || !currentUser || isAIOff) return;

        const newUserMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: input };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);
        setError('');

        const historyForApi: { role: 'user' | 'model'; content: string }[] = [...messages, newUserMessage].map(m => ({
            role: m.role,
            content: m.content
        }));

        try {
            const aiResponseText = await processApplicationChat(historyForApi, appCodes, users, approvalRoutes);
            
            let submissionData;
            try {
                submissionData = JSON.parse(aiResponseText);
            } catch (jsonError) {
                const newAiMessage: Message = { id: `model-${Date.now()}`, role: 'model', content: aiResponseText };
                setMessages(prev => [...prev, newAiMessage]);
                return;
            }

            if (submissionData.applicationCodeId && submissionData.formData && submissionData.approvalRouteId) {
                 await submitApplication(submissionData, currentUser.id);
                 onSuccess();
            } else {
                // If it's valid JSON but not the final submission object, treat it as a conversational turn.
                const newAiMessage: Message = { id: `model-${Date.now()}`, role: 'model', content: aiResponseText };
                setMessages(prev => [...prev, newAiMessage]);
            }

        } catch (err: any) {
            if (err.name === 'AbortError') return; // Request was aborted, do nothing
            const errorMessage = err instanceof Error ? err.message : "不明なエラーが発生しました。";
            setError(`申請処理中にエラーが発生しました: ${errorMessage}`);
            const errorAiMessage: Message = { id: `model-err-${Date.now()}`, role: 'model', content: "申し訳ありません、エラーが発生しました。もう一度やり直してください。" };
            setMessages(prev => [...prev, errorAiMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 font-sans">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI申請アシスタント</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => (
                        <div key={message.id} className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                            {message.role === 'model' && <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>}
                            <div className={`max-w-md p-3 rounded-2xl whitespace-pre-wrap break-words ${message.role === 'user' ? 'bg-blue-500 text-white rounded-br-lg' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-lg'}`}>
                                {message.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-end gap-2">
                             <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>
                             <div className="max-w-md p-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-lg">
                                <Loader className="w-5 h-5 animate-spin"/>
                             </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                    {error && (
                        <div className="mb-2 flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-900/30 p-2 text-sm text-red-700 dark:text-red-200">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isPreloading ? "アシスタントを準備中..." : (isAIOff ? "AI機能は現在無効です。" : "メッセージを入力...")}
                            disabled={isLoading || isPreloading || isAIOff}
                            className="w-full bg-slate-100 dark:bg-slate-700 border border-transparent text-slate-900 dark:text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || isPreloading || !input.trim() || isAIOff}
                            className="bg-blue-600 text-white p-3 rounded-lg shadow-sm hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex-shrink-0"
                        >
                            <Send className="w-6 h-6" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatApplicationModal;