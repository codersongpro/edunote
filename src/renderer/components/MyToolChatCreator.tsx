import React, { useState, useRef, useEffect } from 'react';
import { CustomTool } from '../types';
import { generateToolFromChat } from '../services/geminiService';
import { Send, Bot, ChevronRight } from 'lucide-react';

interface Message {
  role: 'ai' | 'user';
  text: string;
}

const INTRO_QUESTIONS: Message[] = [
  { role: 'ai', text: '안녕하세요! 대화를 통해 나만의 AI 도구를 만들어드릴게요.\n\n어떤 작업을 자동화하고 싶으세요? 예를 들어 "학생 일기를 보고 피드백 써주는 도구 만들고 싶어요"처럼 자유롭게 말씀해 주세요.' },
];

interface MyToolChatCreatorProps {
  onComplete: (draft: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const MyToolChatCreator: React.FC<MyToolChatCreatorProps> = ({ onComplete, onCancel }) => {
  const [messages, setMessages] = useState<Message[]>(INTRO_QUESTIONS);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getNextQuestion = (count: number, userMsg: string): string => {
    if (count === 1) {
      return `이해했어요! 그 도구를 실행할 때 어떤 정보를 입력해야 할까요?\n예: "학생 이름, 학년, 일기 파일이 필요해요" 처럼 입력 항목을 알려주세요.`;
    }
    if (count === 2) {
      return `좋아요! AI가 만들어줄 결과물은 어떤 형식이었으면 좋겠나요?\n예: "칭찬, 개선점, 격려의 말 형식으로요" 또는 "표 형태로 정리해줘요" 처럼 알려주세요.`;
    }
    return '';
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    const nextCount = turnCount + 1;
    setTurnCount(nextCount);

    if (nextCount < 3) {
      setIsLoading(true);
      setTimeout(() => {
        const next = getNextQuestion(nextCount, userMsg);
        if (next) setMessages(prev => [...prev, { role: 'ai', text: next }]);
        setIsLoading(false);
        inputRef.current?.focus();
      }, 400);
    } else {
      setMessages(prev => [...prev, { role: 'ai', text: '감사합니다! 지금 바로 도구를 만들어드릴게요... 잠깐만요.' }]);
      setIsGenerating(true);
      try {
        const draft = await generateToolFromChat(newMessages);
        if (draft) {
          setMessages(prev => [
            ...prev,
            { role: 'ai', text: `도구가 준비됐어요!\n\n이름: **${draft.name}**\n${draft.description}\n\n아래 "도구 확인하기" 버튼을 눌러 세부 내용을 확인하고 저장하세요.` },
          ]);
          setTimeout(() => onComplete(draft), 300);
        } else {
          setMessages(prev => [...prev, { role: 'ai', text: '죄송해요, 도구 생성에 실패했습니다. 다시 시도해 주세요.' }]);
        }
      } catch {
        setMessages(prev => [...prev, { role: 'ai', text: 'AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }]);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          취소
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">대화로 도구 만들기</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI가 3가지 질문으로 도구를 자동 생성합니다</p>
        </div>
        {/* 진행 표시 */}
        <div className="flex items-center gap-1">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`w-2 h-2 rounded-full transition-colors ${
                turnCount >= n ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 채팅 메시지 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'ai'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                  : 'bg-amber-500 text-white rounded-tr-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {(isLoading || isGenerating) && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="px-3.5 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1 items-center h-5">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력 */}
      {turnCount < 3 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isGenerating}
              placeholder="답변을 입력하세요... (Enter로 전송)"
              rows={2}
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isGenerating}
              className="p-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {turnCount >= 3 && !isGenerating && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
};

export default MyToolChatCreator;
