import React, { useState, useRef } from 'react';
import { CustomTool, CustomToolInput, FileData } from '../types';
import { generateToolPrompt, runCustomTool } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { GeneratedDisplay } from './GeneratedDisplay';
import { Plus, Trash2, Sparkles, ChevronLeft, ChevronRight, Save, X, Zap } from 'lucide-react';

interface MyToolEditorProps {
  initial?: CustomTool;
  onSave: (tool: Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const CATEGORIES = [
  { value: 'admin', label: '교무 행정' },
  { value: 'lesson', label: '수업 자료' },
  { value: 'student', label: '학생 기록' },
  { value: 'other', label: '기타' },
] as const;

type Category = 'admin' | 'lesson' | 'student' | 'other';

const MyToolEditor: React.FC<MyToolEditorProps> = ({ initial, onSave, onCancel }) => {
  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'other');

  // Step 2
  const [inputs, setInputs] = useState<CustomToolInput[]>(
    initial?.inputs ?? [],
  );

  // Step 3
  const [promptTemplate, setPromptTemplate] = useState(initial?.promptTemplate ?? '');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [templateFiles, setTemplateFiles] = useState<FileData[]>([]);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // 테스트 실행(B)
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const [testFiles, setTestFiles] = useState<Record<string, FileData[]>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testError, setTestError] = useState('');

  const addInput = () => {
    const id = `field_${inputs.length}`;
    setInputs(prev => [...prev, { id, label: '', type: 'text', placeholder: '' }]);
  };

  const removeInput = (idx: number) => {
    setInputs(prev => prev.filter((_, i) => i !== idx));
  };

  const updateInput = (idx: number, patch: Partial<CustomToolInput>) => {
    setInputs(prev => prev.map((inp, i) => (i === idx ? { ...inp, ...patch } : inp)));
  };

  const insertVariableAtCursor = (id: string) => {
    const ta = promptRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? promptTemplate.length;
    const end = ta.selectionEnd ?? start;
    const snippet = `{{${id}}}`;
    const next = promptTemplate.slice(0, start) + snippet + promptTemplate.slice(end);
    setPromptTemplate(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  const handleAiHelp = async () => {
    if (!description.trim() && inputs.length === 0 && !promptTemplate.trim() && templateFiles.length === 0) return;
    setIsGeneratingPrompt(true);
    try {
      const draft = await generateToolPrompt(description, inputs, promptTemplate, templateFiles[0] ?? null);
      setPromptTemplate(draft);
    } catch (e: any) {
      alert('프롬프트 생성에 실패했습니다: ' + (e?.message ?? ''));
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleTestRun = async () => {
    setIsTesting(true);
    setTestError('');
    setTestResult('');
    try {
      const tempTool: CustomTool = {
        id: 'preview',
        name: name.trim() || '미리보기',
        description,
        category,
        toolType: 'prompt',
        inputs,
        promptTemplate,
        createdAt: '',
        updatedAt: '',
      };
      const output = await runCustomTool(tempTool, testValues, testFiles);
      setTestResult(output);
    } catch (e: any) {
      setTestError(e?.message || '실행 중 오류가 발생했습니다.');
    } finally {
      setIsTesting(false);
    }
  };

  const previewPrompt = () => {
    let preview = promptTemplate;
    for (const inp of inputs) {
      preview = preview.replaceAll(`{{${inp.id}}}`, inp.placeholder ? `[${inp.placeholder}]` : `[${inp.label}]`);
    }
    return preview;
  };

  const canGoNext = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return inputs.every(inp => inp.label.trim().length > 0);
    return true;
  };

  const handleSave = () => {
    onSave({ name: name.trim(), description: description.trim(), category, inputs, promptTemplate });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#171210]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EDE8E1] dark:border-[#2E2822]">
        <button onClick={onCancel} className="text-[#A8A29E] hover:text-[#78716C] dark:hover:text-[#C4B8B0] transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6] flex-1">
          {initial ? '도구 수정' : '새 도구 만들기'}
        </h2>
        {/* 단계 표시 */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                n === step
                  ? 'bg-amber-500 text-white'
                  : n < step
                  ? 'bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
                  : 'bg-[#EDE8E1] dark:bg-[#2E2822] text-[#A8A29E] dark:text-[#6B5E57]'
              }`}
            >
              {n}
            </div>
          ))}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* ── Step 1: 기본 정보 ── */}
        {step === 1 && (
          <div className="space-y-5 max-w-xl">
            <div>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3">1단계 · 기본 정보</p>
              <label className="block text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-1.5">
                도구 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="예: 가정통신문 작성기"
                autoFocus
                className="w-full px-3 py-2.5 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-1.5">도구 설명</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="이 도구가 무엇을 해주는지 간략히 설명하세요"
                rows={3}
                className="w-full px-3 py-2.5 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-1.5">카테고리</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      category === cat.value
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] hover:border-amber-300 hover:text-amber-600'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: 입력 필드 구성 ── */}
        {step === 2 && (
          <div className="space-y-4 max-w-xl">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">2단계 · 입력 필드 구성</p>
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">사용자가 도구를 실행할 때 입력할 항목을 정의하세요. 필드가 없어도 괜찮습니다.</p>

            {inputs.map((inp, idx) => (
              <div key={inp.id} className="border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#78716C] dark:text-[#9C8F87]">필드 {idx + 1}</span>
                  <button onClick={() => removeInput(idx)} className="text-[#A8A29E] hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#78716C] dark:text-[#C4B8B0] mb-1">필드명 (화면에 표시) *</label>
                  <input
                    type="text"
                    value={inp.label}
                    onChange={e => updateInput(idx, { label: e.target.value })}
                    placeholder="예: 학생 이름"
                    className="w-full px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#78716C] dark:text-[#C4B8B0] mb-1">예시 힌트</label>
                  <input
                    type="text"
                    value={inp.placeholder ?? ''}
                    onChange={e => updateInput(idx, { placeholder: e.target.value })}
                    placeholder="예: 예: 홍길동"
                    className="w-full px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#78716C] dark:text-[#C4B8B0] mb-1">입력 형태</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'text', label: '한 줄 텍스트' },
                      { value: 'textarea', label: '여러 줄 텍스트' },
                      { value: 'file-upload', label: '파일 첨부' },
                    ].map(t => (
                      <button
                        key={t.value}
                        onClick={() => updateInput(idx, { type: t.value as CustomToolInput['type'] })}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          inp.type === t.value
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:border-amber-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addInput}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              입력 필드 추가
            </button>
          </div>
        )}

        {/* ── Step 3: 프롬프트 작성 ── */}
        {step === 3 && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">3단계 · 프롬프트 작성</p>

            {inputs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#78716C] dark:text-[#C4B8B0] mb-2">삽입 가능한 항목 (클릭하면 커서 위치에 삽입)</p>
                <div className="flex flex-wrap gap-2">
                  {inputs.map(inp => (
                    <button
                      key={inp.id}
                      onClick={() => insertVariableAtCursor(inp.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors"
                    >
                      {inp.label || `필드_${inp.id}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 참고 양식 파일 */}
            <div className="border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl p-4 space-y-2">
              <div>
                <p className="text-xs font-semibold text-[#44403C] dark:text-[#C4B8B0]">참고 양식 파일 <span className="font-normal text-[#A8A29E]">(선택)</span></p>
                <p className="text-xs text-[#A8A29E] dark:text-[#6B5E57] mt-0.5">원하는 출력 형식의 예시 파일을 첨부하면 AI가 해당 양식 형식에 맞는 프롬프트를 작성해줍니다.</p>
              </div>
              {templateFiles.length === 0 ? (
                <FileUpload label="양식 파일 첨부" files={templateFiles} onFilesChange={setTemplateFiles} multiple={false} globalPaste={true} />
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                  <span className="text-xs font-medium text-green-700 dark:text-green-300 flex-1 truncate">{templateFiles[0].file.name}</span>
                  <button onClick={() => setTemplateFiles([])} className="text-green-500 hover:text-red-500 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0]">AI 프롬프트</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAiHelp}
                    disabled={isGeneratingPrompt}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800/60 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingPrompt
                      ? promptTemplate.trim() ? '수정 중...' : '작성 중...'
                      : promptTemplate.trim() ? 'AI로 다듬기' : templateFiles.length > 0 ? 'AI 도움받기 (양식 반영)' : 'AI 도움받기'}
                  </button>
                </div>
              </div>
              <textarea
                ref={promptRef}
                value={promptTemplate}
                onChange={e => setPromptTemplate(e.target.value)}
                placeholder="AI에게 어떤 결과를 만들어달라고 할지 작성하세요. 위 '삽입 가능한 항목'을 클릭하거나 직접 {{변수명}}을 입력할 수 있습니다."
                rows={10}
                className="w-full px-3 py-2.5 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-mono"
              />
            </div>

            {inputs.some(i => i.type === 'file-upload') && (
              <div className="px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                파일 첨부 필드가 있습니다. 프롬프트에서 "첨부된 파일을 분석해줘"처럼 지시하면 AI에게 자동 전달됩니다.
              </div>
            )}

            {promptTemplate && (
              <div>
                <p className="text-xs font-semibold text-[#78716C] dark:text-[#9C8F87] mb-1.5">미리보기 (예시값으로 치환)</p>
                <div className="px-3 py-2.5 bg-[#FAF9F7] dark:bg-[#221E1B] border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg text-xs text-[#78716C] dark:text-[#9C8F87] whitespace-pre-wrap leading-relaxed font-mono">
                  {previewPrompt()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: 테스트 실행 ── */}
        {step === 4 && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">4단계 · 테스트 실행</p>
            <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">저장하기 전에 샘플 값을 넣고 직접 실행해 결과를 확인해 보세요. 교사 이름 등 전역 변수는 실제 실행 시 자동으로 채워집니다.</p>

            {inputs.length === 0 ? (
              <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">입력 필드가 없습니다. 바로 테스트 실행을 눌러 결과를 확인하세요.</p>
            ) : (
              <div className="space-y-4">
                {inputs.map(input => (
                  <div key={input.id}>
                    {input.type !== 'file-upload' && (
                      <label className="block text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-1.5">{input.label}</label>
                    )}
                    {input.type === 'file-upload' ? (
                      <FileUpload
                        label={input.label}
                        files={testFiles[input.id] ?? []}
                        onFilesChange={files => setTestFiles(prev => ({ ...prev, [input.id]: files }))}
                        multiple={true}
                      />
                    ) : input.type === 'textarea' ? (
                      <textarea
                        value={testValues[input.id] ?? ''}
                        onChange={e => setTestValues(prev => ({ ...prev, [input.id]: e.target.value }))}
                        placeholder={input.placeholder}
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={testValues[input.id] ?? ''}
                        onChange={e => setTestValues(prev => ({ ...prev, [input.id]: e.target.value }))}
                        placeholder={input.placeholder}
                        className="w-full px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleTestRun}
              disabled={isTesting || !promptTemplate.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-[#EDE8E1] dark:disabled:bg-[#2E2822] disabled:text-[#A8A29E] text-white font-bold rounded-lg text-sm transition-colors"
            >
              <Zap className={`w-4 h-4 ${isTesting ? 'animate-pulse' : ''}`} />
              {isTesting ? 'AI 생성 중...' : '테스트 실행'}
            </button>

            {!promptTemplate.trim() && (
              <p className="text-xs text-amber-600 dark:text-amber-400">3단계에서 프롬프트를 먼저 작성해야 테스트할 수 있습니다.</p>
            )}

            {testError && (
              <p className="text-xs text-red-600 dark:text-red-400">{testError}</p>
            )}

            {testResult && (
              <div className="h-[420px]">
                <GeneratedDisplay content={testResult} title={name.trim() || '미리보기'} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-[#EDE8E1] dark:border-[#2E2822]">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : onCancel()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#78716C] dark:text-[#C4B8B0] border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg hover:bg-[#FAF9F7] dark:hover:bg-[#221E1B] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 1 ? '취소' : '이전'}
        </button>
        {step < 4 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canGoNext()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 disabled:bg-[#EDE8E1] dark:disabled:bg-[#2E2822] disabled:text-[#A8A29E] text-white rounded-lg transition-colors"
          >
            다음
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 disabled:bg-[#EDE8E1] dark:disabled:bg-[#2E2822] disabled:text-[#A8A29E] text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            저장
          </button>
        )}
      </div>
    </div>
  );
};

export default MyToolEditor;
