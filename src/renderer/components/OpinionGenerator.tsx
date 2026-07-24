import React, { useState, useRef } from 'react';
import { notifyToast } from '../lib/toast';
import { HelpCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTour } from '../TourContext';
import { SchoolLevel, LengthOption, LengthUnit, StudentOpinionData, AppMode } from '../types';
import { POSITIVE_TAGS, NEGATIVE_TAGS } from '../constants';
import { generateOpinion, parseStudentObservationFromFiles } from '../services/geminiService';
import { useGlobalState } from '../GlobalStateContext';
import { queueViolationWarning } from '../lib/guidelineCompliance';
import { playSuccessSound } from '../lib/soundEffect';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { saveHistory, getHistory, HistoryEntry } from '../lib/generationHistory';
import { getStudentGenerationExtras } from '../lib/generationSafety';
import { getByteLength } from '../lib/textLength';

interface Props {
  schoolLevel: SchoolLevel;
}

interface DuplicateResult {
  sentence: string;
  students: string[];
}

const OpinionGenerator: React.FC<Props> = ({ schoolLevel }) => {
  const { startTour } = useTour();
  const { state, setState, isGlobalGenerating, setIsGlobalGenerating, setGlobalProgress, showToast } = useGlobalState();
  const { startGeneration, updateProgress, endGeneration, isCancelRequested, callWithAbort } = useGenerationTracker(AppMode.GENERATOR);
  const opState = state.opinion;

  // Local UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateResults, setDuplicateResults] = useState<DuplicateResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [studentPanelCollapsed, setStudentPanelCollapsed] = useState(false);
  const [isAnalyzingObservation, setIsAnalyzingObservation] = useState(false);
  const observationFileInputRef = useRef<HTMLInputElement>(null);

  // Helper to update opinion state
  const updateOpState = (updates: Partial<typeof state.opinion>) => {
    setState(prev => ({
      ...prev,
      opinion: { ...prev.opinion, ...updates }
    }));
  };

  // --- Helper: Completeness Dots ---
  const getCompletenessScore = (student: StudentOpinionData): number => {
    let score = 0;
    score += student.positiveTags.length;
    score += student.negativeTags.length;
    score += Math.min(2, Math.floor((student.additionalContext?.length || 0) / 20));
    return score;
  };

  const renderCompletenessDots = (student: StudentOpinionData) => {
    const score = getCompletenessScore(student);
    const maxDots = 5;
    const dotsToShow = Math.min(score, maxDots);
    
    if (dotsToShow === 0) return null;

    return (
      <div className="flex space-x-0.5">
        {Array.from({ length: dotsToShow }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        ))}
      </div>
    );
  };

  // --- Setup Handlers ---
  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      updateOpState({ studentCount: val });
    }
  };

  const handleNameInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateOpState({ nameInput: e.target.value });
  };

  const goToConfig = () => {
    const names = opState.nameInput
      .split(/,|\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let newStudents: StudentOpinionData[] = [];
    const count = names.length > 0 ? names.length : opState.studentCount;

    if (names.length > 0) {
      newStudents = names.map((name, i) => ({
        id: String(i + 1),
        name: name,
        positiveTags: [],
        negativeTags: [],
        additionalContext: '',
        selected: false
      }));
    } else {
      newStudents = Array.from({ length: count }, (_, i) => ({
        id: String(i + 1),
        name: `학생 ${i + 1}`,
        positiveTags: [],
        negativeTags: [],
        additionalContext: '',
        selected: false
      }));
    }

    // Generate common student list for synchronization
    const commonList = names.length > 0 
        ? names.map((name, i) => ({ id: String(Date.now() + i), name }))
        : Array.from({ length: count }, (_, i) => ({ id: String(Date.now() + i), name: `학생 ${i + 1}` }));

    // Update global state with synchronization to other modules
    setState(prev => ({
        ...prev,
        opinion: {
            ...prev.opinion,
            studentCount: count,
            students: newStudents,
            step: 'CONFIG',
            currentStudentIndex: 0
        },
        // Sync names to other modules so they are preserved when switching tabs
        subject: {
            ...prev.subject,
            nameInput: opState.nameInput,
            studentCount: count,
            commonStudents: commonList
        },
        sports: {
            ...prev.sports,
            nameInput: opState.nameInput,
            studentCount: count
        },
        creative: {
            ...prev.creative,
            nameInput: opState.nameInput,
            studentCount: count
        }
    }));
  };

  // --- Selection Handlers ---
  const toggleSelection = (index: number) => {
    if (isGlobalGenerating) return;
    const newStudents = opState.students.map((s, i) =>
      i === index ? { ...s, selected: !s.selected } : s
    );
    updateOpState({ students: newStudents });
  };

  const toggleAllSelection = (checked: boolean) => {
    if (isGlobalGenerating) return;
    const newStudents = opState.students.map(s => ({ ...s, selected: checked }));
    updateOpState({ students: newStudents });
  };

  // --- Config Handlers ---
  const currentStudent = opState.students[opState.currentStudentIndex];

  const toggleTag = (tag: string, type: 'positive' | 'negative') => {
    if (isGlobalGenerating) return;
    const idx = opState.currentStudentIndex;
    const newStudents = opState.students.map((s, i) => {
      if (i !== idx) return s;
      if (type === 'positive') {
        const positiveTags = s.positiveTags.includes(tag)
          ? s.positiveTags.filter(t => t !== tag)
          : [...s.positiveTags, tag];
        return { ...s, positiveTags };
      }
      const negativeTags = s.negativeTags.includes(tag)
        ? s.negativeTags.filter(t => t !== tag)
        : [...s.negativeTags, tag];
      return { ...s, negativeTags };
    });
    updateOpState({ students: newStudents });
  };

  const handleContextChange = (text: string) => {
    const idx = opState.currentStudentIndex;
    const newStudents = opState.students.map((s, i) =>
      i === idx ? { ...s, additionalContext: text } : s
    );
    updateOpState({ students: newStudents });
  };

  const handleObservationFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const invalid = files.find(f => !f.type.startsWith('image/') && f.type !== 'application/pdf');
    if (invalid) {
      notifyToast({ type: 'warning', title: '이미지 파일 또는 PDF 파일만 업로드 가능합니다.' });
      if (observationFileInputRef.current) observationFileInputRef.current.value = '';
      return;
    }

    setIsAnalyzingObservation(true);
    try {
      const filesToAnalyze = await Promise.all(files.map(file => new Promise<{ data: string; mimeType: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ data: (reader.result as string).split(',')[1], mimeType: file.type });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })));

      const extractedText = await parseStudentObservationFromFiles(filesToAnalyze, '행동특성 및 종합의견 - 추가 관찰 내용');
      if (!extractedText.trim()) {
        notifyToast({ type: 'warning', title: '파일에서 관찰 내용을 분석하지 못했습니다.' });
        return;
      }

      const current = opState.students[opState.currentStudentIndex]?.additionalContext || '';
      handleContextChange(current ? `${current}\n\n${extractedText.trim()}` : extractedText.trim());
      notifyToast({ type: 'success', title: '학생 기록물 분석이 완료되었습니다. 내용을 확인해주세요.' });
    } catch (err: any) {
      console.error('Observation File Analysis Error:', err);
      notifyToast({ type: 'error', title: '파일 분석 중 오류가 발생했습니다.' });
    } finally {
      setIsAnalyzingObservation(false);
      if (observationFileInputRef.current) observationFileInputRef.current.value = '';
    }
  };

  // --- Generation Handlers ---
  const handleGenerateAll = async () => {
    setIsGlobalGenerating(true);
    setIsGenerating(true);
    startGeneration(0);
    setGlobalProgress(0);
    const newStudents = [...opState.students];
    const total = newStudents.length;

    try {
        for (let i = 0; i < newStudents.length; i++) {
            if (isCancelRequested()) break;
            const student = newStudents[i];
            try {
              const extras = await getStudentGenerationExtras(student.name);
              const { text: result, model } = await callWithAbort(() => generateOpinion({
                  schoolLevel,
                  studentName: student.name,
                  positiveTags: student.positiveTags,
                  negativeTags: student.negativeTags,
                  additionalContext: student.additionalContext,
                  lengthOption: opState.lengthOption as LengthOption,
                  customLength: opState.customLength as number,
                  lengthUnit: opState.lengthUnit as LengthUnit,
                  ...extras
              }));
              newStudents[i].generatedContent = result;
              newStudents[i].generatedModel = model;
              queueViolationWarning(showToast, newStudents[i].name, result);
              saveHistory('opinion', student.name, result);
              setGlobalProgress(Math.round((i + 1) / total * 100));
              updateProgress(Math.round((i + 1) / total * 100));
            } catch (err) {
              if (err instanceof Error && err.message === 'CANCELLED') break;
              throw err;
            }
        }

        if (!isCancelRequested()) playSuccessSound();
        updateOpState({ students: newStudents, step: 'RESULT' });
    } catch (err: any) {
        if (!(err instanceof Error && err.message === 'CANCELLED')) {
          console.error(err instanceof Error ? err.message : String(err));
          notifyToast({ type: 'error', title: "생성 중 오류가 발생했습니다." });
        }
        updateOpState({ students: newStudents, step: 'RESULT' });
    } finally {
        setIsGlobalGenerating(false);
        setIsGenerating(false);
        setGlobalProgress(0);
        endGeneration();
    }
  };

  const handleGenerateSelected = async () => {
    const selectedIndices = opState.students
        .map((s, i) => s.selected ? i : -1)
        .filter(i => i !== -1);

    if (selectedIndices.length === 0) {
        notifyToast({ type: 'warning', title: "선택된 학생이 없습니다." });
        return;
    }

    setIsGlobalGenerating(true);
    setIsGenerating(true);
    startGeneration(0);
    setGlobalProgress(0);
    const newStudents = [...opState.students];
    const total = selectedIndices.length;

    try {
        for (let i = 0; i < selectedIndices.length; i++) {
            if (isCancelRequested()) break;
            const index = selectedIndices[i];
            const student = newStudents[index];
            try {
              const extras = await getStudentGenerationExtras(student.name);
              const { text: result, model } = await callWithAbort(() => generateOpinion({
                  schoolLevel,
                  studentName: student.name,
                  positiveTags: student.positiveTags,
                  negativeTags: student.negativeTags,
                  additionalContext: student.additionalContext,
                  lengthOption: opState.lengthOption as LengthOption,
                  customLength: opState.customLength as number,
                  lengthUnit: opState.lengthUnit as LengthUnit,
                  ...extras
              }));
              newStudents[index].generatedContent = result;
              newStudents[index].generatedModel = model;
              queueViolationWarning(showToast, newStudents[index].name, result);
              saveHistory('opinion', student.name, result);
              setGlobalProgress(Math.round((i + 1) / total * 100));
              updateProgress(Math.round((i + 1) / total * 100));
            } catch (err) {
              if (err instanceof Error && err.message === 'CANCELLED') break;
              throw err;
            }
        }

        if (!isCancelRequested()) playSuccessSound();
        updateOpState({ students: newStudents, step: 'RESULT' });
    } catch (err: any) {
        if (!(err instanceof Error && err.message === 'CANCELLED')) {
          console.error(err instanceof Error ? err.message : String(err));
          notifyToast({ type: 'error', title: "생성 중 오류가 발생했습니다." });
        }
        updateOpState({ students: newStudents, step: 'RESULT' });
    } finally {
        setIsGlobalGenerating(false);
        setIsGenerating(false);
        setGlobalProgress(0);
        endGeneration();
    }
  };

  const handleRegenerateOne = async (index: number) => {
    const student = opState.students[index];
    setGeneratingIds((prev: Set<string>) => new Set(prev).add(student.id));
    
    // Extract current sentences to avoid generating the exact same content again
    const avoidPhrases = student.generatedContent 
        ? student.generatedContent.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length > 10)
        : [];

    try {
      const extras = await getStudentGenerationExtras(student.name);
      const { text: result, model } = await generateOpinion({
          schoolLevel,
          studentName: student.name,
          positiveTags: student.positiveTags,
          negativeTags: student.negativeTags,
          additionalContext: student.additionalContext,
          lengthOption: opState.lengthOption as LengthOption,
          customLength: opState.customLength as number,
          lengthUnit: opState.lengthUnit as LengthUnit,
          avoidPhrases,
          ...extras
      });

      const newStudents = [...opState.students];
      newStudents[index].generatedContent = result;
      newStudents[index].generatedModel = model;
      queueViolationWarning(showToast, newStudents[index].name, result);
      saveHistory('opinion', student.name, result);
      updateOpState({ students: newStudents });
      playSuccessSound();
    } catch (err: any) {
      const error = err;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(errorMessage);
      notifyToast({ type: 'error', title: "재생성 중 오류가 발생했습니다." });
    } finally {
      setGeneratingIds((prev: Set<string>) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    }
  };

  const handleResultChange = (index: number, text: string) => {
    const newStudents = [...opState.students];
    newStudents[index].generatedContent = text;
    updateOpState({ students: newStudents });
  };

  const handleCopy = async (text: string, id: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Failed to copy text: ', errorMessage);
    }
  };

  // 생성된 모든 학생 결과를 "이름: 내용" 형식으로 한 번에 클립보드에 복사
  const handleCopyAll = async () => {
    const text = opState.students
      .filter(s => s.generatedContent)
      .map(s => `[${s.name}]\n${s.generatedContent}`)
      .join('\n\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId('__ALL__');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy all: ', err instanceof Error ? err.message : String(err));
    }
  };

  // --- Duplicate Check ---
  const checkDuplicates = () => {
    const sentenceMap = new Map<string, string[]>();
    
    opState.students.forEach(student => {
      if (!student.generatedContent) return;
      const sentences = student.generatedContent.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length > 10);
      const uniqueSentences = new Set(sentences);
      
      uniqueSentences.forEach(sentence => {
        if (!sentenceMap.has(sentence)) {
          sentenceMap.set(sentence, []);
        }
        sentenceMap.get(sentence)!.push(student.name);
      });
    });

    const duplicates: DuplicateResult[] = [];
    sentenceMap.forEach((names, sentence) => {
      if (names.length > 1) {
        duplicates.push({ sentence, students: names });
      }
    });

    setDuplicateResults(duplicates);
    setShowDuplicateModal(true);
  };

  const downloadCSV = async () => {
    const BOM = '\uFEFF';
    const header = ['학생명', '생성된 의견', '긍정적 특성', '보완할 점', '추가 관찰내용'];

    const rows: string[][] = opState.students.map((s: StudentOpinionData) => [
      s.name,
      `"${`${s.generatedContent || ''}`.replace(/"/g, '""')}"`,
      (s.positiveTags || []).join(', '),
      (s.negativeTags || []).join(', '),
      `${s.additionalContext || ''}`.replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""')
    ]);

    const csvContent = BOM + [header, ...rows].map((e: string[]) => e.join(',')).join('\n');
    await window.electronAPI.saveCsv(csvContent, `행동특성_종합의견_${new Date().toISOString().slice(0,10)}.csv`);
  };

  return (
    <div className="bg-white dark:bg-[#221E1B] h-full flex flex-col transition-colors relative">
      {/* Header with Steps */}
      <div data-tour="opinion-gen-header" className="bg-white/80 dark:bg-[#221E1B]/80 backdrop-blur-sm p-4 border-b border-[#EDE8E1] dark:border-[#2E2822] sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mr-3 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-lg">행동특성 및 종합의견 생성</h2>
              <div className="flex items-center space-x-2 text-xs text-[#78716C] dark:text-[#9C8F87] font-medium hidden sm:flex">
                 <span className={opState.step === 'SETUP' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>1. 인원 설정</span>
                 <span>&gt;</span>
                 <span className={opState.step === 'CONFIG' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>2. 특성 선택</span>
                 <span>&gt;</span>
                 <span className={opState.step === 'RESULT' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>3. 결과 확인</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startTour('opinion-gen')}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
            >
              <HelpCircle className="w-3 h-3" />튜토리얼
            </button>
            {opState.step === 'RESULT' && (
                <button
                  onClick={() => updateOpState({ step: 'CONFIG' })}
                  disabled={isGlobalGenerating}
                  className={`text-sm text-[#78716C] underline hover:text-emerald-600 ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    수정하기
                </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {opState.step === 'SETUP' && (
            <div data-tour="opinion-gen-setup" className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl mx-auto space-y-8">
                    <div>
                        <label className="block text-lg font-bold text-[#44403C] dark:text-[#C4B8B0] mb-4">
                            생성할 학생 수는 몇 명인가요?
                        </label>
                        <div className="flex items-center space-x-4 bg-[#FAF9F7] dark:bg-[#221E1B] p-6 rounded-2xl border border-dashed border-[#E7E5E4] dark:border-[#2E2822] justify-center">
                            <button 
                                onClick={() => updateOpState({ studentCount: Math.max(1, opState.studentCount - 1) })}
                                className="w-12 h-12 flex items-center justify-center bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl shadow-sm text-xl text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] transition-colors"
                            >-</button>
                            <input
                                type="number"
                                value={opState.studentCount}
                                onChange={handleCountChange}
                                className="w-32 text-center text-3xl font-bold bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[#1C1917] dark:text-[#F0EBE6]"
                            />
                            <button 
                                onClick={() => updateOpState({ studentCount: opState.studentCount + 1 })}
                                className="w-12 h-12 flex items-center justify-center bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl shadow-sm text-xl text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] transition-colors"
                            >+</button>
                        </div>
                    </div>
                    
                    <div>
                        <div className="mb-4">
                             <label className="block text-lg font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">
                                학생 이름을 입력해주세요
                            </label>
                            <p className="text-sm text-[#78716C] dark:text-[#9C8F87]">
                                학생 이름을 쉼표(,)로 구분하거나, <strong>엑셀/스프레드시트에서 이름 열을 복사해 붙여넣기</strong>할 수 있습니다. <br/>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">(예: 김철수, 이영희, 박민수)</span>
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                const raw = await window.electronAPI.getConfig('studentNames') as string;
                                if (!raw) return;
                                const names = raw.split('\n').map((l: string) => l.replace(/^\d+[.\s)]+/, '').trim()).filter((l: string) => l.length > 0);
                                if (names.length === 0) return;
                                updateOpState({ nameInput: names.join(', '), studentCount: names.length });
                            }}
                            className="mb-2 px-4 py-2 text-sm font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                            우리반 학생 이름 자동 입력
                        </button>
                        <textarea
                            value={opState.nameInput}
                            onChange={handleNameInput}
                            placeholder="학생 1, 학생 2, 학생 3..."
                            className="w-full h-32 px-4 py-3 bg-[#FAF9F7] dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl text-[#1C1917] dark:text-[#F0EBE6] focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none shadow-inner"
                        />
                    </div>

                    <button
                        onClick={goToConfig}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-colors text-lg mt-8"
                    >
                        다음 단계로
                    </button>
                </div>
            </div>
        )}

        {opState.step === 'CONFIG' && (
            <div data-tour="opinion-gen-config" className="flex-1 flex overflow-hidden">
                {/* Sidebar List */}
                {studentPanelCollapsed && (
                    <div className="w-11 shrink-0 bg-[#FAF9F7] dark:bg-[#171210] border-r border-[#E7E5E4] dark:border-[#2E2822] flex justify-center py-3">
                        <button
                            onClick={() => setStudentPanelCollapsed(false)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#EDE8E1] dark:hover:bg-[#2E2822] transition-colors"
                            title="학생 목록 펼치기"
                        >
                            <PanelLeftOpen className="w-4 h-4" />
                        </button>
                    </div>
                )}
                {!studentPanelCollapsed && (
                <div className={`w-1/4 min-w-[150px] bg-[#FAF9F7] dark:bg-[#171210] border-r border-[#E7E5E4] dark:border-[#2E2822] overflow-y-auto ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-[#A8A29E] uppercase tracking-wider">학생 목록</h3>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center space-x-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={opState.students.length > 0 && opState.students.every(s => s.selected)}
                                        onChange={(e) => toggleAllSelection(e.target.checked)}
                                        className="w-3 h-3 text-emerald-600 rounded border-[#E7E5E4] focus:ring-emerald-500"
                                    />
                                    <span className="text-[10px] text-[#78716C]">전체</span>
                                </label>
                                <button
                                    onClick={() => setStudentPanelCollapsed(true)}
                                    className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#EDE8E1] dark:hover:bg-[#2E2822] transition-colors"
                                    title="학생 목록 접기"
                                >
                                    <PanelLeftClose className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            {opState.students.map((student, idx) => (
                                <div key={student.id} className="flex items-center space-x-2">
                                    <input 
                                        type="checkbox" 
                                        checked={student.selected || false}
                                        onChange={() => toggleSelection(idx)}
                                        className="w-4 h-4 text-emerald-600 rounded border-[#E7E5E4] focus:ring-emerald-500"
                                    />
                                    <button
                                        onClick={() => updateOpState({ currentStudentIndex: idx })}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            opState.currentStudentIndex === idx
                                            ? 'bg-white dark:bg-[#221E1B] text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-[#E7E5E4] dark:ring-[#2E2822]'
                                            : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-[#EDE8E1]/50 dark:hover:bg-[#2E2822]'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{student.name}</span>
                                            {renderCompletenessDots(student)}
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                )}

                {/* Configuration Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#221E1B]">
                    <div className="max-w-4xl mx-auto space-y-8">
                        
                        <div className="flex justify-between items-center pb-2 border-b border-[#EDE8E1] dark:border-[#2E2822]">
                            <h3 className="text-xl font-bold text-[#1C1917] dark:text-[#F0EBE6]">
                                <span className="text-emerald-600 dark:text-emerald-400">{currentStudent.name}</span> 학생 특성 선택
                            </h3>
                            <div className="text-sm text-[#78716C]">{opState.currentStudentIndex + 1} / {opState.students.length}</div>
                        </div>

                        {/* Positive Tags */}
                        <div>
                            <h4 className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-3 flex items-center">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></span>
                                긍정적 특성 (Positive)
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-[#FAF9F7] dark:bg-[#221E1B]/50 p-4 rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] max-h-64 overflow-y-auto">
                                {POSITIVE_TAGS.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => toggleTag(tag.label, 'positive')}
                                        disabled={isGlobalGenerating}
                                        className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left truncate disabled:cursor-not-allowed ${
                                            currentStudent.positiveTags.includes(tag.label)
                                            ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500 dark:ring-emerald-400'
                                            : 'bg-white dark:bg-[#2E2822] border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D]'
                                        }`}
                                    >
                                        {tag.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Negative Tags */}
                        <div>
                            <h4 className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-3 flex items-center">
                                <span className="w-2 h-2 bg-rose-400 rounded-full mr-2"></span>
                                보완할 점 (To Improve)
                            </h4>
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-[#FAF9F7] dark:bg-[#221E1B]/50 p-4 rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] max-h-48 overflow-y-auto">
                                {NEGATIVE_TAGS.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => toggleTag(tag.label, 'negative')}
                                        disabled={isGlobalGenerating}
                                        className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left truncate disabled:cursor-not-allowed ${
                                            currentStudent.negativeTags.includes(tag.label)
                                            ? 'bg-rose-100 dark:bg-rose-900/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500 dark:ring-rose-400'
                                            : 'bg-white dark:bg-[#2E2822] border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D]'
                                        }`}
                                    >
                                        {tag.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Additional Context */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">추가 관찰 내용</label>
                                <input
                                    type="file"
                                    ref={observationFileInputRef}
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    multiple
                                    onChange={handleObservationFileUpload}
                                />
                                <button
                                    onClick={() => observationFileInputRef.current?.click()}
                                    disabled={isAnalyzingObservation || isGlobalGenerating}
                                    className="px-3 py-1 bg-white dark:bg-[#2E2822] text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold shadow-sm border border-[#E7E5E4] dark:border-[#2E2822] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isAnalyzingObservation ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            분석 중...
                                        </>
                                    ) : '📷 학생 기록물 업로드 (사진/스캔 자동 분석)'}
                                </button>
                            </div>
                            <p className="text-xs text-[#A8A29E] mb-2">※ 학생의 활동지·결과물을 스캔하거나 촬영해 업로드하면 AI가 내용을 분석해 채워줍니다. 업로드된 파일은 분석에만 사용되며 저장되지 않습니다.</p>
                            <textarea
                                value={currentStudent.additionalContext}
                                onChange={(e) => handleContextChange(e.target.value)}
                                disabled={isGlobalGenerating}
                                placeholder="구체적인 에피소드나 강조하고 싶은 내용을 자유롭게 입력하세요."
                                className="w-full h-24 px-4 py-3 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-[#FAF9F7] dark:bg-[#2E2822] resize-none text-sm disabled:opacity-50"
                            />
                        </div>

                        {/* Length Settings */}
                        <div className={`p-4 bg-[#FAF9F7] dark:bg-[#2E2822]/30 rounded-xl border border-dashed border-[#E7E5E4] dark:border-[#2E2822] ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <label className="text-sm font-bold text-[#78716C] dark:text-[#C4B8B0]">생성 길이 설정 (전체 적용)</label>
                                <div className="flex items-center gap-4">
                                    <div className="flex space-x-3">
                                        {(['200', '300', '400', '500', 'custom'] as LengthOption[]).map((opt) => (
                                            <label key={opt} className="flex items-center cursor-pointer">
                                                <input 
                                                    type="radio" 
                                                    name="length" 
                                                    value={opt} 
                                                    checked={opState.lengthOption === opt} 
                                                    onChange={() => updateOpState({ lengthOption: opt })}
                                                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-[#E7E5E4]"
                                                />
                                                <span className="ml-1.5 text-sm text-[#78716C] dark:text-[#9C8F87]">
                                                    {opt === 'custom' ? '직접' : opt}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    {opState.lengthOption === 'custom' && (
                                        <input 
                                            type="number"
                                            value={opState.customLength}
                                            onChange={(e) => updateOpState({ customLength: Number(e.target.value) })}
                                            className="w-20 px-2 py-1 text-sm border rounded bg-white dark:bg-[#2E2822] dark:text-[#F0EBE6]"
                                        />
                                    )}
                                    <div className="flex bg-white dark:bg-[#2E2822] rounded-lg p-0.5 border border-[#E7E5E4] dark:border-[#6B5E57]">
                                         <button onClick={() => updateOpState({ lengthUnit: '자' })} className={`px-2 py-0.5 text-xs rounded ${opState.lengthUnit === '자' ? 'bg-emerald-100 text-emerald-700' : 'text-[#78716C]'}`}>자</button>
                                         <button onClick={() => updateOpState({ lengthUnit: 'byte' })} className={`px-2 py-0.5 text-xs rounded ${opState.lengthUnit === 'byte' ? 'bg-emerald-100 text-emerald-700' : 'text-[#78716C]'}`}>byte</button>
                                    </div>
                                </div>
                             </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => updateOpState({ step: 'SETUP' })}
                                    disabled={isGlobalGenerating}
                                    className="flex-none w-20 py-4 bg-[#EDE8E1] dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#EDE8E1] dark:hover:bg-[#3A332D] transition-colors"
                                >
                                    이전
                                </button>
                                <button
                                    onClick={handleGenerateSelected}
                                    disabled={isGlobalGenerating}
                                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center whitespace-nowrap px-1 text-sm sm:text-base"
                                >
                                    {isGlobalGenerating ? '생성 중...' : `선택 학생(${opState.students.filter(s => s.selected).length}명) 생성`}
                                </button>
                                <button
                                    onClick={handleGenerateAll}
                                    disabled={isGlobalGenerating}
                                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center whitespace-nowrap px-1 text-sm sm:text-base"
                                >
                                    {isGlobalGenerating ? (
                                        '생성 중...'
                                    ) : (
                                        `전체 학생(${opState.students.length}명) 생성`
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {opState.step === 'RESULT' && (
             <div data-tour="opinion-gen-result" className="flex-1 overflow-hidden flex flex-col">
                <div className="p-4 bg-white dark:bg-[#221E1B] border-b border-[#E7E5E4] dark:border-[#2E2822] flex justify-between items-center flex-wrap gap-2">
                    <h3 className="font-bold text-[#44403C] dark:text-[#C4B8B0]">생성 결과</h3>
                    <div className="flex items-center gap-2">
                         <button
                            onClick={handleCopyAll}
                            disabled={isGlobalGenerating}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center shadow-md ${
                                copiedId === '__ALL__'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400'
                                : 'bg-[#78716C] text-white hover:bg-[#44403C]'
                            } ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                            {copiedId === '__ALL__' ? '전체 복사 완료!' : '전체 복사'}
                        </button>
                         <button
                            onClick={checkDuplicates}
                            disabled={isGlobalGenerating}
                            className={`px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 transition-colors flex items-center shadow-md ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            중복 표현 검사
                        </button>
                        <button
                            onClick={downloadCSV}
                            disabled={isGlobalGenerating}
                            className={`px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center shadow-md ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            CSV로 다운로드
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {opState.students.map((student, idx) => (
                        <div key={student.id} className="bg-[#FAF9F7] dark:bg-[#221E1B]/50 p-6 rounded-2xl border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm">
                             <div className="flex justify-between mb-4">
                                <h4 className="font-bold text-lg text-[#1C1917] dark:text-[#F0EBE6] flex items-center">
                                    <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mr-3 text-sm">
                                        {idx + 1}
                                    </span>
                                    {student.name}
                                    {student.generatedModel && (
                                        <span className="ml-3 text-xs font-normal text-[#A8A29E] bg-[#EDE8E1] dark:bg-[#2E2822] px-2 py-0.5 rounded-full" title="이 결과를 생성한 AI 모델">
                                            {student.generatedModel}
                                        </span>
                                    )}
                                </h4>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleCopy(student.generatedContent || '', student.id)}
                                        disabled={isGlobalGenerating}
                                        className={`text-sm font-medium flex items-center px-3 py-1.5 rounded-lg transition-colors border ${
                                            copiedId === student.id
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400'
                                            : 'bg-white border-[#E7E5E4] text-[#78716C] hover:bg-[#FAF9F7] dark:bg-[#2E2822] dark:border-[#2E2822] dark:text-[#C4B8B0] dark:hover:bg-[#3A332D]'
                                        } ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {copiedId === student.id ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                </svg>
                                                복사 완료!
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                                </svg>
                                                복사
                                            </>
                                        )}
                                    </button>
                                    {(() => {
                                      const hist = getHistory('opinion', student.name);
                                      return hist.length > 0 ? (
                                        <button
                                          onClick={() => setExpandedHistory(prev => {
                                            const next = new Set(prev);
                                            next.has(student.id) ? next.delete(student.id) : next.add(student.id);
                                            return next;
                                          })}
                                          className="text-sm font-medium flex items-center px-3 py-1.5 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] transition-colors"
                                        >
                                          이전 기록 ({hist.length})
                                        </button>
                                      ) : null;
                                    })()}
                                    <button
                                        onClick={() => handleRegenerateOne(idx)}
                                        disabled={generatingIds.has(student.id) || isGlobalGenerating}
                                        className={`text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium flex items-center px-3 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors ${(generatingIds.has(student.id) || isGlobalGenerating) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {generatingIds.has(student.id) ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                재생성 중...
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                                </svg>
                                                재생성
                                            </>
                                        )}
                                    </button>
                                </div>
                             </div>
                             <div className="relative">
                                 <textarea
                                    value={student.generatedContent || ''}
                                    onChange={(e) => handleResultChange(idx, e.target.value)}
                                    className="w-full min-h-[120px] p-4 rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-y text-sm leading-relaxed"
                                 />
                                 <div className="absolute bottom-3 right-3 text-xs text-[#A8A29E] pointer-events-none">
                                     {(student.generatedContent || '').length}자/{getByteLength(student.generatedContent || '')}바이트
                                 </div>
                             </div>
                             {expandedHistory.has(student.id) && (() => {
                               const hist: HistoryEntry[] = getHistory('opinion', student.name);
                               return hist.length > 0 ? (
                                 <div className="mt-3 space-y-2">
                                   <p className="text-xs font-bold text-[#A8A29E] dark:text-[#6B5E57] uppercase tracking-wide">이전 생성 기록</p>
                                   {hist.map((entry, hi) => (
                                     <div key={hi} className="rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#171210]/40 p-3 text-sm text-[#78716C] dark:text-[#9C8F87]">
                                       <div className="flex justify-between items-center mb-1">
                                         <span className="text-xs text-[#A8A29E]">{new Date(entry.date).toLocaleString('ko-KR')}</span>
                                         <button
                                           onClick={() => { handleResultChange(idx, entry.content); setExpandedHistory(prev => { const next = new Set(prev); next.delete(student.id); return next; }); }}
                                           className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                                         >복원</button>
                                       </div>
                                       <p className="leading-relaxed line-clamp-3">{entry.content}</p>
                                     </div>
                                   ))}
                                 </div>
                               ) : null;
                             })()}
                        </div>
                    ))}
                </div>
             </div>
        )}

        {/* Duplicate Check Modal */}
        {showDuplicateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-[#221E1B] rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                    <div className="p-6 border-b border-[#EDE8E1] dark:border-[#2E2822] flex justify-between items-center">
                        <h3 className="text-xl font-bold text-[#1C1917] dark:text-[#F0EBE6] flex items-center">
                            <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mr-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </span>
                            중복 표현 검사 결과
                        </h3>
                        <button onClick={() => setShowDuplicateModal(false)} className="text-[#A8A29E] hover:text-[#78716C] dark:hover:text-[#C4B8B0]">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1">
                        {duplicateResults.length === 0 ? (
                            <div className="text-center py-8 text-[#78716C] dark:text-[#9C8F87]">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-4 text-emerald-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-lg font-bold text-[#44403C] dark:text-[#C4B8B0]">중복된 표현이 발견되지 않았습니다!</p>
                                <p className="text-sm mt-1">모든 학생의 내용이 다양하게 작성되었습니다.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-[#78716C] dark:text-[#9C8F87] mb-4">
                                    다음 문장들이 2명 이상의 학생에게서 발견되었습니다. 내용을 수정하여 다양성을 높여주세요.
                                </p>
                                {duplicateResults.map((result, idx) => (
                                    <div key={idx} className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                        <p className="font-bold text-[#1C1917] dark:text-[#C4B8B0] mb-2">"{result.sentence}"</p>
                                        <div className="flex flex-wrap gap-2">
                                            {result.students.map(name => (
                                                <span key={name} className="px-2 py-1 bg-white dark:bg-[#2E2822] text-xs rounded border border-amber-200 dark:border-amber-800 text-[#78716C] dark:text-[#C4B8B0]">
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-[#EDE8E1] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#221E1B]/50 rounded-b-2xl flex justify-end">
                        <button
                            onClick={() => setShowDuplicateModal(false)}
                            className="px-6 py-2 bg-[#1C1917] dark:bg-[#2E2822] text-white font-bold rounded-lg hover:bg-[#171210] dark:hover:bg-[#3A332D] transition-colors"
                        >
                            확인
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default OpinionGenerator;
