
import React, { useState, useRef, useEffect } from 'react';
import { SchoolLevel, LengthOption, LengthUnit, StudentCreativeActivityData, Student, AppMode } from '../types';
import { CREATIVE_ACTIVITY_TAGS } from '../constants';
import { generateCreativeActivityReport, parseAnnualPlanFromImages, parseAnnualPlanFromDocuments } from '../services/geminiService';
import { extractTextFromHwpx } from '../lib/hwpx-parser';
import { useGlobalState } from '../GlobalStateContext';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { playSuccessSound } from '../lib/soundEffect';
import { saveHistory, getHistory, HistoryEntry } from '../lib/generationHistory';

interface Props {
  schoolLevel: SchoolLevel;
}

interface DuplicateResult {
  sentence: string;
  students: string[];
}

const ACTIVITY_DOMAINS = ['자율활동', '동아리활동', '진로활동', '봉사활동'];

const CreativeActivityGenerator: React.FC<Props> = ({ schoolLevel }) => {
  const { state, setState, isGlobalGenerating, setIsGlobalGenerating, setGlobalProgress, globalProgress } = useGlobalState();
  const { startGeneration, endGeneration, updateProgress, isCancelRequested, callWithAbort } = useGenerationTracker(AppMode.CREATIVE_ACTIVITY_GENERATOR);
  const creativeState = state.creative;

  // Local UI State
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const wasGeneratingCreative = useRef(false);

  useEffect(() => {
    const isNow = generatingIds.size > 0;
    if (isNow && !wasGeneratingCreative.current) { startGeneration(); wasGeneratingCreative.current = true; }
    else if (!isNow && wasGeneratingCreative.current) { endGeneration(); wasGeneratingCreative.current = false; }
  }, [generatingIds.size]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateResults, setDuplicateResults] = useState<DuplicateResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  // UI State for Adding New Activity
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityDomain, setNewActivityDomain] = useState('자율활동');

  // UI State for Annual Plan Image Parsing
  const [isAnalyzingPlan, setIsAnalyzingPlan] = useState(false);
  const planFileInputRef = useRef<HTMLInputElement>(null);

  // Helper to update creative state
  const updateCreativeState = (updates: Partial<typeof state.creative>) => {
    setState(prev => ({
      ...prev,
      creative: { ...prev.creative, ...updates }
    }));
  };

  // --- Persistence Logic ---
  useEffect(() => {
    if (creativeState.currentActivityName) {
      updateCreativeState({
        dataStore: {
          ...creativeState.dataStore,
          [creativeState.currentActivityName]: {
            type: creativeState.currentActivityType,
            annualPlan: creativeState.currentAnnualPlan,
            students: creativeState.activeStudents
          }
        }
      });
    }
  }, [creativeState.activeStudents, creativeState.currentAnnualPlan, creativeState.currentActivityType]);

  // Switch Activity handler
  const switchActivity = (activityName: string) => {
    if (isGlobalGenerating) {
        alert("생성 중에는 활동을 전환할 수 없습니다.");
        return;
    }

    if (activityName === creativeState.currentActivityName) return;

    const currentDataStore = { ...creativeState.dataStore };
    if (creativeState.currentActivityName) {
        currentDataStore[creativeState.currentActivityName] = {
            type: creativeState.currentActivityType,
            annualPlan: creativeState.currentAnnualPlan,
            students: creativeState.activeStudents
        };
    }

    const savedData = currentDataStore[activityName];

    if (savedData) {
        const hasGeneratedContent = savedData.students.some(s => s.generatedContent && s.generatedContent.trim().length > 0);
        const nextStep = hasGeneratedContent ? 'RESULT' : 'ACTIVITY_SETUP';

        updateCreativeState({
            dataStore: currentDataStore,
            currentActivityName: activityName,
            currentActivityType: savedData.type,
            currentAnnualPlan: savedData.annualPlan,
            activeStudents: savedData.students,
            currentStudentIndex: 0,
            step: nextStep
        });
    }
  };

  // Create new Activity
  const createNewActivity = () => {
      if (!newActivityName.trim()) {
          alert("활동명을 입력해주세요.");
          return;
      }
      if (creativeState.dataStore[newActivityName]) {
          alert("이미 존재하는 활동명입니다.");
          return;
      }

      const initializedStudents = creativeState.commonStudents.map(s => ({
          id: s.id,
          name: s.name,
          selectedTags: [],
          additionalContext: '',
          generatedContent: undefined,
          selected: false
      }));

      const currentDataStore = { ...creativeState.dataStore };
      
      if (creativeState.currentActivityName) {
          currentDataStore[creativeState.currentActivityName] = {
              type: creativeState.currentActivityType,
              annualPlan: creativeState.currentAnnualPlan,
              students: creativeState.activeStudents
          };
      }

      currentDataStore[newActivityName] = {
          type: newActivityDomain,
          annualPlan: '',
          students: initializedStudents
      };

      updateCreativeState({
          dataStore: currentDataStore,
          currentActivityName: newActivityName,
          currentActivityType: newActivityDomain,
          currentAnnualPlan: '',
          activeStudents: initializedStudents,
          currentStudentIndex: 0,
          step: 'ACTIVITY_SETUP'
      });

      setIsAddingActivity(false);
      setNewActivityName('');
      setNewActivityDomain('자율활동');
  };

  const deleteActivity = (e: React.MouseEvent, activityName: string) => {
      e.stopPropagation();
      if (!window.confirm(`'${activityName}' 활동을 정말 삭제하시겠습니까? 입력된 모든 데이터가 사라집니다.`)) return;

      const newDataStore = { ...creativeState.dataStore };
      delete newDataStore[activityName];

      let nextActivity = '';
      let nextType = '자율활동';
      let nextPlan = '';
      let nextStudents: StudentCreativeActivityData[] = [];
      let nextStep: any = 'ACTIVITY_SETUP';

      const remainingKeys = Object.keys(newDataStore);
      if (remainingKeys.length > 0) {
          nextActivity = remainingKeys[0];
          const saved = newDataStore[nextActivity];
          nextType = saved.type;
          nextPlan = saved.annualPlan;
          nextStudents = saved.students;
          
          const hasContent = nextStudents.some(s => s.generatedContent && s.generatedContent.trim().length > 0);
          nextStep = hasContent ? 'RESULT' : 'ACTIVITY_SETUP';
      } else {
           nextStudents = creativeState.commonStudents.map(s => ({
              id: s.id, name: s.name, selectedTags: [], additionalContext: '', selected: false
           }));
      }

      updateCreativeState({
          dataStore: newDataStore,
          currentActivityName: nextActivity,
          currentActivityType: nextType,
          currentAnnualPlan: nextPlan,
          activeStudents: nextStudents,
          step: nextStep
      });
  };

  const syncStudentsWithCommon = () => {
    if (!window.confirm("공통 학생 명단에 입력된 이름으로 현재 활동의 학생 이름을 업데이트하시겠습니까?\n(기존에 작성한 개별 기록은 유지됩니다.)")) {
      return;
    }

    const updatedActiveStudents = creativeState.commonStudents.map((commonStudent, index) => {
      const existingStudent = creativeState.activeStudents[index];
      if (existingStudent) {
        return { ...existingStudent, name: commonStudent.name }; 
      }
      return {
        id: commonStudent.id,
        name: commonStudent.name,
        selectedTags: [],
        additionalContext: '',
        selected: false
      };
    });

    updateCreativeState({ activeStudents: updatedActiveStudents });
  };

  const getCompletenessScore = (student: StudentCreativeActivityData): number => {
    let score = 0;
    score += student.selectedTags.length;
    score += Math.min(2, Math.floor((student.additionalContext?.length || 0) / 20));
    return score;
  };

  const renderCompletenessDots = (student: StudentCreativeActivityData) => {
    const score = getCompletenessScore(student);
    const maxDots = 5;
    const dotsToShow = Math.min(score, maxDots);
    
    if (dotsToShow === 0) return null;

    return (
      <div className="flex space-x-0.5">
        {Array.from({ length: dotsToShow }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-500 dark:bg-orange-400" />
        ))}
      </div>
    );
  };

  const handlePlanImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsAnalyzingPlan(true);
    const base64Images: string[] = [];
    const textChunks: string[] = [];
    const pdfParts: Array<{ data: string; mimeType: string }> = [];

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const name = file.name.toLowerCase();

            if (file.type.startsWith('image/')) {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                base64Images.push(base64);

            } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                pdfParts.push({ data: base64, mimeType: 'application/pdf' });

            } else if (name.endsWith('.hwpx')) {
                try {
                    const text = await extractTextFromHwpx(file);
                    if (text.trim()) textChunks.push(text.trim());
                } catch {
                    alert(`${file.name}: HWPX 텍스트 추출 실패. 다른 형식으로 시도해 주세요.`);
                }

            } else if (name.endsWith('.hwp')) {
                alert(`${file.name}: HWP(구형) 파일은 직접 읽기가 어렵습니다. HWPX 또는 PDF로 변환 후 업로드해 주세요.`);
            }
        }

        let extractedText = '';

        if (base64Images.length > 0) {
            const t = await parseAnnualPlanFromImages(base64Images);
            if (t) extractedText += (extractedText ? '\n\n' : '') + t;
        }

        if (pdfParts.length > 0) {
            const t = await parseAnnualPlanFromDocuments(pdfParts);
            if (t) extractedText += (extractedText ? '\n\n' : '') + t;
        }

        if (textChunks.length > 0) {
            extractedText += (extractedText ? '\n\n' : '') + textChunks.join('\n\n');
        }

        if (extractedText) {
            const newPlan = creativeState.currentAnnualPlan
                ? creativeState.currentAnnualPlan + '\n\n' + extractedText
                : extractedText;
            updateCreativeState({ currentAnnualPlan: newPlan });
        } else {
            alert('파일에서 내용을 추출하지 못했습니다.');
        }

    } catch (err) {
        const error = err as any;
        console.error(error instanceof Error ? error.message : String(error));
        alert('파일 분석 중 오류가 발생했습니다.');
    } finally {
        setIsAnalyzingPlan(false);
        if (planFileInputRef.current) planFileInputRef.current.value = '';
    }
  };

  const handlePlanPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) files.push(file);
        }
    }

    if (files.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        files.forEach(file => dt.items.add(file));
        await handlePlanImages(dt.files);
    }
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      updateCreativeState({ studentCount: val });
    }
  };

  const handleNameInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateCreativeState({ nameInput: e.target.value });
  };

  const initializeCommonStudents = () => {
    const names = creativeState.nameInput
      .split(/,|\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let newCommonStudents: Student[] = [];
    const count = names.length > 0 ? names.length : creativeState.studentCount;

    if (names.length > 0) {
        newCommonStudents = names.map((name, i) => ({ id: String(Date.now() + i), name }));
    } else {
        newCommonStudents = Array.from({ length: count }, (_, i) => ({ id: String(Date.now() + i), name: `학생 ${i + 1}` }));
    }

    let newDataStore = { ...creativeState.dataStore };

    setState(prev => ({
        ...prev,
        creative: {
            ...prev.creative,
            studentCount: count,
            commonStudents: newCommonStudents,
            step: 'ACTIVITY_SETUP',
            dataStore: newDataStore,
        },
        opinion: { ...prev.opinion, nameInput: creativeState.nameInput, studentCount: count },
        subject: { ...prev.subject, nameInput: creativeState.nameInput, studentCount: count },
        sports: { ...prev.sports, nameInput: creativeState.nameInput, studentCount: count }
    }));
  };

  const toggleTag = (tag: string) => {
    if (isGlobalGenerating) return;
    const newStudents = [...creativeState.activeStudents];
    const student = newStudents[creativeState.currentStudentIndex];
    
    if (student.selectedTags.includes(tag)) {
      student.selectedTags = student.selectedTags.filter(t => t !== tag);
    } else {
      student.selectedTags.push(tag);
    }
    updateCreativeState({ activeStudents: newStudents });
  };

  const handleIndividualContextChange = (text: string) => {
    const newStudents = [...creativeState.activeStudents];
    newStudents[creativeState.currentStudentIndex].additionalContext = text;
    updateCreativeState({ activeStudents: newStudents });
  };

  const toggleSelection = (index: number) => {
    if (isGlobalGenerating) return;
    const newStudents = [...creativeState.activeStudents];
    newStudents[index].selected = !newStudents[index].selected;
    updateCreativeState({ activeStudents: newStudents });
  };

  const toggleAllSelection = (checked: boolean) => {
    if (isGlobalGenerating) return;
    const newStudents = creativeState.activeStudents.map(s => ({ ...s, selected: checked }));
    updateCreativeState({ activeStudents: newStudents });
  };

  const handleGenerateAll = async () => {
    if (!creativeState.currentActivityName) return;

    startGeneration(0);
    setIsGlobalGenerating(true);
    setGlobalProgress(0);
    const newStudents = [...creativeState.activeStudents];
    let completedCount = 0;

    try {
        for (let i = 0; i < newStudents.length; i++) {
            if (isCancelRequested()) break;
            const student = newStudents[i];
            try {
              const result = await callWithAbort(() => generateCreativeActivityReport({
                  schoolLevel,
                  studentName: student.name,
                  activityName: creativeState.currentActivityName,
                  activityType: creativeState.currentActivityType,
                  annualPlan: creativeState.currentAnnualPlan || "특이사항 없음",
                  keywords: student.selectedTags,
                  additionalContext: student.additionalContext,
                  lengthOption: creativeState.lengthOption,
                  customLength: creativeState.customLength,
                  lengthUnit: creativeState.lengthUnit
              }));
              newStudents[i].generatedContent = result;
              saveHistory('creative', student.name, result);
              completedCount++;
              const pct = Math.round((completedCount / newStudents.length) * 100);
              updateProgress(pct);
              setGlobalProgress(pct);
            } catch (err) {
              if (err instanceof Error && err.message === 'CANCELLED') break;
              throw err;
            }
        }

        if (!isCancelRequested()) playSuccessSound();
        updateCreativeState({ activeStudents: newStudents, step: 'RESULT' });
    } catch (err: any) {
        if (!(err instanceof Error && err.message === 'CANCELLED')) {
          console.error(err instanceof Error ? err.message : String(err));
          alert("생성 중 오류가 발생했습니다.");
        }
        updateCreativeState({ activeStudents: newStudents, step: 'RESULT' });
    } finally {
        endGeneration();
        setIsGlobalGenerating(false);
        setGlobalProgress(0);
    }
  };

  const handleGenerateSelected = async () => {
    const selectedIndices = creativeState.activeStudents
        .map((s, i) => s.selected ? i : -1)
        .filter(i => i !== -1);

    if (selectedIndices.length === 0) {
        alert("선택된 학생이 없습니다.");
        return;
    }

    if (!creativeState.currentActivityName) return;

    startGeneration(0);
    setIsGlobalGenerating(true);
    setGlobalProgress(0);
    const newStudents = [...creativeState.activeStudents];
    let completedCount = 0;

    try {
        for (let i = 0; i < selectedIndices.length; i++) {
            if (isCancelRequested()) break;
            const index = selectedIndices[i];
            const student = newStudents[index];
            try {
              const result = await callWithAbort(() => generateCreativeActivityReport({
                  schoolLevel,
                  studentName: student.name,
                  activityName: creativeState.currentActivityName,
                  activityType: creativeState.currentActivityType,
                  annualPlan: creativeState.currentAnnualPlan || "특이사항 없음",
                  keywords: student.selectedTags,
                  additionalContext: student.additionalContext,
                  lengthOption: creativeState.lengthOption,
                  customLength: creativeState.customLength,
                  lengthUnit: creativeState.lengthUnit
              }));
              newStudents[index].generatedContent = result;
              saveHistory('creative', student.name, result);
              completedCount++;
              const pct = Math.round((completedCount / selectedIndices.length) * 100);
              updateProgress(pct);
              setGlobalProgress(pct);
            } catch (err) {
              if (err instanceof Error && err.message === 'CANCELLED') break;
              throw err;
            }
        }

        if (!isCancelRequested()) playSuccessSound();
        updateCreativeState({ activeStudents: newStudents, step: 'RESULT' });
    } catch (err: any) {
        if (!(err instanceof Error && err.message === 'CANCELLED')) {
          console.error(err instanceof Error ? err.message : String(err));
          alert("생성 중 오류가 발생했습니다.");
        }
        updateCreativeState({ activeStudents: newStudents, step: 'RESULT' });
    } finally {
        endGeneration();
        setIsGlobalGenerating(false);
        setGlobalProgress(0);
    }
  };

  const handleRegenerateOne = async (index: number) => {
    const student = creativeState.activeStudents[index];
    setGeneratingIds((prev: Set<string>) => new Set(prev).add(student.id));
    
    const avoidPhrases = student.generatedContent 
        ? student.generatedContent.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length > 10)
        : [];

    try {
      const result = await generateCreativeActivityReport({
        schoolLevel,
        studentName: student.name,
        activityName: creativeState.currentActivityName,
        activityType: creativeState.currentActivityType,
        annualPlan: creativeState.currentAnnualPlan || "특이사항 없음",
        keywords: student.selectedTags,
        additionalContext: student.additionalContext,
        lengthOption: creativeState.lengthOption,
        customLength: creativeState.customLength,
        lengthUnit: creativeState.lengthUnit,
        avoidPhrases
      });
      
      const newStudents = [...creativeState.activeStudents];
      newStudents[index].generatedContent = result;
      saveHistory('creative', creativeState.activeStudents[index].name, result);
      updateCreativeState({ activeStudents: newStudents });
    } catch (err: any) {
      const error = err;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(errorMessage);
      alert("재생성 중 오류가 발생했습니다.");
    } finally {
      setGeneratingIds((prev: Set<string>) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    }
  };

  const handleResultChange = (index: number, text: string) => {
    const newStudents = [...creativeState.activeStudents];
    newStudents[index].generatedContent = text;
    updateCreativeState({ activeStudents: newStudents });
  };

  const handleCopy = async (text: string, id: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Failed to copy text: ', errorMessage);
    }
  };

  // 현재 활동의 모든 학생 결과를 한 번에 클립보드에 복사
  const handleCopyAll = async () => {
    const text = creativeState.activeStudents
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

  const checkDuplicates = () => {
    try {
      const sentenceMap = new Map<string, string[]>();
      
      creativeState.activeStudents.forEach(student => {
        if (!student.generatedContent) return;
        const sentences = student.generatedContent
          .replace(/([.?!])\s+/g, "$1|")
          .split("|")
          .map(s => s.trim())
          .filter(s => s.length > 10);

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
    } catch (error) {
      console.error("Duplicate check error:", String(error));
      alert("중복 검사 중 오류가 발생했습니다.");
    }
  };

  const downloadExcel = async () => {
    try {
        const rows: string[][] = [];
        const header = ['활동유형', '활동명', '학생명', '생성된 특기사항', '연간계획', '선택된 키워드', '개별 활동내용'];
        Object.keys(creativeState.dataStore).forEach(actName => {
            const data = creativeState.dataStore[actName];
            const type = data.type || '기타';
            data.students.forEach(s => {
                rows.push([type, actName, s.name, s.generatedContent || '', data.annualPlan || '', (s.selectedTags || []).join(', '), s.additionalContext || '']);
            });
        });
        if (rows.length === 0) { alert("다운로드할 데이터가 없습니다."); return; }
        const csvContent = [header, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        await window.electronAPI.saveCsv(csvContent, `창체특기사항_전체_${new Date().toISOString().slice(0,10)}.csv`);
    } catch (e) {
        console.error("CSV download error:", e);
        alert("파일 생성 중 오류가 발생했습니다.");
    }
  };

  const renderActivityTabs = () => {
      const tabs = Object.keys(creativeState.dataStore);
      if (tabs.length === 0 && !creativeState.currentActivityName) return null;
      const allTabs = [...tabs];
      if (creativeState.currentActivityName && !allTabs.includes(creativeState.currentActivityName)) {
          allTabs.push(creativeState.currentActivityName);
      }
      return (
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {allTabs.map((act) => (
                <div key={act} className="relative group">
                    <button
                        onClick={() => switchActivity(act)}
                        disabled={isGlobalGenerating}
                        className={`px-4 py-2 pr-8 rounded-lg text-sm font-bold whitespace-nowrap transition-all border ${
                            creativeState.currentActivityName === act
                                ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                        } ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {act}
                    </button>
                    <button
                        onClick={(e) => deleteActivity(e, act)}
                        disabled={isGlobalGenerating}
                        className={`absolute right-1 top-1/2 transform -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-white hover:bg-red-500/50 transition-colors ${isGlobalGenerating ? 'hidden' : ''}`}
                        title="활동 삭제"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>
            ))}
            {!isAddingActivity ? (
                <button
                    onClick={() => {
                        if (isGlobalGenerating) return;
                        setIsAddingActivity(true);
                    }}
                    disabled={isGlobalGenerating}
                    className={`px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center whitespace-nowrap ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mr-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    활동 추가
                </button>
            ) : (
                <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-orange-500/50 rounded-lg p-1 animate-in fade-in zoom-in duration-200 shadow-lg">
                    <select
                        value={newActivityDomain}
                        onChange={(e) => setNewActivityDomain(e.target.value)}
                        className="text-xs py-1 pl-2 pr-6 border-none bg-slate-100 dark:bg-slate-700 rounded focus:ring-0 text-slate-800 dark:text-white cursor-pointer"
                    >
                        {ACTIVITY_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input 
                        type="text" 
                        value={newActivityName}
                        onChange={(e) => setNewActivityName(e.target.value)}
                        placeholder="새 활동명"
                        className="text-xs py-1 px-2 w-24 border-none focus:ring-0 bg-transparent text-slate-800 dark:text-white"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') createNewActivity();
                            if (e.key === 'Escape') setIsAddingActivity(false);
                        }}
                    />
                    <button onClick={createNewActivity} className="p-1 text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                    </button>
                    <button onClick={() => setIsAddingActivity(false)} className="p-1 text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/30 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                    </button>
                </div>
            )}
        </div>
      );
  };

  const nextStep = () => {
    if (creativeState.step === 'STUDENT_SETUP') {
        initializeCommonStudents();
    } else if (creativeState.step === 'ACTIVITY_SETUP') {
        const actName = creativeState.currentActivityName.trim();
        if (!actName) {
            alert("활동명을 입력해주세요.");
            return;
        }
        
        // Ensure activeStudents is automatically populated from commonStudents if it's empty
        let studentsToUse = creativeState.activeStudents;
        if (studentsToUse.length === 0 || (creativeState.commonStudents.length > 0 && studentsToUse.length !== creativeState.commonStudents.length)) {
            studentsToUse = creativeState.commonStudents.map(s => ({
                id: s.id,
                name: s.name,
                selectedTags: [],
                additionalContext: '',
                selected: false
            }));
        }

        updateCreativeState({ 
            step: 'INDIVIDUAL_CONTEXT', 
            currentStudentIndex: 0,
            activeStudents: studentsToUse
        });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 h-full flex flex-col transition-colors relative">
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex justify-between items-center">
            <div className="flex items-center">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 mr-3 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                </div>
                <div>
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">창의적 체험활동 특기사항</h2>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:flex">
                        <span className={creativeState.step === 'STUDENT_SETUP' ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}>1. 인원 설정</span>
                        <span>&gt;</span>
                        <span className={creativeState.step === 'ACTIVITY_SETUP' ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}>2. 활동 설정</span>
                        <span>&gt;</span>
                        <span className={creativeState.step === 'INDIVIDUAL_CONTEXT' ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}>3. 개별 기록</span>
                        <span>&gt;</span>
                        <span className={creativeState.step === 'RESULT' ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}>4. 결과</span>
                    </div>
                </div>
            </div>
            {creativeState.step === 'RESULT' && (
              <button 
                onClick={() => updateCreativeState({ step: 'INDIVIDUAL_CONTEXT' })} 
                disabled={isGlobalGenerating}
                className={`text-sm text-slate-500 underline hover:text-orange-600 ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                  수정하기
              </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
         {creativeState.step === 'STUDENT_SETUP' && (
             <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl mx-auto space-y-8">
                    <div>
                        <label className="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-4">
                            생성할 전체 학생 수는 몇 명인가요?
                        </label>
                        <div className="flex items-center space-x-4 bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 justify-center">
                            <button onClick={() => updateCreativeState({ studentCount: Math.max(1, creativeState.studentCount - 1) })} className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm text-xl">-</button>
                            <input
                                type="number"
                                value={creativeState.studentCount}
                                onChange={handleCountChange}
                                className="w-32 text-center text-3xl font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 dark:text-white"
                            />
                            <button onClick={() => updateCreativeState({ studentCount: creativeState.studentCount + 1 })} className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm text-xl">+</button>
                        </div>
                    </div>
                    
                    <div>
                        <div className="mb-4">
                             <label className="block text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">
                                학생 이름을 입력해주세요
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                학생 이름을 쉼표(,)로 구분하거나, <strong>엑셀/스프레드시트에서 복사해 붙여넣기</strong>할 수 있습니다.<br/>
                                <span className="text-orange-600 dark:text-orange-400 font-medium">(예: 김철수, 이영희, 박민수)</span>
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                const raw = await window.electronAPI.getConfig('studentNames') as string;
                                if (!raw) return;
                                const names = raw.split('\n').map((l: string) => l.replace(/^\d+[.\s)]+/, '').trim()).filter((l: string) => l.length > 0);
                                if (names.length === 0) return;
                                updateCreativeState({ nameInput: names.join(', '), studentCount: names.length });
                            }}
                            className="mb-2 px-4 py-2 text-sm font-bold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700 rounded-lg hover:bg-orange-100 transition-colors"
                        >
                            우리반 학생 이름 자동 입력
                        </button>
                        <textarea
                            value={creativeState.nameInput}
                            onChange={handleNameInput}
                            placeholder="학생 1, 학생 2, 학생 3..."
                            className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:outline-none resize-none shadow-inner"
                        />
                    </div>

                    <button 
                        onClick={initializeCommonStudents}
                        className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg transition-colors text-lg mt-8"
                    >
                        다음: 활동 정보 입력
                    </button>
                </div>
            </div>
        )}

        {creativeState.step === 'ACTIVITY_SETUP' && (
             <div className="flex-1 overflow-y-auto p-6">
                 <div className="max-w-4xl mx-auto space-y-6">
                     <div className="mb-4">
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">작업 중인 활동</label>
                         {renderActivityTabs()}
                     </div>

                     <div className="p-6 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-800/30">
                         <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">활동 기본 정보 설정</h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                             <div>
                                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">활동명</label>
                                 <input
                                     type="text"
                                     value={creativeState.currentActivityName}
                                     onChange={(e) => updateCreativeState({ currentActivityName: e.target.value })}
                                     className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 dark:text-white"
                                     placeholder="예: 1학기 자율활동"
                                 />
                             </div>
                             <div>
                                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">활동 유형</label>
                                 <select
                                     value={creativeState.currentActivityType}
                                     onChange={(e) => updateCreativeState({ currentActivityType: e.target.value })}
                                     className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 dark:text-white cursor-pointer"
                                 >
                                     {ACTIVITY_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                                 </select>
                             </div>
                         </div>

                         <div className="mb-4">
                             <div className="flex justify-between items-center mb-2">
                                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">연간 지도 계획 (공통 활동 내용)</label>
                                 <div className="flex gap-2">
                                     <input 
                                         type="file" 
                                         ref={planFileInputRef}
                                         className="hidden" 
                                         accept="image/*,.pdf,.hwpx,.hwp"
                                         multiple
                                         onChange={(e) => handlePlanImages(e.target.files)}
                                     />
                                     <button 
                                         onClick={() => planFileInputRef.current?.click()}
                                         disabled={isAnalyzingPlan}
                                         className="px-3 py-1 bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center"
                                     >
                                         {isAnalyzingPlan ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                분석 중...
                                            </>
                                         ) : '📂 파일에서 추출 (이미지/PDF/HWPX)'}
                                     </button>
                                 </div>
                             </div>
                             <textarea
                                 value={creativeState.currentAnnualPlan}
                                 onChange={(e) => updateCreativeState({ currentAnnualPlan: e.target.value })}
                                 onPaste={handlePlanPaste}
                                 placeholder="활동의 연간 계획이나 주요 활동 내용을 입력하세요. (이미지를 붙여넣기 하거나 업로드하여 텍스트를 추출할 수 있습니다.)"
                                 className="w-full h-48 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 dark:text-white resize-y text-sm"
                             />
                         </div>
                     </div>
                     
                     <div className="flex gap-4">
                        <button onClick={() => updateCreativeState({ step: 'STUDENT_SETUP' })} className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">이전</button>
                        <button onClick={nextStep} className="flex-[2] py-4 bg-orange-500 text-white font-bold rounded-xl shadow-lg hover:bg-orange-600 transition-all">
                            다음: 학생별 특기사항 입력
                        </button>
                     </div>
                 </div>
             </div>
        )}

        {creativeState.step === 'INDIVIDUAL_CONTEXT' && (
             <div className="flex-1 flex overflow-hidden flex-col">
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 pt-3 pb-0">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">활동 전환</label>
                    {renderActivityTabs()}
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className={`w-1/4 min-w-[200px] bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 overflow-y-auto ${isGlobalGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                            <button
                                onClick={syncStudentsWithCommon}
                                disabled={isGlobalGenerating}
                                className={`w-full py-2 px-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors flex items-center justify-center gap-1.5 ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                공통 명단 불러오기
                            </button>
                        </div>
                        
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">학생 목록</h3>
                                <label className="flex items-center space-x-1 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={creativeState.activeStudents.length > 0 && creativeState.activeStudents.every(s => s.selected)}
                                        onChange={(e) => toggleAllSelection(e.target.checked)}
                                        className="w-3 h-3 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                    />
                                    <span className="text-[10px] text-slate-500">전체</span>
                                </label>
                            </div>
                            <div className="space-y-1">
                                {creativeState.activeStudents.map((student, idx) => (
                                    <div key={student.id} className="flex items-center space-x-2">
                                        <input 
                                            type="checkbox" 
                                            checked={student.selected || false}
                                            onChange={() => toggleSelection(idx)}
                                            className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                        />
                                        <button
                                            onClick={() => updateCreativeState({ currentStudentIndex: idx })}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                creativeState.currentStudentIndex === idx
                                                ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
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

                    <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-800">
                        <div className="max-w-4xl mx-auto space-y-8">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                    <span className="text-orange-600 dark:text-orange-400">{creativeState.activeStudents[creativeState.currentStudentIndex].name}</span> 활동 내용 입력
                                </h3>
                                <div className="text-sm text-slate-500">{creativeState.currentStudentIndex + 1} / {creativeState.activeStudents.length}</div>
                            </div>
                            
                            {/* Tags Selection */}
                            <div className="space-y-6">
                                {/* Roles */}
                                <div>
                                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-sm">임원 및 역할 (Roles)</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {CREATIVE_ACTIVITY_TAGS.filter(t => t.category === 'role').map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleTag(tag.label)}
                                                disabled={isGlobalGenerating}
                                                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left truncate disabled:cursor-not-allowed ${
                                                    creativeState.activeStudents[creativeState.currentStudentIndex].selectedTags.includes(tag.label)
                                                    ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500 dark:ring-orange-400'
                                                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600'
                                                }`}
                                            >
                                                {tag.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Activities */}
                                <div>
                                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-sm">주요 활동 (Activities)</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                                        {CREATIVE_ACTIVITY_TAGS.filter(t => t.category === 'activity').map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleTag(tag.label)}
                                                disabled={isGlobalGenerating}
                                                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left truncate disabled:cursor-not-allowed ${
                                                    creativeState.activeStudents[creativeState.currentStudentIndex].selectedTags.includes(tag.label)
                                                    ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500 dark:ring-orange-400'
                                                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600'
                                                }`}
                                            >
                                                {tag.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Competencies */}
                                <div>
                                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-sm">역량 및 태도 (Competencies)</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {CREATIVE_ACTIVITY_TAGS.filter(t => t.category === 'competency').map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleTag(tag.label)}
                                                disabled={isGlobalGenerating}
                                                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left truncate disabled:cursor-not-allowed ${
                                                    creativeState.activeStudents[creativeState.currentStudentIndex].selectedTags.includes(tag.label)
                                                    ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500 dark:ring-orange-400'
                                                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600'
                                                }`}
                                            >
                                                {tag.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Additional Context */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">개별 관찰 내용 (선택)</label>
                                <textarea
                                    value={creativeState.activeStudents[creativeState.currentStudentIndex].additionalContext}
                                    onChange={(e) => handleIndividualContextChange(e.target.value)}
                                    disabled={isGlobalGenerating}
                                    placeholder="학생의 구체적인 역할, 기여도, 변화 등 개별적인 특이사항을 입력하세요."
                                    className="w-full h-32 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50 dark:bg-slate-700 resize-none disabled:opacity-50 text-sm"
                                />
                            </div>

                            {/* Length Settings */}
                            <div className={`p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 ${isGlobalGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300">생성 길이 설정 (전체 적용)</label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex space-x-3">
                                            {(['100', '200', '300', '400', '500', 'custom'] as LengthOption[]).map((opt) => (
                                                <label key={opt} className="flex items-center cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="creativeLength" 
                                                        value={opt} 
                                                        checked={creativeState.lengthOption === opt} 
                                                        onChange={() => updateCreativeState({ lengthOption: opt })}
                                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                                                    />
                                                    <span className="ml-1.5 text-sm text-slate-600 dark:text-slate-400">
                                                        {opt === 'custom' ? '직접' : opt}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        {creativeState.lengthOption === 'custom' && (
                                            <input 
                                                type="number"
                                                value={creativeState.customLength}
                                                onChange={(e) => updateCreativeState({ customLength: Number(e.target.value) })}
                                                className="w-20 px-2 py-1 text-sm border rounded bg-white dark:bg-slate-600 dark:text-white"
                                            />
                                        )}
                                        <div className="flex bg-white dark:bg-slate-600 rounded-lg p-0.5 border border-slate-200 dark:border-slate-500">
                                             <button onClick={() => updateCreativeState({ lengthUnit: '자' })} className={`px-2 py-0.5 text-xs rounded ${creativeState.lengthUnit === '자' ? 'bg-orange-100 text-orange-700' : 'text-slate-500'}`}>자</button>
                                             <button onClick={() => updateCreativeState({ lengthUnit: 'byte' })} className={`px-2 py-0.5 text-xs rounded ${creativeState.lengthUnit === 'byte' ? 'bg-orange-100 text-orange-700' : 'text-slate-500'}`}>byte</button>
                                        </div>
                                    </div>
                                 </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => updateCreativeState({ step: 'ACTIVITY_SETUP' })}
                                        disabled={isGlobalGenerating}
                                        className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                    >
                                        이전 (활동 설정)
                                    </button>
                                    <button
                                        onClick={handleGenerateSelected}
                                        disabled={isGlobalGenerating}
                                        className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center whitespace-nowrap px-1 text-sm sm:text-base"
                                    >
                                        {isGlobalGenerating ? '생성 중...' : `선택 학생(${creativeState.activeStudents.filter(s => s.selected).length}명) 생성`}
                                    </button>
                                    <button
                                        onClick={handleGenerateAll}
                                        disabled={isGlobalGenerating}
                                        className="flex-[2] bg-gradient-to-r from-orange-600 to-amber-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center whitespace-nowrap px-1 text-sm sm:text-base"
                                    >
                                        {isGlobalGenerating ? (
                                            '생성 중...'
                                        ) : (
                                            `전체 학생(${creativeState.activeStudents.length}명) 생성`
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
             </div>
        )}

        {creativeState.step === 'RESULT' && (
             <div className="flex-1 overflow-hidden flex flex-col">
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 pt-3 pb-0">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">활동 전환 (결과 화면)</label>
                    {renderActivityTabs()}
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center flex-wrap gap-2">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">
                        <span className="text-orange-600 dark:text-orange-400">[{creativeState.currentActivityName}]</span> 생성 결과
                    </h3>
                    <div className="flex items-center gap-2">
                         <button
                            onClick={handleCopyAll}
                            disabled={isGlobalGenerating}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center shadow-md ${
                                copiedId === '__ALL__'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-600 text-white hover:bg-slate-700'
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
                            onClick={downloadExcel}
                            disabled={isGlobalGenerating}
                            className={`px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors flex items-center shadow-md ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            전체 엑셀 다운로드
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {creativeState.activeStudents.map((student, idx) => (
                        <div key={student.id} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                             <div className="flex justify-between mb-4">
                                <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center">
                                    <span className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mr-3 text-sm">
                                        {idx + 1}
                                    </span>
                                    {student.name}
                                </h4>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleCopy(student.generatedContent || '', student.id)}
                                        disabled={isGlobalGenerating}
                                        className={`text-sm font-medium flex items-center px-3 py-1.5 rounded-lg transition-colors border ${
                                            copiedId === student.id
                                            ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-400'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600'
                                        } ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {copiedId === student.id ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1.5 text-orange-600 dark:text-orange-400">
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
                                      const hist = getHistory('creative', student.name);
                                      return hist.length > 0 ? (
                                        <button
                                          onClick={() => setExpandedHistory(prev => {
                                            const next = new Set(prev);
                                            next.has(student.id) ? next.delete(student.id) : next.add(student.id);
                                            return next;
                                          })}
                                          className="text-sm font-medium flex items-center px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                                        >
                                          이전 기록 ({hist.length})
                                        </button>
                                      ) : null;
                                    })()}
                                    <button
                                        onClick={() => handleRegenerateOne(idx)}
                                        disabled={generatingIds.has(student.id) || isGlobalGenerating}
                                        className={`text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium flex items-center px-3 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors ${(generatingIds.has(student.id) || isGlobalGenerating) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                    className="w-full min-h-[120px] p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-y text-sm leading-relaxed"
                                 />
                                 <div className="absolute bottom-3 right-3 text-xs text-slate-400 pointer-events-none">
                                     {(student.generatedContent || '').length}자
                                 </div>
                             </div>
                             {expandedHistory.has(student.id) && (() => {
                               const hist: HistoryEntry[] = getHistory('creative', student.name);
                               return hist.length > 0 ? (
                                 <div className="mt-3 space-y-2">
                                   <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">이전 생성 기록</p>
                                   {hist.map((entry, hi) => (
                                     <div key={hi} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 text-sm text-slate-600 dark:text-slate-400">
                                       <div className="flex justify-between items-center mb-1">
                                         <span className="text-xs text-slate-400">{new Date(entry.date).toLocaleString('ko-KR')}</span>
                                         <button
                                           onClick={() => { handleResultChange(idx, entry.content); setExpandedHistory(prev => { const next = new Set(prev); next.delete(student.id); return next; }); }}
                                           className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
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
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                            <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mr-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </span>
                            중복 표현 검사 결과
                        </h3>
                        <button onClick={() => setShowDuplicateModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1">
                        {duplicateResults.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-4 text-orange-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">중복된 표현이 발견되지 않았습니다!</p>
                                <p className="text-sm mt-1">모든 학생의 내용이 다양하게 작성되었습니다.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    다음 문장들이 2명 이상의 학생에게서 발견되었습니다. 내용을 수정하여 다양성을 높여주세요.
                                </p>
                                {duplicateResults.map((result, idx) => (
                                    <div key={idx} className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                        <p className="font-bold text-slate-800 dark:text-slate-200 mb-2">"{result.sentence}"</p>
                                        <div className="flex flex-wrap gap-2">
                                            {result.students.map(name => (
                                                <span key={name} className="px-2 py-1 bg-white dark:bg-slate-700 text-xs rounded border border-amber-200 dark:border-amber-800 text-slate-600 dark:text-slate-300">
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex justify-end">
                        <button
                            onClick={() => setShowDuplicateModal(false)}
                            className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors"
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

export default CreativeActivityGenerator;
