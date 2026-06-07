
import React, { useState, useRef, useEffect } from 'react';
import { SchoolLevel, ChatMessage } from '../types';
import { askGuidelineQuestion } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { useGlobalState } from '../GlobalStateContext';
import { playSuccessSound } from '../lib/soundEffect';

interface Props {
  schoolLevel: SchoolLevel;
}

const GuidelineQA: React.FC<Props> = ({ schoolLevel }) => {
  const { state, setState } = useGlobalState();
  const messages = state.guidelineQA.messages;

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setIsLoading(false);
    window.addEventListener('edunote-generation-reset', handler);
    return () => window.removeEventListener('edunote-generation-reset', handler);
  }, []);

  const setMessages = (newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setState(prev => {
        const nextMsgs = typeof newMessages === 'function' ? newMessages(prev.guidelineQA.messages) : newMessages;
        return {
            ...prev,
            guidelineQA: { messages: nextMsgs }
        };
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
        setMessages([
        {
            role: 'model',
            text: `안녕하세요! 학교생활기록부 기재요령에 대해 궁금한 점이 있으신가요?`,
            timestamp: Date.now(),
        },
        ]);
    }
  }, [schoolLevel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const answer = await askGuidelineQuestion(schoolLevel, userMsg.text);
      const modelMsg: ChatMessage = { role: 'model', text: answer, timestamp: Date.now() };
      setMessages((prev) => [...prev, modelMsg]);
      playSuccessSound();
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        role: 'model',
        text: "죄송합니다. 오류가 발생하여 답변을 가져올 수 없습니다.",
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#221E1B] transition-colors">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-[#EDE8E1] dark:bg-[#2E2822] text-[#1C1917] dark:text-[#C4B8B0] rounded-bl-none border border-[#E7E5E4] dark:border-[#2E2822]'
              }`}
            >
              {msg.role === 'model' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#EDE8E1] dark:bg-[#2E2822] rounded-2xl rounded-bl-none px-4 py-3 flex items-center space-x-2">
              <div className="w-2 h-2 bg-[#A8A29E] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-[#A8A29E] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-[#A8A29E] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B]">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`${schoolLevel} 기재요령에 대해 물어보세요...`}
            className="flex-1 px-4 py-3 bg-[#FAF9F7] dark:bg-[#171210] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[#1C1917] dark:text-[#C4B8B0]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[#E7E5E4] dark:disabled:bg-[#2E2822] text-white font-bold rounded-xl transition-colors shadow-sm disabled:shadow-none flex items-center justify-center min-w-[3rem]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default GuidelineQA;
