import React, { useState, useRef, useEffect } from 'react';
import { SchoolLevel, ChatMessage, AppMode } from '../types';
import { askRecordChatbot } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { useGlobalState } from '../GlobalStateContext';
import { Bot, HelpCircle, Trash2 } from 'lucide-react';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { playSuccessSound } from '../lib/soundEffect';
import { useTour } from '../TourContext';

interface Props {
  schoolLevel: SchoolLevel;
}

const RecordChatbot: React.FC<Props> = ({ schoolLevel }) => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.RECORD_CHATBOT);
  const { startTour } = useTour();
  const { state, setState } = useGlobalState();
  const messages = state.recordChatbot.messages;

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
      const nextMsgs = typeof newMessages === 'function' ? newMessages(prev.recordChatbot.messages) : newMessages;
      return { ...prev, recordChatbot: { messages: nextMsgs } };
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const greetingText = (level: typeof schoolLevel) =>
    `안녕하세요. 학교생활기록부 기재요령을 바탕으로 ${level} 선생님께 필요한 내용을 정리해 드리겠습니다. 기재 예시 요청, 특정 항목 작성법, 기재 금지 사항 확인 등 무엇이든 편하게 물어보세요.`;

  useEffect(() => {
    setMessages(prev => {
      const greeting = { role: 'model' as const, text: greetingText(schoolLevel), timestamp: Date.now() };
      if (prev.length === 0) return [greeting];
      if (prev[0].role === 'model') return [greeting, ...prev.slice(1)];
      return prev;
    });
  }, [schoolLevel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    const history = messages.map(m => ({ role: m.role, text: m.text }));
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    startGeneration();

    try {
      const answer = await askRecordChatbot(schoolLevel, history, userMsg.text);
      setMessages(prev => [...prev, { role: 'model', text: answer, timestamp: Date.now() }]);
      playSuccessSound();
    } catch {
      setMessages(prev => [...prev, {
        role: 'model',
        text: '죄송합니다. 오류가 발생했습니다. API 키 설정을 확인해 주세요.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      endGeneration();
    }
  };

  const handleClear = () => {
    setMessages([{ role: 'model', text: greetingText(schoolLevel), timestamp: Date.now() }]);
  };

  const suggestedQuestions = [
    '행동특성 및 종합의견에 학생 이름을 쓸 수 있나요?',
    '교과세특에 기재 금지 사항이 뭔가요?',
    '창체 특기사항 글자수 제한이 어떻게 되나요?',
    '스포츠클럽 기재 방법을 알려주세요',
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#221E1B]">
      {/* Header */}
      <div data-tour="record-chatbot-header" className="h-14 flex items-center justify-between px-4 border-b border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 p-1.5 rounded-lg">
            <Bot className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">AI 챗봇 도우미</h2>
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">2026 기재요령 기반 · {schoolLevel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => startTour('record-chatbot')}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            튜토리얼
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-xs text-[#A8A29E] dark:text-[#6B5E57] hover:text-[#78716C] dark:hover:text-[#C4B8B0] px-2 py-1 rounded hover:bg-[#FAF9F7] dark:hover:bg-[#2E2822] transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            초기화
          </button>
        </div>
      </div>

      {/* Messages */}
      <div data-tour="record-chatbot-messages" className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length <= 1 && (
          <div data-tour="record-chatbot-suggestions" className="pt-2">
            <p className="text-xs text-[#A8A29E] dark:text-[#6B5E57] text-center mb-3">자주 묻는 질문</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(q);
                  }}
                  className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 rounded-full px-3 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-none'
                : 'bg-[#EDE8E1] dark:bg-[#2E2822] text-[#1C1917] dark:text-[#F0EBE6] rounded-bl-none border border-[#E7E5E4] dark:border-[#2E2822]'
            }`}>
              {msg.role === 'model' ? (
                <div className="prose prose-sm max-w-none">
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
            <div className="bg-[#EDE8E1] dark:bg-[#2E2822] rounded-2xl rounded-bl-none px-4 py-3 flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-[#A8A29E] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-[#A8A29E] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-[#A8A29E] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div data-tour="record-chatbot-input" className="p-4 border-t border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="기재요령 관련 질문을 자유롭게 입력하세요..."
            className="flex-1 px-4 py-3 bg-[#FAF9F7] dark:bg-[#2E2822] border border-[#EDE8E1] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[#1C1917] dark:text-[#F0EBE6] text-sm dark:placeholder-[#6B5E57]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[#E7E5E4] dark:disabled:bg-[#2E2822] text-white font-bold rounded-xl transition-colors shadow-sm disabled:shadow-none"
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

export default RecordChatbot;
