import React, { useState, useRef, useEffect } from 'react';
import { notifyToast } from '../lib/toast';
import { HelpCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTour } from '../TourContext';
import { SchoolLevel, AssessmentTask, LengthOption, LengthUnit, StudentSubjectData, ObservationDetails, AppMode } from '../types';
import { generateSubjectReport, parseAssessmentTasks, parseNeisGradeFiles, parseStudentObservationFromFiles } from '../services/geminiService';
import { ELEMENTARY_SUBJECT_LIST, SECONDARY_SUBJECT_LIST } from '../constants';
import { useGlobalState } from '../GlobalStateContext';
import { queueViolationWarning } from '../lib/guidelineCompliance';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { playSuccessSound } from '../lib/soundEffect';
import { saveHistory, getHistory, HistoryEntry } from '../lib/generationHistory';
import { getStudentGenerationExtras } from '../lib/generationSafety';
import { prepareAndRunWithAbort } from '../lib/cancellation';
import { loadByteLimits, DEFAULT_BYTE_LIMITS, RecordKind } from '../lib/textLength';
import { toCsv } from '../lib/csv';
import { ByteCountBadge } from './ByteCountBadge';
import { loadStudentRoster, RosterEntry } from '../lib/studentRoster';
import { RosterNameHint } from './RosterNameHint';
import { copyPlainTextToClipboard } from '../lib/clipboard';

interface Props {
  schoolLevel: SchoolLevel;
}

interface DuplicateResult {
  sentence: string;
  students: string[];
}

const EMPTY_OBSERVATION_DETAILS: ObservationDetails = { process: '', attitude: '', skill: '', example: '' };

// 관찰 세부 항목 네 가지를 사용자가 보는 '추가 관찰내용' 문단으로 합친다.
const buildContextFromDetails = (details: ObservationDetails): string => {
  const parts: string[] = [];
  if (details.process) parts.push(`[개별 학습 과정]: ${details.process}`);
  if (details.attitude) parts.push(`[태도 및 참여]: ${details.attitude}`);
  if (details.skill) parts.push(`[기능 발달]: ${details.skill}`);
  if (details.example) parts.push(`[구체적 사례]: ${details.example}`);
  return parts.join('\n\n');
};

const SubjectGenerator: React.FC<Props> = ({ schoolLevel }) => {
  const { startTour } = useTour();
  const { state, setState, isGlobalGenerating, setIsGlobalGenerating, globalProgress, setGlobalProgress, showToast } = useGlobalState();
  const { startGeneration, updateProgress, endGeneration, isCancelRequested, callWithAbort } = useGenerationTracker(AppMode.SUBJECT_GENERATOR);
  const subjectState = state.subject;

  // Local UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const wasGenerating = useRef(false);

  useEffect(() => {
    const isNow = generatingIds.size > 0;
    if (isNow && !wasGenerating.current) { startGeneration(); wasGenerating.current = true; }
    else if (!isNow && wasGenerating.current) { endGeneration(); wasGenerating.current = false; }
  }, [generatingIds.size]);
  const [uploadedFile, setUploadedFile] = useState<{data: string, type: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateResults, setDuplicateResults] = useState<DuplicateResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [studentPanelCollapsed, setStudentPanelCollapsed] = useState(false);

  // NEIS Upload States
  const [showNeisModal, setShowNeisModal] = useState(false);
  const [neisFile1, setNeisFile1] = useState<{name: string, data: string, type: string} | null>(null);
  const [neisFile2, setNeisFile2] = useState<{name: string, data: string, type: string} | null>(null);
  const [isAnalyzingNeis, setIsAnalyzingNeis] = useState(false);

  const currentSubjectList = schoolLevel === SchoolLevel.ELEMENTARY 
    ? ELEMENTARY_SUBJECT_LIST 
    : SECONDARY_SUBJECT_LIST;

  // Helpers to update global state
  const updateSubjectState = (updates: Partial<typeof state.subject>) => {
    setState(prev => ({
      ...prev,
      subject: { ...prev.subject, ...updates }
    }));
  };

  // --- Persistence Logic ---

  // Persist active data to dataStore whenever active data changes
  useEffect(() => {
    if (subjectState.currentSubject) {
      updateSubjectState({
        dataStore: {
          ...subjectState.dataStore,
          [subjectState.currentSubject]: {
            tasks: subjectState.activeTasks,
            students: subjectState.activeStudents
          }
        }
      });
    }
  }, [subjectState.activeTasks, subjectState.activeStudents]); 

  // Switch subject handler
  const switchSubject = (newSubject: string) => {
    if (isGlobalGenerating) {
        notifyToast({ type: 'warning', title: "생성 중에는 교과목을 전환할 수 없습니다." });
        return;
    }

    if (newSubject === subjectState.currentSubject) return;
    
    const currentDataStore = { ...subjectState.dataStore };
    if (subjectState.currentSubject) {
        currentDataStore[subjectState.currentSubject] = {
            tasks: subjectState.activeTasks,
            students: subjectState.activeStudents
        };
    }

    const savedData = currentDataStore[newSubject];
    
    if (savedData) {
      const hasGeneratedContent = savedData.students.some(s => s.generatedContent && s.generatedContent.trim().length > 0);
      const nextStep = hasGeneratedContent ? 'RESULT' : 'INDIVIDUAL_CONTEXT'; 

      updateSubjectState({
        dataStore: currentDataStore,
        currentSubject: newSubject,
        activeTasks: savedData.tasks,
        activeStudents: savedData.students,
        currentStudentIndex: 0,
        isDirectInput: !currentSubjectList.includes(newSubject),
        step: nextStep
      });
    } else {
        const initializedStudents = subjectState.commonStudents.map(s => ({
            id: s.id,
            name: s.name,
            additionalContext: '',
            observationDetails: { process: '', attitude: '', skill: '', example: '' },
            evaluations: [],
            generatedContent: undefined,
            selected: false
        }));

        updateSubjectState({
            dataStore: currentDataStore,
            currentSubject: newSubject,
            activeTasks: [{ id: (Date.now()).toString(), task: '', level: '상' }],
            activeStudents: initializedStudents,
            currentStudentIndex: 0,
            isDirectInput: !currentSubjectList.includes(newSubject),
            step: 'INDIVIDUAL_CONTEXT'
        });
    }
  };
  
  const createNewSubject = (subjName: string) => {
      const initializedStudents = subjectState.commonStudents.map(s => ({
        id: s.id,
        name: s.name,
        additionalContext: '',
        observationDetails: { process: '', attitude: '', skill: '', example: '' },
        evaluations: [],
        generatedContent: undefined,
        selected: false
      }));

      const newTasks = [{ id: (Date.now()).toString(), task: '', level: '상' as const }];
      
      setState(prev => ({
          ...prev,
          subject: {
              ...prev.subject,
              currentSubject: subjName,
              activeTasks: newTasks,
              activeStudents: initializedStudents,
              currentStudentIndex: 0,
              isDirectInput: !currentSubjectList.includes(subjName),
              step: 'GLOBAL_SETUP', 
              dataStore: {
                  ...prev.subject.dataStore,
                  [subjName]: {
                      tasks: newTasks,
                      students: initializedStudents
                  }
              }
          }
      }));
  };

  const deleteSubject = (e: React.MouseEvent, subjectName: string) => {
      e.stopPropagation();
      if (!window.confirm(`'${subjectName}' 과목을 정말 삭제하시겠습니까? 입력된 모든 데이터가 사라집니다.`)) return;

      const newDataStore = { ...subjectState.dataStore };
      delete newDataStore[subjectName];

      let nextSubject = '';
      let nextTasks: AssessmentTask[] = [{ id: (Date.now()).toString(), task: '', level: '상' }];
      let nextStudents: StudentSubjectData[] = subjectState.commonStudents.map(s => ({
          id: s.id,
          name: s.name,
          additionalContext: '',
          observationDetails: { process: '', attitude: '', skill: '', example: '' },
          evaluations: [],
          generatedContent: undefined,
          selected: false
      }));
      let nextStep: any = 'GLOBAL_SETUP';
      let isDirect = false;

      const remainingKeys = Object.keys(newDataStore);
      if (remainingKeys.length > 0) {
          nextSubject = remainingKeys[0];
          const savedData = newDataStore[nextSubject];
          nextTasks = savedData.tasks;
          nextStudents = savedData.students;
          const hasContent = nextStudents.some(s => s.generatedContent && s.generatedContent.trim().length > 0);
          nextStep = hasContent ? 'RESULT' : 'INDIVIDUAL_CONTEXT';
          isDirect = !currentSubjectList.includes(nextSubject);
      }

      updateSubjectState({
          dataStore: newDataStore,
          currentSubject: nextSubject,
          activeTasks: nextTasks,
          activeStudents: nextStudents,
          step: nextStep,
          isDirectInput: isDirect
      });
  };

  const syncStudentsWithCommon = () => {
    if (!window.confirm("공통 학생 명단에 입력된 이름으로 현재 과목의 학생 이름을 업데이트하시겠습니까?\n(기존에 작성한 세특 내용과 평가 데이터는 유지됩니다.)")) {
      return;
    }

    const updatedActiveStudents = subjectState.commonStudents.map((commonStudent, index) => {
      const existingStudent = subjectState.activeStudents[index];
      if (existingStudent) {
        return { ...existingStudent, name: commonStudent.name }; 
      }
      return {
        id: commonStudent.id,
        name: commonStudent.name,
        additionalContext: '',
        observationDetails: { process: '', attitude: '', skill: '', example: '' },
        evaluations: [],
        selected: false
      };
    });

    updateSubjectState({ activeStudents: updatedActiveStudents });
  };

  const getCompletenessScore = (student: StudentSubjectData): number => {
    let score = 0;
    score += (student.evaluations?.length || 0);
    if (student.observationDetails) {
        if (student.observationDetails.process) score += 1;
        if (student.observationDetails.attitude) score += 1;
        if (student.observationDetails.skill) score += 1;
        if (student.observationDetails.example) score += 1;
    } else {
        score += Math.min(2, Math.floor((student.additionalContext?.length || 0) / 20));
    }
    return score;
  };

  const renderCompletenessDots = (student: StudentSubjectData) => {
    const score = getCompletenessScore(student);
    const maxDots = 5;
    const dotsToShow = Math.min(score, maxDots);
    
    if (dotsToShow === 0) return null;

    return (
      <div className="flex space-x-0.5">
        {Array.from({ length: dotsToShow }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400" />
        ))}
      </div>
    );
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      updateSubjectState({ studentCount: val });
    }
  };

  const handleNameInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateSubjectState({ nameInput: e.target.value });
  };

  const initializeCommonStudents = () => {
    const names = subjectState.nameInput
      .split(/,|\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let newCommonStudents: StudentSubjectData[] = [];
    const count = names.length > 0 ? names.length : subjectState.studentCount;

    if (names.length > 0) {
      newCommonStudents = names.map((name, i) => ({
        id: String(Date.now() + i),
        name: name,
        additionalContext: '',
        observationDetails: { process: '', attitude: '', skill: '', example: '' },
        evaluations: [],
        selected: false
      }));
    } else {
      newCommonStudents = Array.from({ length: count }, (_, i) => ({
        id: String(Date.now() + i),
        name: `학생 ${i + 1}`,
        additionalContext: '',
        observationDetails: { process: '', attitude: '', skill: '', example: '' },
        evaluations: [],
        selected: false
      }));
    }

    setState(prev => ({
        ...prev,
        subject: {
            ...prev.subject,
            studentCount: count,
            commonStudents: newCommonStudents,
            step: 'GLOBAL_SETUP'
        },
        opinion: { ...prev.opinion, nameInput: subjectState.nameInput, studentCount: count },
        sports: { ...prev.sports, nameInput: subjectState.nameInput, studentCount: count },
        creative: { ...prev.creative, nameInput: subjectState.nameInput, studentCount: count }
    }));
  };

  const handleNeisUpload = (e: React.ChangeEvent<HTMLInputElement>, semester: 1 | 2) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          const fileData = { name: file.name, data: base64Data, type: file.type };
          if (semester === 1) setNeisFile1(fileData);
          else setNeisFile2(fileData);
      };
      reader.readAsDataURL(file);
  };

  const handleNeisAnalysis = async () => {
      if (!neisFile1 && !neisFile2) {
          notifyToast({ type: 'warning', title: "최소한 하나의 파일을 업로드해주세요." });
          return;
      }

      setIsAnalyzingNeis(true);
      try {
          const filesToAnalyze = [];
          if (neisFile1) filesToAnalyze.push({ data: neisFile1.data, mimeType: neisFile1.type });
          if (neisFile2) filesToAnalyze.push({ data: neisFile2.data, mimeType: neisFile2.type });

          const results = await parseNeisGradeFiles(filesToAnalyze);
          
          if (!results || results.length === 0) {
              notifyToast({ type: 'warning', title: "분석된 결과가 없습니다. 파일 내용을 확인해주세요." });
              return;
          }

          const allStudentNames = new Set<string>();
          results.forEach(res => {
              res.students.forEach(s => allStudentNames.add(s.name));
          });
          const studentList = Array.from(allStudentNames).sort();
          
          const newCommonStudents = studentList.map((name, i) => ({
              id: String(Date.now() + i),
              name: name
          }));

          const newDataStore: any = {};
          
          results.forEach(res => {
              const subjectKey = res.subject;
              
              if (!newDataStore[subjectKey]) {
                  newDataStore[subjectKey] = {
                      tasks: [],
                      students: newCommonStudents.map(s => ({
                          id: s.id,
                          name: s.name,
                          additionalContext: '',
                          observationDetails: { process: '', attitude: '', skill: '', example: '' },
                          evaluations: [],
                          selected: false
                      }))
                  };
              }

              const currentTaskCount = newDataStore[subjectKey].tasks.length;
              const newTasks = res.tasks.map((t, i) => ({
                  id: `${Date.now()}-${subjectKey}-${currentTaskCount + i}`,
                  task: t,
                  level: '상' 
              }));
              newDataStore[subjectKey].tasks.push(...newTasks);

              res.students.forEach(s => {
                  const targetStudent = newDataStore[subjectKey].students.find((st: any) => st.name === s.name);
                  if (targetStudent) {
                      s.evaluations.forEach((grade, idx) => {
                          if (newTasks[idx]) { 
                              targetStudent.evaluations.push({
                                  id: newTasks[idx].id,
                                  level: grade
                              });
                          }
                      });
                  }
              });
          });

          const firstSubject = Object.keys(newDataStore)[0] || '';
          
          setState(prev => ({
              ...prev,
              subject: {
                  ...prev.subject,
                  studentCount: newCommonStudents.length,
                  commonStudents: newCommonStudents,
                  nameInput: newCommonStudents.map(s => s.name).join(', '),
                  dataStore: newDataStore,
                  currentSubject: firstSubject,
                  activeTasks: newDataStore[firstSubject]?.tasks || [],
                  activeStudents: newDataStore[firstSubject]?.students || [],
                  step: 'GLOBAL_SETUP',
                  isDirectInput: !currentSubjectList.includes(firstSubject)
              },
              opinion: { ...prev.opinion, nameInput: newCommonStudents.map(s => s.name).join(', '), studentCount: newCommonStudents.length },
              sports: { ...prev.sports, nameInput: newCommonStudents.map(s => s.name).join(', '), studentCount: newCommonStudents.length },
              creative: { ...prev.creative, nameInput: newCommonStudents.map(s => s.name).join(', '), studentCount: newCommonStudents.length }
          }));

          setShowNeisModal(false);
          notifyToast({ type: 'success', title: "나이스 자료 분석이 완료되었습니다. 과제 및 평가 결과를 확인해주세요." });

      } catch (err: any) {
          const error = err;
          console.error(error);
          notifyToast({ type: 'error', title: "분석 중 오류가 발생했습니다: " + error.message });
      } finally {
          setIsAnalyzingNeis(false);
      }
  };

  const handleSubjectChange = (val: string, isDirect: boolean) => {
      if (val && !isDirect) {
          if (subjectState.dataStore[val]) {
              switchSubject(val);
          } else {
              createNewSubject(val);
          }
      } else if (isDirect) {
          if (subjectState.isDirectInput) {
               updateSubjectState({ currentSubject: val });
          } else {
              updateSubjectState({ isDirectInput: true, currentSubject: '' });
          }
      }
  };

  const addTask = () => {
    const newId = (Date.now()).toString() + Math.random().toString(36).substr(2, 5);
    updateSubjectState({ activeTasks: [...subjectState.activeTasks, { id: newId, task: '', level: '상' }] });
  };

  const removeTask = (index: number) => {
    if (subjectState.activeTasks.length > 1) {
      const newTasks = [...subjectState.activeTasks];
      newTasks.splice(index, 1);
      updateSubjectState({ activeTasks: newTasks });
    }
  };

  const updateTaskContent = (index: number, content: string) => {
    const newTasks = subjectState.activeTasks.map((t, i) =>
      i === index ? { ...t, task: content } : t
    );
    updateSubjectState({ activeTasks: newTasks });
  };

  const analyzeFile = async (base64Data: string, mimeType: string) => {
    setIsParsingFile(true);
    try {
        const results = await parseAssessmentTasks(base64Data, mimeType, subjectState.currentSubject);
        
        if (!results || results.length === 0) {
            notifyToast({ type: 'warning', title: '평가 과제를 찾을 수 없습니다.' });
            return;
        }

        const newDataStore = { ...subjectState.dataStore };
        let firstSubjectName = subjectState.currentSubject;

        results.forEach((res, idx) => {
            const subjName = res.subject || `분석된과목_${idx+1}`;
            if (idx === 0 && !firstSubjectName) firstSubjectName = subjName;

            const subjectStudents = subjectState.commonStudents.map(s => ({
                id: s.id,
                name: s.name,
                additionalContext: '',
                observationDetails: { process: '', attitude: '', skill: '', example: '' },
                evaluations: [],
                generatedContent: undefined,
                selected: false
            }));

            newDataStore[subjName] = {
                tasks: res.tasks,
                students: subjectStudents
            };
        });

        updateSubjectState({
            dataStore: newDataStore,
            currentSubject: firstSubjectName,
            activeTasks: newDataStore[firstSubjectName].tasks,
            activeStudents: newDataStore[firstSubjectName].students,
            isDirectInput: !currentSubjectList.includes(firstSubjectName)
        });
        
    } catch (err: any) {
        const error = err;
        const errorMessage = error instanceof Error ? error.message : String(error as any);
        console.error("File Parse Error:", errorMessage);
        notifyToast({ type: 'error', title: "파일에서 평가 과제를 추출하지 못했습니다." });
    } finally {
        setIsParsingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      notifyToast({ type: 'warning', title: '이미지 파일 또는 PDF 파일만 업로드 가능합니다.' });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setUploadedFile({ data: base64Data, type: file.type });
        await analyzeFile(base64Data, file.type);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      const error = err;
      const errorMessage = error instanceof Error ? error.message : String(error as any);
      console.error(errorMessage);
      notifyToast({ type: 'error', title: '파일 처리 중 오류가 발생했습니다.' });
    }
  };

  const handleDetailChange = (field: keyof ObservationDetails, value: string) => {
    const idx = subjectState.currentStudentIndex;
    const newStudents = subjectState.activeStudents.map((s, i) => {
      if (i !== idx) return s;
      const observationDetails = { ...EMPTY_OBSERVATION_DETAILS, ...s.observationDetails, [field]: value };
      return { ...s, observationDetails, additionalContext: buildContextFromDetails(observationDetails) };
    });
    updateSubjectState({ activeStudents: newStudents });
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

      const extractedText = await parseStudentObservationFromFiles(filesToAnalyze, `${subjectState.currentSubject} 교과세특 - 구체적 사례`);
      if (!extractedText.trim()) {
        notifyToast({ type: 'warning', title: '파일에서 관찰 내용을 분석하지 못했습니다.' });
        return;
      }

      const idx = subjectState.currentStudentIndex;
      const newStudents = subjectState.activeStudents.map((s, i) => {
        if (i !== idx) return s;
        const previous = { ...EMPTY_OBSERVATION_DETAILS, ...s.observationDetails };
        const observationDetails = {
          ...previous,
          example: previous.example ? `${previous.example}\n\n${extractedText.trim()}` : extractedText.trim(),
        };
        return { ...s, observationDetails, additionalContext: buildContextFromDetails(observationDetails) };
      });
      updateSubjectState({ activeStudents: newStudents });
      notifyToast({ type: 'success', title: '학생 기록물 분석이 완료되었습니다. 내용을 확인해주세요.' });
    } catch (err: any) {
      console.error('Observation File Analysis Error:', err);
      notifyToast({ type: 'error', title: '파일 분석 중 오류가 발생했습니다.' });
    } finally {
      setIsAnalyzingObservation(false);
      if (observationFileInputRef.current) observationFileInputRef.current.value = '';
    }
  };

  const handleLevelChange = (taskId: string, level: '상' | '중' | '하') => {
    const idx = subjectState.currentStudentIndex;
    const newStudents = subjectState.activeStudents.map((s, i) => {
      if (i !== idx) return s;
      const evaluations = s.evaluations ?? [];
      return {
        ...s,
        evaluations: evaluations.some(e => e.id === taskId)
          ? evaluations.map(e => (e.id === taskId ? { ...e, level } : e))
          : [...evaluations, { id: taskId, level }],
      };
    });
    updateSubjectState({ activeStudents: newStudents });
  };

  const getStudentLevel = (taskId: string): '상' | '중' | '하' => {
    const student = subjectState.activeStudents[subjectState.currentStudentIndex];
    const evaluation = student.evaluations?.find(e => e.id === taskId);
    return evaluation?.level || '상';
  };

  const toggleSelection = (index: number) => {
    if (isGlobalGenerating) return;
    const newStudents = [...subjectState.activeStudents];
    newStudents[index] = { ...newStudents[index], selected: !newStudents[index].selected };
    updateSubjectState({ activeStudents: newStudents });
  };

  const toggleAllSelection = (checked: boolean) => {
    if (isGlobalGenerating) return;
    const newStudents = subjectState.activeStudents.map(s => ({ ...s, selected: checked }));
    updateSubjectState({ activeStudents: newStudents });
  };

  const handleGenerateAll = async () => {
    if (!subjectState.currentSubject) return;

    setIsGlobalGenerating(true);
    setIsGenerating(true);
    setGlobalProgress(0);
    startGeneration(0);
    const newStudents = [...subjectState.activeStudents];
    let completedCount = 0;

    try {
        for (let i = 0; i < newStudents.length; i++) {
            if (isCancelRequested()) break;
            const student = newStudents[i];
            let mergedTasks = subjectState.activeTasks.map(t => {
                const studentEval = student.evaluations?.find(e => e.id === t.id);
                return { ...t, level: studentEval ? studentEval.level : '상' };
            });
            mergedTasks = mergedTasks.sort(() => Math.random() - 0.5);
            try {
              const { text: result, model, privacyApplied } = await prepareAndRunWithAbort(
                callWithAbort,
                () => getStudentGenerationExtras(student.name),
                extras => generateSubjectReport({
                  schoolLevel,
                  studentName: student.name,
                  subject: subjectState.currentSubject,
                  tasks: mergedTasks,
                  additionalContext: student.additionalContext,
                  lengthOption: subjectState.lengthOption as LengthOption,
                  customLength: subjectState.customLength as number,
                  lengthUnit: subjectState.lengthUnit as LengthUnit,
                  ...extras
                }),
              );
              newStudents[i] = { ...newStudents[i], generatedContent: result, generatedModel: model, privacyApplied };
              queueViolationWarning(showToast, newStudents[i].name, result);
              saveHistory('subject', student.name, result);
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
        updateSubjectState({ activeStudents: newStudents, step: 'RESULT' });
    } catch (err: any) {
        if (!(err instanceof Error && err.message === 'CANCELLED')) {
          console.error(err instanceof Error ? err.message : String(err));
          notifyToast({ type: 'error', title: "생성 중 오류가 발생했습니다." });
        }
        updateSubjectState({ activeStudents: newStudents, step: 'RESULT' });
    } finally {
        setIsGlobalGenerating(false);
        setIsGenerating(false);
        setGlobalProgress(0);
        endGeneration();
    }
  };

  const handleGenerateSelected = async () => {
    const selectedIndices = subjectState.activeStudents
        .map((s, i) => s.selected ? i : -1)
        .filter(i => i !== -1);

    if (selectedIndices.length === 0) {
        notifyToast({ type: 'warning', title: "선택된 학생이 없습니다." });
        return;
    }

    if (!subjectState.currentSubject) return;

    setIsGlobalGenerating(true);
    setIsGenerating(true);
    setGlobalProgress(0);
    startGeneration(0);
    const newStudents = [...subjectState.activeStudents];
    let completedCount = 0;

    try {
        for (let i = 0; i < selectedIndices.length; i++) {
            if (isCancelRequested()) break;
            const index = selectedIndices[i];
            const student = newStudents[index];
            let mergedTasks = subjectState.activeTasks.map(t => {
                const studentEval = student.evaluations?.find(e => e.id === t.id);
                return { ...t, level: studentEval ? studentEval.level : '상' };
            });
            mergedTasks = mergedTasks.sort(() => Math.random() - 0.5);
            try {
              const { text: result, model, privacyApplied } = await prepareAndRunWithAbort(
                callWithAbort,
                () => getStudentGenerationExtras(student.name),
                extras => generateSubjectReport({
                  schoolLevel,
                  studentName: student.name,
                  subject: subjectState.currentSubject,
                  tasks: mergedTasks,
                  additionalContext: student.additionalContext,
                  lengthOption: subjectState.lengthOption as LengthOption,
                  customLength: subjectState.customLength as number,
                  lengthUnit: subjectState.lengthUnit as LengthUnit,
                  ...extras
                }),
              );
              newStudents[index] = { ...newStudents[index], generatedContent: result, generatedModel: model, privacyApplied };
              queueViolationWarning(showToast, newStudents[index].name, result);
              saveHistory('subject', student.name, result);
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
        updateSubjectState({ activeStudents: newStudents, step: 'RESULT' });
    } catch (err: any) {
        if (!(err instanceof Error && err.message === 'CANCELLED')) {
          console.error(err instanceof Error ? err.message : String(err));
          notifyToast({ type: 'error', title: "생성 중 오류가 발생했습니다." });
        }
        updateSubjectState({ activeStudents: newStudents, step: 'RESULT' });
    } finally {
        setIsGlobalGenerating(false);
        setIsGenerating(false);
        setGlobalProgress(0);
        endGeneration();
    }
  };

  const handleRegenerateOne = async (index: number) => {
    const student = subjectState.activeStudents[index];
    setGeneratingIds((prev: Set<string>) => new Set(prev).add(student.id));

    const avoidPhrases = student.generatedContent 
        ? student.generatedContent.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length > 10)
        : [];

    try {
      let mergedTasks = subjectState.activeTasks.map(t => {
          const studentEval = student.evaluations?.find(e => e.id === t.id);
          return {
              ...t,
              level: studentEval ? studentEval.level : '상'
          };
      });

      mergedTasks = mergedTasks.sort(() => Math.random() - 0.5);

      const { text: result, model, privacyApplied } = await prepareAndRunWithAbort(
        callWithAbort,
        () => getStudentGenerationExtras(student.name),
        extras => generateSubjectReport({
          schoolLevel,
          studentName: student.name,
          subject: subjectState.currentSubject,
          tasks: mergedTasks,
          additionalContext: student.additionalContext,
          lengthOption: subjectState.lengthOption as LengthOption,
          customLength: subjectState.customLength as number,
          lengthUnit: subjectState.lengthUnit as LengthUnit,
          avoidPhrases,
          ...extras
        }),
      );

      const newStudents = [...subjectState.activeStudents];
      newStudents[index] = { ...newStudents[index], generatedContent: result, generatedModel: model, privacyApplied };
      queueViolationWarning(showToast, newStudents[index].name, result);
      saveHistory('subject', subjectState.activeStudents[index].name, result);
      updateSubjectState({ activeStudents: newStudents });
      playSuccessSound();

    } catch (err: any) {
      const error = err;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== 'CANCELLED') {
        console.error(errorMessage);
        notifyToast({ type: 'error', title: "재생성 중 오류가 발생했습니다." });
      }
    } finally {
      setGeneratingIds((prev: Set<string>) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    }
  };

  const handleResultChange = (index: number, text: string) => {
    const newStudents = [...subjectState.activeStudents];
    newStudents[index] = { ...newStudents[index], generatedContent: text };
    updateSubjectState({ activeStudents: newStudents });
  };

  const handleCopy = async (text: string, id: string) => {
    if (!text) return;
    if (!await copyPlainTextToClipboard(text)) {
      notifyToast({ type: 'error', title: '클립보드 복사에 실패했습니다.' });
      return;
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 현재 교과의 모든 학생 결과를 한 번에 클립보드에 복사
  const handleCopyAll = async () => {
    const text = subjectState.activeStudents
      .filter(s => s.generatedContent)
      .map(s => `[${s.name}]\n${s.generatedContent}`)
      .join('\n\n');
    if (!text) return;
    if (!await copyPlainTextToClipboard(text)) {
      notifyToast({ type: 'error', title: '클립보드 복사에 실패했습니다.' });
      return;
    }
    setCopiedId('__ALL__');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const checkDuplicates = () => {
    try {
      const sentenceMap = new Map<string, string[]>();
      
      subjectState.activeStudents.forEach(student => {
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
      notifyToast({ type: 'error', title: "중복 검사 중 오류가 발생했습니다." });
    }
  };

  const downloadExcel = async () => {
    try {
        const subjectsToExport = Object.keys(subjectState.dataStore);
        if (subjectState.currentSubject && !subjectsToExport.includes(subjectState.currentSubject)) {
            subjectsToExport.push(subjectState.currentSubject);
        }
        if (subjectsToExport.length === 0) { notifyToast({ type: 'warning', title: "다운로드할 데이터가 없습니다." }); return; }
        const header = ['교과', '학생명', '생성된 세특', '평가과제(요약)', '추가 관찰내용'];
        const rows: string[][] = [];
        subjectsToExport.forEach(subj => {
            let data: any;
            if (subj === subjectState.currentSubject) {
                data = { tasks: subjectState.activeTasks, students: subjectState.activeStudents };
            } else {
                data = subjectState.dataStore[subj];
            }
            if (!data || data.students.length === 0) return;
            data.students.forEach((s: StudentSubjectData) => {
                const tasksSummary = data.tasks.map((t: AssessmentTask) => {
                    const studentEval = s.evaluations?.find((e: any) => e.id === t.id);
                    const level = studentEval ? studentEval.level : '상';
                    return t.task + '(' + level + ')';
                }).join(' / ');
                rows.push([subj, s.name, s.generatedContent || '', tasksSummary, s.additionalContext || '']);
            });
        });
        if (rows.length === 0) { notifyToast({ type: 'warning', title: "다운로드할 데이터가 없습니다." }); return; }
        await window.electronAPI.saveCsv(toCsv([header, ...rows]), '전체교과_세특_' + new Date().toISOString().slice(0,10) + '.csv');
    } catch (e) {
        console.error("CSV download error:", e);
        notifyToast({ type: 'error', title: "파일 생성 중 오류가 발생했습니다." });
    }
  };

  const downloadCurrentSubjectExcel = async () => {
    try {
        const header = ['학생명', '생성된 세특', '평가과제(요약)', '추가 관찰내용'];
        const rows = subjectState.activeStudents.map((s: StudentSubjectData) => {
            const tasksSummary = subjectState.activeTasks.map((t: AssessmentTask) => {
                const studentEval = s.evaluations?.find(e => e.id === t.id);
                const level = studentEval ? studentEval.level : '상';
                return `${t.task}(${level})`;
            }).join(' / ');
            return [s.name, s.generatedContent || '', tasksSummary, s.additionalContext || ''];
        });
        if (rows.length === 0) { notifyToast({ type: 'warning', title: "다운로드할 데이터가 없습니다." }); return; }
        await window.electronAPI.saveCsv(toCsv([header, ...rows]), `${subjectState.currentSubject}_세특_${new Date().toISOString().slice(0,10)}.csv`);
    } catch (e) {
        console.error("CSV download error:", e);
        notifyToast({ type: 'error', title: "파일 생성 중 오류가 발생했습니다." });
    }
  };

  const nextStep = () => {
      if (subjectState.step === 'STUDENT_SETUP') {
          initializeCommonStudents();
      } else if (subjectState.step === 'GLOBAL_SETUP') {
          if (!subjectState.currentSubject || !subjectState.currentSubject.trim()) {
              notifyToast({ type: 'warning', title: "교과목을 선택하거나 입력해주세요." });
              return;
          }
          const validTasks = subjectState.activeTasks.filter(t => t.task && t.task.trim().length > 0);
          if (validTasks.length === 0) {
              notifyToast({ type: 'warning', title: "최소 하나 이상의 평가 과제(활동) 내용을 입력해주세요." });
              return;
          }
          if (validTasks.length !== subjectState.activeTasks.length) {
              updateSubjectState({ activeTasks: validTasks });
          }
          updateSubjectState({ step: 'INDIVIDUAL_CONTEXT', currentStudentIndex: 0 });
      }
  };

  // Get current observation details safely
  const currentDetails = subjectState.activeStudents[subjectState.currentStudentIndex]?.observationDetails || { process: '', attitude: '', skill: '', example: '' };

  const renderSubjectTabs = () => {
      const tabs = Object.keys(subjectState.dataStore);
      if (tabs.length === 0 && !subjectState.currentSubject) return null;

      const allTabs = [...tabs];
      if (subjectState.currentSubject && !allTabs.includes(subjectState.currentSubject)) {
          allTabs.push(subjectState.currentSubject);
      }

      return (
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {allTabs.map((subj) => (
                <div key={subj} className="relative group">
                    <button
                        onClick={() => switchSubject(subj)}
                        disabled={isGlobalGenerating}
                        className={`px-4 py-2 pr-8 rounded-lg text-sm font-bold whitespace-nowrap transition-all border ${
                            subjectState.currentSubject === subj
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                : 'bg-white dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:bg-[#EDE8E1] dark:hover:bg-[#3A332D]'
                        } ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={isGlobalGenerating ? "생성 중에는 전환할 수 없습니다." : subj}
                    >
                        {subj}
                    </button>
                    {/* Delete Button */}
                    <button
                        onClick={(e) => deleteSubject(e, subj)}
                        disabled={isGlobalGenerating}
                        className={`absolute right-1 top-1/2 transform -translate-y-1/2 p-1 rounded-full text-[#A8A29E] hover:text-white hover:bg-red-500/50 transition-colors ${isGlobalGenerating ? 'hidden' : ''}`}
                        title="과목 삭제"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>
            ))}
            <button
                onClick={() => {
                    if (isGlobalGenerating) return;
                    
                    const newDataStore = { ...subjectState.dataStore };
                    if (subjectState.currentSubject) {
                        newDataStore[subjectState.currentSubject] = {
                            tasks: subjectState.activeTasks,
                            students: subjectState.activeStudents
                        };
                    }

                    updateSubjectState({
                        dataStore: newDataStore,
                        currentSubject: '',
                        isDirectInput: false,
                        step: 'GLOBAL_SETUP',
                        activeTasks: [{ id: (Date.now()).toString(), task: '', level: '상' }],
                        activeStudents: subjectState.commonStudents.map(s => ({...s, additionalContext: '', observationDetails: { process: '', attitude: '', skill: '', example: '' }, evaluations: [], selected: false }))
                    });
                }}
                disabled={isGlobalGenerating}
                className={`px-3 py-2 rounded-lg bg-[#EDE8E1] dark:bg-[#221E1B] text-[#78716C] dark:text-[#9C8F87] border border-dashed border-[#E7E5E4] dark:border-[#2E2822] hover:bg-[#EDE8E1] dark:hover:bg-[#2E2822] transition-colors flex items-center ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="새 교과목 추가"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                과목 추가
            </button>
        </div>
      );
  };

  return (
    <div className="bg-white dark:bg-[#221E1B] h-full flex flex-col transition-colors relative">
      <div data-tour="subject-gen-header" className="bg-white/80 dark:bg-[#221E1B]/80 backdrop-blur-sm p-4 border-b border-[#EDE8E1] dark:border-[#2E2822] sticky top-0 z-10">
        <div className="flex justify-between items-center">
            <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mr-3 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <div>
                    <h2 className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-lg">교과학습발달상황(세특) 생성</h2>
                    <div className="flex items-center space-x-2 text-xs text-[#78716C] dark:text-[#9C8F87] font-medium hidden sm:flex">
                        <span className={subjectState.step === 'STUDENT_SETUP' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>1. 인원 설정</span>
                        <span>&gt;</span>
                        <span className={subjectState.step === 'GLOBAL_SETUP' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>2. 과제 설정</span>
                        <span>&gt;</span>
                        <span className={subjectState.step === 'INDIVIDUAL_CONTEXT' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>3. 개별 평가</span>
                        <span>&gt;</span>
                        <span className={subjectState.step === 'RESULT' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>4. 결과</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => startTour('subject-gen')}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                <HelpCircle className="w-3 h-3" />튜토리얼
              </button>
              {subjectState.step === 'RESULT' && (
                <button
                  onClick={() => updateSubjectState({ step: 'INDIVIDUAL_CONTEXT' })}
                  disabled={isGlobalGenerating}
                  className={`text-sm text-[#78716C] underline hover:text-purple-600 ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    수정하기
                </button>
              )}
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
         {subjectState.step === 'STUDENT_SETUP' && (
             <div data-tour="subject-gen-setup" className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl mx-auto space-y-8">
                    {/* New NEIS Upload Button */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-6 text-center shadow-sm">
                        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mb-2">
                            나이스(NEIS) 개인별 성적 자료가 있으신가요?
                        </h3>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-4">
                            엑셀 파일을 업로드하면 학생 명단, 과목, 평가 과제 및 결과를 자동으로 분석하여 입력해드립니다.
                        </p>
                        <button
                            onClick={() => setShowNeisModal(true)}
                            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center mx-auto"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            나이스 성적 자료 업로드
                        </button>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-[#E7E5E4] dark:border-[#2E2822]"></div>
                        <span className="flex-shrink-0 mx-4 text-[#A8A29E] text-sm">또는 직접 입력하기</span>
                        <div className="flex-grow border-t border-[#E7E5E4] dark:border-[#2E2822]"></div>
                    </div>

                    <div>
                        <label className="block text-lg font-bold text-[#44403C] dark:text-[#C4B8B0] mb-4">
                            생성할 전체 학생 수는 몇 명인가요?
                        </label>
                        <div className="flex items-center space-x-4 bg-[#FAF9F7] dark:bg-[#221E1B] p-6 rounded-2xl border border-dashed border-[#E7E5E4] dark:border-[#2E2822] justify-center">
                            <button onClick={() => updateSubjectState({ studentCount: Math.max(1, subjectState.studentCount - 1) })} className="w-12 h-12 flex items-center justify-center bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl shadow-sm text-xl">-</button>
                            <input
                                type="number"
                                value={subjectState.studentCount}
                                onChange={handleCountChange}
                                className="w-32 text-center text-3xl font-bold bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-[#1C1917] dark:text-[#F0EBE6]"
                            />
                            <button onClick={() => updateSubjectState({ studentCount: subjectState.studentCount + 1 })} className="w-12 h-12 flex items-center justify-center bg-white dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl shadow-sm text-xl">+</button>
                        </div>
                    </div>
                    
                    <div>
                        <div className="mb-4">
                             <label className="block text-lg font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">
                                학생 이름을 입력해주세요 (공통 적용)
                            </label>
                            <p className="text-sm text-[#78716C] dark:text-[#9C8F87]">
                                학생 이름을 쉼표(,)로 구분하거나, <strong>엑셀/스프레드시트에서 복사해 붙여넣기</strong>할 수 있습니다. (모든 교과목 공통 적용) <br/>
                                <span className="text-purple-600 dark:text-purple-400 font-medium">(예: 김철수, 이영희, 박민수)</span>
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
                                updateSubjectState({ nameInput: names.join(', '), studentCount: names.length });
                            }}
                            className="mb-2 px-4 py-2 text-sm font-bold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                        >
                            우리반 학생 이름 자동 입력
                        </button>
                        <textarea
                            value={subjectState.nameInput}
                            onChange={handleNameInput}
                            placeholder="학생 1, 학생 2, 학생 3..."
                            className="w-full h-32 px-4 py-3 bg-[#FAF9F7] dark:bg-[#2E2822] border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl text-[#1C1917] dark:text-[#F0EBE6] focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none shadow-inner"
                        />
                    </div>

                    <div className="flex gap-4 mt-8">
                         <button onClick={nextStep} className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700">다음: 교과 및 과제 설정</button>
                    </div>
                </div>
            </div>
         )}

         {/* NEIS Upload Modal */}
         {showNeisModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-[#221E1B] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b border-[#EDE8E1] dark:border-[#2E2822] flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20">
                        <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-200 flex items-center">
                            <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center mr-2 text-emerald-600 dark:text-emerald-300">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                            </span>
                            나이스(NEIS) 성적 자료 업로드
                        </h3>
                        <button onClick={() => setShowNeisModal(false)} className="text-[#A8A29E] hover:text-[#78716C] dark:hover:text-[#C4B8B0]">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto flex-1 space-y-6">
                        <div className="bg-[#FAF9F7] dark:bg-[#2E2822]/30 p-4 rounded-xl text-sm space-y-2 border border-[#E7E5E4] dark:border-[#2E2822]">
                            <h4 className="font-bold text-[#1C1917] dark:text-[#C4B8B0] mb-2">📢 나이스 파일 다운로드 방법</h4>
                            <ol className="list-decimal pl-5 space-y-1 text-[#78716C] dark:text-[#C4B8B0]">
                                <li>나이스 접속 &gt; <strong>[성적]</strong> 메뉴 클릭</li>
                                <li><strong>[개인별 성적조회]</strong> 메뉴 선택</li>
                                <li>조회할 학기 선택 (1학기/2학기)</li>
                                <li><strong>모든 학생 이름 체크</strong></li>
                                <li><strong>[일괄출력]</strong> 버튼 클릭 후 <strong>[pdf저장]</strong></li>
                                <li>다운로드 받은 파일을 아래에 각각 업로드해주세요.</li>
                            </ol>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                            ⚠️ 업로드한 파일은 개인정보 보호 모드와 무관하게 학생 이름이 가려지지 않고 원본 그대로 AI에 전송됩니다.
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border-2 border-dashed border-[#E7E5E4] dark:border-[#2E2822] rounded-xl p-6 text-center hover:border-emerald-500 transition-colors">
                                <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-2">1학기 성적 파일</p>
                                <input 
                                    type="file" 
                                    id="neis-file-1"
                                    className="hidden" 
                                    accept=".xls,.xlsx,.pdf"
                                    onChange={(e) => handleNeisUpload(e, 1)}
                                />
                                <label htmlFor="neis-file-1" className="cursor-pointer">
                                    {neisFile1 ? (
                                        <div className="text-emerald-600 dark:text-emerald-400 font-medium break-all">
                                            ✅ {neisFile1.name}
                                        </div>
                                    ) : (
                                        <div className="px-4 py-2 bg-[#EDE8E1] dark:bg-[#2E2822] text-[#78716C] dark:text-[#9C8F87] rounded-lg text-sm inline-block">
                                            파일 선택
                                        </div>
                                    )}
                                </label>
                            </div>

                            <div className="border-2 border-dashed border-[#E7E5E4] dark:border-[#2E2822] rounded-xl p-6 text-center hover:border-emerald-500 transition-colors">
                                <p className="font-bold text-[#44403C] dark:text-[#C4B8B0] mb-2">2학기 성적 파일</p>
                                <input 
                                    type="file" 
                                    id="neis-file-2"
                                    className="hidden" 
                                    accept=".xls,.xlsx,.pdf"
                                    onChange={(e) => handleNeisUpload(e, 2)}
                                />
                                <label htmlFor="neis-file-2" className="cursor-pointer">
                                    {neisFile2 ? (
                                        <div className="text-emerald-600 dark:text-emerald-400 font-medium break-all">
                                            ✅ {neisFile2.name}
                                        </div>
                                    ) : (
                                        <div className="px-4 py-2 bg-[#EDE8E1] dark:bg-[#2E2822] text-[#78716C] dark:text-[#9C8F87] rounded-lg text-sm inline-block">
                                            파일 선택
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>
                        
                        <div className="text-xs text-[#78716C] dark:text-[#9C8F87] text-center">
                            ※ 업로드된 파일은 AI 분석에만 사용되며 서버에 저장되지 않습니다. <br/>
                            ※ 상(◎), 중(○), 하(△) 평가 결과를 자동으로 분석합니다. <br/>
                            ※ 반드시 실제 자료와 일치하는지 확인하시고 다음 단계로 진행하세요.
                        </div>
                    </div>

                    <div className="p-4 border-t border-[#EDE8E1] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#221E1B]/50 rounded-b-2xl flex justify-end gap-3">
                        <button
                            onClick={() => setShowNeisModal(false)}
                            className="px-4 py-2 bg-[#EDE8E1] dark:bg-[#2E2822] text-[#44403C] dark:text-[#C4B8B0] font-bold rounded-lg hover:bg-[#E7E5E4] dark:hover:bg-[#3A332D] transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleNeisAnalysis}
                            disabled={isAnalyzingNeis || (!neisFile1 && !neisFile2)}
                            className={`px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg transition-colors flex items-center ${isAnalyzingNeis || (!neisFile1 && !neisFile2) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
                        >
                            {isAnalyzingNeis ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    분석 중...
                                </>
                            ) : '업로드하고 분석하기'}
                        </button>
                    </div>
                </div>
            </div>
         )}

         {subjectState.step === 'GLOBAL_SETUP' && (
             <div data-tour="subject-gen-config" className="flex-1 overflow-y-auto p-6">
                 {/* ... Content of GLOBAL_SETUP step ... */}
                 <div className="max-w-4xl mx-auto space-y-6">
                     {/* Tab Navigation Area */}
                     {Object.keys(subjectState.dataStore).length > 0 && (
                         <div className="mb-4">
                             <label className="block text-xs font-bold text-[#78716C] dark:text-[#9C8F87] mb-2">작업 중인 교과목</label>
                             {renderSubjectTabs()}
                         </div>
                     )}

                     <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                         <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-lg">평가 과제(Assignments) 설정</h3>
                             <div className="flex gap-2">
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    className="hidden" 
                                    accept="image/*,application/pdf"
                                    onChange={handleFileUpload}
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isParsingFile}
                                    className="px-4 py-2 bg-white dark:bg-[#2E2822] text-purple-600 dark:text-purple-300 rounded-lg text-sm font-bold shadow-sm border border-[#E7E5E4] dark:border-[#2E2822] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] flex items-center"
                                >
                                    {isParsingFile ? (
                                      <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        과제 분석 중...
                                      </>
                                    ) : '📂 파일 업로드 (평가계획서 등)'}
                                </button>
                             </div>
                         </div>
                         
                         {isParsingFile && (
                            <div className="mb-4 p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-bold rounded-xl text-center animate-pulse">
                                📄 파일을 분석하여 평가 과제를 추출하고 있습니다...
                            </div>
                         )}
                         
                         <div className="mb-4">
                            <div>
                                <label className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0] mb-2">교과목</label>
                                <div className="flex gap-2">
                                    {subjectState.isDirectInput ? (
                                        <>
                                            <input
                                                type="text"
                                                value={subjectState.currentSubject}
                                                onChange={(e) => updateSubjectState({ currentSubject: e.target.value })}
                                                placeholder="교과목 직접 입력 (예: 심화수학I)"
                                                className="flex-1 px-4 py-3 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] shadow-sm"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => updateSubjectState({ isDirectInput: false, currentSubject: '' })}
                                                className="px-4 py-2 bg-[#EDE8E1] dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] rounded-xl font-bold hover:bg-[#EDE8E1] dark:hover:bg-[#3A332D] transition-colors whitespace-nowrap"
                                            >
                                                목록 선택
                                            </button>
                                        </>
                                    ) : (
                                        <select
                                            value={currentSubjectList.includes(subjectState.currentSubject) ? subjectState.currentSubject : ''}
                                            onChange={(e) => {
                                                if (e.target.value === 'direct') {
                                                    handleSubjectChange('', true);
                                                } else {
                                                    handleSubjectChange(e.target.value, false);
                                                }
                                            }}
                                            className="w-full px-4 py-3 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] shadow-sm appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled>교과목 선택</option>
                                            {currentSubjectList.map((subj) => (
                                                <option key={subj} value={subj}>{subj}</option>
                                            ))}
                                            <option value="direct">직접 입력...</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                         </div>

                         <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">평가 과제 목록 (자동 저장)</label>
                                <button onClick={addTask} className="text-xs font-bold text-purple-600 hover:bg-purple-100 px-2 py-1 rounded">+ 과제 추가</button>
                            </div>
                             {subjectState.activeTasks.map((item, index) => (
                                <div key={item.id} className="flex flex-col md:flex-row gap-3 p-3 bg-white dark:bg-[#221E1B] rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm items-center">
                                    <div className="flex-1 w-full">
                                        <input
                                            type="text"
                                            value={item.task}
                                            onChange={(e) => updateTaskContent(index, e.target.value)}
                                            placeholder={`평가 과제명 (예: 수행평가-논술쓰기) ${index + 1}`}
                                            className="w-full px-3 py-2 border-none focus:ring-0 bg-transparent text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-[#EDE8E1] dark:border-[#2E2822] pt-2 md:pt-0 md:pl-3">
                                        {subjectState.activeTasks.length > 1 && (
                                            <button onClick={() => removeTask(index)} className="text-[#A8A29E] hover:text-red-500 p-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                             ))}
                         </div>
                         <p className="text-xs text-[#A8A29E] mt-2">💡 교과목을 변경하면 해당 교과목의 과제 목록이 자동으로 불러와집니다.</p>
                     </div>
                     
                     <div className="flex gap-4">
                        <button onClick={() => updateSubjectState({ step: 'STUDENT_SETUP' })} className="flex-1 py-4 bg-[#EDE8E1] dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] font-bold rounded-xl">이전 (학생 설정)</button>
                        <button onClick={nextStep} className="flex-[2] py-4 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 transition-all">
                            다음: 개별 평가 입력
                        </button>
                     </div>
                 </div>
             </div>
         )}

         {subjectState.step === 'INDIVIDUAL_CONTEXT' && (
             <div className="flex-1 flex overflow-hidden flex-col">
                {/* Subject Tabs */}
                <div className="bg-[#FAF9F7] dark:bg-[#171210] border-b border-[#E7E5E4] dark:border-[#2E2822] px-4 pt-3 pb-0">
                    <label className="block text-xs font-bold text-[#78716C] dark:text-[#9C8F87] mb-2">교과목 전환 (자동 저장됨)</label>
                    {renderSubjectTabs()}
                </div>

                <div className="flex-1 flex overflow-hidden">
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
                        <div className="p-4 border-b border-[#EDE8E1] dark:border-[#221E1B]">
                            <button
                                onClick={syncStudentsWithCommon}
                                disabled={isGlobalGenerating}
                                className={`w-full py-2 px-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center justify-center gap-1.5 ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="학생 설정 단계에서 수정한 명단으로 현재 과목의 학생 이름을 업데이트합니다."
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                공통 명단 불러오기
                            </button>
                        </div>
                        
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-[#A8A29E] uppercase tracking-wider">학생 목록</h3>
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={subjectState.activeStudents.length > 0 && subjectState.activeStudents.every(s => s.selected)}
                                            onChange={(e) => toggleAllSelection(e.target.checked)}
                                            className="w-3 h-3 text-purple-600 rounded border-[#E7E5E4] focus:ring-purple-500"
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
                                {subjectState.activeStudents.map((student, idx) => (
                                    <div key={student.id} className="flex items-center space-x-2">
                                        <input 
                                            type="checkbox" 
                                            checked={student.selected || false}
                                            onChange={() => toggleSelection(idx)}
                                            className="w-4 h-4 text-purple-600 rounded border-[#E7E5E4] focus:ring-purple-500"
                                        />
                                        <button
                                            onClick={() => updateSubjectState({ currentStudentIndex: idx })}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                subjectState.currentStudentIndex === idx
                                                ? 'bg-white dark:bg-[#221E1B] text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-[#E7E5E4] dark:ring-[#2E2822]'
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

                    <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#221E1B]">
                        {/* ... The content of the main area remains unchanged ... */}
                        <div className="max-w-4xl mx-auto">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#EDE8E1] dark:border-[#2E2822]">
                                <h3 className="text-xl font-bold text-[#1C1917] dark:text-[#F0EBE6]">
                                    <span className="text-purple-600 dark:text-purple-400">{subjectState.activeStudents[subjectState.currentStudentIndex].name}</span> 평가 및 관찰
                                </h3>
                                <div className="text-sm text-[#78716C]">{subjectState.currentStudentIndex + 1} / {subjectState.activeStudents.length}</div>
                            </div>
                            
                            {/* Evaluation Levels */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0] mb-2">과제별 수행 수준 ({subjectState.currentSubject})</label>
                                <div className="space-y-3">
                                    {subjectState.activeTasks.map((task) => (
                                        <div key={task.id} className="p-3 bg-[#FAF9F7] dark:bg-[#2E2822]/50 rounded-xl border border-[#E7E5E4] dark:border-[#2E2822]">
                                            <p className="text-sm text-[#44403C] dark:text-[#C4B8B0] mb-2 font-medium">{task.task || '(내용 없음)'}</p>
                                            <div className="flex gap-2">
                                                {(['상', '중', '하'] as const).map(lvl => {
                                                    const currentLevel = getStudentLevel(task.id);
                                                    return (
                                                        <button
                                                            key={lvl}
                                                            onClick={() => handleLevelChange(task.id, lvl)}
                                                            disabled={isGlobalGenerating}
                                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                                                currentLevel === lvl 
                                                                ? 'bg-purple-600 text-white shadow-md' 
                                                                : 'bg-white dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] border border-[#E7E5E4] dark:border-[#6B5E57] hover:bg-[#EDE8E1] dark:hover:bg-[#6B5E57]'
                                                            }`}
                                                        >
                                                            {lvl}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">
                                        추가 관찰 내용 <span className="text-xs font-normal text-[#A8A29E] ml-1">(선택 사항)</span>
                                    </label>
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
                                        className="px-3 py-1 bg-white dark:bg-[#2E2822] text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold shadow-sm border border-[#E7E5E4] dark:border-[#2E2822] hover:bg-[#FAF9F7] dark:hover:bg-[#3A332D] flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                                <p className="text-xs text-[#A8A29E] -mt-2 mb-3">※ 학생의 활동지·결과물을 스캔하거나 촬영해 업로드하면 AI가 내용을 분석해 "4. 구체적 사례"에 채워줍니다. 업로드된 파일은 분석에만 사용되며 저장되지 않지만, 개인정보 보호 모드와 무관하게 원본이 그대로 AI에 전송됩니다.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">1. 개별 학생의 실제 학습 과정</label>
                                        <textarea
                                            value={currentDetails.process}
                                            onChange={(e) => handleDetailChange('process', e.target.value)}
                                            disabled={isGlobalGenerating}
                                            placeholder="어떤 문제를 어떻게 해결하려고 노력했는지 서술"
                                            className="w-full h-28 px-3 py-2 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-[#FAF9F7] dark:bg-[#2E2822] resize-none disabled:opacity-50 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">2. 태도·참여 모습</label>
                                        <textarea
                                            value={currentDetails.attitude}
                                            onChange={(e) => handleDetailChange('attitude', e.target.value)}
                                            disabled={isGlobalGenerating}
                                            placeholder="수업 중 보인 흥미, 집중도, 협력 태도 등"
                                            className="w-full h-28 px-3 py-2 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-[#FAF9F7] dark:bg-[#2E2822] resize-none disabled:opacity-50 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">3. 기능 발달</label>
                                        <textarea
                                            value={currentDetails.skill}
                                            onChange={(e) => handleDetailChange('skill', e.target.value)}
                                            disabled={isGlobalGenerating}
                                            placeholder="교과 관련 기능이 어떻게 향상되었는지 기술"
                                            className="w-full h-28 px-3 py-2 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-[#FAF9F7] dark:bg-[#2E2822] resize-none disabled:opacity-50 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">4. 구체적 사례 기반의 기술</label>
                                        <textarea
                                            value={currentDetails.example}
                                            onChange={(e) => handleDetailChange('example', e.target.value)}
                                            disabled={isGlobalGenerating}
                                            placeholder="학생의 역량이 드러난 결정적인 장면이나 결과물"
                                            className="w-full h-28 px-3 py-2 border border-[#E7E5E4] dark:border-[#2E2822] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-[#FAF9F7] dark:bg-[#2E2822] resize-none disabled:opacity-50 text-sm"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-[#A8A29E] mt-2 text-right">※ 입력된 4가지 내용은 자동으로 합쳐져서 AI에게 전달됩니다.</p>
                            </div>

                            {/* Length Settings Reuse */}
                            <div className={`p-4 bg-[#FAF9F7] dark:bg-[#2E2822]/30 rounded-xl border border-dashed border-[#E7E5E4] dark:border-[#2E2822] mb-8 ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <label className="text-sm font-bold text-[#78716C] dark:text-[#C4B8B0]">생성 길이 설정 (전체 적용)</label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex space-x-3">
                                            {(['200', '300', '400', '500', 'custom'] as LengthOption[]).map((opt) => (
                                                <label key={opt} className="flex items-center cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="subjectLength" 
                                                        value={opt} 
                                                        checked={subjectState.lengthOption === opt} 
                                                        onChange={() => updateSubjectState({ lengthOption: opt })}
                                                        className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-[#E7E5E4]"
                                                    />
                                                    <span className="ml-1.5 text-sm text-[#78716C] dark:text-[#9C8F87]">
                                                        {opt === 'custom' ? '직접' : opt}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        {subjectState.lengthOption === 'custom' && (
                                            <input 
                                                type="number"
                                                value={subjectState.customLength}
                                                onChange={(e) => updateSubjectState({ customLength: Number(e.target.value) })}
                                                className="w-20 px-2 py-1 text-sm border rounded bg-white dark:bg-[#2E2822] dark:text-white"
                                            />
                                        )}
                                        <div className="flex bg-white dark:bg-[#2E2822] rounded-lg p-0.5 border border-[#E7E5E4] dark:border-[#6B5E57]">
                                            <button onClick={() => updateSubjectState({ lengthUnit: '자' })} className={`px-2 py-0.5 text-xs rounded ${subjectState.lengthUnit === '자' ? 'bg-purple-100 text-purple-700' : 'text-[#78716C]'}`}>자</button>
                                            <button onClick={() => updateSubjectState({ lengthUnit: 'byte' })} className={`px-2 py-0.5 text-xs rounded ${subjectState.lengthUnit === 'byte' ? 'bg-purple-100 text-purple-700' : 'text-[#78716C]'}`}>byte</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                {isGlobalGenerating && (
                                    <div className="w-full">
                                        <div className="flex justify-between text-xs text-[#78716C] mb-1">
                                            <span>진행률</span>
                                            <span>{globalProgress}%</span>
                                        </div>
                                        <div className="w-full bg-[#EDE8E1] dark:bg-[#2E2822] rounded-full h-2.5 overflow-hidden">
                                            <div 
                                                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                                style={{ width: `${globalProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => updateSubjectState({ step: 'GLOBAL_SETUP' })} 
                                        disabled={isGlobalGenerating}
                                        className="flex-1 py-4 bg-[#EDE8E1] dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                    >이전 (과제 설정)</button>
                                    <button
                                        onClick={handleGenerateSelected}
                                        disabled={isGlobalGenerating}
                                        className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center whitespace-nowrap px-1 text-sm sm:text-base"
                                    >
                                        {isGlobalGenerating ? '생성 중...' : `선택 학생(${subjectState.activeStudents.filter(s => s.selected).length}명) 생성`}
                                    </button>
                                    <button
                                        onClick={handleGenerateAll}
                                        disabled={isGlobalGenerating}
                                        className="flex-[2] bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg flex justify-center items-center hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap px-1 text-sm sm:text-base"
                                    >
                                        {isGlobalGenerating ? (
                                            '생성 중...'
                                        ) : (
                                            `전체 학생(${subjectState.activeStudents.length}명) 생성`
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
             </div>
         )}

         {/* ... (Rest of file content) ... */}
         {subjectState.step === 'RESULT' && (
             <div data-tour="subject-gen-result" className="flex-1 overflow-hidden flex flex-col">
                 <div className="bg-[#FAF9F7] dark:bg-[#171210] border-b border-[#E7E5E4] dark:border-[#2E2822] px-4 pt-3 pb-0">
                    <label className="block text-xs font-bold text-[#78716C] dark:text-[#9C8F87] mb-2">교과목 전환 (결과 화면)</label>
                    {renderSubjectTabs()}
                </div>

                <div className="p-4 bg-white dark:bg-[#221E1B] border-b border-[#E7E5E4] dark:border-[#2E2822] flex justify-between items-center flex-wrap gap-2">
                    <h3 className="font-bold text-[#44403C] dark:text-[#C4B8B0]">
                        <span className="text-purple-600 dark:text-purple-400">[{subjectState.currentSubject}]</span> 생성 결과
                    </h3>
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
                            중복 검사
                        </button>
                        <button
                            onClick={downloadCurrentSubjectExcel}
                            disabled={isGlobalGenerating}
                            className={`px-4 py-2 bg-[#78716C] text-white text-sm font-bold rounded-lg hover:bg-[#44403C] transition-colors flex items-center shadow-md ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="현재 보고 있는 교과목의 데이터만 엑셀 파일로 다운로드합니다."
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5l3 3m0 0l3-3m-3 3v-6m1.06-4.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 4.5v15a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 19.5V9.75a2.25 2.25 0 00-.66-1.59l-2.12-2.12" />
                            </svg>
                            현 교과 엑셀 저장
                        </button>
                        <button
                            onClick={downloadExcel}
                            disabled={isGlobalGenerating}
                            className={`px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center shadow-md ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : 'animate-pulse hover:animate-none'}`}
                            title="모든 교과의 데이터를 하나의 엑셀 파일(교과별 시트)로 다운로드합니다."
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            전 교과 엑셀 저장
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {subjectState.activeStudents.map((student, idx) => (
                        <div key={student.id} className="bg-[#FAF9F7] dark:bg-[#221E1B]/50 p-6 rounded-2xl border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm">
                             <div className="flex justify-between mb-4">
                                <h4 className="font-bold text-lg text-[#1C1917] dark:text-[#F0EBE6] flex items-center">
                                    <span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mr-3 text-sm">
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
                                            ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400'
                                            : 'bg-white border-[#E7E5E4] text-[#78716C] hover:bg-[#FAF9F7] dark:bg-[#2E2822] dark:border-[#2E2822] dark:text-[#C4B8B0] dark:hover:bg-[#3A332D]'
                                        } ${isGlobalGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {copiedId === student.id ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1.5 text-purple-600 dark:text-purple-400">
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
                                      const hist = getHistory('subject', student.name);
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
                                        className={`text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium flex items-center px-3 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors ${(generatingIds.has(student.id) || isGlobalGenerating) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                    className="w-full min-h-[120px] p-4 rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] text-[#1C1917] dark:text-[#F0EBE6] focus:ring-2 focus:ring-purple-500 focus:outline-none resize-y text-sm leading-relaxed"
                                 />
                                 <ByteCountBadge text={student.generatedContent || ''} limit={byteLimits.subject} />
                             </div>
                             {expandedHistory.has(student.id) && (() => {
                               const hist: HistoryEntry[] = getHistory('subject', student.name);
                               return hist.length > 0 ? (
                                 <div className="mt-3 space-y-2">
                                   <p className="text-xs font-bold text-[#A8A29E] dark:text-[#6B5E57] uppercase tracking-wide">이전 생성 기록</p>
                                   {hist.map((entry, hi) => (
                                     <div key={hi} className="rounded-xl border border-[#E7E5E4] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#171210]/40 p-3 text-sm text-[#78716C] dark:text-[#9C8F87]">
                                       <div className="flex justify-between items-center mb-1">
                                         <span className="text-xs text-[#A8A29E]">{new Date(entry.date).toLocaleString('ko-KR')}</span>
                                         <button
                                           onClick={() => { handleResultChange(idx, entry.content); setExpandedHistory(prev => { const next = new Set(prev); next.delete(student.id); return next; }); }}
                                           className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
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
      </div>

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
                            <p className="text-sm">모든 학생의 세특 내용이 고유하게 작성되었습니다.</p>
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
  );
};

export default SubjectGenerator;
