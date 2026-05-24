import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AppMode } from '../types';
import { askEducationQuestion } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { GraduationCap, Trash2 } from 'lucide-react';
import { useGenerationTracker } from '../hooks/useGenerationTracker';

const EducationAssistantQA: React.FC = () => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.EDUCATION_QA);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([{
      role: 'model',
      text: '안녕하세요! 교육 전반에 관한 질문을 자유롭게 해주세요.\n\n교육 정책, 교육과정, 교수법, 평가 방법, 학교 행정 등 다양한 교육 관련 주제에 대해 도움을 드리겠습니다.',
      timestamp: Date.now(),
    }]);
  }, []);

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
      const answer = await askEducationQuestion(userMsg.text, history);
      setMessages(prev => [...prev, { role: 'model', text: answer, timestamp: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'model',
        text: '오류가 발생했습니다. API 키 설정을 확인해 주세요.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      endGeneration();
    }
  };

  const handleClear = () => {
    setMessages([{
      role: 'model',
      text: '교육 관련 궁금한 점을 질문해 주세요.',
      timestamp: Date.now(),
    }]);
  };

  const suggestedQuestions = [
    '2022 개정 교육과정의 핵심 변화는?',
    '과정중심 평가란 무엇인가요?',
    '고교학점제 운영 방식을 설명해 주세요',
    '학교폭력 예방 교육 의무 시간이 어떻게 되나요?',
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-green-100 p-1.5 rounded-lg">
            <GraduationCap className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">교육 도우미 AI</h2>
            <p className="text-xs text-slate-500">교육 관련 궁금한 점을 자유롭게 질문하세요</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          초기화
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length <= 1 && (
          <div className="pt-2">
            <p className="text-xs text-slate-400 text-center mb-3">자주 묻는 질문</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="text-xs bg-green-50 text-green-700 border border-green-100 rounded-full px-3 py-1.5 hover:bg-green-100 transition-colors"
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
                ? 'bg-green-600 text-white rounded-br-none'
                : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
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
            <div className="bg-slate-100 rounded-2xl rounded-bl-none px-4 py-3 flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-100 bg-white shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="교육 관련 질문을 자유롭게 입력하세요..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-slate-800 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-5 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors shadow-sm"
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

export default EducationAssistantQA;
