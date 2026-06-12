import React, { useState, useRef, useEffect } from 'react';
import { CustomTool, FileData } from '../types';
import { generateToolFromChat, generateHtmlApp } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { Send, Bot, Paperclip, SkipForward, Wand2, Monitor, Sparkles } from 'lucide-react';

interface Message {
  role: 'ai' | 'user';
  text: string;
}

// 대화로 만들 결과물 유형 — AI 스킬, HTML 앱, 또는 둘 다
type ResultType = 'skill' | 'app' | 'both';

// 대화 완료 시 전달되는 초안 묶음.
// app은 목록에 바로 저장되고, skill은 확인 화면(위저드)을 거쳐 저장된다.
export interface ChatToolDrafts {
  skill?: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>;
  app?: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>;
}

const Q0 = `안녕하세요! 대화를 통해 나만의 도구를 만들어드릴게요.

먼저, 어떤 형태의 도구를 만들까요? 아래 버튼에서 선택해 주세요.

• AI 스킬 — 입력값을 받아 AI가 글·표 등의 결과를 생성하는 도구
  (예: 가정통신문 자동 작성, 상담 내용 요약)
• HTML 앱 — 클릭해서 바로 실행하는 인터랙티브 웹 앱
  (예: 타이머, 자리 뽑기, 학습 게임)
• 스킬 + 앱 — 같은 주제로 AI 스킬과 HTML 앱을 한 번에`;

const q1For = (type: ResultType): string => {
  if (type === 'app') {
    return `좋아요, HTML 앱을 만들게요!

어떤 앱이 필요하세요?

예를 들어:
• "모둠 자리를 무작위로 뽑아주는 룰렛"
• "수업 시간에 쓸 큰 화면 타이머"
• "구구단 연습 게임"
• "발표 순서 뽑기"

자유롭게 말씀해 주세요!`;
  }
  if (type === 'both') {
    return `좋아요, AI 스킬과 HTML 앱을 한 번에 만들게요!

어떤 작업이나 활동을 도와주는 도구인가요?

예를 들어:
• "학생 칭찬 문구를 만들어 주고, 화면에 크게 띄워주는 도구"
• "퀴즈 문제를 만들어 주고, 게임처럼 풀 수 있는 도구"

자유롭게 말씀해 주세요!`;
  }
  return `좋아요, AI 스킬을 만들게요!

어떤 작업을 자동화하고 싶으세요?

예를 들어:
• "학생 일기를 보고 맞춤 피드백을 써주는 도구"
• "가정통신문을 자동으로 작성해주는 도구"
• "이수증 파일에서 연수 정보를 뽑아 표로 정리해주는 도구"
• "학부모 상담 내용을 요약해주는 도구"

자유롭게 말씀해 주세요!`;
};

// 유형 선택 이후의 질문 — count는 사용자가 답한 횟수 (1이면 다음이 두 번째 질문)
const questionFor = (type: ResultType, count: number): string => {
  if (count === 1) {
    if (type === 'app') {
      return `이해했어요!\n\n앱에 어떤 기능과 화면이 필요할까요?\n\n예를 들어:\n• "시작/정지 버튼과 큰 숫자 표시가 필요해요"\n• "학생 이름을 붙여넣으면 무작위로 한 명씩 뽑아줘요"\n• "점수판과 정답 효과음이 있으면 좋겠어요"`;
    }
    return `이해했어요!\n\n그 도구를 실행할 때 어떤 정보를 입력해야 할까요?\n\n예를 들어:\n• "학생 이름, 학년, 과제 파일이 필요해요"\n• "행사 이름, 날짜, 대상 학년만 있으면 돼요"\n• "학생 목록 파일을 첨부할 거예요"\n• "아무 입력 없이 그냥 실행만 해도 돼요"`;
  }
  if (count === 2) {
    if (type === 'app') {
      return `거의 다 됐어요!\n\n디자인이나 동작에서 원하는 점이 있나요?\n\n예를 들어:\n• "밝고 알록달록한 분위기로 해줘요"\n• "저학년용이라 글씨를 아주 크게 해줘요"\n• "차분한 색으로 깔끔하게요"\n\n특별히 없으면 "알아서 해줘"라고 입력해 주세요.`;
    }
    if (type === 'both') {
      return `좋아요!\n\n결과물 형식이나 앱 화면에 대해 원하는 점이 있나요?\n\n예를 들어:\n• "결과는 표로 정리하고, 앱은 큰 글씨로 보여줘요"\n• "공문서처럼 격식 있게 쓰고, 앱은 알록달록하게요"\n\n특별히 없으면 "알아서 해줘"라고 입력해 주세요.`;
    }
    return `좋아요!\n\n결과물은 어떤 형식으로 받고 싶으세요?\n\n예를 들어:\n• "칭찬, 개선점, 격려의 말 세 항목으로 정리해줘요"\n• "표 형태로 깔끔하게 정리해줘요"\n• "공문서처럼 격식 있게 써줘요"\n• "친근하고 따뜻한 문체로 써줘요"\n• "항목별로 번호를 붙여서 정리해줘요"`;
  }
  if (count === 3 && type !== 'app') {
    return `거의 다 됐어요!\n\n참고할 양식 파일이 있으신가요?\n원하는 출력 형식의 예시 파일(예: 기존에 쓰던 가정통신문, 피드백 양식, 표 양식 등)을 첨부하면 AI가 그 형식을 따라 작성해줍니다.\n\n없으시면 "건너뛰기"를 클릭해 주세요.`;
  }
  return '';
};

const VALID_CATEGORIES: CustomTool['category'][] = ['admin', 'lesson', 'student', 'other'];

interface MyToolChatCreatorProps {
  onComplete: (drafts: ChatToolDrafts) => void;
  onCancel: () => void;
}

const MyToolChatCreator: React.FC<MyToolChatCreatorProps> = ({ onComplete, onCancel }) => {
  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', text: Q0 }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultType, setResultType] = useState<ResultType | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [templateFiles, setTemplateFiles] = useState<FileData[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 답변 턴 수 — 앱은 양식 첨부 단계가 없어 한 턴 짧다
  const totalTurns = resultType === 'app' ? 3 : 4;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectType = (type: ResultType) => {
    if (isGenerating) return;
    setResultType(type);
    const label =
      type === 'skill' ? 'AI 스킬로 만들어 주세요.'
      : type === 'app' ? 'HTML 앱으로 만들어 주세요.'
      : 'AI 스킬과 HTML 앱을 둘 다 만들어 주세요.';
    setMessages(prev => [...prev, { role: 'user', text: label }, { role: 'ai', text: q1For(type) }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // AI 응답(JSON)을 화면에서 쓸 수 있는 스킬 초안으로 정리한다
  const toSkillDraft = (
    spec: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>,
  ): Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: spec.name,
    description: spec.description || '',
    category: VALID_CATEGORIES.includes(spec.category) ? spec.category : 'other',
    toolType: 'prompt',
    inputs: Array.isArray(spec.inputs)
      ? spec.inputs.map((inp, i) => ({
          id: inp?.id || `field_${i}`,
          label: inp?.label || `입력 ${i + 1}`,
          type: inp?.type === 'textarea' || inp?.type === 'file-upload' ? inp.type : 'text',
          placeholder: inp?.placeholder || '',
          required: inp?.required === true,
        }))
      : [],
    promptTemplate: spec.promptTemplate || '',
  });

  const handleGenerate = async (msgs: Message[], file: FileData | null) => {
    if (!resultType) return;
    const wantSkill = resultType !== 'app';
    const wantApp = resultType !== 'skill';

    setMessages(prev => [...prev, { role: 'ai', text: '감사합니다! 대화 내용을 바탕으로 도구를 설계하는 중이에요... 잠깐만요.' }]);
    setIsGenerating(true);
    try {
      const spec = await generateToolFromChat(msgs, file, wantApp);
      if (!spec || !spec.name) {
        setMessages(prev => [...prev, { role: 'ai', text: '죄송해요, 도구 생성에 실패했습니다. 다시 시도해 주세요.' }]);
        return;
      }

      const drafts: ChatToolDrafts = {};
      if (wantSkill) drafts.skill = toSkillDraft(spec);

      if (wantApp) {
        setMessages(prev => [...prev, { role: 'ai', text: '앱 화면을 만드는 중이에요... 1~2분 정도 걸릴 수 있어요.' }]);
        try {
          const appRequest = spec.appSpec || `${spec.name}: ${spec.description}`;
          const html = await generateHtmlApp(appRequest);
          drafts.app = {
            name: wantSkill ? `${spec.name} (앱)` : spec.name,
            description: spec.description || '',
            category: VALID_CATEGORIES.includes(spec.category) ? spec.category : 'other',
            toolType: 'html-app',
            htmlContent: html,
            inputs: [],
            promptTemplate: '',
          };
        } catch {
          // 앱 생성만 실패한 경우 — 스킬이라도 전달하고, 앱은 따로 다시 만들도록 안내
          if (!wantSkill) {
            setMessages(prev => [...prev, { role: 'ai', text: '죄송해요, 앱 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }]);
            return;
          }
          setMessages(prev => [...prev, { role: 'ai', text: '앱 생성에는 실패했어요. AI 스킬만 먼저 저장하고, 앱은 "HTML 앱 만들기"에서 다시 시도해 주세요.' }]);
        }
      }

      const doneText =
        drafts.skill && drafts.app
          ? `스킬과 앱이 모두 준비됐어요!\n\n이름: **${spec.name}**\n${spec.description}\n\n앱("${drafts.app.name}")은 내 스킬 목록에 바로 추가돼요. 이어서 AI 스킬의 세부 내용을 확인하고 저장하세요.`
          : drafts.app
            ? `앱이 준비됐어요!\n\n이름: **${drafts.app.name}**\n${drafts.app.description}\n\n내 스킬 목록에 추가돼요. 카드의 "열기" 버튼으로 바로 실행해 보세요.`
            : `도구가 준비됐어요!\n\n이름: **${spec.name}**\n${spec.description}\n\n아래 "도구 확인하기" 버튼을 눌러 세부 내용을 확인하고 저장하세요.`;
      setMessages(prev => [...prev, { role: 'ai', text: doneText }]);
      setTimeout(() => onComplete(drafts), 300);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || isGenerating || !resultType) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    const nextCount = turnCount + 1;
    setTurnCount(nextCount);

    // 앱 단독은 양식 첨부 단계 없이 세 번째 답변 후 바로 생성
    if (resultType === 'app' && nextCount >= 3) {
      await handleGenerate(newMessages, null);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const next = questionFor(resultType, nextCount);
      if (next) setMessages(prev => [...prev, { role: 'ai', text: next }]);
      setIsLoading(false);
      inputRef.current?.focus();
    }, 400);
  };

  const handleFileStepDone = async (skipFile: boolean) => {
    const file = skipFile ? null : (templateFiles[0] ?? null);
    setTurnCount(totalTurns);
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

  const isFileUploadTurn = resultType !== null && resultType !== 'app' && turnCount === totalTurns - 1 && !isLoading;
  const isDone = resultType !== null && turnCount >= totalTurns;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#171210]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E7E5E4] dark:border-[#2E2822]">
        <button onClick={onCancel} className="text-sm text-[#A8A29E] hover:text-[#78716C] dark:hover:text-[#C4B8B0] transition-colors">
          취소
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6]">대화로 도구 만들기</h2>
          <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">AI가 몇 가지 질문으로 AI 스킬·HTML 앱을 자동 생성합니다 (둘 다 한 번에도 가능)</p>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalTurns }).map((_, i) => (
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

      {/* 결과물 유형 선택 (첫 단계) */}
      {!resultType && !isGenerating && (
        <div className="p-4 border-t border-[#E7E5E4] dark:border-[#2E2822] grid gap-2">
          <button
            onClick={() => handleSelectType('skill')}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left"
          >
            <Wand2 className="w-5 h-5 text-amber-500 shrink-0" />
            <span>
              <span className="block text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">AI 스킬</span>
              <span className="block text-xs text-[#78716C] dark:text-[#9C8F87]">입력값을 받아 AI가 글·표 등의 결과를 생성</span>
            </span>
          </button>
          <button
            onClick={() => handleSelectType('app')}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-violet-200 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors text-left"
          >
            <Monitor className="w-5 h-5 text-violet-500 shrink-0" />
            <span>
              <span className="block text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">HTML 앱</span>
              <span className="block text-xs text-[#78716C] dark:text-[#9C8F87]">클릭해서 바로 실행하는 인터랙티브 웹 앱 (타이머·뽑기·게임 등)</span>
            </span>
          </button>
          <button
            onClick={() => handleSelectType('both')}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-left"
          >
            <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>
              <span className="block text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">스킬 + 앱 동시에</span>
              <span className="block text-xs text-[#78716C] dark:text-[#9C8F87]">같은 주제로 AI 스킬과 HTML 앱을 한 번에 생성</span>
            </span>
          </button>
        </div>
      )}

      {/* 파일 업로드 턴 (스킬·둘 다의 마지막 질문) */}
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

      {/* 일반 텍스트 입력 */}
      {resultType && !isFileUploadTurn && !isDone && !isGenerating && (
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
