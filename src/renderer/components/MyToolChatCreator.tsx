import React, { useState, useRef, useEffect } from 'react';
import { CustomTool, FileData } from '../types';
import { generateToolFromChat } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { Send, Bot, Paperclip, SkipForward } from 'lucide-react';

interface Message {
  role: 'ai' | 'user';
  text: string;
}

const Q1 = `안녕하세요! 대화를 통해 나만의 AI 스킬을 만들어드릴게요.

어떤 작업을 자동화하고 싶으세요?

예를 들어:
• "학생 일기를 보고 맞춤 피드백을 써주는 도구"
• "가정통신문을 자동으로 작성해주는 도구"
• "이수증 파일에서 연수 정보를 뽑아 표로 정리해주는 도구"
• "학부모 상담 내용을 요약해주는 도구"

자유롭게 말씀해 주세요!`;

interface MyToolChatCreatorProps {
  onComplete: (draft: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const TOTAL_TURNS = 4;

const MyToolChatCreator: React.FC<MyToolChatCreatorProps> = ({ onComplete, onCancel }) => {
  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', text: Q1 }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [templateFiles, setTemplateFiles] = useState<FileData[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getNextQuestion = (count: number): string => {
    switch (count) {
      case 1:
        return `이해했어요!\n\n그 도구를 실행할 때 어떤 정보를 입력해야 할까요?\n\n예를 들어:\n• "학생 이름, 학년, 과제 파일이 필요해요"\n• "행사 이름, 날짜, 대상 학년만 있으면 돼요"\n• "학생 목록 파일을 첨부할 거예요"\n• "아무 입력 없이 그냥 실행만 해도 돼요"`;
      case 2:
        return `좋아요!\n\n결과물은 어떤 형식으로 받고 싶으세요?\n\n예를 들어:\n• "칭찬, 개선점, 격려의 말 세 항목으로 정리해줘요"\n• "표 형태로 깔끔하게 정리해줘요"\n• "공문서처럼 격식 있게 써줘요"\n• "친근하고 따뜻한 문체로 써줘요"\n• "항목별로 번호를 붙여서 정리해줘요"`;
      case 3:
        return `거의 다 됐어요!\n\n참고할 양식 파일이 있으신가요?\n원하는 출력 형식의 예시 파일(예: 기존에 쓰던 가정통신문, 피드백 양식, 표 양식 등)을 첨부하면 AI가 그 형식을 따라 작성해줍니다.\n\n없으시면 "건너뛰기"를 클릭해 주세요.`;
      default:
        return '';
    }
  };

  const handleGenerate = async (msgs: Message[], file: FileData | null) => {
    setMessages(prev => [...prev, { role: 'ai', text: '감사합니다! 지금 바로 도구를 만들어드릴게요... 잠깐만요.' }]);
    setIsGenerating(true);
    try {
      const draft = await generateToolFromChat(msgs, file);
      if (draft) {
        setMessages(prev => [
          ...prev,
          {
            role: 'ai',
            text: `도구가 준비됐어요!\n\n이름: **${draft.name}**\n${draft.description}\n\n아래 "도구 확인하기" 버튼을 눌러 세부 내용을 확인하고 저장하세요.`,
          },
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
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || isGenerating) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    const nextCount = turnCount + 1;
    setTurnCount(nextCount);

    if (nextCount < TOTAL_TURNS - 1) {
      setIsLoading(true);
      setTimeout(() => {
        const next = getNextQuestion(nextCount);
        if (next) setMessages(prev => [...prev, { role: 'ai', text: next }]);
        setIsLoading(false);
        inputRef.current?.focus();
      }, 400);
    } else if (nextCount === TOTAL_TURNS - 1) {
      // Turn 3: show file upload question
      setIsLoading(true);
      setTimeout(() => {
        const next = getNextQuestion(nextCount);
        if (next) setMessages(prev => [...prev, { role: 'ai', text: next }]);
        setIsLoading(false);
      }, 400);
    }
  };

  const handleFileStepDone = async (skipFile: boolean) => {
    const file = skipFile ? null : (templateFiles[0] ?? null);
    const nextCount = TOTAL_TURNS;
    setTurnCount(nextCount);
    const userMsgText = skipFile
      ? '참고 양식 없이 진행할게요.'
      : `양식 파일 첨부: ${templateFiles[0]?.file.name ?? '파일'}`;
    const finalMessages: Message[] = [...messages, { role: 'user', text: userMsgText }];
    setMessages(finalMessages);
    await handleGenerate(finalMessages, file);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isFileUploadTurn = turnCount === TOTAL_TURNS - 1 && !isLoading;
  const isDone = turnCount >= TOTAL_TURNS;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#171210]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E7E5E4] dark:border-[#2E2822]">
        <button onClick={onCancel} className="text-sm text-[#A8A29E] hover:text-[#78716C] dark:hover:text-[#C4B8B0] transition-colors">
          취소
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6]">대화로 도구 만들기</h2>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">AI가 4가지 질문으로 도구를 자동 생성합니다</p>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: TOTAL_TURNS }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                turnCount > i ? 'bg-amber-500' : turnCount === i ? 'bg-amber-300' : 'bg-[#EDE8E1] dark:bg-[#2E2822]'
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
                  ? 'bg-[#EDE8E1] dark:bg-[#221E1B] text-[#1C1917] dark:text-[#C4B8B0] rounded-tl-sm'
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
            <div className="px-3.5 py-2.5 bg-[#EDE8E1] dark:bg-[#221E1B] rounded-2xl rounded-tl-sm">
              <div className="flex gap-1 items-center h-5">
                <div className="w-1.5 h-1.5 bg-[#A8A29E] rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 bg-[#A8A29E] rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 bg-[#A8A29E] rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 파일 업로드 턴 (Q4) */}
      {isFileUploadTurn && !isGenerating && (
        <div className="p-4 border-t border-[#E7E5E4] dark:border-[#2E2822] space-y-3">
          {templateFiles.length === 0 ? (
            <FileUpload
              label="양식 파일 첨부 (PDF, 이미지, HWP 등)"
              files={templateFiles}
              onFilesChange={setTemplateFiles}
              multiple={false}
              globalPaste={true}
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl">
              <Paperclip className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300 flex-1 truncate">{templateFiles[0].file.name}</span>
              <button
                onClick={() => handleFileStepDone(false)}
                className="px-3 py-1 text-xs font-bold bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                이 파일로 진행
              </button>
            </div>
          )}
          <button
            onClick={() => handleFileStepDone(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl text-sm font-semibold text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#221E1B] transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            건너뛰기 (참고 양식 없이 진행)
          </button>
        </div>
      )}

      {/* 일반 텍스트 입력 (Q1~Q3) */}
      {!isFileUploadTurn && !isDone && !isGenerating && (
        <div className="p-4 border-t border-[#E7E5E4] dark:border-[#2E2822]">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="답변을 입력하세요... (Enter로 전송)"
              rows={2}
              className="flex-1 px-3 py-2.5 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-[#EDE8E1] dark:disabled:bg-[#2E2822] text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isDone && !isGenerating && (
        <div className="p-4 border-t border-[#E7E5E4] dark:border-[#2E2822]">
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl text-sm font-semibold text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#221E1B] transition-colors"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
};

export default MyToolChatCreator;
