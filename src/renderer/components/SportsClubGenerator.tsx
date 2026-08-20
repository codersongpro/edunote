import React, { useState, useRef, useEffect } from 'react';
import { notifyToast } from '../lib/toast';
import { HelpCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTour } from '../TourContext';
import { SchoolLevel, LengthOption, LengthUnit, StudentSportsData, AppMode } from '../types';
import { generateSportsClubReport, parseStudentObservationFromFiles } from '../services/geminiService';
import { useGlobalState } from '../GlobalStateContext';
import { queueViolationWarning } from '../lib/guidelineCompliance';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { playSuccessSound } from '../lib/soundEffect';
import { saveHistory, getHistory, HistoryEntry } from '../lib/generationHistory';
import { getStudentGenerationExtras } from '../lib/generationSafety';
import { loadByteLimits, DEFAULT_BYTE_LIMITS, RecordKind } from '../lib/textLength';
import { ByteCountBadge } from './ByteCountBadge';
import { loadStudentRoster, RosterEntry } from '../lib/studentRoster';
import { RosterNameHint } from './RosterNameHint';

interface Props {
  schoolLevel: SchoolLevel;
}

interface DuplicateResult {
  sentence: string;
  students: string[];
}

const SPORTS_POSITIVE_TRAITS = [
  '주장', '부주장', '협력', '준비성', '자율', '끈기', '협응력', '리더십',
  '팀워크', '책임감', '적극성', '열정', '집중력', '체력 우수', '기술 향상',
  '규칙 준수', '매너', '배려', '경청', '성실성', '창의적 플레이', '빠른 판단력',
  '페어플레이', '자기 관리', '도전 정신', '회복 탄력성', '전략적 사고',
  '소통 능력', '긍정적 태도', '안전 의식',
];

const SPORTS_NEGATIVE_TRAITS = [
  '집중력 부족', '규칙 미준수', '소극적 참여', '팀워크 부족', '준비 부족',
  '체력 부족', '지각', '무단 불참', '불성실한 태도', '비매너 행동',
  '거친 플레이', '개인 플레이 위주', '자세 불량', '갈등 야기', '책임감 부족',
  '경청 미흡', '부정 언어 사용', '기술 습득 저조', '협력 거부', '반칙',
  '안전 규칙 미준수', '부상 유발 행동', '자기 관리 미흡', '도전 회피',
  '불만 표출', '과도한 승부욕', '의사소통 문제', '비협력적 태도',
  '장비 관리 소홀', '경기 중 이탈',
];

const SportsClubGenerator: React.FC<Props> = ({ schoolLevel }) => {
  const { startTour } = useTour();
  const { state, setState, isGlobalGenerating, setIsGlobalGenerating, setGlobalProgress, showToast } = useGlobalState();
  const { startGeneration, updateProgress, endGeneration, isCancelRequested, callWithAbort } = useGenerationTracker(AppMode.SPORTS_CLUB_GENERATOR);
  const sportsState = state.sports;

  // Local UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const wasGenerating = useRef(false);
  const [traitMode, setTraitMode] = useState<'positive' | 'negative'>('positive');

  useEffect(() => {
    const isNow = generatingIds.size > 0;
    if (isNow && !wasGenerating.current) { startGeneration(); wasGenerating.current = true; }
    else if (!isNow && wasGenerating.current) { endGeneration(); wasGenerating.current = false; }
  }, [generatingIds.size]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateResults, setDuplicateResults] = useState<DuplicateResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [studentPanelCollapsed, setStudentPanelCollapsed] = useState(false);
  const [isAnalyzingObservation, setIsAnalyzingObservation] = useState(false);
  const observationFileInputRef = useRef<HTMLInputElement>(null);

  // NEIS 입력 상한(설정에서 조정 가능). 조회 전에는 기본값으로 표시한다.
  const [byteLimits, setByteLimits] = useState<Record<RecordKind, number>>(DEFAULT_BYTE_LIMITS);
  useEffect(() => {
    let cancelled = false;
    loadByteLimits().then(limits => { if (!cancelled) setByteLimits(limits); });
    return () => { cancelled = true; };
  }, []);

  // 설정에 등록한 학생 번호-이름 명렬표(로컬 전용). 번호로 입력했을 때 실명 힌트를 보여주는 데만 쓴다.
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadStudentRoster().then(entries => { if (!cancelled) setRoster(entries); });
    return () => { cancelled = true; };
  }, []);

  // Helper to update sports state
  const updateSportsState = (updates: Partial<typeof state.sports>) => {
    setState(prev => ({
      ...prev,
      sports: { ...prev.sports, ...updates }
    }));
  };

  // --- Helper: Completeness Dots ---
  const getCompletenessScore = (student: StudentSportsData): number => {
    let score = 0;
    score += Math.floor((student.additionalContext?.length || 0) / 20);
    return score;
  };

  const renderCompletenessDots = (student: StudentSportsData) => {
    const score = getCompletenessScore(student);
    const maxDots = 5;
    const dotsToShow = Math.min(score, maxDots);
    
    if (dotsToShow === 0) return null;

    return (
      <div className="flex space-x-0.5">
        {Array.from({ length: dotsToShow }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
        ))}
      </div>
    );
  };

  // --- Setup Handlers ---
  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      updateSportsState({ studentCount: val });
    }
  };

  const handleNameInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateSportsState({ nameInput: e.target.value });
  };

  const goToConfig = () => {
    const names = sportsState.nameInput
      .split(/,|\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let newStudents: StudentSportsData[] = [];
    const count = names.length > 0 ? names.length : sportsState.studentCount;

    if (names.length > 0) {
      newStudents = names.map((name, i) => ({
        id: String(i + 1),
        name: name,
        additionalContext: '',
        selected: false
      }));
    } else {
      newStudents = Array.from({ length: count }, (_, i) => ({
        id: String(i + 1),
        name: `학생 ${i + 1}`,
        additionalContext: '',
        selected: false
      }));
    }

    // Generate common student list for synchronization
    const commonList = names.length > 0 
        ? names.map((name, i) => ({ id: String(Date.now() + i), name }))
        : Array.from({ length: count }, (_, i) => ({ id: String(Date.now() + i), name: `학생 ${i + 1}` }));

    setState(prev => ({
        ...prev,
        sports: {
            ...prev.sports,
            studentCount: count,
            students: newStudents,
            step: 'CONFIG',
            currentStudentIndex: 0
        },
        // Sync names to other modules
        opinion: {
            ...prev.opinion,
            nameInput: sportsState.nameInput,
            studentCount: count
        },
        subject: {
            ...prev.subject,
            nameInput: sportsState.nameInput,
            studentCount: count,
            commonStudents: commonList
        },
        creative: {
            ...prev.creative,
            nameInput: sportsState.nameInput,
            studentCount: count
        }
    }));
  };

  // --- Selection Handlers ---
  const toggleSelection = (index: number) => {
    if (isGlobalGenerating) return;
    const newStudents = [...sportsState.students];
    newStudents[index].selected = !newStudents[index].selected;
    updateSportsState({ students: newStudents });
  };

  const toggleAllSelection = (checked: boolean) => {
    if (isGlobalGenerating) return;
    const newStudents = sportsState.students.map(s => ({ ...s, selected: checked }));
    updateSportsState({ students: newStudents });
  };

  // --- Config Handlers ---
  const handleContextChange = (text: string) => {
    const newStudents = [...sportsState.students];
    newStudents[sportsState.currentStudentIndex].additionalContext = text;
    updateSportsState({ students: newStudents });
  };

  const handleTraitToggle = (trait: string) => {
    const current = sportsState.students[sportsState.currentStudentIndex].additionalContext || '';
    const hasTag = current.includes(`[${trait}]`);
    const updated = hasTag
      ? current.replace(`[${trait}]`, '').replace(/  +/g, ' ').trim()
      : `${current}${current && !current.endsWith(' ') ? ' ' : ''}[${trait}]`;
    handleContextChange(updated);
  };

  const isTraitSelected = (trait: string) => {
    return (sportsState.students[sportsState.currentStudentIndex]?.additionalContext || '').includes(`[${trait}]`);
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

      const extractedText = await parseStudentObservationFromFiles(filesToAnalyze, '학교스포츠클럽 특기사항 - 개별 활동 내용 및 태도');
      if (!extractedText.trim()) {
        notifyToast({ type: 'warning', title: '파일에서 관찰 내용을 분석하지 못했습니다.' });
        return;
      }

      const current = sportsState.students[sportsState.currentStudentIndex]?.additionalContext || '';
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
    if (!sportsState.sportName || !sportsState.clubName) {
        notifyToast({ type: 'warning', title: "종목명과 클럽명을 입력해주세요." });
        return;
    }
    
    setIsGlobalGenerating(true);
    setIsGenerating(true);
    setGlobalProgress(0);
    startGeneration(0);
    const newStudents = [...sportsState.students];
    let completedCount = 0;

    try {
        for (let i = 0; i < newStudents.length; i++) {
            if (isCancelRequested()) break;
            const student = newStudents[i];
            try {
              const extras = await getStudentGenerationExtras(student.name);
              const { text: result, model, privacyApplied } = await callWithAbort(() => generateSportsClubReport({
                  schoolLevel,
                  studentName: student.name,
                  sportName: sportsState.sportName,
                  clubName: sportsState.clubName,
                  additionalContext: student.additionalContext,
                  lengthOption: sportsState.lengthOption as LengthOption,
                  customLength: sportsState.customLength as number,
                  lengthUnit: sportsState.lengthUnit as LengthUnit,
                  ...extras
              }));
              newStudents[i].generatedContent = result;
              newStudents[i].generatedModel = model;
              newStudents[i].privacyApplied = privacyApplied;
              queueViolationWarning(showToast, newStudents[i].name, result);
              saveHistory('sports', student.name, result);
              completedCount++;
              const pct = Math.round((completedCount / newStudents.length) * 100);
              setGlobalProgress(pct);
              updateProgress(pct);
            } catch (err) {
              if (err instanceof Error && err.message === 'CANCELLED') break;
              throw err;
            }
        }

        if (!isCancelRequested()) playSuccessSound();
        updateSportsState({ students: newStudents, step: 'RESULT' });
    } catch (err: any) {
        if (!(err instanceof Error && err.message === 'CANCELLED')) {
          console.error(err instanceof Error ? err.message : String(err));
          notifyToast({ type: 'error', title: "생성 중 오류가 발생했습니다." });
        }
        updateSportsState({ students: newStudents, step: 'RESULT' });
    } finally {
        setIsGlobalGenerating(false);
        setIsGenerating(false);
        setGlobalProgress(0);
        endGeneration();
    }
  };

  const handleGenerateSelected = async () => {
    if (!sportsState.sportName || !sportsState.clubName) {
        notifyToast({ type: 'warning', title: "종목명과 클럽명을 입력해주세요." });
        return;
    }

    const selectedIndices = sportsState.students
        .map((s, i) => s.selected ? i : -1)
        .filter(i => i !== -1);

    if (selectedIndices.length === 0) {
        notifyToast({ type: 'warning', title: "선택된 학생이 없습니다." });
        return;
    }

    setIsGlobalGenerating(true);
    setIsGenerating(true);
    setGlobalProgress(0);
    startGeneration(0);
    const newStudents = [...sportsState.students];
    let completedCount = 0;

    try {
        for (let i = 0; i < selectedIndices.length; i++) {
            if (isCancelRequested()) break;
            const index = selectedIndices[i];
            const student = newStudents[index];
            try {
              const extras = await getStudentGenerationExtras(student.name);
              const { text: result, model, privacyApplied } = await callWithAbort(() => generateSportsClubReport({
                  schoolLevel,
                  studentName: student.name,
                  sportName: sportsState.sportName,
                  clubName: sportsState.clubName,
                  additionalContext: student.additionalContext,
                  lengthOption: sportsState.lengthOption as LengthOption,
                  customLength: sportsState.customLength as number,
                  lengthUnit: sportsState.lengthUnit as LengthUnit,
                  ...extras
              }));
              newStudents[index].generatedContent = result;
              newStudents[index].generatedModel = model;
              newStudents[index].privacyApplied = privacyApplied;
              queueViolationWarning(showToast, newStudents[index].name, result);
              saveHistory('sports', student.name, result);
              completedCount++;
              const selPct = Math.round((completedCount / selectedIndices.length) * 100);
              setGlobalProgress(selPct);
              updateProgress(selPct);
            } catch (err) {
              if (err instanceof Error && err.message === 'CANCELLED') break;
              throw err;
            }
        }

        if (!isCancelRequested()) playSuccessSound();
        updateSportsState({ students: newStudents, step: 'RESULT' });
    } catch (err: any) {
        if (!(err instanceof Error && err.message === 'CANCELLED')) {
          console.error(err instanceof Error ? err.message : String(err));
          notifyToast({ type: 'error', title: "생성 중 오류가 발생했습니다." });
        }
        updateSportsState({ students: newStudents, step: 'RESULT' });
    } finally {
        setIsGlobalGenerating(false);
        setIsGenerating(false);
        setGlobalProgress(0);
        endGeneration();
    }
  };

  const handleRegenerateOne = async (index: number) => {
    const student = sportsState.students[index];
    setGeneratingIds((prev: Set<string>) => new Set(prev).add(student.id));
    
    const avoidPhrases = student.generatedContent 
        ? student.generatedContent.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length > 10)
        : [];

    try {
      const extras = await getStudentGenerationExtras(student.name);
      const { text: result, model, privacyApplied } = await generateSportsClubReport({
          schoolLevel,
          studentName: student.name,
          sportName: sportsState.sportName,
          clubName: sportsState.clubName,
          additionalContext: student.additionalContext,
          lengthOption: sportsState.lengthOption as LengthOption,
          customLength: sportsState.customLength as number,
          lengthUnit: sportsState.lengthUnit as LengthUnit,
          avoidPhrases,
          ...extras
      });

      const newStudents = [...sportsState.students];
      newStudents[index].generatedContent = result;
      newStudents[index].generatedModel = model;
      newStudents[index].privacyApplied = privacyApplied;
      queueViolationWarning(showToast, newStudents[index].name, result);
      saveHistory('sports', sportsState.students[index].name, result);
      updateSportsState({ students: newStudents });
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
    const newStudents = [...sportsState.students];
    newStudents[index].generatedContent = text;
    updateSportsState({ students: newStudents });
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

  // 모든 학생 결과를 한 번에 클립보드에 복사
  const handleCopyAll = async () => {
    const text = sportsState.students
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
    
    sportsState.students.forEach(student => {
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
    const header = ['학생명', '생성된 특기사항', '종목', '클럽명', '개별 활동내용'];
    
    const rows = sportsState.students.map((s: StudentSportsData) => [
      s.name,
      `"${`${s.generatedContent || ''}`.replace(/"/g, '""')}"`,
      sportsState.sportName,
      sportsState.clubName,
      `${s.additionalContext || ''}`.replace(/(\r\n|\n|\r)/gm, " ")
    ]);

    const csvContent = BOM + [header, ...rows].map(e => e.join(',')).join('\n');
    await window.electronAPI.saveCsv(csvContent, `스포츠클럽_${sportsState.sportName}_${new Date().toISOString().slice(0,10)}.csv`);
  };

  return (
    <div className="bg-white dark:bg-[#221E1B] h-full flex flex-col transition-colors relative">
      <div data-tour="sports-gen-header" className="bg-white/80 dark:bg-[#221E1B]/80 backdrop-blur-sm p-4 border-b border-[#EDE8E1] dark:border-[#2E2822]">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0V5.625a1.125 1.125 0 00-1.125-1.125h-2.25a1.125 1.125 0 00-1.125 1.125V14.25m-6 0h15" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-lg">학교스포츠클럽 특기사항 생성</h2>
              <div className="flex items-center space-x-2 text-xs text-[#78716C] dark:text-[#9C8F87] font-medium">
                 <span className={sportsState.step === 'SETUP' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>1. 인원 설정</span>
                 <span>&gt;</span>
                 <span className={sportsState.step === 'CONFIG' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>2. 활동 입력</span>
                 <span>&gt;</span>
                 <span className={sportsState.step === 'RESULT' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>3. 결과 확인</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startTour('sports-gen')}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <HelpCircle className="w-3 h-3" />튜토리얼
            </button>
            {sportsState.step === 'RESULT' && (
                <button
                  onClick={() => updateSportsState({ step: 'CONFIG' })}
                  disabled={isGlobalGenerating}
                  className={`text-sm text-[#78716C] underline hover:text-blue-600 ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    수정하기
                </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {sportsState.step === 'SETUP' && (
            <div data-tour="sports-gen-setup" className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl mx-auto space-y-8">
                    <div>
                        <label className="block text-lg font-bold text-[#44403C] dark:text-[#C4B8B0] mb-4">
                            생성할 학생 수는 몇 명인가요?
                        </label>
                         <div className="flex items-center space-x-4 bg-[#FAF9F7] dark:bg-[#221E1B] p-6 rounded-2xl border border-dashed border-[#E7E5E4] dark:border-[#2E2822] justify-center">
                            <button 
                                onClick={() => updateSportsState({ studentCount: Math.max(1, sportsState.studentCount - 1) })}
                                className="w-12 h-12 flex items-center justify-center bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl shadow-sm text-xl text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] transition-colors"
                            >-</button>
                            <input
                                type="number"
                                value={sportsState.studentCount}
                                onChange={handleCountChange}
                                className="w-32 text-center text-3xl font-bold bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#1C1917] dark:text-[#F0EBE6]"
                            />
                            <button 
                                onClick={() => updateSportsState({ studentCount: sportsState.studentCount + 1 })}
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
                                <span className="text-blue-600 dark:text-blue-400 font-medium">(예: 김철수, 이영희, 박민수)</span>
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                🔒 개인정보 보호를 위해 실명 대신 <strong>학생 번호나 별명(가명)</strong> 입력을 권장합니다. (예: 1, 2, 3 또는 학생A, 학생B) — 설정의 "학생 번호-이름 명렬표"에 등록해두면 화면에서만 실명을 확인할 수 있습니다.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                const raw = await window.electronAPI.getConfig('studentNames') as string;
                                if (!raw) return;
                                const names = raw.split('\n').map((l: string) => l.replace(/^\d+[.\s)]+/, '').trim()).filter((l: string) => l.length > 0);
                                if (names.length === 0) return;
                                updateSportsState({ nameInput: names.join(', '), studentCount: names.length });
                            }}
                            className="mb-2 px-4 py-2 text-sm font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            우리반 학생 이름 자동 입력
                        </button>
                        <textarea
                            value={sportsState.nameInput}
                            onChange={handleNameInput}
                            placeholder="학생 1, 학생 2, 학생 3..."
                            className="w-full h-32 px-4 py-3 bg-[#FAF9F7] dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl text-[#1C1917] dark:text-[#F0EBE6] focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none shadow-inner"
                        />
                    </div>

                    <button
                        onClick={goToConfig}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-colors text-lg mt-8"
                    >
                        다음 단계로
                    </button>
                </div>
            </div>
        )}

        {sportsState.step === 'CONFIG' && (
            <div data-tour="sports-gen-config" className="flex-1 flex overflow-hidden">
                {/* Sidebar List */}
                {studentPanelCollapsed && (
                    <div className="w-11 shrink-0 bg-[#FAF9F7] dark:bg-[#171210] border-r border-[#E7E5E4] dark:border-[#2E2822] flex justify-center py-3">
                        <button
                            onClick={() => setStudentPanelCollapsed(false)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#EDE8E1] dark:hover:bg-[#221E1B] transition-colors"
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
                                        checked={sportsState.students.length > 0 && sportsState.students.every(s => s.selected)}
                                        onChange={(e) => toggleAllSelection(e.target.checked)}
                                        className="w-3 h-3 text-blue-600 rounded border-[#E7E5E4] focus:ring-blue-500"
                                    />
                                    <span className="text-[10px] text-[#78716C]">전체</span>
                                </label>
                                <button
                                    onClick={() => setStudentPanelCollapsed(true)}
                                    className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#EDE8E1] dark:hover:bg-[#221E1B] transition-colors"
                                    title="학생 목록 접기"
                                >
                                    <PanelLeftClose className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            {sportsState.students.map((student, idx) => (
                                <div key={student.id} className="flex items-center space-x-2">
                                    <input 
                                        type="checkbox" 
                                        checked={student.selected || false}
                                        onChange={() => toggleSelection(idx)}
                                        className="w-4 h-4 text-blue-600 rounded border-[#E7E5E4] focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={() => updateSportsState({ currentStudentIndex: idx })}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            sportsState.currentStudentIndex === idx
                                            ? 'bg-white dark:bg-[#221E1B] text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-[#E7E5E4] dark:ring-[#2E2822]'
                                            : 'text-[#78716C] dark:text-[#9C8F87] hover:bg-[#EDE8E1]/50 dark:hover:bg-[#221E1B]'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{student.name}<RosterNameHint roster={roster} identifier={student.name} /></span>
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
                        
                        {/* Global Sport Settings */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                            <h3 className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-lg mb-4">스포츠클럽 정보 (공통)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0] mb-2">종목명</label>
                                    <input 
                                        type="text" 
                                        value={sportsState.sportName} 
                                        onChange={(e) => updateSportsState({ sportName: e.target.value })}
                                        disabled={isGlobalGenerating}
                                        placeholder="예: 축구, 배드민턴"
                                        className="w-full px-4 py-3 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#221E1B] disabled:opacity-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0] mb-2">클럽명</label>
                                    <input 
                                        type="text" 
                                        value={sportsState.clubName} 
                                        onChange={(e) => updateSportsState({ clubName: e.target.value })}
                                        disabled={isGlobalGenerating}
                                        placeholder="예: 슛돌이 FC, 셔틀콕"
                                        className="w-full px-4 py-3 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#221E1B] disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#EDE8E1] dark:border-[#2E2822]">
                                <h3 className="text-xl font-bold text-[#1C1917] dark:text-[#F0EBE6]">
                                    <span className="text-blue-600 dark:text-blue-400">{sportsState.students[sportsState.currentStudentIndex].name}</span> 학생 개별 활동
                                </h3>
                                <div className="text-sm text-[#78716C]">{sportsState.currentStudentIndex + 1} / {sportsState.students.length}</div>
                            </div>

                            <div className="mb-2">
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">특성 선택 (클릭하면 아래 입력란에 추가)</label>
                                <div className="flex rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] overflow-hidden text-xs">
                                  <button
                                    onClick={() => setTraitMode('positive')}
                                    className={`px-3 py-1 font-semibold transition-colors ${traitMode === 'positive' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0]'}`}
                                  >긍정 요소</button>
                                  <button
                                    onClick={() => setTraitMode('negative')}
                                    className={`px-3 py-1 font-semibold transition-colors ${traitMode === 'negative' ? 'bg-rose-500 text-white' : 'bg-white dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0]'}`}
                                  >부정 요소</button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 p-2.5 bg-[#FAF9F7] dark:bg-[#2E2822]/50 rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] max-h-28 overflow-y-auto">
                                {(traitMode === 'positive' ? SPORTS_POSITIVE_TRAITS : SPORTS_NEGATIVE_TRAITS).map(trait => {
                                  const selected = isTraitSelected(trait);
                                  return (
                                    <button
                                      key={trait}
                                      onClick={() => handleTraitToggle(trait)}
                                      disabled={isGlobalGenerating}
                                      className={`px-2.5 py-1 text-xs rounded-full border transition-all font-medium disabled:opacity-50 ${
                                        selected
                                          ? traitMode === 'positive'
                                            ? 'bg-emerald-500 text-white border-emerald-500'
                                            : 'bg-rose-500 text-white border-rose-500'
                                          : traitMode === 'positive'
                                          ? 'bg-white dark:bg-[#2E2822] text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-50'
                                          : 'bg-white dark:bg-[#2E2822] text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700 hover:bg-rose-50'
                                      }`}
                                    >
                                      {trait}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">개별 활동 내용 및 태도 <span className="text-xs font-normal text-[#A8A29E]">(특성 선택 시 자동으로 추가됨)</span></label>
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
                                    className="px-3 py-1 bg-white dark:bg-[#2E2822] text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold shadow-sm border border-[#E7E5E4] dark:border-[#2E2822] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                            <p className="text-xs text-[#A8A29E] mb-2">※ 학생의 활동지·결과물을 스캔하거나 촬영해 업로드하면 AI가 내용을 분석해 채워줍니다. 업로드된 파일은 분석에만 사용되며 저장되지 않지만, 개인정보 보호 모드와 무관하게 원본이 그대로 AI에 전송됩니다.</p>
                            <textarea
                                value={sportsState.students[sportsState.currentStudentIndex].additionalContext}
                                onChange={(e) => handleContextChange(e.target.value)}
                                disabled={isGlobalGenerating}
                                placeholder="이 학생의 구체적인 활동 내용, 역할(주장 등), 성장한 점, 태도 등을 입력하세요."
                                className="w-full h-28 px-4 py-3 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[#FAF9F7] dark:bg-[#2E2822] resize-none disabled:opacity-50"
                            />
                        </div>

                        {/* Length Settings */}
                        <div className={`p-4 bg-[#FAF9F7] dark:bg-[#2E2822]/30 rounded-xl border border-dashed border-[#E7E5E4] dark:border-[#2E2822] ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <label className="text-sm font-bold text-[#78716C] dark:text-[#C4B8B0]">생성 길이 설정 (전체 적용)</label>
                                <div className="flex items-center gap-4">
                                    <div className="flex space-x-3">
                                        {(['100', '200', '300', 'custom'] as LengthOption[]).map((opt) => (
                                            <label key={opt} className="flex items-center cursor-pointer">
                                                <input 
                                                    type="radio" 
                                                    name="sportsLength" 
                                                    value={opt} 
                                                    checked={sportsState.lengthOption === opt} 
                                                    onChange={() => updateSportsState({ lengthOption: opt })}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-[#E7E5E4]"
                                                />
                                                <span className="ml-1.5 text-sm text-[#78716C] dark:text-[#9C8F87]">
                                                    {opt === 'custom' ? '직접' : opt}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    {sportsState.lengthOption === 'custom' && (
                                        <input 
                                            type="number"
                                            value={sportsState.customLength}
                                            onChange={(e) => updateSportsState({ customLength: Number(e.target.value) })}
                                            className="w-20 px-2 py-1 text-sm border rounded bg-white dark:bg-[#2E2822] dark:text-white"
                                        />
                                    )}
                                    <div className="flex bg-white dark:bg-[#2E2822] rounded-lg p-0.5 border border-[#E7E5E4] dark:border-[#6B5E57]">
                                         <button onClick={() => updateSportsState({ lengthUnit: '자' })} className={`px-2 py-0.5 text-xs rounded ${sportsState.lengthUnit === '자' ? 'bg-blue-100 text-blue-700' : 'text-[#78716C]'}`}>자</button>
                                         <button onClick={() => updateSportsState({ lengthUnit: 'byte' })} className={`px-2 py-0.5 text-xs rounded ${sportsState.lengthUnit === 'byte' ? 'bg-blue-100 text-blue-700' : 'text-[#78716C]'}`}>byte</button>
                                    </div>
                                </div>
                             </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => updateSportsState({ step: 'SETUP' })}
                                    disabled={isGlobalGenerating}
                                    className="flex-1 py-4 bg-[#EDE8E1] dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#EDE8E1] dark:hover:bg-[#3A332D] transition-colors"
                                >
                                    이전 (인원 설정)
                                </button>
                                <button
                                    onClick={handleGenerateSelected}
                                    disabled={isGlobalGenerating}
                                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center whitespace-nowrap px-1 text-sm sm:text-base"
                                >
                                    {isGlobalGenerating ? '생성 중...' : `선택 학생(${sportsState.students.filter(s => s.selected).length}명) 생성`}
                                </button>
                                <button
                                    onClick={handleGenerateAll}
                                    disabled={isGlobalGenerating}
                                    className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center whitespace-nowrap px-1 text-sm sm:text-base"
                                >
                                    {isGlobalGenerating ? (
                                        '생성 중...'
                                    ) : (
                                        `전체 학생(${sportsState.students.length}명) 생성`
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {sportsState.step === 'RESULT' && (
             <div data-tour="sports-gen-result" className="flex-1 overflow-hidden flex flex-col">
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
                            className={`px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-md ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            CSV로 다운로드
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {sportsState.students.map((student, idx) => (
                        <div key={student.id} className="bg-[#FAF9F7] dark:bg-[#221E1B]/50 p-6 rounded-2xl border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm">
                             <div className="flex justify-between mb-4">
                                <h4 className="font-bold text-lg text-[#1C1917] dark:text-[#F0EBE6] flex items-center">
                                    <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3 text-sm">
                                        {idx + 1}
                                    </span>
                                    {student.name}
                                    {student.generatedModel && (
                                        <span className="ml-3 text-xs font-normal text-[#A8A29E] bg-[#EDE8E1] dark:bg-[#2E2822] px-2 py-0.5 rounded-full" title="이 결과를 생성한 AI 모델">
                                            {student.generatedModel}
                                        </span>
                                    )}
                                    {student.generatedModel && (
                                        <span
                                            className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${
                                                student.privacyApplied
                                                    ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40'
                                                    : 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40'
                                            }`}
                                            title={student.privacyApplied ? '개인정보 보호 모드로 이름을 가려 전송했습니다.' : '개인정보 보호 모드가 꺼져 있거나 적용되지 않아 이름이 그대로 전송되었습니다.'}
                                        >
                                            {student.privacyApplied ? '🔒 이름 가림' : '이름 그대로 전송'}
                                        </span>
                                    )}
                                </h4>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleCopy(student.generatedContent || '', student.id)}
                                        disabled={isGlobalGenerating}
                                        className={`text-sm font-medium flex items-center px-3 py-1.5 rounded-lg transition-colors border ${
                                            copiedId === student.id
                                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400'
                                            : 'bg-white border-[#E7E5E4] text-[#78716C] hover:bg-[#FAF9F7] dark:bg-[#2E2822] dark:border-[#2E2822] dark:text-[#C4B8B0] dark:hover:bg-[#3A332D]'
                                        } ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {copiedId === student.id ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1.5 text-blue-600 dark:text-blue-400">
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
                                      const hist = getHistory('sports', student.name);
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
                                        className={`text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${(generatingIds.has(student.id) || isGlobalGenerating) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                    className="w-full min-h-[120px] p-4 rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y text-sm leading-relaxed"
                                 />
                                 <ByteCountBadge text={student.generatedContent || ''} limit={byteLimits.sports} />
                             </div>
                             {expandedHistory.has(student.id) && (() => {
                               const hist: HistoryEntry[] = getHistory('sports', student.name);
                               return hist.length > 0 ? (
                                 <div className="mt-3 space-y-2">
                                   <p className="text-xs font-bold text-[#A8A29E] dark:text-[#6B5E57] uppercase tracking-wide">이전 생성 기록</p>
                                   {hist.map((entry, hi) => (
                                     <div key={hi} className="rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#171210]/40 p-3 text-sm text-[#78716C] dark:text-[#9C8F87]">
                                       <div className="flex justify-between items-center mb-1">
                                         <span className="text-xs text-[#A8A29E]">{new Date(entry.date).toLocaleString('ko-KR')}</span>
                                         <button
                                           onClick={() => { handleResultChange(idx, entry.content); setExpandedHistory(prev => { const next = new Set(prev); next.delete(student.id); return next; }); }}
                                           className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
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
                    <div className="p-4 border-b border-[#EDE8E1] dark:border-[#2E2822] flex justify-between items-center">
                        <h3 className="text-lg font-bold text-[#1C1917] dark:text-[#F0EBE6]">중복 문장 검사 결과</h3>
                        <button onClick={() => setShowDuplicateModal(false)} className="text-[#A8A29E] hover:text-[#78716C]">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1">
                        {duplicateResults.length === 0 ? (
                            <div className="text-center py-8 text-[#78716C] dark:text-[#9C8F87]">
                                <p className="text-lg">✅ 발견된 중복 문장이 없습니다.</p>
                                <p className="text-sm">모든 학생의 내용이 고유하게 작성되었습니다.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 rounded-lg text-sm mb-4">
                                    ⚠️ 총 {duplicateResults.length}개의 중복 문장이 발견되었습니다. 내용을 수정해주세요.
                                </div>
                                {duplicateResults.map((result, idx) => (
                                    <div key={idx} className="bg-[#FAF9F7] dark:bg-[#2E2822]/50 p-4 rounded-xl border border-[#E7E5E4] dark:border-[#2E2822]">
                                        <p className="text-[#1C1917] dark:text-[#F0EBE6] font-medium mb-2 text-sm">"{result.sentence}"</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {result.students.map((studentName, i) => (
                                                <span key={i} className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-md font-bold">
                                                    {studentName}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-[#EDE8E1] dark:border-[#2E2822] flex justify-end">
                        <button
                            onClick={() => setShowDuplicateModal(false)}
                            className="px-4 py-2 bg-[#EDE8E1] dark:bg-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] font-bold rounded-lg hover:bg-[#E7E5E4] dark:hover:bg-[#3A332D] transition-colors"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default SportsClubGenerator;
